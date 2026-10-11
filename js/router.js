/* =====================================================================
   router.js – hash-based page switching without reload
   ---------------------------------------------------------------------
   URL scheme:  #/search            → page "search"
                #/forum/thread-2    → page "forum", params ["thread-2"]
                #/search?q=purge    → page "search", query { q: "purge" }

   Pages register themselves:
       Router.register('search', {
         title: 'SEARCH',
         render(container, ctx) { ... },   // ctx = { params, query, state }
         leave() { ... }                   // optional cleanup
       });
   ===================================================================== */

const Router = (() => {

  const pages = {};
  let current = null;          // { id, params, query }
  let container = null;
  const hooks = { before: [], after: [] };

  function register(id, def) {
    pages[id] = Object.assign({ title: id.toUpperCase() }, def);
  }

  function has(id) { return !!pages[id]; }

  function onBefore(fn) { hooks.before.push(fn); }
  function onAfter(fn) { hooks.after.push(fn); }

  function parseHash(hash) {
    let h = (hash || '').replace(/^#\/?/, '');
    let query = {};
    const qi = h.indexOf('?');
    if (qi >= 0) {
      new URLSearchParams(h.slice(qi + 1)).forEach((v, k) => { query[k] = v; });
      h = h.slice(0, qi);
    }
    const parts = h.split('/').filter(Boolean);
    return { id: parts[0] || 'home', params: parts.slice(1), query };
  }

  function buildHash(id, params = [], query = {}) {
    let h = '#/' + [id, ...params].join('/');
    const qs = new URLSearchParams(query).toString();
    if (qs) h += '?' + qs;
    return h;
  }

  function navigate(id, params, query) {
    const target = buildHash(id, params, query);
    if (location.hash === target) {
      resolve();               // same hash → re-render manually
    } else {
      location.hash = target;  // triggers hashchange → resolve()
    }
  }

  function refresh() {
    if (current) render(current);
  }

  function resolve() {
    const route = parseHash(location.hash);
    if (!pages[route.id]) {
      route.params = [route.id];
      route.id = 'error';
    }
    render(route);
  }

  function render(route) {
    const def = pages[route.id];
    if (!def) return;

    // cancel = a before-hook returned false (e.g. page locked)
    for (const fn of hooks.before) {
      if (fn(route, current) === false) return;
    }

    if (current && pages[current.id] && pages[current.id].leave) {
      try { pages[current.id].leave(); } catch (e) { console.error(e); }
    }

    current = route;
    container.innerHTML = '';
    container.scrollTop = 0;

    const page = document.createElement('div');
    page.className = 'page page-' + route.id;
    container.appendChild(page);

    const ctx = { params: route.params, query: route.query, state: State.getState() };
    try {
      def.render(page, ctx);
    } catch (e) {
      console.error('[router] render failed for', route.id, e);
      page.innerHTML = `<h1>ERROR</h1><pre class="danger">${escapeHtml(String(e && e.stack || e))}</pre>`;
    }

    updateNav(route.id);
    State.addVisit(route.id);
    hooks.after.forEach(fn => fn(route));
  }

  function updateNav(id) {
    document.querySelectorAll('#nav a[data-page]').forEach(a => {
      a.classList.toggle('active', a.dataset.page === id);
    });
  }

  function currentPage() { return current ? current.id : null; }

  function init(el) {
    container = el;
    window.addEventListener('hashchange', resolve);
    resolve();
  }

  // small shared helper (also exposed for pages)
  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  return { register, has, navigate, refresh, init, currentPage, onBefore, onAfter, buildHash, parseHash, escapeHtml };
})();

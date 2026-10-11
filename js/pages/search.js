/* pages/search.js – SEARCH
   #/search              → empty search + recent queries
   #/search?q=the+purge  → results for a query

   All results/effects/actions come from data/search-results.json.
   Flow per search:  log query → render results (pre-effect state) → apply
   effects → if a flag flipped, the page "corrects" itself after a delay
   (glitch + re-render). That delay is the moment the world reacts. */

const SearchData = {

  normalize(q) {
    return String(q || '').toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  },

  // Longest matching term wins; terms match on equality or containment.
  findQuery(q) {
    const data = Content.get('search');
    if (!data) return null;
    const n = this.normalize(q);
    let best = null, bestLen = 0;
    data.queries.forEach(def => {
      def.match.forEach(term => {
        const t = this.normalize(term);
        if ((n === t || n.includes(t)) && t.length > bestLen) { best = def; bestLen = t.length; }
      });
    });
    return best;
  },

  results(q, s) {
    const data = Content.get('search');
    const def = this.findQuery(q);
    if (!def) return { def: null, results: this.filler(q, s) };
    const results = Content.visible(def.results, s).map((r, i) => ({
      title: Content.text(r.title, `search.${def.id}.${i}.title`, s),
      route: r.route,
      snippet: Content.text(r.snippet, `search.${def.id}.${i}.snippet`, s)
    }));
    return { def, results };
  },

  // Unknown queries: sometimes nothing, sometimes 1–2 generic hits (seed+query stable)
  filler(q, s) {
    const data = Content.get('search');
    const n = this.normalize(q);
    const roll = Seed.intBetween(s.seed, 'search.filler.' + n, 0, 3);
    if (roll === 0 || n.length < 3) return [];
    return Seed.shuffle(s.seed, 'search.filler.order.' + n, data.filler).slice(0, roll === 3 ? 2 : 1);
  },

  noResultsText(q, s) {
    const data = Content.get('search');
    return Content.text(data.noResults, 'search.noresults.' + this.normalize(q), s);
  },

  // Returns true if any flag changed.
  applyEffects(def) {
    if (!def || !def.effects) return false;
    let changed = false;
    def.effects.forEach(e => {
      if (e.when && !Content.check(e.when)) return;
      if (e.setFlag && !State.getFlag(e.setFlag)) changed = State.tryUnlock(e.setFlag) || changed;
    });
    return changed;
  },

  actions(s) {
    const data = Content.get('search');
    return Content.visible(data.actions, s);
  }
};

Content.registerBuilder('search', (s) => ({ actions: SearchData.actions(s) }));

Router.register('search', {
  title: 'SEARCH',

  render(el, ctx) {
    const s = ctx.state;
    const q = ctx.query.q || '';

    el.innerHTML = `
      <h1>SEARCH</h1>
      <form id="search-form" autocomplete="off">
        <span class="prompt accent">&gt;</span>
        <input class="input" id="search-input" type="text" value="${UI.esc(q)}" placeholder="query the network index" spellcheck="false">
        <button class="btn" type="submit">search</button>
      </form>
      <div id="search-results"></div>
      <div id="search-actions"></div>
      <div id="search-recent"></div>
    `;

    const input = el.querySelector('#search-input');
    el.querySelector('#search-form').addEventListener('submit', ev => {
      ev.preventDefault();
      const query = input.value.trim();
      if (!query) return;
      State.addSearch(query);
      Router.navigate('search', [], { q: query });
    });

    if (q) this.renderResults(el, s, q);
    else input.focus();

    this.renderActions(el, s);
    this.renderRecent(el, s);
  },

  // a short "querying index" beat with disk noise, then the results
  renderResults(el, s, q) {
    const box = el.querySelector('#search-results');
    box.innerHTML = '<p class="dim typing">querying index<span class="dots"></span></p>';
    SFX.play('hdd');
    this._timer = setTimeout(() => this.showResults(el, s, q), 450 + Math.random() * 350);
  },

  showResults(el, s, q) {
    const box = el.querySelector('#search-results');
    const { def, results } = SearchData.results(q, s);

    box.innerHTML = this.resultsHtml(q, results, s);

    // world reacts: apply effects, then "correct" the page after a beat
    if (SearchData.applyEffects(def)) {
      this._timer = setTimeout(() => {
        if (Router.currentPage() !== 'search') return;
        FX.burst(300);
        SFX.play('static');
        const fresh = SearchData.results(q, State.getState());
        box.innerHTML = this.resultsHtml(q, fresh.results, State.getState(), true);
        this.renderActions(el, State.getState());
      }, 1600);
    }
  },

  resultsHtml(q, results, s, corrected = false) {
    const head = `<p class="dim">query: "${UI.esc(q)}" – ${results.length} result(s)` +
      (corrected ? ' <span class="warn">(index updated)</span>' : '') + '</p>';
    if (!results.length) {
      return head + `<pre class="dim">${UI.esc(SearchData.noResultsText(q, s))}</pre>`;
    }
    return head + '<ul class="results">' + results.map(r => `
      <li class="result">
        <a href="#/${r.route}">${UI.esc(r.title)}</a>
        <div class="faint">net://${UI.esc(r.route.split('?')[0])}</div>
        <div class="dim">${UI.esc(r.snippet)}</div>
      </li>`).join('') + '</ul>';
  },

  renderActions(el, s) {
    const box = el.querySelector('#search-actions');
    const actions = SearchData.actions(s);
    if (!actions.length) { box.innerHTML = ''; return; }
    box.innerHTML = actions.map(a => `
      <div class="action">
        <p class="warn">${UI.esc(a.hint || '')}</p>
        <button class="btn" data-action="${a.id}">${UI.esc(a.label)}</button>
      </div>`).join('');
    box.querySelectorAll('button[data-action]').forEach(btn => {
      btn.addEventListener('click', () => {
        const a = actions.find(x => x.id === btn.dataset.action);
        if (!a) return;
        const ok = a.setFlag ? State.tryUnlock(a.setFlag) : true;
        btn.disabled = true;
        FX.burst(300);
        SFX.play(ok ? 'unlock' : 'error');
        box.innerHTML = `<pre class="${ok ? 'accent' : 'danger'}">${UI.esc(
          ok ? Content.text(a.response, 'search.action.' + a.id) : 'Request denied.')}</pre>`;
      });
    });
  },

  renderRecent(el, s) {
    const box = el.querySelector('#search-recent');
    const recent = s.searchHistory.slice(-5).reverse();
    if (!recent.length) { box.innerHTML = ''; return; }
    box.innerHTML = UI.section('recent queries',
      '<ul class="list">' + recent.map(r =>
        `<li><a href="#/search?q=${encodeURIComponent(r.query)}">${UI.esc(r.query)}</a> ` +
        `<span class="faint">${UI.gameStamp(r.ts).slice(11)}</span></li>`).join('') + '</ul>');
  },

  leave() { clearTimeout(this._timer); }
});

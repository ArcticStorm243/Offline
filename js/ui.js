/* =====================================================================
   ui.js – small shared rendering helpers used by all pages
   ===================================================================== */

const UI = (() => {

  const esc = Router.escapeHtml;

  // In-game "now": the game world runs a fixed number of years ahead.
  // Real clock + offset so timestamps feel alive but stay in the 204x era.
  const YEAR_OFFSET = 15;
  function gameNow() {
    const d = new Date();
    d.setFullYear(d.getFullYear() + YEAR_OFFSET);
    return d;
  }

  function pad(n) { return String(n).padStart(2, '0'); }

  function fmtDate(d) {
    d = d instanceof Date ? d : new Date(d);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  function fmtTime(d) {
    d = d instanceof Date ? d : new Date(d);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  function fmtDateTime(d) { return fmtDate(d) + ' ' + fmtTime(d); }

  // real timestamp (ms) → in-game datetime string
  function gameStamp(ts) {
    const d = new Date(ts);
    d.setFullYear(d.getFullYear() + YEAR_OFFSET);
    return fmtDateTime(d);
  }

  // Resolves a content date spec (messages, forum posts):
  //   "2039-04-12 19:20"  → as is
  //   "rel:-3"            → "3 minutes ago"  (relative to now)
  //   "__SESSION__"       → game timestamp of save creation
  //   undefined           → the moment the item first became visible (State.noteSeen(key))
  function stamp(spec, key) {
    const s = State.getState();
    if (spec === '__SESSION__') return gameStamp(s.createdAt);
    if (typeof spec === 'string' && spec.startsWith('rel:')) {
      const m = Math.abs(parseInt(spec.slice(4), 10)) || 0;
      return m === 0 ? 'just now' : m === 1 ? '1 minute ago' : `${m} minutes ago`;
    }
    if (spec) return spec;
    return gameStamp(State.noteSeen(key));
  }

  function fmtSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1024 / 1024).toFixed(1) + ' MB';
  }

  // key/value block:  KEY ........ value
  function kv(rows) {
    return '<dl class="kv">' + rows.map(([k, v, cls]) =>
      `<dt>${esc(k)}</dt><dd class="${cls || ''}">${v}</dd>`).join('') + '</dl>';
  }

  // simple table; cells are already-escaped HTML
  function table(headers, rows, cls = '') {
    return `<table class="tbl ${cls}"><thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>` +
      `<tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  }

  function section(title, bodyHtml, cls = '') {
    return `<section class="sec ${cls}"><h2>${esc(title)}</h2>${bodyHtml}</section>`;
  }

  // ---------- typing effects (Paket 8) ----------

  // Reveals the text of an element character by character (works on HTML:
  // all text nodes are typed in document order, tags stay intact).
  // opts: charDelay (ms, default 28), jitter (ms), sound (name|null, default 'tick')
  // Returns { done: Promise, cancel() }.
  function typeText(target, opts = {}) {
    const charDelay = opts.charDelay !== undefined ? opts.charDelay : 28;
    const jitter = opts.jitter !== undefined ? opts.jitter : 14;
    const sound = opts.sound !== undefined ? opts.sound : 'tick';
    let timer = null, cancelled = false;

    const walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let n;
    while ((n = walker.nextNode())) nodes.push({ node: n, text: n.nodeValue });
    nodes.forEach(x => { x.node.nodeValue = ''; });

    const done = new Promise(resolve => {
      let ni = 0, ci = 0;
      const tick = () => {
        if (cancelled) return;
        while (ni < nodes.length && ci >= nodes[ni].text.length) { ni++; ci = 0; }
        if (ni >= nodes.length) { resolve(); return; }
        const ch = nodes[ni].text[ci++];
        nodes[ni].node.nodeValue += ch;
        if (sound && ch !== ' ' && typeof SFX !== 'undefined') SFX.play(sound);
        if (opts.onChar) opts.onChar();
        timer = setTimeout(tick, charDelay + (jitter ? Math.random() * jitter : 0));
      };
      tick();
    });
    return {
      done,
      cancel() {
        cancelled = true; clearTimeout(timer);
        nodes.forEach(x => { x.node.nodeValue = x.text; });   // show the rest instantly
      }
    };
  }

  // Line-by-line reveal with a typing cursor on the active line. Each line is
  // typed character by character (typeText), then the next one follows after
  // `delay` ms. A line may be a string or { html, cls, delay, sfx } –
  // `sfx` is played when the line starts.
  // opts: delay, firstDelay, keepCursor, charDelay, sound
  // Returns { done: Promise, cancel() }.
  function typeLines(container, lines, opts = {}) {
    const delay = opts.delay || 600;
    const first = opts.firstDelay !== undefined ? opts.firstDelay : delay;
    let timer = null, typer = null, cancelled = false;
    const done = new Promise(resolve => {
      let i = 0;
      const step = () => {
        if (cancelled) return;
        container.querySelectorAll('.line.cursor').forEach(l => l.classList.remove('cursor'));
        if (i >= lines.length) {
          if (opts.keepCursor !== false) container.insertAdjacentHTML('beforeend', '<span class="line cursor"></span>');
          resolve();
          return;
        }
        const l = lines[i++];
        const html = typeof l === 'string' ? esc(l) : l.html;
        container.insertAdjacentHTML('beforeend', `<span class="line cursor ${l.cls || ''}">${html}</span>`);
        const span = container.lastElementChild;
        if (l.sfx && typeof SFX !== 'undefined') SFX.play(l.sfx);
        typer = typeText(span, { charDelay: opts.charDelay, sound: opts.sound });
        typer.done.then(() => {
          if (cancelled) return;
          timer = setTimeout(step, (typeof l === 'object' && l.delay) || delay);
        });
      };
      timer = setTimeout(step, first);
    });
    return {
      done,
      cancel() { cancelled = true; clearTimeout(timer); if (typer) typer.cancel(); }
    };
  }

  return { esc, gameNow, gameStamp, stamp, fmtDate, fmtTime, fmtDateTime, fmtSize, kv, table, section, typeLines, typeText, YEAR_OFFSET };
})();

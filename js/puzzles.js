/* =====================================================================
   puzzles.js – puzzle logic with seed-chosen variants (Paket 6)
   ---------------------------------------------------------------------
   · freezes a puzzle's variant the first time the puzzle is "reached"
     (puzzles.json reachedWhen) → State.puzzleVariants, never re-rolled
   · sets `auto` flags (core_unlocked) as soon as requirements hold
   · validates player input for puzzle 4 (profile form) and watches the
     search history for the search-combination variant
   · exposes the active variant + personalised reference lines
   ===================================================================== */

const Puzzles = (() => {

  function data() { return Content.get('puzzles') || { puzzles: {} }; }
  function def(id) { return data().puzzles[id] || null; }

  // ---------- variants ----------

  function variant(id, s = State.getState()) {
    const p = def(id);
    if (!p || !p.variants) return null;
    const vid = s.puzzleVariants[id];
    return vid ? p.variants.find(v => v.id === vid) || null : null;
  }

  function freezeReached(s = State.getState()) {
    Object.entries(data().puzzles).forEach(([id, p]) => {
      if (!p.variants || State.hasVariant(id)) return;
      if (Content.check(p.reachedWhen, s)) {
        State.getVariant(id, p.variants.map(v => v.id));
      }
    });
  }

  function autoUnlock() {
    Object.entries(data().puzzles).forEach(([id, p]) => {
      if (p.auto && p.flag) State.tryUnlock(p.flag);
    });
  }

  function sync() {
    freezeReached();
    autoUnlock();
  }

  function solved(id) { const p = def(id); return !!(p && State.getFlag(p.flag)); }

  // ---------- puzzle 4: input verification ----------

  function codeword(s = State.getState()) {
    const v = variant('puzzle_4', s);
    if (!v || !v.codewords) return '';
    return Seed.pickVariant(s.seed, 'puzzle_4.codeword', v.codewords);
  }

  function normalize(x) { return String(x || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

  // returns true if `input` solves puzzle 4 in the active variant
  function attempt(id, input) {
    if (id !== 'puzzle_4') return false;
    const s = State.getState();
    const v = variant('puzzle_4', s);
    if (!v || solved('puzzle_4')) return false;

    let ok = false;
    if (v.solution === 'account_creation_date') {
      ok = normalize(input) === normalize(Profile.creationDate(s));
    } else if (v.solution === 'codeword_from_8471') {
      ok = normalize(input) === normalize(codeword(s));
    }

    State.logEvent('attempt', id + ':' + (ok ? 'ok' : 'fail'));
    if (ok) State.tryUnlock(v.flag || def(id).flag);
    return ok;
  }

  function failText(s = State.getState()) {
    return Content.text(data().attemptFailed || ['verification failed.'], 'puzzle.fail.' + s.eventLog.length, s);
  }

  // variant C: "shutdown" followed by a search for 0192
  function checkSearchCombo() {
    const s = State.getState();
    const v = variant('puzzle_4', s);
    if (!v || v.solution !== 'shutdown_then_0192' || solved('puzzle_4')) return;
    const h = s.searchHistory;
    if (h.length < 2) return;
    const last = normalize(h[h.length - 1].query);
    const prev = normalize(h[h.length - 2].query);
    if (prev === 'shutdown' && last.includes('0192')) {
      State.tryUnlock(def('puzzle_4').flag);
    }
  }

  // ---------- core screen: personalised reference ----------

  function references(s = State.getState()) {
    return ['puzzle_4', 'puzzle_5'].map(id => {
      const v = variant(id, s);
      return v && v.reference ? Content.text(v.reference, 'puzzle.ref.' + id, s) : null;
    }).filter(Boolean);
  }

  // ---------- init ----------

  function init() {
    Content.registerVar('codeword', codeword);
    sync();
    State.on('flag', sync);
    State.on('counter', sync);
    State.on('search', checkSearchCombo);
    State.on('reset', sync);
  }

  return { init, sync, variant, attempt, failText, codeword, solved, references, def };
})();

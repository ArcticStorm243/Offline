/* =====================================================================
   content.js – loads /data/*.json and assembles page content
   ---------------------------------------------------------------------
   Pages never hard-code if/else on flags. They call
       Content.getPageContent(pageId, state)
   which reads the JSON definitions and returns only what is currently
   visible/active for the given flags + seed variants.

   Paket 1: loader + generic helpers. Page-specific assembly is filled in
   during Paket 3–6 as the JSON files get their content.
   ===================================================================== */

const Content = (() => {

  const FILES = {
    flagsMap:  'data/flags-content-map.json',
    messages:  'data/messages.json',
    forum:     'data/forum.json',
    search:    'data/search-results.json',
    puzzles:   'data/puzzles.json',
    dialogue:  'data/dialogue.json',
    usernames: 'data/usernames.json',
    files:     'data/files.json',
    profile:   'data/profile.json',
    endings:   'data/endings.json'
  };

  const data = {};
  let loaded = false;
  let loadError = null;

  async function loadJSON(path) {
    const res = await fetch(path, { cache: 'no-store' });
    if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
    return res.json();
  }

  async function loadAll() {
    try {
      const entries = await Promise.all(
        Object.entries(FILES).map(async ([key, path]) => [key, await loadJSON(path)])
      );
      entries.forEach(([k, v]) => { data[k] = v; });
      loaded = true;
      if (data.flagsMap && data.flagsMap.requirements) {
        State.setRequirements(data.flagsMap.requirements);
      }
    } catch (e) {
      loadError = e;
      console.error('[content] failed to load data files', e);
    }
    return loaded;
  }

  // ---------- generic condition check ----------
  //
  // Condition objects used throughout the JSON files:
  //   { "flag": "chat_unlocked" }                  → flag must be true
  //   { "notFlag": "found_contradiction" }         → flag must be false
  //   { "all": ["a","b"] } / { "any": ["a","b"] }
  //   { "counter": "messages_with_8471", "min": 2 }
  //   { "variant": { "puzzle_5": "A" } }            → frozen variant must match
  //   null / undefined / {}                         → always true

  function check(cond, s = State.getState()) {
    if (!cond) return true;
    if (cond.flag !== undefined && !s.flags[cond.flag]) return false;
    if (cond.notFlag !== undefined && s.flags[cond.notFlag]) return false;
    if (cond.all && !cond.all.every(f => !!s.flags[f])) return false;
    if (cond.any && !cond.any.some(f => !!s.flags[f])) return false;
    if (cond.counter !== undefined && (s.counters[cond.counter] || 0) < (cond.min || 1)) return false;
    if (cond.variant) {
      for (const [pid, v] of Object.entries(cond.variant)) {
        if (s.puzzleVariants[pid] !== v) return false;
      }
    }
    return true;
  }

  // Filter a list of items with optional "when" conditions
  function visible(items, s) {
    return (items || []).filter(it => check(it.when, s));
  }

  // Pick a seed-stable text variant.
  // Accepts a string (returned as is) or an array of strings (one is chosen
  // deterministically by seed + poolId so it's the same on every reload).
  function text(value, poolId, s = State.getState()) {
    if (Array.isArray(value)) return Seed.pickVariant(s.seed, poolId, value);
    return value;
  }

  // ---------- template variables ----------
  // {{name}} inside content strings is replaced by registerVar(name, fn(state)).
  // Unknown names are left as-is (visible in the UI → easy to spot).

  const vars = {};
  function registerVar(name, fn) { vars[name] = fn; }
  function fill(str, s = State.getState()) {
    return String(str).replace(/\{\{(\w+)\}\}/g, (m, name) => vars[name] ? String(vars[name](s)) : m);
  }

  // ---------- page content assembly ----------
  // Each page-specific builder gets registered by the page module or by
  // later Pakete. Fallback returns the raw data slice.

  const builders = {};
  function registerBuilder(pageId, fn) { builders[pageId] = fn; }

  function getPageContent(pageId, s = State.getState()) {
    if (builders[pageId]) return builders[pageId](s, data);
    return data[pageId] || null;
  }

  function get(key) { return data[key]; }
  function isLoaded() { return loaded; }
  function getError() { return loadError; }

  return { loadAll, check, visible, text, fill, registerVar, registerBuilder, getPageContent, get, isLoaded, getError, FILES };
})();

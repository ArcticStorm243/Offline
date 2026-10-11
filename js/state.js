/* =====================================================================
   state.js – game state, flags, counters, save/load (LocalStorage)
   ---------------------------------------------------------------------
   Single source of truth for one playthrough. Everything that the world
   "remembers" about the player lives here and is persisted on every change.
   ===================================================================== */

const State = (() => {

  const SAVE_KEY = 'offline_save';
  const SAVE_VERSION = 1;

  const FLAG_NAMES = [
    'found_8471_profile',
    'received_first_message',
    'replied_to_8471',
    'chat_unlocked',
    'searched_purge',
    'read_purge_thread',
    'found_contradiction',
    'archive_file_purge_unlocked',
    'found_old_account_2038',
    'found_developer_proof',
    'core_unlocked'
  ];

  function defaultState(seed) {
    const flags = {};
    FLAG_NAMES.forEach(f => { flags[f] = false; });
    return {
      version: SAVE_VERSION,
      seed: seed,
      createdAt: Date.now(),
      flags: flags,
      counters: {
        messages_with_8471: 0,
        serverStatusStage: 0
      },
      searchHistory: [],   // [{ query, ts }]
      visitedPages: [],    // [{ page, ts }]   (last N, see MAX_LOG)
      messagesRead: [],    // [messageId]
      puzzleVariants: {},  // { puzzle_4: "B" }
      eventLog: [],        // [{ type, detail, ts }]  → profile "Recent activity"
      firstSeen: {},       // { key: ts } – when a message/post first became visible (stable timestamps)
      chat: {              // dialogue with 8471
        log: [],           //   [{ who: '8471'|'0192'|'sys', text, ts }]
        done: [],          //   completed node ids / groups
        opened: [],        //   node ids whose opening line was already shown
        pending: null      //   { nodeId, optionIndex } while 8471 is "typing"
      },
      endingChosen: null
    };
  }

  const MAX_LOG = 50;
  let state = null;
  const listeners = { change: [], flag: [], counter: [] };

  // ---------- events ----------

  function on(evt, fn) { (listeners[evt] || (listeners[evt] = [])).push(fn); }
  function emit(evt, payload) {
    (listeners[evt] || []).forEach(fn => { try { fn(payload); } catch (e) { console.error(e); } });
    if (evt !== 'change') emit('change', { evt, payload });
  }

  // ---------- persistence ----------

  function saveToLocalStorage() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch (e) {
      console.warn('[state] save failed', e);
    }
  }

  function loadFromLocalStorage() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed.seed !== 'number') return null;
      // merge with defaults so new fields added in later versions exist
      const merged = Object.assign(defaultState(parsed.seed), parsed);
      merged.flags = Object.assign({}, defaultState(parsed.seed).flags, parsed.flags || {});
      merged.counters = Object.assign({}, defaultState(parsed.seed).counters, parsed.counters || {});
      merged.chat = Object.assign(defaultState(parsed.seed).chat, parsed.chat || {});
      return merged;
    } catch (e) {
      console.warn('[state] load failed', e);
      return null;
    }
  }

  function hasSave() { return !!localStorage.getItem(SAVE_KEY); }

  function newGame() {
    state = defaultState(Seed.newSeed());
    saveToLocalStorage();
    emit('reset', state);
    return state;
  }

  function resetGame() {
    localStorage.removeItem(SAVE_KEY);
    return newGame();
  }

  // Load existing save or start fresh
  function init() {
    state = loadFromLocalStorage() || defaultState(Seed.newSeed());
    saveToLocalStorage();
    return state;
  }

  // ---------- accessors ----------

  function getState() { return state; }
  function getSeed() { return state.seed; }

  function getFlag(name) { return !!state.flags[name]; }

  function setFlag(name, value = true) {
    if (!(name in state.flags)) console.warn('[state] unknown flag', name);
    const prev = !!state.flags[name];
    state.flags[name] = !!value;
    if (prev !== !!value) {
      if (value) logEvent('flag', name);
      saveToLocalStorage();
      emit('flag', { name, value: !!value });
    }
  }

  function getCounter(name) { return state.counters[name] || 0; }

  function setCounter(name, value) {
    state.counters[name] = value;
    saveToLocalStorage();
    emit('counter', { name, value });
  }

  function incrementCounter(name, by = 1) {
    setCounter(name, getCounter(name) + by);
    return state.counters[name];
  }

  // ---------- requirement checks (generic, table-driven) ----------
  //
  // Requirements table lives in data/flags-content-map.json ("requirements")
  // and is injected via setRequirements(). Format per flag:
  //   { "all": ["flagA", "flagB"], "counters": { "messages_with_8471": 3 } }
  // "all"      → every flag must be true
  // "any"      → at least one flag must be true
  // "counters" → each counter must be >= given value
  // Missing entry or empty object → no prerequisite.

  let requirements = {};
  function setRequirements(table) { requirements = table || {}; }

  function canUnlock(flagName, s = state) {
    const req = requirements[flagName];
    if (!req) return true;
    if (req.all && !req.all.every(f => !!s.flags[f])) return false;
    if (req.any && !req.any.some(f => !!s.flags[f])) return false;
    if (req.counters) {
      for (const [c, min] of Object.entries(req.counters)) {
        if ((s.counters[c] || 0) < min) return false;
      }
    }
    return true;
  }

  // Sets the flag only if requirements are met. Returns true on success.
  function tryUnlock(flagName) {
    if (getFlag(flagName)) return true;
    if (!canUnlock(flagName)) return false;
    setFlag(flagName, true);
    return true;
  }

  // ---------- puzzle variants (frozen on first access) ----------

  function getVariant(puzzleId, optionIds) {
    if (state.puzzleVariants[puzzleId] !== undefined) return state.puzzleVariants[puzzleId];
    const chosen = Seed.pickVariant(state.seed, puzzleId, optionIds);
    state.puzzleVariants[puzzleId] = chosen;
    saveToLocalStorage();
    emit('variant', { puzzleId, variant: chosen });
    return chosen;
  }

  function hasVariant(puzzleId) { return state.puzzleVariants[puzzleId] !== undefined; }

  // ---------- activity logs ----------

  function pushLog(list, entry) {
    list.push(entry);
    if (list.length > MAX_LOG) list.splice(0, list.length - MAX_LOG);
  }

  function logEvent(type, detail) {
    pushLog(state.eventLog, { type, detail, ts: Date.now() });
  }

  function addSearch(query) {
    pushLog(state.searchHistory, { query, ts: Date.now() });
    logEvent('search', query);
    saveToLocalStorage();
    emit('search', query);
  }

  function addVisit(page) {
    pushLog(state.visitedPages, { page, ts: Date.now() });
    saveToLocalStorage();
  }

  function visitCount(page) {
    return state.visitedPages.filter(v => v.page === page).length;
  }

  function markMessageRead(id) {
    if (!state.messagesRead.includes(id)) {
      state.messagesRead.push(id);
      logEvent('read', id);
      saveToLocalStorage();
      emit('read', id);
    }
  }

  function isMessageRead(id) { return state.messagesRead.includes(id); }

  // Records (once) when something first became visible; returns that timestamp.
  function noteSeen(key) {
    if (!state.firstSeen[key]) {
      state.firstSeen[key] = Date.now();
      saveToLocalStorage();
    }
    return state.firstSeen[key];
  }

  // ---------- chat ----------

  function chatPush(who, text) {
    state.chat.log.push({ who, text, ts: Date.now() });
    if (who === '0192') incrementCounter('messages_with_8471');   // saves + emits
    else saveToLocalStorage();
    emit('chat', { who, text });
  }

  function chatMark(list, id) {   // list: 'done' | 'opened'
    if (!state.chat[list].includes(id)) { state.chat[list].push(id); saveToLocalStorage(); }
  }

  function chatSetPending(p) { state.chat.pending = p; saveToLocalStorage(); }

  function setEnding(id) {
    state.endingChosen = id;
    saveToLocalStorage();
    emit('ending', id);
  }

  function set(key, value) {  // generic setter for simple top-level fields (booted, ...)
    state[key] = value;
    saveToLocalStorage();
  }

  return {
    FLAG_NAMES,
    init, newGame, resetGame, hasSave,
    getState, getSeed, set,
    getFlag, setFlag, getCounter, setCounter, incrementCounter,
    setRequirements, canUnlock, tryUnlock,
    getVariant, hasVariant,
    logEvent, addSearch, addVisit, visitCount, markMessageRead, isMessageRead, noteSeen, setEnding,
    chatPush, chatMark, chatSetPending,
    saveToLocalStorage, loadFromLocalStorage,
    on
  };
})();

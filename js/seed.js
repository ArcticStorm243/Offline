/* =====================================================================
   seed.js – deterministic PRNG + variant selection
   ---------------------------------------------------------------------
   Every playthrough gets ONE seed (created on "New Game", never changed).
   pickVariant(seed, poolId, options) combines that seed with a string id
   (puzzle name, message id, ...) so the same save always yields the same
   variant for the same pool, while different pools get independent rolls.
   ===================================================================== */

const Seed = (() => {

  // mulberry32 – small, fast, good enough for game variants
  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // FNV-1a 32-bit string hash → number
  function hashString(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // A PRNG stream that is unique to (seed, poolId)
  function rngFor(seed, poolId) {
    const mixed = (seed ^ hashString(String(poolId))) >>> 0;
    const rng = mulberry32(mixed);
    rng(); // discard first value – improves spread for similar seeds
    return rng;
  }

  // Deterministic index in [0, length)
  function pickIndex(seed, poolId, length) {
    if (!length || length <= 0) return -1;
    return Math.floor(rngFor(seed, poolId)() * length);
  }

  // Deterministic element from options[]
  function pickVariant(seed, poolId, options) {
    if (!Array.isArray(options) || options.length === 0) return null;
    return options[pickIndex(seed, poolId, options.length)];
  }

  // Deterministic shuffle (Fisher-Yates) – returns a new array
  function shuffle(seed, poolId, array) {
    const rng = rngFor(seed, poolId);
    const out = array.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }

  // Deterministic integer in [min, max]
  function intBetween(seed, poolId, min, max) {
    return min + Math.floor(rngFor(seed, poolId)() * (max - min + 1));
  }

  // Fresh seed for a new game (31-bit positive int, easy to display/store)
  function newSeed() {
    return Math.floor(Math.random() * 0x7fffffff);
  }

  return { mulberry32, hashString, rngFor, pickIndex, pickVariant, shuffle, intBetween, newSeed };
})();

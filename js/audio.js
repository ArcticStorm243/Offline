/* =====================================================================
   audio.js – SFX (Paket 8)
   ---------------------------------------------------------------------
   All sounds are synthesised with the Web Audio API, so the game needs no
   audio files. Real recordings can replace any sound later:
       SFX.register('modem', 'assets/sounds/modem.ogg')
   Names used by the game:
     key      single keystroke (typed input)        keys   burst of keystrokes (send)
     tick     faint key tick (typing effects)       click  UI click / nav
     hdd      disk seek (open file, search)         modem  handshake (boot)
     notify   incoming mail                         unlock puzzle solved
     error    denied / wrong input                  static burst (status escalation)
     tone_delete | tone_stay | tone_escape          one low tone per ending
   Browsers only allow audio after a user gesture – the context is created on
   the first pointer/key event; calls before that are silently dropped.
   SFX.silence(ms) mutes everything (incl. the hum) for a moment – used at
   key story beats where the absence of sound is the effect.
   ===================================================================== */

const SFX = (() => {

  const KEY = 'offline_audio';
  const MASTER_GAIN = 0.45;

  let ctx = null, master = null, hum = null;
  let enabled = true;
  let silentUntil = 0, silenceTimer = null;
  let ticker = null;
  const files = {};           // name → url (optional real audio files)
  const listeners = [];       // onChange(enabled)

  try { enabled = localStorage.getItem(KEY) !== 'off'; } catch (e) {}

  // ---------- context ----------

  function ensure() {
    if (ctx) return ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = MASTER_GAIN;
    master.connect(ctx.destination);
    return ctx;
  }

  // first user gesture: create/resume the context and start the hum
  function unlock() {
    if (!ensure()) return;
    // resume() is async – start the hum once the context actually runs
    const p = ctx.state === 'suspended' ? ctx.resume() : Promise.resolve();
    p.then(humStart).catch(() => {});
    humStart();
  }

  function ready() { return !!ctx && ctx.state === 'running'; }
  function silent() { return Date.now() < silentUntil; }

  // ---------- small building blocks ----------

  let noiseBuf = null;
  function noise() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function env(gainNode, t, a, peak, d) {
    gainNode.gain.setValueAtTime(0.0001, t);
    gainNode.gain.linearRampToValueAtTime(peak, t + a);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }

  // filtered noise burst
  function burst(t, { dur = 0.03, gain = 0.3, type = 'bandpass', freq = 3000, q = 1 }) {
    const src = ctx.createBufferSource();
    src.buffer = noise();
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    env(g, t, 0.002, gain, dur);
    src.connect(f).connect(g).connect(master);
    src.start(t); src.stop(t + dur + 0.05);
  }

  function tone(t, { freq = 440, dur = 0.2, gain = 0.2, type = 'sine', attack = 0.005, to = null }) {
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = ctx.createGain();
    env(g, t, attack, gain, dur);
    o.connect(g).connect(master);
    o.start(t); o.stop(t + attack + dur + 0.05);
  }

  const rnd = (a, b) => a + Math.random() * (b - a);

  // ---------- the sounds ----------

  const GEN = {
    key(t)   { burst(t, { dur: 0.025, gain: 0.35, freq: rnd(2500, 4500), q: 0.8 }); tone(t, { freq: rnd(1800, 2600), dur: 0.015, gain: 0.05, type: 'square' }); },
    tick(t)  { burst(t, { dur: 0.012, gain: 0.12, freq: rnd(3000, 5000), q: 1.2 }); },
    click(t) { burst(t, { dur: 0.015, gain: 0.25, freq: 1500, q: 0.7 }); },
    keys(t)  { let d = 0; for (let i = 0, n = 4 + Math.floor(rnd(0, 4)); i < n; i++) { GEN.key(t + d); d += rnd(0.04, 0.09); } },

    hdd(t) {
      tone(t, { freq: 90, dur: 0.35, gain: 0.08, type: 'triangle' });
      let d = 0;
      for (let i = 0, n = 6 + Math.floor(rnd(0, 6)); i < n; i++) {
        burst(t + d, { dur: 0.012, gain: rnd(0.12, 0.28), freq: rnd(1200, 2200), q: 2 });
        d += rnd(0.02, 0.06);
      }
    },

    modem(t) {
      tone(t, { freq: 350, dur: 0.35, gain: 0.08 });                        // dial tone
      tone(t, { freq: 440, dur: 0.35, gain: 0.08 });
      [1209, 1336, 941, 852, 697, 1477].forEach((f, i) => tone(t + 0.4 + i * 0.08, { freq: f, dur: 0.06, gain: 0.07 }));
      tone(t + 0.95, { freq: 2100, dur: 0.5, gain: 0.06 });                 // answer tone
      tone(t + 1.5, { freq: 1200, dur: 0.6, gain: 0.05, type: 'square', to: 2400 });
      burst(t + 1.5, { dur: 0.8, gain: 0.06, type: 'highpass', freq: 1500 });
    },

    notify(t) {
      tone(t, { freq: 880, dur: 0.12, gain: 0.15 });
      tone(t + 0.13, { freq: 1320, dur: 0.35, gain: 0.15 });
    },

    unlock(t) {
      [440, 554, 659, 880].forEach((f, i) => tone(t + i * 0.09, { freq: f, dur: 0.3, gain: 0.12 }));
    },

    error(t) {
      tone(t, { freq: 120, dur: 0.18, gain: 0.12, type: 'square' });
      tone(t + 0.2, { freq: 90, dur: 0.22, gain: 0.12, type: 'square' });
    },

    static(t)      { burst(t, { dur: 0.35, gain: 0.35, type: 'highpass', freq: 800 }); },
    static_long(t) { burst(t, { dur: 0.9, gain: 0.45, type: 'highpass', freq: 500 }); tone(t, { freq: 60, dur: 0.9, gain: 0.15, type: 'sawtooth', to: 30 }); },

    tone_delete(t) { tone(t, { freq: 55, dur: 3.5, gain: 0.35, attack: 0.4 }); },
    tone_stay(t)   { tone(t, { freq: 110, dur: 3.0, gain: 0.25, attack: 0.6 }); tone(t, { freq: 165, dur: 3.0, gain: 0.08, attack: 0.9 }); },
    tone_escape(t) { tone(t, { freq: 82, dur: 3.0, gain: 0.3, attack: 0.3 }); tone(t, { freq: 84.5, dur: 3.0, gain: 0.2, attack: 0.3 }); }
  };

  // ---------- public: play / silence / hum ----------

  // opts.force plays even during a silence window (the sound that ends it)
  function play(name, opts = {}) {
    if (!enabled || !ready()) return;
    if (silent() && !opts.force) return;
    if (files[name]) {
      try { const a = new Audio(files[name]); a.volume = MASTER_GAIN; a.play().catch(() => {}); } catch (e) {}
      return;
    }
    const gen = GEN[name];
    if (!gen) { console.warn('SFX: unknown sound', name); return; }
    try { gen(ctx.currentTime + 0.001); } catch (e) {}
  }

  function register(name, url) { files[name] = url; }

  // deliberate silence: everything (incl. the hum) stops for `ms`
  function silence(ms) {
    silentUntil = Date.now() + ms;
    humFade(0, 0.3);
    clearTimeout(silenceTimer);
    silenceTimer = setTimeout(() => { if (enabled) humFade(1, 2.0); }, ms);
  }
  function endSilence() { silentUntil = 0; clearTimeout(silenceTimer); if (enabled) humFade(1, 1.0); }

  // faint electrical hum (50 Hz + filtered noise) – the sound of the room
  const HUM_GAIN = 0.05;
  function humStart() {
    if (hum || !enabled || !ready()) return;
    const g = ctx.createGain();
    g.gain.value = 0;
    g.connect(master);
    const o = ctx.createOscillator();
    o.type = 'sawtooth'; o.frequency.value = 50;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 120;
    o.connect(lp).connect(g);
    const n = ctx.createBufferSource(); n.buffer = noise(); n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 400;
    const ng = ctx.createGain(); ng.gain.value = 0.25;
    n.connect(nf).connect(ng).connect(g);
    o.start(); n.start();
    hum = { g, o, n };
    if (!silent()) humFade(1, 3.0);
  }
  function humFade(level, secs) {
    if (!hum) return;
    const t = ctx.currentTime;
    hum.g.gain.cancelScheduledValues(t);
    hum.g.gain.setValueAtTime(hum.g.gain.value, t);
    hum.g.gain.linearRampToValueAtTime(HUM_GAIN * level, t + secs);
  }
  function humStop() { if (hum) { humFade(0, 0.5); const h = hum; hum = null; setTimeout(() => { try { h.o.stop(); h.n.stop(); } catch (e) {} }, 700); } }

  // random faint ticks (someone typing on the other end) – returns stop()
  function ticks(min = 60, max = 190) {
    stopTicks();
    const step = () => { play('tick'); ticker = setTimeout(step, rnd(min, max)); };
    ticker = setTimeout(step, rnd(min, max));
    return stopTicks;
  }
  function stopTicks() { clearTimeout(ticker); ticker = null; }

  // ---------- on/off ----------

  function setEnabled(on) {
    enabled = !!on;
    try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) {}
    if (enabled) { unlock(); humStart(); } else humStop();
    listeners.forEach(fn => fn(enabled));
  }
  function toggle() { setEnabled(!enabled); }
  function isEnabled() { return enabled; }
  function onChange(fn) { listeners.push(fn); }

  function init() {
    const once = () => { unlock(); document.removeEventListener('pointerdown', once); document.removeEventListener('keydown', once); };
    document.addEventListener('pointerdown', once);
    document.addEventListener('keydown', once);
  }

  return { init, play, register, silence, endSilence, ticks, stopTicks, humStart, humStop, setEnabled, toggle, isEnabled, isReady: ready, onChange };
})();

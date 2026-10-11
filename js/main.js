/* =====================================================================
   main.js – bootstrap
   Order: State.init() → Content.loadAll() → Router.init()
   Also owns the status bar (server status, users online) and small
   screen effects (FX) that any page can trigger.
   ===================================================================== */

// ---------- FX helpers (glitch burst, blackout) ----------
const FX = {
  burst(duration = 400) {
    document.body.classList.add('glitch-burst');
    setTimeout(() => document.body.classList.remove('glitch-burst'), duration);
  },
  blackout(on = true) {
    document.body.classList.toggle('blackout', on);
  },
  // wrap text in a glitch span (CSS uses data-text for the color-shifted copies)
  glitchText(text) {
    const t = Router.escapeHtml(text);
    return `<span class="glitch" data-text="${t}">${t}</span>`;
  }
};

// ---------- status bar ----------
const SERVER_STATUS = [
  'All systems operational.',
  '3 systems offline.',
  '4 systems offline.',
  'SYSTEM 0192 UNSTABLE',
  'CORE ACCESS GRANTED'
];

function updateStatusBar() {
  const s = State.getState();
  const stage = State.getCounter('serverStatusStage');

  const server = document.getElementById('status-server');
  const endingDef = s.endingChosen && Content.isLoaded() ? (Content.get('endings') || {})[s.endingChosen] : null;
  server.textContent = (endingDef && endingDef.statusLine) || SERVER_STATUS[stage] || SERVER_STATUS[0];
  server.className = 'status-center stage-' + stage;

  const online = s.flags.replied_to_8471 ? 1 : 0;
  document.getElementById('status-online').textContent =
    online === 1 ? '1 user online' : `${online} users online`;

  document.getElementById('footer-seed').textContent = 'seed: ' + s.seed.toString(16).padStart(8, '0');

  // unread mail badge
  const badge = document.getElementById('badge-mail');
  if (Content.isLoaded() && typeof MailData !== 'undefined') {
    const n = MailData.unreadCount(s);
    badge.textContent = n;
    badge.hidden = n === 0;
  }
}

function startClock() {
  const el = document.getElementById('footer-clock');
  const tick = () => {
    const d = new Date();
    el.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map(n => String(n).padStart(2, '0')).join(':');
  };
  tick();
  setInterval(tick, 1000);
}

// ---------- sound (Paket 8) ----------
function initSound() {
  SFX.init();
  const btn = document.getElementById('btn-sound');
  const label = on => { btn.textContent = on ? '[ sound: on ]' : '[ sound: off ]'; };
  label(SFX.isEnabled());
  SFX.onChange(label);
  btn.addEventListener('click', () => SFX.toggle());

  // every keystroke in a field is a keystroke on the machine
  document.addEventListener('keydown', e => {
    if (e.target.matches('input, textarea') && e.key.length === 1) SFX.play('key');
  });
  // links and buttons click
  document.addEventListener('click', e => {
    if (e.target.closest('a[href^="#/"], .btn, .link-btn')) SFX.play('click');
  });
}

// ---------- boot ----------
(async function boot() {
  State.init();
  updateStatusBar();
  startClock();
  initSound();

  State.on('change', updateStatusBar);

  document.getElementById('btn-reset').addEventListener('click', () => {
    // NOTE: uses no confirm() dialog on purpose – keeps automation/testing simple.
    FX.burst();
    State.resetGame();
    location.hash = '#/home';
    Router.refresh();
  });

  const ok = await Content.loadAll();
  if (ok) { World.init(); Puzzles.init(); }
  Router.init(document.getElementById('app'));
  Router.onAfter(updateStatusBar);
  updateStatusBar();

  if (!ok) {
    Router.navigate('error', ['data'], { reason: 'data' });
  }

  // expose for debugging in the console
  window.OFFLINE = { State, Seed, Content, Router, FX, World, Puzzles, SFX };
  console.log('%cOFFLINE', 'color:#35e1ff', 'seed', State.getSeed(), '| window.OFFLINE for debugging');
})();

/* pages/home.js – HOME: boot sequence, then the "desktop" (service index).
   Boot runs once per browser session (sessionStorage); afterwards HOME shows
   the index directly. A new game (reset) boots again. The boot lines are seed-neutral on purpose – the
   sameness is part of the loop. */

Router.register('home', {
  title: 'HOME',

  bootLines(s) {
    const online = s.flags.replied_to_8471 ? '1 user online' : '0 users online';
    return [
      { html: 'CONNECTING...', delay: 1500, sfx: 'modem' },
      { html: 'CONNECTED.', delay: 900, sfx: 'click' },
      { html: '', delay: 300 },
      { html: 'Welcome back, <span class="accent">user_0192</span>.', delay: 1100, sfx: 'hdd' },
      { html: UI.esc(online), delay: 700, sfx: 'click' }
    ];
  },

  booted() {
    try { return sessionStorage.getItem('offline_booted') === String(State.getSeed()); } catch (e) { return false; }
  },
  setBooted() {
    try { sessionStorage.setItem('offline_booted', String(State.getSeed())); } catch (e) {}
  },

  render(el, ctx) {
    const s = ctx.state;

    if (this.booted()) {
      this.renderIndex(el, s);
      return;
    }

    el.innerHTML = `
      <div class="fullscreen-msg" id="boot"></div>
      <p class="boot-skip">[ press any key ]</p>
    `;
    const box = el.querySelector('#boot');
    const hint = el.querySelector('.boot-skip');

    const finish = () => {
      this.setBooted();
      this.renderIndex(el, s);
    };

    const start = () => {
      hint.textContent = '[ press any key ]';
      this._typing = UI.typeLines(box, this.bootLines(s), { delay: 700, firstDelay: 400 });
      this._typing.done.then(() => {
        SFX.silence(2400);                     // the "0 users online" beat: nothing but the room
        this._timer = setTimeout(finish, 1600);
      });
      // skip on key / click
      this._skip = () => { this.leave(); finish(); };
      window.addEventListener('keydown', this._skip, { once: true });
      el.addEventListener('click', this._skip, { once: true });
    };

    // Browsers allow audio only after a user gesture. If sound is on but not
    // yet unlocked (first load, new cycle after reload), wait for a key so the
    // modem and the typing are actually audible.
    if (SFX.isEnabled() && !SFX.isReady()) {
      hint.textContent = '[ press any key to connect ]';
      box.innerHTML = '<span class="line cursor"></span>';
      this._skip = () => {
        box.innerHTML = '';
        // the gesture handler in SFX runs first; give the context a tick to resume
        this._timer = setTimeout(start, 120);
      };
      window.addEventListener('keydown', this._skip, { once: true });
      el.addEventListener('click', this._skip, { once: true });
      return;
    }
    start();
  },

  renderIndex(el, s) {
    const services = [
      ['search',  'SEARCH',  'query the network index'],
      ['mail',    'MAIL',    'inbox'],
      ['forum',   'FORUM',   'public threads'],
      ['archive', 'ARCHIVE', 'stored records'],
      ['profile', 'PROFILE', 'user_0192'],
      ['chat',    'CHAT',    'direct sessions'],
      ['system',  'SYSTEM',  'status & diagnostics'],
      ['files',   'FILES',   'local storage']
    ];

    const lastVisit = s.visitedPages.length > 1
      ? UI.gameStamp(s.visitedPages[s.visitedPages.length - 2].ts)
      : '—';

    el.innerHTML = `
      <h1>HOME</h1>
      ${UI.kv([
        ['user',        'user_0192'],
        ['session',     UI.gameStamp(s.createdAt)],
        ['last action', lastVisit, 'dim'],
        ['users online', s.flags.replied_to_8471 ? '1' : '0']
      ])}
      ${UI.section('services',
        '<ul class="menu">' + services.map(([id, name, desc]) =>
          `<li><a href="#/${id}">${name}</a> <span class="faint">– ${desc}</span></li>`).join('') +
        '</ul>')}
      <p class="faint">There is nothing wrong with the network.<span class="cursor"></span></p>
    `;
  },

  leave() {
    if (this._typing) this._typing.cancel();
    clearTimeout(this._timer);
    if (this._skip) window.removeEventListener('keydown', this._skip);
    this._skip = null;
  }
});

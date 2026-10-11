/* pages/ending.js – the three endings (Paket 7)
   #/ending/delete | stay | escape        → confirmation screen
   #/ending/<id>/run                      → plays the sequence (sets endingChosen)
   #/ending/<id>/final                    → resting screen after the sequence
                                            (reload-safe: Router guard sends
                                             finished delete/escape runs here)

   DELETE  → typed termination lines, blackout, "CONNECTION LOST." – any key
             starts a new cycle (new seed).
   STAY    → "NETWORK MAINTAINED.", 8471's last line, cursor keeps blinking;
             the game stays playable.
   ESCAPE  → glitch fragments, blackout, a boot sequence for user_???? –
             any key starts a new cycle.
   Texts live in data/endings.json. */

const Endings = {
  IDS: ['delete', 'stay', 'escape'],
  data() { return Content.get('endings') || {}; },
  def(id) { return this.data()[id] || null; },

  // Meta record across playthroughs (endings seen, cycle count) – not part of the save.
  META_KEY: 'offline_meta',
  meta() {
    try { return JSON.parse(localStorage.getItem(this.META_KEY)) || { cycles: 1, endings: [] }; }
    catch (e) { return { cycles: 1, endings: [] }; }
  },
  record(id) {
    const m = this.meta();
    if (!m.endings.includes(id)) m.endings.push(id);
    try { localStorage.setItem(this.META_KEY, JSON.stringify(m)); } catch (e) {}
  },
  newCycle() {
    const m = this.meta();
    m.cycles = (m.cycles || 1) + 1;
    try { localStorage.setItem(this.META_KEY, JSON.stringify(m)); sessionStorage.clear(); } catch (e) {}
    State.resetGame();
    location.hash = '#/home';
    location.reload();
  }
};

Router.register('ending', {
  title: 'ENDING',

  render(el, ctx) {
    const s = ctx.state;
    const id = ctx.params[0] || '';
    const step = ctx.params[1] || 'confirm';
    const d = Endings.def(id);

    if (!d || !Endings.IDS.includes(id) || !s.flags.core_unlocked) {
      Router.navigate('error', ['ending/' + id], { reason: 'locked' });
      return;
    }
    if (step === 'confirm') return this.renderConfirm(el, s, id, d);
    if (step === 'run')     return this.run(el, s, id, d);
    if (step === 'final')   return this.renderFinal(el, s, id, d);
    Router.navigate('error', ['ending/' + id + '/' + step]);
  },

  // ---------- 1. confirmation ----------

  renderConfirm(el, s, id, d) {
    el.innerHTML = `
      <div class="fullscreen-msg ending">
        ${d.confirm.map(l => `<span class="line ${l === '' ? '' : l.endsWith('?') ? 'accent' : ''}">${UI.esc(l)}</span>`).join('')}
        <div class="core-choices" style="margin-top:18px">
          <button class="btn ${id === 'delete' ? 'danger' : ''}" id="ending-confirm">[ ${UI.esc(d.confirmLabel || 'Confirm')} ]</button>
          <a class="btn" href="#/system/core">[ Cancel ]</a>
        </div>
      </div>`;
    el.querySelector('#ending-confirm').addEventListener('click', () => {
      Router.navigate('ending', [id, 'run']);
    });
  },

  // ---------- 2. sequence ----------

  run(el, s, id, d) {
    if (s.endingChosen !== id) {
      State.setEnding(id);
      State.logEvent('ending', id);
      Endings.record(id);
    }
    el.innerHTML = '<div class="fullscreen-msg ending" id="ending-seq"></div>';
    const box = el.querySelector('#ending-seq');
    FX.burst(400);
    SFX.play('static');
    SFX.silence(60000);                       // the sequence plays in silence ...
    this._typing = UI.typeLines(box, d.sequence, { delay: 900, firstDelay: 600, keepCursor: false, sound: null });
    this._typing.done.then(() => {
      SFX.play('tone_' + id, { force: true });   // ... then a single low tone
      this['after_' + id](el, box, d);
    });
  },

  after_delete(el, box, d) {
    this._timer = setTimeout(() => {
      FX.burst(600);
      this._timer = setTimeout(() => this.renderFinal(el, State.getState(), 'delete', d), 700);
    }, 1200);
  },

  after_stay(el, box, d) {
    const line = Content.text(d.chatLine, 'ending.stay.chatLine');
    box.insertAdjacentHTML('beforeend', '<p class="dim typing" style="margin-top:14px">8471 is typing<span class="dots"></span></p>');
    this._timer = setTimeout(() => {
      box.querySelector('.typing').remove();
      SFX.endSilence();                       // STAY: the room comes back
      // becomes part of the real transcript, so CHAT shows it too
      State.chatPush('8471', line);
      State.chatMark('done', 'before_core');
      box.insertAdjacentHTML('beforeend', `
        <div class="chat-line them fresh" style="margin-top:14px">
          <span class="who">user_8471</span>
          <pre>${UI.esc(line)}</pre>
        </div>
        <span class="line cursor" style="margin-top:14px"></span>`);
      updateStatusBar();
    }, 2600);
  },

  after_escape(el, box, d) {
    const frags = d.fragments || [];
    let i = 0;
    const next = () => {
      if (i < frags.length) {
        FX.burst(350);
        box.insertAdjacentHTML('beforeend', `<span class="line danger frag">${FX.glitchText(frags[i])}</span>`);
        i++;
        this._timer = setTimeout(next, 650);
        return;
      }
      this._timer = setTimeout(() => this.renderFinal(el, State.getState(), 'escape', d), 500);
    };
    this._timer = setTimeout(next, 800);
  },

  // ---------- 3. resting screen ----------

  renderFinal(el, s, id, d) {
    if (id === 'stay') { Router.navigate('chat'); return; }

    const layer = this.blackoutLayer();
    FX.blackout(true);
    SFX.humStop();                            // dead machine: no hum on the final screen
    layer.innerHTML = '';

    const armContinue = () => {
      layer.insertAdjacentHTML('beforeend', `<p class="faint continue">${UI.esc(Endings.data().continue || '[ press any key ]')}</p>`);
      const go = () => { window.removeEventListener('keydown', go); layer.removeEventListener('click', go); Endings.newCycle(); };
      window.addEventListener('keydown', go);
      layer.addEventListener('click', go);
      this._go = go;
    };

    if (id === 'delete') {
      this._timer = setTimeout(() => {
        layer.innerHTML = `<p class="final-line">${UI.esc(d.final || 'CONNECTION LOST.')}</p>`;
        this._timer = setTimeout(armContinue, 6000);
      }, 1500);
      return;
    }

    // escape: brief darkness, then a boot for someone else
    this._timer = setTimeout(() => {
      layer.innerHTML = '<div class="fullscreen-msg" id="cycle-boot"></div>';
      const box = layer.querySelector('#cycle-boot');
      SFX.play('modem', { force: true });
      this._typing = UI.typeLines(box, d.boot, { delay: 700, firstDelay: 300, sound: null });
      this._typing.done.then(() => { this._timer = setTimeout(armContinue, 3500); });
    }, 1800);
  },

  blackoutLayer() {
    let layer = document.getElementById('blackout-layer');
    if (!layer) {
      layer = document.createElement('div');
      layer.id = 'blackout-layer';
      document.body.appendChild(layer);
    }
    return layer;
  },

  leave() {
    clearTimeout(this._timer);
    if (this._typing) this._typing.cancel();
    if (this._go) { window.removeEventListener('keydown', this._go); this._go = null; }
    // leaving a finished delete/escape screen is only possible via newCycle()
  }
});

// Reload guard: a finished DELETE/ESCAPE run always lands on its final screen.
Router.onBefore((route) => {
  const s = State.getState();
  if (!s || !s.endingChosen || s.endingChosen === 'stay') return;
  if (route.id === 'ending' && route.params[1] === 'final') return;
  if (route.id === 'error') return;
  Router.navigate('ending', [s.endingChosen, 'final']);
  return false;
});

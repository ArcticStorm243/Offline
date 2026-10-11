/* pages/profile.js – PROFILE
   #/profile          → own profile (user_0192)
   #/profile/8471     → another user's profile (gated by flags, Paket 3/5)

   The account creation date is derived from the seed (needed later as the
   password for puzzle 4 / variant A), so it is stable per playthrough. */

const Profile = {

  // Own account: created after the purge (2039) – a "reconstruction".
  creationDate(s) {
    const y = 2040;
    const m = Seed.intBetween(s.seed, 'profile.created.month', 1, 12);
    const d = Seed.intBetween(s.seed, 'profile.created.day', 1, 28);
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  },

  // last 5 player actions, newest first – wording from flags-content-map.activityLabels
  recentActivity(s) { return World.activity(s, 5); },

  // legacy account (2038) – seed-stable creation date, revealed by puzzle 4
  oldCreationDate(s) {
    const cfg = (Content.get('profile') || {}).oldAccount || { createdYear: 2038 };
    const m = Seed.intBetween(s.seed, 'profile.old.month', 1, 12);
    const d = Seed.intBetween(s.seed, 'profile.old.day', 1, 28);
    return `${cfg.createdYear}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  },

  previousSessions(s) {
    const data = Content.get('profile');
    if (!data) return [];
    return Seed.pickVariant(s.seed, 'profile.previous_sessions', data.previousSessions) || [];
  }
};

Router.register('profile', {
  title: 'PROFILE',

  render(el, ctx) {
    const s = ctx.state;
    const who = ctx.params[0];

    if (!who || who === '0192' || who === 'user_0192') return this.renderOwn(el, s);
    return this.renderOther(el, s, who.replace(/^user_/, ''));
  },

  renderOwn(el, s) {
    const activity = Profile.recentActivity(s);
    const stage = s.counters.serverStatusStage;

    el.innerHTML = `
      <h1>PROFILE</h1>
      ${UI.section('identity', UI.kv([
        ['user id',   'user_0192'],
        ['status',    stage >= 3 ? '<span class="off">UNSTABLE</span>' : '<span class="ok">active</span>'],
        ['created',   Profile.creationDate(s)],
        ['last login', UI.gameStamp(s.createdAt)],
        ['sessions',  String(1 + Math.floor(s.visitedPages.length / 40))],
        ['role',      '<span class="faint">standard user</span>']
      ]))}

      ${UI.section('recent activity',
        activity.length
          ? '<ul class="list">' + activity.map(a =>
              `<li><span class="faint">${UI.gameStamp(a.ts).slice(11)}</span>  <span class="${a.type === 'status' ? 'warn' : ''}">${UI.esc(a.text)}</span></li>`).join('') + '</ul>'
          : '<p class="dim">No recorded activity.</p>'
      )}

      <div id="previous-sessions"></div>

      <p class="faint">This profile is monitored for pattern deviation.</p>
    `;

    // Legacy sessions – appear once the old account is recovered (puzzle 4)
    if (s.flags.found_old_account_2038) {
      const cfg = (Content.get('profile') || {}).oldAccount || {};
      const rows = Profile.previousSessions(s).map(([ts, action, detail]) =>
        [`<span class="faint">${UI.esc(ts)}</span>`, `<span class="dim">${UI.esc(action)}</span>`, UI.esc(detail)]);
      el.querySelector('#previous-sessions').innerHTML = UI.section('previous sessions',
        UI.kv([
          ['legacy account', 'user_0192 <span class="faint">(merged)</span>'],
          ['created', Profile.oldCreationDate(s)],
          ['node', UI.esc(cfg.node || '')],
          ['role', `<span class="warn">${UI.esc(cfg.role || '')}</span>`]
        ]) + UI.table(['timestamp', 'action', 'detail'], rows), 'legacy');
    } else if (s.flags.chat_unlocked) {
      this.renderLegacyLocked(el, s);
    }
  },

  // Puzzle 4 – the locked legacy record. Variant decides the mechanic:
  //   A: enter the account creation date shown on this very profile
  //   B: enter the passphrase 8471 mentions in chat
  //   C: no input – solved via search ("shutdown", then "0192")
  renderLegacyLocked(el, s) {
    const v = Puzzles.variant('puzzle_4', s);
    const box = el.querySelector('#previous-sessions');
    if (!v) {
      box.innerHTML = UI.section('previous sessions', '<p class="faint">[ 1 legacy session record – access restricted ]</p>');
      return;
    }
    const hint = Content.text(v.hint, 'puzzle_4.hint', s);
    const attempts = s.eventLog.filter(e => e.type === 'attempt' && e.detail === 'puzzle_4:fail').length;

    box.innerHTML = UI.section('previous sessions', `
      <p class="faint">${UI.esc(v.lockedText)}</p>
      <p class="dim">${UI.esc(hint)}</p>
      ${v.prompt ? `
        <form id="legacy-form" autocomplete="off">
          <p class="dim">${UI.esc(v.prompt)}</p>
          <input class="input" id="legacy-input" type="text" spellcheck="false" placeholder="${v.solution === 'account_creation_date' ? 'YYYY-MM-DD' : 'passphrase'}">
          <button class="btn" type="submit">verify</button>
        </form>
        <p id="legacy-result" class="danger">${attempts ? UI.esc(attempts + ' failed attempt(s) logged.') : ''}</p>` : ''}
    `, 'legacy-locked');

    const form = box.querySelector('#legacy-form');
    if (!form) return;
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      const input = box.querySelector('#legacy-input');
      const ok = Puzzles.attempt('puzzle_4', input.value);
      if (ok) {
        FX.burst(500);
        SFX.play('unlock');
        Router.refresh();
      } else {
        box.querySelector('#legacy-result').textContent = Puzzles.failText();
        input.value = '';
        input.focus();
        FX.burst(150);
        SFX.play('error');
      }
    });
  },

  renderOther(el, s, id) {
    // Only 8471 exists as a "real" other user; everything else is a 404.
    if (id !== '8471') {
      Router.navigate('error', ['user_' + id], { reason: 'not_found' });
      return;
    }
    if (!s.flags.found_8471_profile) {
      Router.navigate('error', ['user_8471'], { reason: 'locked' });
      return;
    }

    el.innerHTML = `
      <h1>PROFILE</h1>
      ${UI.section('identity', UI.kv([
        ['user id',    'user_8471'],
        ['status',     '<span class="dim">unknown</span>'],
        ['created',    '<span class="faint">████-██-██</span>'],
        ['last login', '<span class="dim">' + UI.gameStamp(Date.now() - 3 * 60 * 1000) + '</span>'],
        ['posts',      '0'],
        ['role',       '<span class="faint">████████</span>']
      ]))}
      ${UI.section('recent activity', '<p class="dim">No recorded activity.</p>')}
      <p class="faint">Profile data partially unavailable.</p>
    `;
  }
});

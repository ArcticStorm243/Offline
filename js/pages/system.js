/* pages/system.js – SYSTEM: status, subsystems, diagnostics, logs.
   #/system              → overview
   #/system/diagnostics  → diagnostics
   #/system/logs         → system log
   #/system/core         → CORE ACCESS (gated by core_unlocked, Paket 6/7)

   Subsystem states follow serverStatusStage (Abschnitt 8):
     stage 0: all ok · 1: 3 offline · 2: 4 offline · 3: 0192 unstable · 4: core */

const SystemPage = {

  SUBSYSTEMS: [
    ['AUTH',      'authentication'],
    ['INDEX',     'search index'],
    ['MAILRELAY', 'mail relay'],
    ['FORUMDB',   'forum database'],
    ['ARCHIVE',   'cold storage'],
    ['CHATNODE',  'direct sessions'],
    ['WATCHDOG',  'pattern monitor'],
    ['CORE',      'core process']
  ],

  // which subsystems go offline first – seed-shuffled so it differs per run,
  // but WATCHDOG and CORE never appear "offline"
  offlineOrder(s) {
    const candidates = this.SUBSYSTEMS.map(x => x[0]).filter(n => n !== 'WATCHDOG' && n !== 'CORE');
    return Seed.shuffle(s.seed, 'system.offline_order', candidates);
  },

  subsystemStates(s) {
    const stage = s.counters.serverStatusStage;
    const offlineCount = stage >= 2 ? 4 : stage === 1 ? 3 : 0;
    const offline = new Set(this.offlineOrder(s).slice(0, offlineCount));
    return this.SUBSYSTEMS.map(([id, desc]) => {
      let state = 'OK', cls = 'ok';
      if (offline.has(id))                     { state = 'OFFLINE';  cls = 'off'; }
      if (id === 'WATCHDOG' && stage >= 3)     { state = 'ACTIVE';   cls = 'warn'; }
      if (id === 'CORE') {
        if (stage >= 4)      { state = 'UNLOCKED'; cls = 'accent'; }
        else if (stage >= 3) { state = 'DEGRADED'; cls = 'warn'; }
        else                 { state = 'LOCKED';   cls = 'dim'; }
      }
      return { id, desc, state, cls };
    });
  },

  menu(s, active) {
    const items = [
      ['',            'STATUS'],
      ['diagnostics', 'DIAGNOSTICS'],
      ['logs',        'LOGS']
    ];
    if (s.flags.core_unlocked) items.push(['core', 'CORE ACCESS']);
    return '<ul class="menu">' + items.map(([p, label]) =>
      `<li><a href="#/system${p ? '/' + p : ''}" class="${active === p ? 'active' : ''} ${p === 'core' ? 'accent' : ''}">${label}</a></li>`
    ).join('') + '</ul>';
  }
};

Router.register('system', {
  title: 'SYSTEM',

  render(el, ctx) {
    const s = ctx.state;
    const sub = ctx.params[0] || '';
    const views = { '': 'renderStatus', diagnostics: 'renderDiagnostics', logs: 'renderLogs', core: 'renderCore' };
    if (!views[sub]) { Router.navigate('error', ['system/' + sub]); return; }
    this[views[sub]](el, s);
  },

  renderStatus(el, s) {
    const stage = s.counters.serverStatusStage;
    const rows = SystemPage.subsystemStates(s).map(x =>
      [UI.esc(x.id), `<span class="dim">${UI.esc(x.desc)}</span>`, `<span class="${x.cls}">${x.state}</span>`]);

    el.innerHTML = `
      <h1>SYSTEM</h1>
      ${SystemPage.menu(s, '')}
      ${UI.section('status', UI.kv([
        ['server',   `<span class="${stage >= 3 ? 'off' : stage >= 1 ? 'warn' : 'ok'}">${UI.esc(SERVER_STATUS[stage])}</span>`],
        ['uptime',   UI.esc(this.uptime(s))],
        ['node',     'local / user_0192'],
        ['session',  '<span class="dim">' + s.seed.toString(16).padStart(8, '0') + '</span>'],
        ['clock',    UI.fmtDateTime(UI.gameNow())]
      ]))}
      ${UI.section('subsystems', UI.table(['id', 'description', 'state'], rows))}
      <p class="faint">Last integrity check: passed. Nothing requires your attention.</p>
    `;
  },

  // "uptime" counts from the purge – a detail the attentive player can notice
  uptime(s) {
    const purge = new Date('2039-04-11T09:00:00');
    const ms = UI.gameNow() - purge;
    const days = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    return `${days}d ${String(h).padStart(2, '0')}h`;
  },

  renderDiagnostics(el, s) {
    const stage = s.counters.serverStatusStage;
    const lines = [
      'memory ........... 61% used',
      'storage .......... 44% used',
      'index integrity .. ' + (stage >= 2 ? 'MISMATCH (4 segments)' : 'ok'),
      'user records ..... 1 local' + (s.flags.replied_to_8471 ? ', 1 remote (unregistered)' : ''),
      'pattern monitor .. ' + (stage >= 3 ? 'DEVIATION DETECTED – user_0192' : 'nominal'),
      'core process ..... ' + (s.flags.core_unlocked ? 'ACCESSIBLE' : 'sealed')
    ];
    el.innerHTML = `
      <h1>SYSTEM</h1>
      ${SystemPage.menu(s, 'diagnostics')}
      ${UI.section('diagnostics', `<pre>${lines.map(UI.esc).join('\n')}</pre>`)}
      <p class="faint">Diagnostics are read-only.</p>
    `;
  },

  renderLogs(el, s) {
    // Static base log + the player's own page visits (the system "remembers")
    const base = [
      ['2039-04-11 09:00:00', 'migration window opened'],
      ['2039-04-11 09:47:12', 'migration: 2,400,000 accounts pending'],
      ['2039-04-11 10:02:55', 'migration: ████████████'],
      ['2039-04-11 10:03:00', 'migration failed – rollback aborted'],
      ['2039-04-12 02:14:31', 'incident report filed (internal)'],
      ['2040-01-01 00:00:00', 'node re-initialised for user_0192']
    ];
    const visits = s.visitedPages.slice(-8).map(v => [UI.gameStamp(v.ts), `page access: /${v.page}`]);
    const rows = base.concat(visits).map(([t, m]) =>
      [`<span class="faint">${UI.esc(t)}</span>`, UI.esc(m)]);

    el.innerHTML = `
      <h1>SYSTEM</h1>
      ${SystemPage.menu(s, 'logs')}
      ${UI.section('system log', UI.table(['timestamp', 'event'], rows))}
    `;
  },

  renderCore(el, s) {
    if (!s.flags.core_unlocked) {
      Router.navigate('error', ['system/core'], { reason: 'locked' });
      return;
    }
    const refs = Puzzles.references(s);
    el.innerHTML = `
      <h1>SYSTEM</h1>
      ${SystemPage.menu(s, 'core')}
      ${UI.section('core access', UI.kv([
        ['process',     'CORE <span class="accent">– accessible</span>'],
        ['credentials', 'user_0192 <span class="warn">(developer, restored)</span>'],
        ['function',    'IF SYSTEM BECOMES SELF-AWARE → DELETE CORE'],
        ['state',       '<span class="danger">condition met</span>']
      ]))}
      <div class="core-refs">
        ${refs.map(r => `<p class="dim">${UI.esc(r)}</p>`).join('')}
        <p class="dim">You are here now. The function is yours.</p>
      </div>
      <p class="warn">Choose. This cannot be undone.</p>
      <div class="core-choices">
        <a class="btn danger" href="#/ending/delete">DELETE CORE</a>
        <a class="btn" href="#/ending/stay">MAINTAIN NETWORK</a>
        <a class="btn" href="#/ending/escape">DISCONNECT</a>
      </div>
      <p class="faint">A final confirmation follows.</p>
    `;
  }
});

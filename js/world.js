/* =====================================================================
   world.js – world reactivity (Paket 5)
   ---------------------------------------------------------------------
   Watches state changes and applies the rules from flags-content-map.json:
     · serverStatus  → serverStatusStage escalates automatically
     · activityLabels → human-readable "recent activity" for profile/home
   Content changes per flag (new mails, posts, files…) need no code here –
   they are `when` conditions inside the data files.
   ===================================================================== */

const World = (() => {

  function map() { return Content.get('flagsMap') || {}; }

  // ---------- server status escalation ----------

  function targetStage(s) {
    let stage = 0;
    (map().serverStatus || []).forEach(rule => {
      if (Content.check(rule.when, s) && rule.stage > stage) stage = rule.stage;
    });
    return stage;
  }

  function syncServerStatus() {
    const s = State.getState();
    const target = targetStage(s);
    if (target > State.getCounter('serverStatusStage')) {
      State.setCounter('serverStatusStage', target);
      State.logEvent('status', String(target));
      FX.burst(target >= 3 ? 600 : 300);
      SFX.play(target >= 3 ? 'static_long' : 'static');
      SFX.silence(target >= 3 ? 4000 : 1200);   // then the room goes quiet for a beat
    }
  }

  // ---------- activity log ----------

  function labelFor(e, s) {
    const labels = map().activityLabels || {};
    switch (e.type) {
      case 'search': return `Search: "${e.detail}"`;
      case 'flag':   return labels[e.detail] || null;
      case 'status': return labels['status_' + e.detail] || null;
      case 'read': {
        const [kind, id] = String(e.detail).split(':');
        if (kind === 'mail' && typeof MailData !== 'undefined') {
          const m = MailData.all().find(x => x.id === id);
          return m ? `Read mail: "${m.subject}"` : null;
        }
        if (kind === 'thread' && typeof ForumData !== 'undefined') {
          const t = (Content.get('forum') || { threads: [] }).threads.find(x => x.id === id);
          return t ? `Read thread: "${t.title}"` : null;
        }
        if (kind === 'file') {
          const f = ((Content.get('files') || { files: [] }).files).find(x => x.id === id);
          return f ? `Opened: ${f.name}` : null;
        }
        return null;
      }
      default: return null;
    }
  }

  // newest first, only entries with a label
  function activity(s, n = 5) {
    return s.eventLog.slice().reverse()
      .map(e => ({ ts: e.ts, type: e.type, text: labelFor(e, s) }))
      .filter(e => e.text)
      .slice(0, n);
  }

  // ---------- init ----------

  function init() {
    syncServerStatus();
    State.on('flag', syncServerStatus);
    State.on('counter', p => { if (p.name !== 'serverStatusStage') syncServerStatus(); });
    State.on('reset', syncServerStatus);
  }

  return { init, syncServerStatus, targetStage, activity };
})();

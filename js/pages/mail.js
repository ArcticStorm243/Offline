/* pages/mail.js – MAIL
   #/mail          → inbox
   #/mail/<id>     → message view

   Messages come from data/messages.json; visibility via "when" conditions.
   "unlockOnVisit" flags (e.g. received_first_message) are unlocked while
   the player sits in the inbox – the message *arrives* after a short delay. */

const MailData = {

  all() { const d = Content.get('messages'); return d ? d.messages : []; },

  inbox(s) {
    return Content.visible(this.all(), s)
      .map(m => ({
        id: m.id,
        from: m.from,
        subject: m.subject,
        ts: this.timestamp(m),
        date: UI.stamp(m.date, 'mail:' + m.id),
        unread: !State.isMessageRead(m.id),
        openInChat: !!m.openInChat,
        attachment: m.attachment || null,
        body: Content.text(m.body, 'mail.' + m.id + '.body', s)
      }))
      .sort((a, b) => b.ts - a.ts);   // newest first
  },

  // sortable time: fixed dates → parsed; dynamic → first-seen timestamp
  timestamp(m) {
    if (m.date === '__SESSION__') return State.getState().createdAt;
    if (m.date) {
      const d = new Date(m.date.replace(' ', 'T'));
      d.setFullYear(d.getFullYear() - UI.YEAR_OFFSET);
      return d.getTime();
    }
    return State.noteSeen('mail:' + m.id);
  },

  get(s, id) { return this.inbox(s).find(m => m.id === id) || null; },

  unreadCount(s) { return this.inbox(s).filter(m => m.unread).length; },

  // Flags that unlock while the player is in the inbox
  pendingUnlocks(s) {
    const d = Content.get('messages');
    return ((d && d.unlockOnVisit) || []).filter(f => !s.flags[f] && State.canUnlock(f, s));
  }
};

Content.registerBuilder('mail', (s) => ({ inbox: MailData.inbox(s), unread: MailData.unreadCount(s) }));

Router.register('mail', {
  title: 'MAIL',

  render(el, ctx) {
    const s = ctx.state;
    if (ctx.params[0] && ctx.params[1] === 'att') this.renderAttachment(el, s, ctx.params[0]);
    else if (ctx.params[0]) this.renderMessage(el, s, ctx.params[0]);
    else this.renderInbox(el, s);
  },

  // Attachments are file entries (data/files.json, location "attachment")
  renderAttachment(el, s, id) {
    const m = MailData.get(s, id);
    const f = m && m.attachment ? FileBrowser.find(s, 'attachment', m.attachment.fileId) : null;
    if (!f) { Router.navigate('error', ['mail/' + id + '/att']); return; }
    State.markMessageRead('file:' + f.id);
    if (f.onOpen && f.onOpen.setFlag) State.tryUnlock(f.onOpen.setFlag);

    el.innerHTML = `
      <h1>MAIL</h1>
      <div class="file-view">
        <div class="path"><a href="#/mail">inbox</a> / <a href="#/mail/${m.id}">${UI.esc(m.subject)}</a> / ${UI.esc(f.name)}
          <span class="faint">– ${UI.fmtSize(f.size)}</span></div>
        <pre>${UI.esc(FileBrowser.body(s, f))}</pre>
        <p><a href="#/mail/${m.id}">&larr; message</a></p>
      </div>
    `;
  },

  renderInbox(el, s) {
    const inbox = MailData.inbox(s);
    const rows = inbox.map(m => [
      m.unread ? '<span class="accent">*</span>' : '<span class="faint">&nbsp;</span>',
      `<span class="${m.from === 'SYSTEM' ? 'dim' : m.from === 'user_8471' ? 'accent' : ''}">${UI.esc(m.from)}</span>`,
      `<a href="#/mail/${m.id}" class="${m.unread ? 'unread' : ''}">${UI.esc(m.subject)}</a>` +
        (m.attachment ? ' <span class="faint">[att]</span>' : ''),
      `<span class="faint">${UI.esc(m.date)}</span>`
    ]);

    el.innerHTML = `
      <h1>MAIL</h1>
      <p class="dim">inbox – user_0192 – ${inbox.length} message(s), ${inbox.filter(m => m.unread).length} unread</p>
      <div id="inbox">${UI.table(['', 'from', 'subject', 'date'], rows, 'inbox')}</div>
      <p class="faint">Outbound mail is disabled on this node.</p>
    `;

    // a message "arrives" while the player is watching
    const pending = MailData.pendingUnlocks(s);
    if (pending.length) {
      this._timer = setTimeout(() => {
        pending.forEach(f => State.tryUnlock(f));
        if (Router.currentPage() !== 'mail') return;
        SFX.play('notify');
        FX.burst(250);
        Router.refresh();
      }, 2800);
    }
  },

  renderMessage(el, s, id) {
    const m = MailData.get(s, id);
    if (!m) { Router.navigate('error', ['mail/' + id]); return; }
    State.markMessageRead(m.id);

    el.innerHTML = `
      <h1>MAIL</h1>
      <div class="mail-view">
        ${UI.kv([
          ['from',    `<span class="${m.from === 'user_8471' ? 'accent' : ''}">${UI.esc(m.from)}</span>`],
          ['to',      'user_0192'],
          ['subject', UI.esc(m.subject)],
          ['date',    `<span class="dim">${UI.esc(m.date)}</span>`]
        ])}
        <pre>${UI.esc(m.body)}</pre>
        ${m.attachment ? `<p><span class="dim">attachment:</span> <a href="#/mail/${m.id}/att">${UI.esc(m.attachment.name || 'file')}</a></p>` : ''}
        ${m.openInChat ? '<p><a href="#/chat" class="btn">open in chat &rarr;</a></p>' : ''}
        <p><a href="#/mail">&larr; inbox</a></p>
      </div>
    `;
  },

  leave() { clearTimeout(this._timer); }
});

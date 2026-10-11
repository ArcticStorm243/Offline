/* pages/files.js – FILES (local storage) + shared FileBrowser used by ARCHIVE.
   #/files            → listing
   #/files/<id>       → file view

   Entries come from data/files.json (Content), filtered by "when" conditions.
   Special bodies: __SESSION_LOG__ (generated), __NOW__ (modified = now). */

const FileBrowser = {

  list(s, location) {
    const data = Content.get('files');
    if (!data) return [];
    return Content.visible(data.files, s).filter(f => f.location === location);
  },

  find(s, location, id) {
    return this.list(s, location).find(f => f.id === id) || null;
  },

  modified(f) {
    return f.modified === '__NOW__' ? UI.fmtDateTime(UI.gameNow()).slice(0, 16) : f.modified;
  },

  body(s, f) {
    if (f.body === '__SESSION_LOG__') return this.sessionLog(s);
    if (typeof f.body === 'string' && f.body.startsWith('__PAKET_')) return '[ data segment not yet written ]';
    return Content.text(f.body, 'file.' + f.id, s);
  },

  // The player's own trail, written back into the world
  sessionLog(s) {
    const lines = [
      `session start   ${UI.gameStamp(s.createdAt)}`,
      `user            user_0192`,
      `seed            ${s.seed.toString(16).padStart(8, '0')}`,
      ''
    ];
    s.visitedPages.slice(-20).forEach(v => lines.push(`${UI.gameStamp(v.ts).slice(11)}  open /${v.page}`));
    s.searchHistory.slice(-10).forEach(q => lines.push(`${UI.gameStamp(q.ts).slice(11)}  search "${q.query}"`));
    lines.push('', '[log is written by the system, not by you]');
    return lines.join('\n');
  },

  renderList(el, s, { location, title, intro }) {
    const files = this.list(s, location);
    const rows = files.map(f => {
      const nameCell = f.status === 'locked'
        ? `<span class="faint">${UI.esc(f.name)}</span>`
        : `<a href="#/${location}/${f.id}">${UI.esc(f.name)}</a>`;
      const statusCls = { ok: 'dim', corrupted: 'corrupt', restricted: 'warn', locked: 'faint' }[f.status] || 'dim';
      return [nameCell, `<span class="dim">${UI.esc(this.modified(f))}</span>`,
              UI.fmtSize(f.size), `<span class="${statusCls}">${UI.esc(f.status)}</span>`];
    });

    el.innerHTML = `
      <h1>${UI.esc(title)}</h1>
      <p class="dim">${intro}</p>
      ${files.length
        ? UI.table(['name', 'modified', 'size', 'status'], rows, 'files')
        : '<p class="faint">Directory is empty.</p>'}
      <p class="faint">${files.length} object(s).</p>
    `;
    el.querySelectorAll('td:nth-child(3)').forEach(td => td.classList.add('num'));
  },

  renderFile(el, s, { location, title }, id) {
    const f = this.find(s, location, id);
    if (!f || f.status === 'locked') {
      Router.navigate('error', [location + '/' + id], { reason: f ? 'locked' : 'not_found' });
      return;
    }
    State.markMessageRead('file:' + f.id);   // "read" events are logged like messages
    if (f.onOpen && f.onOpen.setFlag) State.tryUnlock(f.onOpen.setFlag);
    SFX.play('hdd');
    if (f.status === 'corrupted') SFX.play('static');

    el.innerHTML = `
      <h1>${UI.esc(title)}</h1>
      <div class="file-view">
        <div class="path"><a href="#/${location}">${location}</a> / ${UI.esc(f.name)}
          <span class="faint">– ${UI.fmtSize(f.size)}, ${UI.esc(this.modified(f))}</span></div>
        <pre class="${f.status === 'corrupted' ? 'flicker' : ''}">${UI.esc(this.body(s, f))}</pre>
        ${f.status === 'corrupted' ? '<p class="danger">Warning: checksum mismatch. Content may be incomplete.</p>' : ''}
        ${f.status === 'restricted' ? '<p class="warn">This record is restricted. Access has been logged.</p>' : ''}
        <p><a href="#/${location}">&larr; back</a></p>
      </div>
    `;
  },

  page(opts) {
    return {
      title: opts.title,
      render(el, ctx) {
        if (ctx.params[0]) FileBrowser.renderFile(el, ctx.state, opts, ctx.params[0]);
        else FileBrowser.renderList(el, ctx.state, opts);
      }
    };
  }
};

Router.register('files', FileBrowser.page({
  location: 'files',
  title: 'FILES',
  intro: 'Local storage – /home/user_0192'
}));

/* pages/error.js – fallback for unknown routes / locked resources / data load errors
   #/error/<what>?reason=not_found|locked|data */

Router.register('error', {
  title: 'ERROR',

  render(el, ctx) {
    const what = ctx.params.length ? ctx.params.join('/') : 'unknown';
    const reason = ctx.query.reason || 'not_found';

    const messages = {
      not_found: { code: 404, text: `resource "${what}" could not be located.`,
                   note: 'The system has logged this request.' },
      locked:    { code: 403, text: `access to "${what}" denied.`,
                   note: 'Your clearance does not cover this resource. The request has been forwarded.' },
      data:      { code: 500, text: 'data segment unreadable.',
                   note: 'Local records could not be loaded.' }
    };
    const m = messages[reason] || messages.not_found;

    el.innerHTML = `
      <h1>${FX.glitchText('ERROR ' + m.code)}</h1>
      <pre class="danger">${m.code} – ${UI.esc(m.text)}</pre>
      <p class="dim">${UI.esc(m.note)}</p>
      <p><a href="#/home">&larr; return</a></p>
    `;

    if (reason === 'locked') FX.burst(250);

    if (reason === 'data') {
      el.insertAdjacentHTML('beforeend', `
        <hr>
        <p class="faint">DEV NOTE: data/*.json could not be fetched. Browsers block fetch() over file://.
        Start a local server in the project folder, e.g.<br>
        <code>python -m http.server 8080</code> &nbsp;or&nbsp; <code>npx serve .</code><br>
        then open <code>http://localhost:8080</code>.</p>
      `);
    }
  }
});

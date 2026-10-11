/* pages/forum.js – FORUM
   #/forum          → thread list + "users seen recently"
   #/forum/<id>     → thread view (fires onRead flag via State.tryUnlock)

   Threads/posts come from data/forum.json. Posts with "when" appear once the
   condition holds; author/body arrays are seed-chosen variants (stable).
   '__VANISH__' resolves to the seed-chosen vanishing username, which turns
   into [deleted user] after found_contradiction. */

const ForumData = {

  threads(s) {
    const d = Content.get('forum');
    return d ? Content.visible(d.threads, s) : [];
  },

  get(s, id) { return this.threads(s).find(t => t.id === id) || null; },

  vanishingUser(s) {
    const pool = (Content.get('usernames') || {}).pool || ['unknown'];
    return Seed.pickVariant(s.seed, 'forum.vanishing_user', pool);
  },

  author(name, s, poolId) {
    const resolved = Content.text(name, poolId, s);
    if (resolved === '__VANISH__') {
      return s.flags.found_contradiction ? '[deleted user]' : this.vanishingUser(s);
    }
    return resolved;
  },

  posts(thread, s) {
    // index over ALL posts (not only visible ones) so variant pools stay stable
    return thread.posts.map((p, i) => ({ p, i })).filter(x => Content.check(x.p.when, s)).map(({ p, i }) => {
      const key = `forum.${thread.id}.${i}`;
      return {
        author: this.author(p.author, s, key + '.author'),
        date: UI.stamp(p.date, key),
        body: Content.text(p.body, key + '.body', s),
        isNew: !p.date || String(p.date).startsWith('rel:')
      };
    });
  },

  // "users seen recently" – a few regular forum authors (seed-shuffled) plus
  // the vanishing user, who is listed until found_contradiction.
  REGULARS: ['lastlight', 'null_reader', 'echo_7', 'm_vasquez_88', 'tobias.k', 'hollow_node', 'ghost_in_the_wire', 'quietcarrier', 'dial_tone'],
  usersSeen(s) {
    const vanish = this.vanishingUser(s);
    let list = Seed.shuffle(s.seed, 'forum.users_seen', this.REGULARS).slice(0, 5);
    if (!s.flags.found_contradiction) list.splice(Seed.intBetween(s.seed, 'forum.vanish_pos', 0, list.length), 0, vanish);
    if (s.flags.replied_to_8471) list.push('user_8471');
    return list;
  },

  postCount(thread, s) { return Content.visible(thread.posts, s).length; },

  lastActivity(thread, s) {
    const posts = this.posts(thread, s);
    return posts.length ? posts[posts.length - 1].date : thread.date;
  }
};

Content.registerBuilder('forum', (s) => ({ threads: ForumData.threads(s), usersSeen: ForumData.usersSeen(s) }));

Router.register('forum', {
  title: 'FORUM',

  render(el, ctx) {
    const s = ctx.state;
    if (ctx.params[0]) this.renderThread(el, s, ctx.params[0]);
    else this.renderList(el, s);
  },

  renderList(el, s) {
    const threads = ForumData.threads(s);
    const rows = threads.map(t => {
      const read = State.isMessageRead('thread:' + t.id);
      return [
        `<a href="#/forum/${t.id}" class="${read ? '' : 'unread'}">${UI.esc(t.title)}</a>` +
          (t.locked ? ' <span class="faint">[locked]</span>' : ''),
        `<span class="dim">${UI.esc(ForumData.author(t.author, s, 'forum.' + t.id + '.author'))}</span>`,
        `<span class="num">${ForumData.postCount(t, s)}</span>`,
        `<span class="faint">${UI.esc(ForumData.lastActivity(t, s))}</span>`
      ];
    });
    const users = ForumData.usersSeen(s);

    el.innerHTML = `
      <h1>FORUM</h1>
      <p class="dim">public threads – ${threads.length} thread(s). Posting is disabled for your account.</p>
      ${UI.table(['thread', 'author', 'replies', 'last activity'], rows, 'threads')}
      ${UI.section('users seen recently',
        '<p>' + users.map(u => `<span class="${u === 'user_8471' ? 'accent' : 'dim'}">${UI.esc(u)}</span>`).join('<span class="faint"> · </span>') + '</p>' +
        `<p class="faint">${users.length} of ${users.length} listed. 0 users online.</p>`)}
    `;
  },

  renderThread(el, s, id) {
    const t = ForumData.get(s, id);
    if (!t) { Router.navigate('error', ['forum/' + id]); return; }

    State.markMessageRead('thread:' + t.id);
    if (t.onRead && t.onRead.setFlag) State.tryUnlock(t.onRead.setFlag);

    const posts = ForumData.posts(t, s);
    const postHtml = p => `
      <div class="post ${p.isNew ? 'post-new' : ''}">
        <div class="post-head">
          <span class="${p.author === 'user_8471' ? 'accent' : p.author === 'SYSTEM' ? 'warn' : p.author === '[deleted user]' ? 'faint' : ''}">${UI.esc(p.author)}</span>
          <span class="faint"> – ${UI.esc(p.date)}</span>
        </div>
        <pre>${UI.esc(p.body)}</pre>
      </div>`;

    el.innerHTML = `
      <h1>FORUM</h1>
      <p class="dim"><a href="#/forum">threads</a> / #${UI.esc(t.id)}</p>
      <h2>${UI.esc(t.title)}</h2>
      ${postHtml({ author: ForumData.author(t.author, s, 'forum.' + t.id + '.author'), date: t.date, body: t.body })}
      <hr>
      ${posts.length ? posts.map(postHtml).join('') : '<p class="faint">No replies.</p>'}
      <hr>
      <p class="faint">${t.locked ? 'This thread is locked.' : 'Reply: disabled. Your account is read-only.'}</p>
      <p><a href="#/forum">&larr; threads</a></p>
    `;
  }
});

/* pages/chat.js – CHAT: direct session with user_8471
   Dialogue tree from data/dialogue.json (see its _doc). No free text.

   Flow per visit:
     1. find the active node (first node whose `when` holds and that isn't done)
     2. if it has an opening line not yet shown → 8471 "types" it, then options appear
     3. player picks an option → logged as own message (messages_with_8471 +1),
        flags applied, 8471 types the reply, then `next` node or the next
        available node takes over.
   Transcript + progress live in state.chat, so reloads resume cleanly. */

const ChatData = {

  data() { return Content.get('dialogue') || { nodes: [], idle: [] }; },

  node(id) { return this.data().nodes.find(n => n.id === id) || null; },

  isDone(s, n) {
    return s.chat.done.includes(n.id) || (n.group && s.chat.done.includes(n.group));
  },

  // The node the conversation is currently on (or null if 8471 has nothing to say)
  active(s) {
    if (s.chat.pending && s.chat.pending.next) {
      const n = this.node(s.chat.pending.next);
      if (n && !this.isDone(s, n)) return n;
    }
    return this.data().nodes.find(n => n.when && !this.isDone(s, n) && Content.check(n.when, s)) || null;
  },

  line(n, s)      { return Content.fill(Content.text(n.line, 'chat.' + n.id + '.line', s), s); },
  reply(n, i, s)  { return Content.fill(Content.text(n.options[i].reply, `chat.${n.id}.${i}.reply`, s), s); },
  optionText(n, i, s) { return Content.fill(Content.text(n.options[i].text, `chat.${n.id}.${i}.text`, s), s); },
  idleText(s)     { return Content.text(this.data().idle, 'chat.idle.' + s.chat.log.length, s); },

  complete(n) {
    State.chatMark('done', n.id);
    if (n.group) State.chatMark('done', n.group);
    if (n.after && n.after.setFlag) State.tryUnlock(n.after.setFlag);
  },

  // "8471 is typing" delay scales with reply length (capped); the reply is
  // then typed into the log character by character on top of that.
  typingDelay(text) { return Math.min(2200, 600 + text.length * 10); }
};

Content.registerBuilder('chat', (s) => ({ log: s.chat.log, active: ChatData.active(s) }));

Router.register('chat', {
  title: 'CHAT',

  render(el, ctx) {
    const s = ctx.state;
    const open = s.flags.received_first_message;

    el.innerHTML = `
      <h1>CHAT</h1>
      <p class="dim" id="chat-head"></p>
      <div id="chat-log" class="chat-log"></div>
      <div id="chat-options" class="chat-options"></div>
    `;
    this.head(el, s);

    if (!open) {
      el.querySelector('#chat-log').innerHTML =
        '<p class="faint">No active sessions.</p><p class="faint">Direct sessions require a contact request from another user.<span class="cursor"></span></p>';
      return;
    }

    this.renderLog(el, s);

    // resume an interrupted reply (player navigated away while 8471 was typing)
    if (s.chat.pending && s.chat.pending.nodeId) {
      const n = ChatData.node(s.chat.pending.nodeId);
      const i = s.chat.pending.optionIndex;
      if (n && i !== undefined && i !== null) {
        this.deliver(el, n, i);
        return;
      }
    }

    this.step(el);
  },

  head(el, s) {
    const online = s.flags.replied_to_8471 ? '1 user online' : '0 users online';
    const partner = s.flags.received_first_message
      ? `session: <span class="accent">user_8471</span> – ${online}`
      : `${online}`;
    el.querySelector('#chat-head').innerHTML = partner;
  },

  // Show/advance the active node
  step(el) {
    const s = State.getState();
    const n = ChatData.active(s);
    const opts = el.querySelector('#chat-options');

    if (!n) {
      opts.innerHTML = `<p class="faint">${UI.esc(ChatData.idleText(s))}<span class="cursor"></span></p>`;
      return;
    }

    if (n.line && !s.chat.opened.includes(n.id)) {
      const text = ChatData.line(n, s);
      this.typing(el, text, () => {
        State.chatMark('opened', n.id);
        State.chatPush('8471', text);
        this.appendLine(el, '8471', text, () => {
          if (!n.options || !n.options.length) { ChatData.complete(n); this.step(el); }
          else this.showOptions(el, n);
        });
      });
      return;
    }

    if (!n.options || !n.options.length) { ChatData.complete(n); this.step(el); return; }
    this.showOptions(el, n);
  },

  showOptions(el, n) {
    const s = State.getState();
    const opts = el.querySelector('#chat-options');
    opts.innerHTML = '<p class="faint">reply as user_0192:</p>' + n.options.map((o, i) =>
      `<button class="btn chat-opt" data-i="${i}">${UI.esc(ChatData.optionText(n, i, s))}</button>`).join('');
    opts.querySelectorAll('.chat-opt').forEach(btn => {
      btn.addEventListener('click', () => this.choose(el, n, parseInt(btn.dataset.i, 10)));
    });
  },

  choose(el, n, i) {
    const s = State.getState();
    const o = n.options[i];
    const text = ChatData.optionText(n, i, s);

    el.querySelector('#chat-options').innerHTML = '';
    State.chatPush('0192', text);           // counts as a message
    this.appendLine(el, '0192', text);
    if (o.setFlag) State.tryUnlock(o.setFlag);
    State.chatSetPending({ nodeId: n.id, optionIndex: i, next: o.next || null });
    SFX.play('keys');

    this.deliver(el, n, i);
  },

  // 8471 answers option i of node n, then the conversation moves on
  deliver(el, n, i) {
    const s = State.getState();
    const reply = ChatData.reply(n, i, s);
    const o = n.options[i];
    this.typing(el, reply, () => {
      State.chatPush('8471', reply);
      ChatData.complete(n);
      State.chatSetPending(o.next ? { next: o.next } : null);
      this.head(el, State.getState());
      this.appendLine(el, '8471', reply, () => {
        this._timer = setTimeout(() => this.step(el), 500);
      });
    });
  },

  typing(el, text, done) {
    const opts = el.querySelector('#chat-options');
    opts.innerHTML = '<p class="dim typing">8471 is typing<span class="dots"></span></p>';
    SFX.ticks(90, 260);                       // faint keys on the other end
    this._timer = setTimeout(() => { SFX.stopTicks(); done(); }, ChatData.typingDelay(text));
  },

  renderLog(el, s) {
    const log = el.querySelector('#chat-log');
    log.innerHTML = s.chat.log.map(e => this.lineHtml(e.who, e.text, e.ts)).join('');
    log.scrollTop = log.scrollHeight;
  },

  // With `done`, the text is typed into the log character by character
  // (state is already updated by then, so leaving mid-way loses nothing).
  appendLine(el, who, text, done) {
    const log = el.querySelector('#chat-log');
    log.insertAdjacentHTML('beforeend', this.lineHtml(who, text, Date.now(), true));
    log.scrollTop = log.scrollHeight;
    if (!done) return;
    const pre = log.lastElementChild.querySelector('pre');
    pre.classList.add('cursor');
    this._typer = UI.typeText(pre, { charDelay: 22, onChar: () => { log.scrollTop = log.scrollHeight; } });
    this._typer.done.then(() => { pre.classList.remove('cursor'); this._typer = null; done(); });
  },

  lineHtml(who, text, ts, fresh = false) {
    const cls = who === '8471' ? 'them' : who === '0192' ? 'me' : 'sys';
    return `<div class="chat-line ${cls} ${fresh ? 'fresh' : ''}">
      <span class="who">${who === 'sys' ? 'SYSTEM' : 'user_' + who}</span>
      <span class="faint">${UI.gameStamp(ts).slice(11)}</span>
      <pre>${UI.esc(text)}</pre>
    </div>`;
  },

  leave() {
    clearTimeout(this._timer);
    SFX.stopTicks();
    if (this._typer) { this._typer.cancel(); this._typer = null; }
    // If 8471 was mid-reply, deliver it silently so state stays consistent.
    const s = State.getState();
    const p = s.chat.pending;
    if (p && p.nodeId && p.optionIndex !== undefined && p.optionIndex !== null) {
      const n = ChatData.node(p.nodeId);
      if (n) {
        State.chatPush('8471', ChatData.reply(n, p.optionIndex, s));
        ChatData.complete(n);
        State.chatSetPending(p.next ? { next: p.next } : null);
      }
    }
  }
});

/* A pretend game host for testing the pad hub and, later, the pad page (plan packages P1 and P6).
   It plays the host's side of docs/specs/pad-protocol.md: picture join (0032), who-are-you, seats, device tokens, and the reject reasons.
   It is test scaffolding, not the real host (that is the session module, P4). */
import crypto from 'node:crypto';

/* (all of these are in the asset library, so the pad page can draw every one) */
const WORDS = ['balloon', 'cat', 'star', 'sun', 'fish', 'tree', 'moon', 'house', 'kite', 'tent', 'bear', 'rocket'];

export class FakeHost {
  /* url: the hub's ws url; key: its host secret; tokens: a Map kept across restarts (the Box remembers trusted phones) */
  constructor({ url, key, join = ['balloon', 'cat', 'star'], people = [{ id: 'mia', name: 'Mia', avatar: null }, { id: 'sam', name: 'Sam', avatar: null }, { id: 'ola', name: 'Ola', avatar: null }, { id: 'guest', name: 'Guest', avatar: null }], seats = 4,
    tokens = new Map(), now = Date.now, maxWrong = 5, waitMs = 60000, game = 'pop-party', padUrl = '/pads/pop-party/', need = 'controller' } = {}) {
    Object.assign(this, { url, key, join, people, seats, tokens, now, maxWrong, waitMs, game, padUrl, need });
    this.pads = new Map();       /* hub id -> { ua, device } */
    this.wrong = 0; this.lockedUntil = 0;
    this.log = [];               /* what the pads said, for tests: { from, m } */
    this.seen = [];              /* every message from the hub */
  }

  start() {
    return new Promise((resolve, reject) => {
      const ws = this.ws = new WebSocket(`${this.url}/ws?role=host&key=${this.key}`);
      ws.addEventListener('open', () => resolve(this));
      ws.addEventListener('error', () => reject(new Error('the hub refused the host')));
      ws.addEventListener('message', (e) => this.onMessage(JSON.parse(e.data)));
      ws.addEventListener('close', () => { this.closed = true; });
    });
  }
  stop() { try { this.ws.close(); } catch {} }

  send(to, m) { if (!this.closed) this.ws.send(JSON.stringify({ to, m })); }
  kick(to) { if (!this.closed) this.ws.send(JSON.stringify({ to, close: true })); }

  /* the picture grid a phone without the secret taps from: the three right ones among nine */
  grid() {
    const decoys = WORDS.filter(w => !this.join.includes(w)).slice(0, 6), g = [...this.join, ...decoys];
    return g.map((w, i) => [w, (i * 5 + 3) % 9]).sort((a, b) => a[1] - b[1]).map(([w]) => w);
  }
  freeSeat() { const used = new Set([...this.tokens.values()].map(t => t.seat)); for (let s = 0; s < this.seats; s++) if (!used.has(s)) return s; return -1; }

  onMessage(msg) {
    this.seen.push(msg);
    if (msg.t === 'open') { this.pads.set(msg.from, { ua: msg.ua, device: null, verified: false }); return; }
    if (msg.t === 'close') { const p = this.pads.get(msg.from); this.pads.delete(msg.from); if (p && p.device) this.onAway && this.onAway(this.tokens.get(p.device)); return; }
    if (msg.t !== 'msg') return;
    this.log.push({ from: msg.from, m: msg.m });
    const p = this.pads.get(msg.from); if (!p) return;
    const m = msg.m;
    if (m.t === 'hello') return this.hello(msg.from, p, m);
    if (m.t === 'pick') return this.pick(msg.from, p, m);
    if (m.t === 'ready') { p.ready = true; this.onReady && this.onReady(p.device && this.tokens.get(p.device), msg.from); return; }
    if (m.t === 'who?') { if (!p.device && !p.verified) return; p.ready = false; return this.send(msg.from, { t: 'who?', people: this.people }); }   /* "Not Sam? Change": the same phone picks again */
    if (m.t === 'ping') return this.send(msg.from, { t: 'pong', n: m.n, tick: 0 });
  }

  welcome(to, p, token) {
    const rec = this.tokens.get(token);
    p.device = token;
    this.send(to, { t: 'welcome', device: token, seat: rec.seat, who: rec.who, colour: ['#3da9ff', '#ff8a3d', '#3fcf7f', '#c46bff'][rec.seat % 4], game: this.game, pad: this.padUrl, need: this.need });
    this.onJoin && this.onJoin(rec);
  }

  hello(to, p, m) {
    if (m.v !== 1) return this.send(to, { t: 'reject', why: 'version' });
    if (m.device && this.tokens.has(m.device)) return this.welcome(to, p, m.device);       /* trusted: straight back to its seat */
    if (this.now() < this.lockedUntil) return this.send(to, { t: 'reject', why: 'wait' });
    if (!m.join) return this.send(to, { t: 'pics?', grid: this.grid() });
    if (JSON.stringify(m.join) !== JSON.stringify(this.join)) {
      this.wrong++;
      if (this.wrong >= this.maxWrong) { this.wrong = 0; this.lockedUntil = this.now() + this.waitMs; return this.send(to, { t: 'reject', why: 'wait' }); }
      return this.send(to, { t: 'reject', why: 'join' });
    }
    this.wrong = 0; p.verified = true;
    this.send(to, { t: 'who?', people: this.people });
  }

  pick(to, p, m) {
    if (!p.verified && !p.device) return;
    const who = this.people.find(x => x.id === m.who); if (!who) return;
    if (p.device && this.tokens.has(p.device)) { this.tokens.get(p.device).who = who.id; return this.welcome(to, p, p.device); }   /* changing who: same token, same seat */
    const seat = this.freeSeat(); if (seat < 0) return this.send(to, { t: 'reject', why: 'full' });
    const token = crypto.randomBytes(12).toString('hex');
    this.tokens.set(token, { seat, who: who.id });
    this.welcome(to, p, token);
  }
}

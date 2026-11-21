/* The pad hub, Node copy (plan package P1; spec: docs/specs/pad-protocol.md).
   The same job the Rust hub in Orlis Play does, for tests and for trying pads without the Windows app. It relays and nothing more:

     phone (pad page) --ws://BOX:47880/ws?role=pad------------------+
     game host (WebView JS) --ws://127.0.0.1:47880/ws?role=host&key=SECRET--+--> hub

   - GET /                serves the pad page (default: app/dist-pad/); GET /pads/<game>/... serves a game's pad program.
   - /ws?role=host&key=K  the game host. Only one at a time; a second replaces the first. K must match (ORLIS_PAD_KEY or `key`).
   - /ws?role=pad         a phone. Gets an id (c1, c2, ...). Refused with close code 4001 ("no game running") when there is no host.
   - To the host: {"t":"open","from":"c3","ua":"..."}, {"t":"close","from":"c3"}, {"t":"msg","from":"c3","m":<the pad's message>}.
   - From the host: {"to":"c3"|"*","m":<message>} to one pad or all; {"to":"c3","close":true} closes that pad.
   - Limits: 16 pads (the 17th gets close code 4003); 16 KB a message and 60 messages a second per pad (extras are dropped, nothing
     crashes); a pad that sends something that is not a JSON object is closed (1003).
   - When the host goes away every pad is closed with 4001, so pads show "Start Orlis on the TV" and rejoin by themselves later.

   No dependencies: a small WebSocket server (RFC 6455, text frames) is built in below.
   Run it:  ORLIS_PAD_KEY=secret node tools/pad-hub.mjs [port]      (default port 47880, then 47881 to 47889 if busy)
   Use it:  import { startHub } from './pad-hub.mjs' */
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LIMITS = { pads: 16, message: 16 * 1024, perSecond: 60, frame: 1024 * 1024 };
export const CLOSE = { normal: 1000, badData: 1003, tooBig: 1009, protocol: 1002, noGame: 4001, replaced: 4002, full: 4003 };
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const here = path.dirname(fileURLToPath(import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2', '.mp4': 'video/mp4', '.webm': 'video/webm', '.wasm': 'application/wasm', '.txt': 'text/plain; charset=utf-8' };

/* ---------- one WebSocket connection (server side) ---------- */
class Conn {
  constructor(socket, { onText, onClose, maxMessage = LIMITS.message, maxFrame = LIMITS.frame }) {
    this.socket = socket; this.onText = onText; this.onClose = onClose; this.maxMessage = maxMessage; this.maxFrame = maxFrame;
    this.buf = Buffer.alloc(0); this.frag = null; this.closed = false; this.closing = false; this.dropped = 0;
    socket.setNoDelay(true);
    socket.on('data', (d) => this.feed(d));
    socket.on('close', () => this.finish());
    socket.on('error', () => { try { socket.destroy(); } catch {} });
  }
  feed(chunk) {
    if (this.closing) return;
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    while (this.buf.length >= 2 && !this.closing) {
      const b0 = this.buf[0], b1 = this.buf[1], fin = !!(b0 & 0x80), op = b0 & 0x0f, masked = !!(b1 & 0x80);
      let len = b1 & 0x7f, off = 2;
      if (b0 & 0x70) return this.close(CLOSE.protocol, 'reserved bits');
      if (len === 126) { if (this.buf.length < 4) return; len = this.buf.readUInt16BE(2); off = 4; }
      else if (len === 127) { if (this.buf.length < 10) return; const big = this.buf.readBigUInt64BE(2); if (big > BigInt(this.maxFrame)) return this.close(CLOSE.tooBig, 'too big'); len = Number(big); off = 10; }
      if (!masked) return this.close(CLOSE.protocol, 'client frames are masked');
      if (len > this.maxFrame) return this.close(CLOSE.tooBig, 'too big');
      if (op >= 8 && (len > 125 || !fin)) return this.close(CLOSE.protocol, 'bad control frame');
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4), payload = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);
      this.frame(fin, op, payload);
    }
  }
  frame(fin, op, payload) {
    if (op === 0x8) { const code = payload.length >= 2 ? payload.readUInt16BE(0) : CLOSE.normal; return this.close(code === 1005 ? CLOSE.normal : code, ''); }
    if (op === 0x9) return this.send(0xA, payload);
    if (op === 0xA) return;
    if (op === 0x2) return this.close(CLOSE.badData, 'text only');
    if (op === 0x1) {                                   /* a new message */
      if (this.frag) return this.close(CLOSE.protocol, 'unfinished message');
      this.frag = { chunks: [], size: 0, drop: false };
    } else if (op === 0x0) {                            /* its continuation */
      if (!this.frag) return this.close(CLOSE.protocol, 'unexpected continuation');
    } else return this.close(CLOSE.protocol, 'unknown opcode');
    const f = this.frag; f.size += payload.length;
    if (f.size > this.maxMessage) { f.drop = true; f.chunks = []; } else if (!f.drop) f.chunks.push(payload);
    if (fin) {
      this.frag = null;
      if (f.drop) { this.dropped++; this.onDrop && this.onDrop('big'); return; }
      this.onText(Buffer.concat(f.chunks).toString('utf8'));
    }
  }
  send(op, payload = Buffer.alloc(0)) {
    if (this.closed || this.socket.destroyed || !this.socket.writable) return false;
    const n = payload.length, head = n < 126 ? Buffer.from([0x80 | op, n]) : n < 65536 ? Buffer.from([0x80 | op, 126, n >> 8, n & 255]) : (() => { const h = Buffer.alloc(10); h[0] = 0x80 | op; h[1] = 127; h.writeBigUInt64BE(BigInt(n), 2); return h; })();
    this.socket.write(Buffer.concat([head, payload]));
    return true;
  }
  sendText(str) { return this.send(0x1, Buffer.from(str, 'utf8')); }
  /* close with a code and a short reason; the socket is ended once the close frame is out (and destroyed if the peer lingers) */
  close(code = CLOSE.normal, reason = '') {
    if (this.closing) return;
    this.closing = true;
    const r = Buffer.from(String(reason).slice(0, 100), 'utf8'), p = Buffer.alloc(2 + r.length); p.writeUInt16BE(code, 0); r.copy(p, 2);
    this.send(0x8, p);
    try { this.socket.end(); } catch {}
    const t = setTimeout(() => { try { this.socket.destroy(); } catch {} }, 1000); t.unref();
    this.finish();
  }
  finish() { if (this.closed) return; this.closed = true; this.onClose && this.onClose(); }
}

/* ---------- the hub ---------- */
export function startHub({ port = 47880, host = '0.0.0.0', key = process.env.ORLIS_PAD_KEY, padDir, gamesDir, fallback = false, loopbackHost = true, now = Date.now, limits = {} } = {}) {
  const L = { ...LIMITS, ...limits };
  if (!key) key = crypto.randomBytes(16).toString('hex');
  const dirs = { pad: padDir === undefined ? path.join(here, '..', 'app', 'dist-pad') : padDir, games: gamesDir || null };
  const pads = new Map();                      /* id -> { id, conn, ua, tokens, stamp } */
  let hostConn = null, nextId = 1;
  const stats = { padsOpened: 0, relayed: 0, droppedBig: 0, droppedFast: 0, closedBadJson: 0, refusedNoHost: 0, refusedFull: 0, hostsReplaced: 0 };

  const toHost = (obj) => { if (hostConn) hostConn.sendText(JSON.stringify(obj)); };
  const sameKey = (a) => { const x = Buffer.from(String(a || '')), y = Buffer.from(key); return x.length === y.length && crypto.timingSafeEqual(x, y); };

  /* static files: the pad page, and each game's pad program */
  const serve = (req, res) => {
    const url = new URL(req.url, 'http://x');
    let root = dirs.pad, rel = decodeURIComponent(url.pathname);
    if (rel.startsWith('/pads/')) { root = dirs.games; rel = rel.slice('/pads'.length); }
    if (rel.endsWith('/')) rel += 'index.html';
    if (rel.includes('\0')) { res.writeHead(400); return res.end(); }
    const file = root && path.join(root, path.normalize(rel));
    if (!root || !file.startsWith(path.resolve(root)) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      if (rel === '/index.html' && !dirs.pad) { res.writeHead(200, { 'Content-Type': TYPES['.html'] }); return res.end('<!doctype html><meta charset="utf-8"><title>Orlis pad</title><p>The pad page is not built yet.'); }
      res.writeHead(404, { 'Content-Type': TYPES['.txt'] }); return res.end('Not found');
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  };
  const server = http.createServer((req, res) => { try { serve(req, res); } catch { res.writeHead(500); res.end(); } });

  const closePad = (p, code, reason) => p.conn.close(code, reason);

  const addHost = (conn) => {
    if (hostConn) { stats.hostsReplaced++; const old = hostConn; hostConn = null; old.close(CLOSE.replaced, 'replaced'); }
    hostConn = conn;
    conn.onText = (text) => {
      let m; try { m = JSON.parse(text); } catch { return; }
      if (!m || typeof m !== 'object' || Array.isArray(m)) return;
      if (m.close === true && typeof m.to === 'string') { const p = pads.get(m.to); if (p) closePad(p, typeof m.code === 'number' ? m.code : CLOSE.normal, m.reason || ''); return; }
      if (m.to === '*') { const s = JSON.stringify(m.m); for (const p of pads.values()) p.conn.sendText(s); return; }
      if (typeof m.to === 'string') { const p = pads.get(m.to); if (p) p.conn.sendText(JSON.stringify(m.m)); }
    };
    conn.onClose = () => {
      if (hostConn !== conn) return;                       /* (it was replaced: the pads stay) */
      hostConn = null;
      for (const p of [...pads.values()]) closePad(p, CLOSE.noGame, 'no game running');
    };
    for (const p of pads.values()) toHost({ t: 'open', from: p.id, ua: p.ua });   /* a new host learns who is already here */
  };

  const addPad = (conn, ua) => {
    if (!hostConn) { stats.refusedNoHost++; conn.close(CLOSE.noGame, 'no game running'); return; }
    if (pads.size >= L.pads) { stats.refusedFull++; conn.close(CLOSE.full, 'full'); return; }
    const p = { id: 'c' + nextId++, conn, ua: String(ua || '').slice(0, 200), tokens: L.perSecond, stamp: now() };
    pads.set(p.id, p); stats.padsOpened++;
    conn.onDrop = (why) => { if (why === 'big') stats.droppedBig++; };
    conn.onText = (text) => {
      /* 60 a second: a bucket that refills; extras are dropped */
      const t = now(); p.tokens = Math.min(L.perSecond, p.tokens + (t - p.stamp) * L.perSecond / 1000); p.stamp = t;
      if (p.tokens < 1) { stats.droppedFast++; return; }
      p.tokens -= 1;
      let m; try { m = JSON.parse(text); } catch { m = undefined; }
      if (!m || typeof m !== 'object' || Array.isArray(m)) { stats.closedBadJson++; closePad(p, CLOSE.badData, 'not JSON'); return; }
      stats.relayed++;
      toHost({ t: 'msg', from: p.id, m });
    };
    conn.onClose = () => { if (pads.get(p.id) === p) { pads.delete(p.id); toHost({ t: 'close', from: p.id }); } };
    toHost({ t: 'open', from: p.id, ua: p.ua });
  };

  server.on('upgrade', (req, socket) => {
    try {
      const url = new URL(req.url, 'http://x'), wskey = req.headers['sec-websocket-key'];
      if (url.pathname !== '/ws' || !wskey || String(req.headers.upgrade).toLowerCase() !== 'websocket' || req.headers['sec-websocket-version'] !== '13') { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); return; }
      const role = url.searchParams.get('role');
      if (role !== 'pad' && role !== 'host') { socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'); return; }
      if (role === 'host') {
        const addr = req.socket.remoteAddress || '', local = addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
        if (!sameKey(url.searchParams.get('key')) || (loopbackHost && !local)) { socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); return; }
      }
      const accept = crypto.createHash('sha1').update(wskey + GUID).digest('base64');
      socket.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\n\r\n`);
      const conn = new Conn(socket, { onText() {}, onClose() {}, maxMessage: role === 'host' ? L.frame : L.message, maxFrame: L.frame });
      if (role === 'host') addHost(conn); else addPad(conn, req.headers['user-agent']);
    } catch { try { socket.destroy(); } catch {} }
  });

  const listen = (p) => new Promise((resolve, reject) => { const onErr = (e) => { server.off('listening', onOk); reject(e); }, onOk = () => { server.off('error', onErr); resolve(server.address().port); }; server.once('error', onErr); server.once('listening', onOk); server.listen(p, host); });
  const ready = (async () => {
    const tries = fallback && port ? [port, ...Array.from({ length: 9 }, (_, i) => port + 1 + i)] : [port];
    let last; for (const p of tries) { try { return await listen(p); } catch (e) { last = e; if (e.code !== 'EADDRINUSE') break; } }
    throw last;
  })();

  return ready.then((realPort) => ({
    port: realPort, key, stats,
    get padCount() { return pads.size; },
    get hasHost() { return !!hostConn; },
    url: `http://127.0.0.1:${realPort}`, wsUrl: `ws://127.0.0.1:${realPort}`,
    close() { return new Promise((resolve) => { for (const p of pads.values()) try { p.conn.socket.destroy(); } catch {} if (hostConn) try { hostConn.socket.destroy(); } catch {} server.closeAllConnections?.(); server.close(() => resolve()); }); }
  }));
}

/* run from the command line */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2]) || 47880;
  const hub = await startHub({ port, fallback: true });
  console.log(`Orlis pad hub on port ${hub.port}\nhost secret: ${hub.key}\nhost:  ${hub.wsUrl}/ws?role=host&key=${hub.key}\npads:  http://<this computer>:${hub.port}/`);
}

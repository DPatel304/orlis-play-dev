/* A very small web server: JSON in, JSON out, one route table. No framework,
   so there's nothing to install or keep updated. */
import { createServer } from 'node:http';

export class Fail extends Error {
  constructor(status, code, message){ super(message); this.status = status; this.code = code; }
}

const MAX_BODY = 64 * 1024;
/* a game's file, sent as it is (a creator's game) */
export const MAX_UPLOAD = 8 * 1024 * 1024;

/* A reply that's a web page (the server's own management page). */
export class Page {
  constructor(html){ this.html = html; }
}
/* Is this request from this very machine? */
export const isLocal = (ip) => ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';

/* Someone on the internet, come in through the internet door (a tunnel such
   as Tailscale Funnel, which hands their requests in from this machine). Never
   the owner, never the home Wi-Fi, never Tailscale. */
export const INTERNET = 'internet';
/* Who a request is from. Through the internet door: the internet, whatever
   it says. Otherwise the address it came from - except that something on this
   machine passing on someone else's request (a tunnel or proxy says so in its
   headers) isn't this machine either. */
const PASSED_ON = ['x-forwarded-for', 'forwarded', 'x-real-ip', 'tailscale-funnel-request', 'cf-connecting-ip'];
export function whoFrom(req, internet = false){
  if (internet) return INTERNET;
  const ip = req.socket.remoteAddress;
  if (isLocal(ip) && PASSED_ON.some(h => req.headers[h] !== undefined)) return INTERNET;
  return ip;
}
/* Whether someone's coming in over Tailscale: its addresses are 100.64.0.0/10
   (IPv4) and fd7a:115c:a1e0::/48 (IPv6). Only people the owner has shared
   this laptop with in Tailscale (or their own devices) can come from there. */
export function isTailscale(ip){
  if (typeof ip !== 'string') return false;
  const v4 = ip.replace(/^::ffff:/i, '');
  const m = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(v4);
  if (m) return +m[1] === 100 && +m[2] >= 64 && +m[2] <= 127;
  return /^fd7a:115c:a1e0:/i.test(ip);
}

/* A reply that's a file rather than JSON. */
export class Raw {
  constructor(data, name, type = 'application/octet-stream'){ this.data = data; this.name = name; this.type = type; }
}

/* When the server last heard from anyone (the updater waits for a quiet
   moment). */
export const activity = { last: 0 };

/* routes: [method, '/api/thing/:id', handler(req) -> body | [status, body]] */
export function makeServer(routes){
  const handle = handler(routes);
  const web = createServer((req, res) => handle(req, res, false));
  /* the internet door: the same server, where everyone is the internet */
  web.internetDoor = () => createServer((req, res) => handle(req, res, true));
  return web;
}
function handler(routes){
  const table = routes.map(([method, path, fn]) => {
    const names = [];
    const re = new RegExp('^' + path.replace(/:(\w+)/g, (_, n) => { names.push(n); return '([^/]+)'; }) + '$');
    return { method, re, names, fn };
  });
  return async (req, res, internet) => {
    activity.last = Date.now();
    /* The app is a page from its own address (tauri.localhost), so it needs
       permission to call this one. Sign-in uses a token in a header, not a
       cookie, so allowing any page to ask doesn't let one act as somebody. */
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Orlis-Name');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'OPTIONS'){ res.writeHead(204); res.end(); return; }
    const url = new URL(req.url, 'http://x');
    let status = 200, body;
    try {
      const hit = table.find(r => r.method === req.method && r.re.test(url.pathname));
      if (!hit) throw new Fail(404, 'not_found', 'Nothing here.');
      const m = url.pathname.match(hit.re);
      const params = Object.fromEntries(hit.names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
      const file = (req.headers['content-type'] || '').startsWith('application/octet-stream');
      const json = req.method === 'GET' || file ? {} : await readJson(req);
      const raw = file ? await readRaw(req) : null;
      const out = await hit.fn({ params, body: json, raw, query: url.searchParams, headers: req.headers, ip: whoFrom(req, internet) });
      if (Array.isArray(out)) [status, body] = out; else body = out;
    } catch (e){
      if (e instanceof Fail){ status = e.status; body = { error: e.code, message: e.message }; }
      else { console.error(e); status = 500; body = { error: 'server', message: 'Something went wrong on the server.' }; }
    }
    /* a page: only ever its own, with nothing from anywhere else */
    if (body instanceof Page){
      res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src data:", 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer' });
      res.end(body.html);
      return;
    }
    /* a file, sent as it is (a game download) */
    if (body instanceof Raw){
      res.writeHead(status, { 'Content-Type': body.type, 'Content-Length': body.data.length, 'Content-Disposition': `attachment; filename="${body.name}"` });
      res.end(body.data);
      return;
    }
    const text = JSON.stringify(body ?? {});
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(text) });
    res.end(text);
  };
}

function readRaw(req){
  return new Promise((ok, no) => {
    let size = 0, parts = [];
    /* (too big: the rest is read and dropped, so the answer gets through) */
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_UPLOAD){ parts = null; return; }
      if (parts) parts.push(c);
    });
    req.on('end', () => parts ? ok(Buffer.concat(parts)) : no(new Fail(413, 'too_big', 'That game is too big to send (8 MB at most).')));
    req.on('error', no);
  });
}

function readJson(req){
  return new Promise((ok, no) => {
    let size = 0; const parts = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY){ no(new Fail(413, 'too_big', 'That was too big to send.')); req.destroy(); return; }
      parts.push(c);
    });
    req.on('end', () => {
      if (!parts.length) return ok({});
      try { const v = JSON.parse(Buffer.concat(parts).toString('utf8')); ok(v && typeof v === 'object' ? v : {}); }
      catch { no(new Fail(400, 'bad_json', 'That request could not be read.')); }
    });
    req.on('error', no);
  });
}

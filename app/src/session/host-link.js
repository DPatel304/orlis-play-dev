/* The host link (plan package P4): the thin WebSocket client from the game host (WebView) to the pad hub (docs/specs/pad-protocol.md).
   It turns hub messages (open, close, msg) into calls on the session, and gives the session its `send` (with `send.close`).
   With no hub configured it does nothing, so games without pads keep working in the browser build.

     const link = createHostLink(hubConfig());          // { port, key } or null
     const session = createSession({ ..., send: link.send });
     link.attach(session); link.start();                 // start() is a no-op without a hub */

/* Where the hub is: the app (Tauri) sets window.__ORLIS_PAD_HUB__ = { port, key } before the game shell starts. Otherwise null. */
export function hubConfig(g = globalThis) { const c = g && g.__ORLIS_PAD_HUB__; return c && c.key && c.port ? { port: c.port, key: c.key } : null; }

export const BACKOFF = [500, 1000, 2000, 4000];

export function createHostLink(config, { WebSocketImpl = globalThis.WebSocket, setTimer = setTimeout, clearTimer = clearTimeout } = {}) {
  let session = null, ws = null, stopped = true, tries = 0, timer = null, up = false;
  const open = new Set();      /* pad ids the hub told us about, so a dropped host link can close them all */
  const out = (o) => { if (ws && up) { try { ws.send(JSON.stringify(o)); } catch { /* the close handler will deal with it */ } } };
  const send = (to, m) => out({ to, m });
  send.close = (to) => out({ to, close: true });

  function onMessage(raw) {
    let o; try { o = JSON.parse(typeof raw === 'string' ? raw : String(raw)); } catch { return; }
    if (!o || !session) return;
    if (o.t === 'open') { open.add(o.from); session.open(o.from, o.ua || ''); }
    else if (o.t === 'close') { open.delete(o.from); session.close(o.from); }
    else if (o.t === 'msg' && o.m && typeof o.m === 'object') session.message(o.from, o.m);
  }
  function connect() {
    if (stopped || !config || !WebSocketImpl) return;
    const sock = ws = new WebSocketImpl(`ws://127.0.0.1:${config.port}/ws?role=host&key=${encodeURIComponent(config.key)}`);
    sock.onopen = () => { if (ws === sock) { up = true; tries = 0; } };
    sock.onmessage = (e) => { if (ws === sock) onMessage(e.data); };
    sock.onclose = () => {
      if (ws !== sock) return;
      ws = null; up = false;
      if (session) for (const id of [...open]) session.close(id);     /* the hub closes every pad when the host goes */
      open.clear();
      if (!stopped) { timer = setTimer(connect, BACKOFF[Math.min(tries, BACKOFF.length - 1)]); tries++; }
    };
    sock.onerror = () => { /* onclose follows */ };
  }
  return {
    send,
    attach(s) { session = s; },
    get enabled() { return !!config; },
    get connected() { return up; },
    start() { if (!config || !stopped) return false; stopped = false; connect(); return true; },
    stop() { stopped = true; if (timer != null) clearTimer(timer); timer = null; const s = ws; ws = null; up = false; try { s && s.close(); } catch { /* ignore */ } }
  };
}

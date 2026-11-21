/* The pad's connection to the hub (spec: docs/specs/pad-protocol.md). One WebSocket that comes back by itself:
   - reconnects on close, on `visibilitychange` to visible, and on `online`, with backoff 0.5, 1, 2, 4 s (max 4 s);
   - pings every 2 s (`ping n`) and measures the round trip from `pong`; a link that has gone quiet (a locked phone) is dropped and rejoined;
   - the backoff starts over only when the host actually answers (a hub that accepts and then closes 4001 must not be hammered).
   No DOM here except the browser events, so it stays easy to test. */
export const BACKOFF = [500, 1000, 2000, 4000];
export const CLOSE = { noGame: 4001, full: 4003 };

export function createLink({ url, onOpen, onMessage, onClose, WS = WebSocket, doc = document, win = window, now = () => Date.now() } = {}) {
  let ws = null, fails = 0, timer = 0, pingTimer = 0, checkTimer = 0, n = 0, everHeard = false, dead = false;
  let lastHeard = 0;
  const sentAt = new Map();
  const link = { rtt: null, state: 'closed', get open() { return !!ws && ws.readyState === 1; } };

  function schedule(ms) { clearTimeout(timer); timer = setTimeout(connect, ms); }

  function connect() {
    if (dead) return;
    clearTimeout(timer);
    if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
    let sock;
    try { sock = new WS(url()); } catch { fails++; schedule(BACKOFF[Math.min(fails - 1, 3)]); return; }
    ws = sock; link.state = 'connecting'; everHeard = false;
    sock.addEventListener('open', () => { if (ws !== sock) return; link.state = 'open'; lastHeard = now(); onOpen && onOpen(); });
    sock.addEventListener('message', (e) => {
      if (ws !== sock) return;
      let m; try { m = JSON.parse(e.data); } catch { return; }
      lastHeard = now();
      if (!everHeard) { everHeard = true; fails = 0; }
      if (m && m.t === 'pong' && sentAt.has(m.n)) { link.rtt = now() - sentAt.get(m.n); sentAt.clear(); }
      onMessage && onMessage(m);
    });
    sock.addEventListener('close', (e) => { if (ws === sock) lost(e.code); });
    sock.addEventListener('error', () => { /* a close follows */ });
  }

  /* the socket is gone (or we gave up on it) */
  function lost(code, wait) {
    const sock = ws; ws = null; link.state = 'closed'; sentAt.clear();
    if (sock) { try { sock.close(); } catch { /* already gone */ } }
    if (dead) return;
    onClose && onClose({ code, everHeard });
    const ms = wait != null ? wait : BACKOFF[Math.min(fails, 3)];
    fails++;
    schedule(ms);
  }

  function ping() {
    if (!link.open) return;
    if (now() - lastHeard > 7000) { lost(1006); return; }        /* quiet for too long: the link is dead, rejoin */
    n++; sentAt.set(n, now()); link.send({ t: 'ping', n });
  }

  /* back on screen, or back online: if we are not connected, try now; if we look connected, check that we really are */
  function wake() {
    if (dead) return;
    if (!link.open && !(ws && ws.readyState === 0)) { fails = 0; connect(); return; }
    if (link.open) {
      const asked = now(); n++; sentAt.set(n, asked); link.send({ t: 'ping', n });
      clearTimeout(checkTimer);
      checkTimer = setTimeout(() => { if (link.open && lastHeard < asked) lost(1006, 0); }, 1500);
    }
  }

  link.send = (obj) => { if (!link.open) return false; try { ws.send(JSON.stringify(obj)); return true; } catch { return false; } };
  link.start = () => {
    connect();
    pingTimer = setInterval(ping, 2000);
    doc.addEventListener('visibilitychange', () => { if (doc.visibilityState === 'visible') wake(); });
    win.addEventListener('online', wake);
    win.addEventListener('pageshow', wake);
  };
  /* tests: pretend the network dropped without the browser noticing */
  link.drop = (code = 1006) => { if (ws) lost(code); };
  /* ask for a slower retry (a full game does not need asking every few seconds) */
  link.slow = (ms) => { if (!link.open) schedule(ms); };
  link.stop = () => { dead = true; clearTimeout(timer); clearInterval(pingTimer); clearTimeout(checkTimer); if (ws) try { ws.close(); } catch { /* done */ } };
  return link;
}

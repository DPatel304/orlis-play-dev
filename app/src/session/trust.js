/* The trusted-phones store on the Box (plan package P4; spec docs/specs/session.md, decision 0032).
   Records live under one localStorage key, `orlis.trustedPads`, as { [token]: { who, ua, lastSeen } }. Storage is injectable for tests;
   without any storage (or if it throws) the store works in memory for the run. */

export const TRUST_KEY = 'orlis.trustedPads';

/* A friendly name for Settings (P5), from a phone's user agent. */
export function deviceName(ua) {
  const u = String(ua || '');
  if (/iPad/i.test(u)) return 'iPad';
  if (/iPhone|iPod/i.test(u)) return 'iPhone';
  if (/Android/i.test(u)) return /Mobile/i.test(u) ? 'Android phone' : 'Android tablet';
  return 'Phone';
}

export function createTrust(storage = (typeof localStorage !== 'undefined' ? localStorage : null), now = Date.now) {
  let mem = null;     /* fallback when storage is missing or throws */
  const read = () => {
    if (mem) return mem;
    try { if (storage) { const o = JSON.parse(storage.getItem(TRUST_KEY) || '{}'); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } } catch { /* fall through */ }
    return {};
  };
  const write = (o) => {
    try { if (storage) { storage.setItem(TRUST_KEY, JSON.stringify(o)); mem = null; return; } } catch { /* fall through */ }
    mem = o;
  };
  return {
    get(token) { const r = read()[token]; return r ? { ...r } : null; },
    set(token, rec) { const o = read(); o[token] = { who: rec.who, ua: rec.ua || '', lastSeen: rec.lastSeen || now() }; write(o); },
    touch(token) { const o = read(); if (o[token]) { o[token].lastSeen = now(); write(o); } },
    remove(token) { const o = read(); if (!(token in o)) return false; delete o[token]; write(o); return true; },
    list() {
      return Object.entries(read()).map(([token, r]) => ({ token, who: r.who, ua: r.ua, lastSeen: r.lastSeen, name: deviceName(r.ua) }))
        .sort((a, b) => b.lastSeen - a.lastSeen);
    },
    deviceName
  };
}

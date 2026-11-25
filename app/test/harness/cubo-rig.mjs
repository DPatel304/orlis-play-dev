/* The rig for the end-to-end tests of Cubo's Create (decisions 0060, 0061): the real shell on the Vite dev server in headless Chromium, the family's
   server played by a small in-memory one (page.route), and a scripted body fed through the real tracker (pose._assign), the way tools/playtest and
   test/preview/cubo-create-shots.mjs do. Plain Node, no test-runner code here. Used by test/cubo-create-e2e.node.mjs.

     const rig = await startCuboRig();
     const s = await rig.open({ w: 1280, h: 720, items: [] });     // a page on the Create tab, errors counted
     s.key('Enter'); s.click('.chero'); s.body.add(0, { x: 0.5 }); await s.body.armsUp(0); s.shot('where');
     await rig.close();

   The body (in-page, window.__bodies) moves the way a person does, never faster: it walks at a walking pace, raises its arms over about half a
   second, reaches a hand out to a thing on the screen (found by selector each frame, so a thing that moves is followed), jumps. A body is a
   grown-up's or a child's (opts.kid: lower in the picture, smaller, a shorter arm). Nothing here calls into the flow; everything goes through pose._assign and the page's own elements. */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { T } from './slowness.mjs';

const { chromium } = createRequire(import.meta.url)('playwright');
export const APP = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SERVER = 'http://127.0.0.1:59871';          /* (the family's server: answered by the rig, never a real one) */
export const SHOTS = process.env.CUBO_E2E_SHOTS || null;  /* a folder: every s.shot() is saved there (docs/calm for the owner's pictures) */

export const PROFILES = [
  { id: 'p1', accountId: 'a1', name: 'Mum', look: { colour: 'pink', face: { eyes: 'happy', mouth: 'grin' }, top: 'bob', outfit: 'stripes', outfitColour: 'ui.gold', extra: 'none' } },
  { id: 'p2', accountId: 'a1', name: 'Ada', look: { colour: 'green', face: { eyes: 'wink', mouth: 'o' }, top: 'tuft', outfit: 'dots', outfitColour: 'touch.skyBlue', extra: 'none' } }
];
const accountOf = (profiles) => ({
  server: { url: SERVER, id: 's1', name: 'Home' }, token: 't', account: { id: 'a1', email: 'mum@example.com', role: 'owner' },
  household: { id: 'here', name: 'Home' }, profiles, current: profiles[profiles.length - 1].id
});

/* a child's body: lower in the picture (their head is lower), smaller, a shorter arm */
export const KID = { top: 0.38, span: 0.5 };
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
/* wait for fn() to be truthy; the deadline scales with how busy the machine is (harness/slowness.mjs) */
export async function until(fn, ms = 6000, label = ''){
  const t0 = Date.now(); let said = false;
  for (;;){
    const v = await fn(); if (v) return v;
    if (!said && Date.now() - t0 > 15000 && process.env.CUBO_DEBUG){ said = true; process.stderr.write('  ... still waiting for ' + (label || String(fn)) + '\n'); }
    if (Date.now() - t0 > ms && Date.now() - t0 > T(ms)) throw new Error('timed out waiting for ' + (label || String(fn)));
    await sleep(40);
  }
}

/* ---------- the person, in the page ---------- */
function bodyScript(){
  const DEFAULT_STAND = { top: 0.15, span: 0.72 };          /* a grown-up: head top and height, in picture heights (a child is lower and smaller) */
  const bodies = window.__bodies = [];
  const lerp = (a, b, k) => a + (b - a) * k;
  const toward = (v, goal, step) => Math.abs(goal - v) <= step ? goal : v + Math.sign(goal - v) * step;
  const vis = 0.95;
  const K = (x, y, v = vis) => ({ x, y, z: 0, v, visibility: v });
  class Person {
    constructor(o){
      Object.assign(this, { x: 0.5, cx: 0.5, up: 0, upGoal: 0, lift: 0, legs: true, reach: { l: null, r: null }, hand: { l: null, r: null }, jumpT: -1, present: true, speed: 0.22, top: DEFAULT_STAND.top, span: DEFAULT_STAND.span }, o);
      this.cx = this.x;
    }
    get sc(){ return this.span / DEFAULT_STAND.span; }
    /* the shoulder (for reaching) and how long an arm is, in picture heights */
    shoulder(s){ const sg = s === 'l' ? -1 : 1; return { x: this.cx + sg * 0.05 * this.sc, y: this.top + this.span * 0.22 - this.lift }; }
    get arm(){ return this.span * 0.44; }
    /* one step of the person's own motion, dt seconds */
    move(dt){
      this.x = toward(this.x, this.goalX ?? this.x, this.speed * dt);
      this.cx = this.x;
      this.up = toward(this.up, this.upGoal, dt * 2.2);          /* both arms up take about half a second */
      if (this.jumpT >= 0){ this.jumpT += dt; const k = this.jumpT / 0.5; this.lift = k >= 1 ? 0 : Math.sin(Math.PI * k) * 0.1 * this.sc; if (k >= 1){ this.jumpT = -1; this.lift = 0; } }
      /* hands: toward the thing reached for (or back to the side), at a hand's pace */
      for (const s of ['l', 'r']){
        const want = this.reach[s] ? this.resolve(this.reach[s], s) : null;
        const rest = this.restPoint(s);
        const goal = want || rest;
        const cur = this.hand[s] || rest;
        const sp = 1.9 * dt;
        const dx = goal.x - cur.x, dy = goal.y - cur.y, d = Math.hypot(dx, dy);
        this.hand[s] = d <= sp ? { x: goal.x, y: goal.y } : { x: cur.x + dx / d * sp, y: cur.y + dy / d * sp };
        this.hand[s].reaching = !!want;
      }
    }
    resolve(r, side){
      if (r.xy) return { x: r.xy[0], y: r.xy[1] };
      const els = [...document.querySelectorAll(r.sel)].filter(e => !e.classList.contains('hide') && !e.closest('.hide') && e.getBoundingClientRect().width > 0);
      const e = els[r.nth || 0];
      if (!e) return null;
      const b = e.getBoundingClientRect();
      if (r.near){
        /* the nearest point of the thing to the player's own shoulder, a little inside its edge (what a person would do: reach in as little as they can) */
        const sh = this.shoulder(side || 'r'), inx = b.width * 0.22, iny = b.height * 0.22;
        const x = Math.max(b.left + inx, Math.min(b.right - inx, sh.x * innerWidth)), y = Math.max(b.top + iny, Math.min(b.bottom - iny, sh.y * innerHeight));
        return { x: x / innerWidth, y: y / innerHeight };
      }
      return { x: (b.left + b.width * (r.fx ?? 0.5)) / innerWidth, y: (b.top + b.height * (r.fy ?? 0.5)) / innerHeight };
    }
    restPoint(s){ const sg = s === 'l' ? -1 : 1; return { x: this.cx + sg * 0.08 * this.sc, y: this.top + this.span * 0.52 - this.lift }; }
    landmarks(){
      const { top, span, sc } = this, cx = this.cx, lift = this.lift;
      const lm = Array.from({ length: 33 }, () => K(cx, 0.5));
      const at = (i, dx, f) => { lm[i] = K(cx + dx * sc, top + span * f - lift); };
      at(0, 0, 0); at(2, -0.01, -0.02); at(5, 0.01, -0.02);
      at(11, -0.05, 0.22); at(12, 0.05, 0.22);
      at(23, -0.03, 0.55); at(24, 0.03, 0.55);
      at(25, -0.032, 0.78); at(26, 0.032, 0.78); at(27, -0.034, 1); at(28, 0.034, 1);
      for (const i of [29, 30, 31, 32]) at(i, i % 2 ? 0.034 : -0.034, 1.03);
      if (!this.legs) for (const i of [25, 26, 27, 28, 29, 30, 31, 32]) lm[i] = K(lm[i].x, 1.2, 0.05);     /* (legs out of the picture: the camera too close or tilted up) */
      /* arms: the wrist where the hand is (raised arms lift it above the head), the elbow between shoulder and wrist, bent a little outward */
      for (const [s, wi, ei, si] of [['l', 15, 13, 11], ['r', 16, 14, 12]]){
        const sg = s === 'l' ? -1 : 1, sh = lm[si], h = this.hand[s] || this.restPoint(s);
        const upY = top + span * -0.1 - lift;
        let w = { x: h.x, y: h.y };
        if (this.up > 0){ w = { x: lerp(h.x, cx + sg * 0.08 * sc, this.up), y: lerp(h.y, upY, this.up) }; }
        const reaching = h.reaching || this.up > 0.2 || Math.hypot(h.x - this.restPoint(s).x, h.y - this.restPoint(s).y) > 0.04;
        /* (a straight arm to something out to the side; a hand held in front of the chest has the elbow out and the forearm across) */
        const front = Math.abs(w.x - sh.x) < 0.1 * sc && w.y > sh.y;
        const e = reaching ? (front ? { x: sh.x + sg * 0.09 * sc, y: w.y + 0.03 * sc } : { x: (sh.x + w.x) / 2, y: (sh.y + w.y) / 2 }) : { x: cx + sg * 0.075 * sc, y: top + span * 0.38 - lift };
        lm[ei] = K(e.x, e.y); lm[wi] = K(w.x, w.y);
      }
      return lm;
    }
  }
  /* the tracker is fed ten-plus times a second, like a camera */
  const FPS = 15;
  let started = false;
  /* the camera, as far as the page can tell: the page asks for it (pose.wake) and lets it go (pose.sleep); with it off nobody is seen. The real
     tracker is replaced by the scripted bodies (pose._update does nothing), but the page's own loop still draws between samples (pose.update -> at). */
  const cam = window.__cam = { wanted: false, wakes: 0, sleeps: 0 };
  const feed = () => {
    const pose = window.__pose; if (!pose || window.__feedOff || !cam.wanted) return;
    pose.mouse.active = false;
    const dt = 1 / FPS;
    for (const p of bodies) if (p) p.move(dt);
    pose._assign(bodies.filter(p => p && p.present).map(p => p.landmarks()), dt);
  };
  const poll = setInterval(() => {
    const pose = window.__pose;
    if (!pose || started) return;
    started = true; clearInterval(poll);
    if (!window.__feedOff){
      pose._update = () => {};
      const sleep = pose.sleep.bind(pose);
      pose.wake = async () => { cam.wanted = true; cam.wakes++; pose._want = true; pose.on = true; pose.ready = true; pose.usingCamera = true; return true; };
      pose.sleep = () => { cam.wanted = false; cam.sleeps++; sleep(); };
    }
    setInterval(feed, 1000 / FPS);
  }, 5);
  window.__body = {
    add(i, o){ bodies[i] = new Person(o || {}); return bodies[i]; },
    remove(i){ if (bodies[i]) bodies[i].present = false; },
    get(i){ return bodies[i]; },
    walkTo(i, x, speed){ const p = bodies[i]; p.goalX = x; if (speed) p.speed = speed; },
    armsUp(i, on){ bodies[i].upGoal = on ? 1 : 0; },
    reach(i, side, r){ bodies[i].reach[side] = r; },
    jump(i){ bodies[i].jumpT = 0; },
    /* where a target is against a person's reach: how far the nearest point of it is from their shoulder (picture heights), how long their arm is, and where it is against their hips */
    reachInfo(i, sel, nth = 0, side = 'r'){
      const p = bodies[i];
      const els = [...document.querySelectorAll(sel)].filter(e => !e.classList.contains('hide') && !e.closest('.hide') && e.getBoundingClientRect().width > 0), el = els[nth];
      if (!el) return null;
      const b = el.getBoundingClientRect(), sh = p.shoulder(side), A = innerWidth / innerHeight;
      const nx = Math.max(b.left, Math.min(b.right, sh.x * innerWidth)) / innerWidth, ny = Math.max(b.top, Math.min(b.bottom, sh.y * innerHeight)) / innerHeight;
      return { d: Math.hypot((nx - sh.x) * A, ny - sh.y), arm: p.arm, centreY: (b.top + b.height / 2) / innerHeight, bottom: b.bottom / innerHeight, top: b.top / innerHeight, hips: p.top + p.span * 0.55 - p.lift, head: p.top - p.lift, shoulder: sh.y, w: b.width / innerWidth };
    }
  };
}

/* ---------- the family's server, in memory ---------- */
function fakeServer(opts){
  const store = { creations: (opts.items || []).map(c => ({ ...c })), n: 0, calls: [], down: !!opts.down };
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, body: JSON.stringify(body) });
  const handler = async (route) => {
    const req = route.request(), u = new URL(req.url()), method = req.method();
    if (method === 'OPTIONS') return json(route, 204, {});
    store.calls.push(`${method} ${u.pathname}`);
    if (store.down) return route.abort('connectionrefused');
    if (u.pathname === '/api/creations' && method === 'GET') return json(route, 200, { creations: store.creations });
    if (u.pathname === '/api/creations' && method === 'POST'){
      const b = JSON.parse(req.postData() || '{}'), now = new Date().toISOString();
      const at = b.id ? store.creations.findIndex(c => c.id === b.id) : -1;
      if (at < 0 && store.creations.length >= 3) return json(route, 409, { error: 'full', message: 'Your slots are full - remove one to make another' });
      const saved = { id: at >= 0 ? b.id : 'srv-' + (++store.n), name: b.name, picks: b.picks, desc: b.desc, makerId: b.makerId, createdAt: at >= 0 ? store.creations[at].createdAt : now, updatedAt: now };
      if (at >= 0) store.creations[at] = saved; else store.creations.push(saved);
      return json(route, 200, saved);
    }
    if (u.pathname.startsWith('/api/creations/') && method === 'DELETE'){ store.creations = store.creations.filter(c => c.id !== decodeURIComponent(u.pathname.split('/').pop())); return json(route, 200, {}); }
    if (u.pathname === '/api/me') return json(route, 200, { account: { id: 'a1', email: 'mum@example.com', role: 'owner' }, household: { id: 'here', name: 'Home' }, profiles: opts.profiles });
    return json(route, 200, {});
  };
  return { store, handler };
}

export async function startCuboRig(){
  const dev = await createServer({ root: APP, configFile: path.join(APP, 'vite.config.js'), logLevel: 'silent', server: { host: '127.0.0.1', port: 0, strictPort: false }, clearScreen: false });
  await dev.listen();
  const base = `http://127.0.0.1:${dev.httpServer.address().port}`;
  const browser = await chromium.launch({ args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const contexts = [];
  const rig = { base, browser, dev };

  /* a page on the Create tab: Player app, the family signed in, the server answered by the rig. opts: w, h, profiles, items (the games already made),
     down (the server out of reach), person (a body standing at x, or false for none), framed (false: the camera first shows legs cut off) */
  rig.open = async (opts = {}) => {
    const { w = 1280, h = 720, profiles = PROFILES, items = [], down = false, person = null, quiet = false, reduced = false, kid = false } = opts;
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
    contexts.push(ctx);
    await ctx.addInitScript(([acc, items]) => {
      try {
        localStorage.setItem('orlis.account', JSON.stringify(acc)); localStorage.setItem('orlis_framing_shown', '1'); localStorage.setItem('orlis_mode', 'player');
        localStorage.setItem('orlis.creations:here', JSON.stringify(items));
      } catch { /* no storage */ }
    }, [accountOf(profiles), items]);
    await ctx.addInitScript((off) => { window.__feedOff = off; }, opts.mouse === true);
    await ctx.addInitScript(bodyScript);
    const fake = fakeServer({ items, profiles, down });
    await ctx.route(`${SERVER}/**`, fake.handler);
    const page = await ctx.newPage();
    const s = { page, ctx, w, h, kid, fake, errors: [], logs: [], shots: [] };
    page.on('pageerror', (e) => { s.errors.push('pageerror: ' + (e.stack || e.message || e)); });
    page.on('console', (m) => {
      if (m.type() === 'error'){
        const loc = m.location && m.location() ? m.location().url || '' : '';
        if (down && /127\.0\.0\.1:59871/.test(loc + m.text())) return;              /* (the dead server's own refusals) */
        if (/ERR_ABORTED|GL Driver|GPU stall/.test(m.text())) return;
        s.errors.push('console.error: ' + m.text() + ' @ ' + loc);
      }
    });
    await page.goto(`${base}/?splash=0`);
    await page.waitForFunction(() => !!(window.__go && window.__pose), null, { timeout: T(30000) });
    if (person !== false && opts.mouse !== true){ await page.evaluate((o) => window.__body.add(0, o), { x: 0.5, ...(kid ? KID : {}), ...(person || {}) }); }
    Object.assign(s, helpers(s));
    /* what Cubo says, as the page's voice is asked (a line said twice, or at the wrong time, shows here) */
    await page.evaluate(async () => {
      const { voice } = await import('/src/audio/voice.js');
      window.__said = []; const say = voice.say.bind(voice);
      const { sfx } = await import('/src/audio/sound.js');
      window.__sfx = { rise: [], pop: 0, whoosh: 0 };
      for (const k of ['rise', 'pop', 'whoosh']){ const o = sfx[k].bind(sfx); sfx[k] = (...a) => { if (k === 'rise') window.__sfx.rise.push(a[0]); else window.__sfx[k]++; return o(...a); }; }
      voice.say = (line, ...r) => { window.__said.push({ t: Math.round(performance.now()), line, step: (document.querySelector('.cc') || {}).dataset ? document.querySelector('.cc').dataset.step : null }); return say(line, ...r); };
    });
    if (!opts.stayHome) await s.toCreate();
    return s;
  };
  rig.close = async () => {
    for (const c of contexts.splice(0)) await c.close().catch(() => {});
    await browser.close().catch(() => {});
    await dev.close().catch(() => {});
  };
  return rig;
}

/* ---------- what a test does with a page ---------- */
function helpers(s){
  const { page } = s;
  const h = {
    async toCreate(){ await page.evaluate(() => window.__go.toCreate()); await page.waitForSelector('.cmake .chero', { timeout: T(15000) }); await sleep(300); },
    step: () => page.evaluate(() => { const c = document.querySelector('.cc'); return c ? c.getAttribute('data-step') : null; }),
    /* the flow's step, with the start screen as 'start' (the flow is at start until it is begun) */
    async stepIs(want, ms = 8000){ return until(async () => (await h.step()) === want, ms, `step ${want} (now ${await h.step()})`); },
    mode: () => page.evaluate(() => window.__mode()),
    async modeIs(want, ms = 15000){ return until(async () => (await h.mode()) === want, ms, `mode ${want} (now ${await h.mode()})`); },
    key: async (k) => { await page.keyboard.press(k); },
    /* a remote key, then a moment for the frame to draw (and a step's lock) */
    async keys(...ks){ for (const k of ks){ await page.keyboard.press(k); await sleep(60); } },
    click: (sel, nth = 0) => page.locator(sel).nth(nth).click({ timeout: T(8000) }),
    /* the step's lock (a hand resting where the last pick was is waited out) */
    async settled(ms = 1500){ await until(async () => !(await page.evaluate(() => document.querySelector('.cc')?.hasAttribute('data-locked'))), ms).catch(() => {}); await sleep(100); },
    text: (sel) => page.locator(sel).first().innerText(),
    visible: (sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].some(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && !e.closest('.hide'); }), sel),
    /* a picture of the page now: docs/calm/cubo2-<name>[-child][-720].png */
    async shot(name){
      if (!SHOTS) return;
      fs.mkdirSync(SHOTS, { recursive: true });
      const file = path.join(SHOTS, `cubo2-${name}${s.kid ? '-child' : ''}${s.w === 1920 ? '' : '-720'}.png`);
      await page.screenshot({ path: file }); s.shots.push(file);
    },
    /* the remote's focus picture */
    async focusShot(name){ return h.shot('focus-' + name); },
    /* the page's own clock (seconds): it runs as fast as the page does, so a wait on it is steady however busy the machine is */
    clock: () => page.evaluate(() => { const c = document.querySelector('.cc'); return c ? c.clock : 0; }),
    async pageWait(secs, label = ''){ const t0 = await h.clock(); await until(async () => (await h.clock()) - t0 >= secs, Math.max(4000, secs * 3000), `${secs} s of the page's own time ${label}`); },
    zone: () => page.evaluate(() => { const c = document.querySelector('.cc'); return c ? c.zone : null; }),
    /* every target on the page now: name, rect (shares of the picture) */
    targets: () => page.evaluate(() => [...document.querySelectorAll('.cc [data-t]')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && !e.closest('.hide') && getComputedStyle(e).display !== 'none'; })
      .map(e => { const r = e.getBoundingClientRect(); return { name: e.dataset.t, x: r.left / innerWidth, y: r.top / innerHeight, w: r.width / innerWidth, h: r.height / innerHeight }; })),
    /* how far the player's arm has to go to a target (see reachInfo in the page's body) */
    reachInfo: (sel, nth = 0, i = 0, side = 'r') => page.evaluate(([i, sel, nth, side]) => window.__body.reachInfo(i, sel, nth, side), [i, sel, nth, side]),
    /* the page's own words: the bubble, and any toast */
    bubble: () => page.evaluate(() => (document.querySelector('.ccbubble .cctext') || {}).textContent || ''),
    /* a record of what Cubo has said (the page's voice calls), so a line said twice or at the wrong time shows */
    async hearLog(){ return page.evaluate(() => window.__said || []); },
    sfx: () => page.evaluate(() => window.__sfx),
    holding: () => page.evaluate(() => { const c = document.querySelector('.cc'); return c ? c.holding : null; }),
    carousel: () => page.evaluate(() => document.querySelector('.cc').carousel),
    state: () => page.evaluate(() => { const c = document.querySelector('.cc'); return c ? JSON.parse(JSON.stringify(c.state)) : null; }),
    body: {
      add: (i, o) => page.evaluate(([i, o]) => window.__body.add(i, o), [i, o]),
      remove: (i) => page.evaluate((i) => window.__body.remove(i), i),
      walkTo: (i, x, speed) => page.evaluate(([i, x, speed]) => window.__body.walkTo(i, x, speed), [i, x, speed]),
      async walk(i, x){ await h.body.walkTo(i, x); await until(() => page.evaluate(([i, x]) => Math.abs(window.__body.get(i).x - x) < 0.004, [i, x]), 20000, 'the walk'); },
      armsUp: (i = 0, on = true) => page.evaluate(([i, on]) => window.__body.armsUp(i, on), [i, on]),
      armsDown: (i = 0) => page.evaluate((i) => window.__body.armsUp(i, false), i),
      /* reach for a thing the way a person would: to the nearest point of it, by the shoulder, else to its middle (reachEl) */
      reachNear: (sel, nth = 0, o = {}) => page.evaluate(([sel, nth, o]) => window.__body.reach(o.i || 0, o.side || 'r', { sel, nth, near: true }), [sel, nth, o]),
      reachEl: (sel, nth = 0, o = {}) => page.evaluate(([sel, nth, o]) => window.__body.reach(o.i || 0, o.side || 'r', { sel, nth, ...o }), [sel, nth, o]),
      reachXY: (x, y, o = {}) => page.evaluate(([x, y, o]) => window.__body.reach(o.i || 0, o.side || 'r', { xy: [x, y] }), [x, y, o]),
      release: (i = 0) => page.evaluate((i) => { window.__body.reach(i, 'l', null); window.__body.reach(i, 'r', null); }, i),
      jump: (i = 0) => page.evaluate((i) => window.__body.jump(i), i),
      legs: (i, on) => page.evaluate(([i, on]) => { window.__body.get(i).legs = on; }, [i, on]),
      /* a hand held in a thing until it has done what it does (pred, run in node), then taken away */
      async hold(sel, nth, pred, ms = 9000, o = {}){
        await h.body.reachNear(sel, nth, o);
        try { await until(pred, ms, `holding ${sel}[${nth}]`); } finally { await h.body.release(o.i || 0); }
      }
    }
  };
  return h;
}

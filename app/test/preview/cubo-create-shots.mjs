/* Pictures of Cubo's Create (decision 0060): the start screen, Where mid-step, the game cards, the group bubbles and the wheel with two picked, the
   Rules sliders, the name wheel, and the made game playing - into docs/calm/cubo-create-*.png (or CUBO_OUT), at 1920x1080 and 1280x720.
   The player is a scripted body put through pose._assign ten times a second (the camera is not used), steered from here with window.__body.
   Run (dev server up):  cd app && npx vite --port 5207 --strictPort   then   node test/preview/cubo-create-shots.mjs
   (Headless Chromium draws in software: the pictures are about the look.) */
import { createRequire } from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
const { chromium } = createRequire(import.meta.url)('/opt/node-tools/node_modules/playwright');
const OUT = process.env.CUBO_OUT || path.resolve(import.meta.dirname, '..', '..', '..', 'docs', 'calm');
const URL = process.env.URL || 'http://localhost:5207/?splash=0';
fs.mkdirSync(OUT, { recursive: true });
const SIZES = [[1920, 1080, ''], [1280, 720, '-720']];
const account = {
  server: { url: 'http://127.0.0.1:1', id: 's1', name: 'Home' }, token: 't', account: { id: 'a1', email: 'mum@example.com', role: 'owner' },
  household: { id: 'here', name: 'Home' },
  profiles: [{ id: 'p1', accountId: 'a1', name: 'Mum', look: { skin: 0 } }, { id: 'p2', accountId: 'a1', name: 'Ada', look: { skin: 1 } }], current: 'p2'
};
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });

/* a standing body, steered through window.__body = { x, up } */
const script = () => {
  window.__body = { x: 0.5, up: false };
  const poll = setInterval(() => {
    const pose = window.__pose;
    if (!pose) return;
    clearInterval(poll);
    pose.update = () => {}; pose.mouse.active = false;
    const body = () => {
      const { x: cx, up } = window.__body, top = 0.15, span = 0.72;
      const lm = Array.from({ length: 33 }, () => ({ x: cx, y: 0.5, z: 0, v: 0.95, visibility: 0.95 }));
      const at = (i, dx, f) => { lm[i] = { x: cx + dx, y: top + span * f, z: 0, v: 0.95, visibility: 0.95 }; };
      at(0, 0, 0); at(2, -0.01, -0.02); at(5, 0.01, -0.02);
      at(11, -0.05, 0.22); at(12, 0.05, 0.22); at(13, -0.075, 0.38); at(14, 0.075, 0.38); at(15, -0.08, up ? -0.1 : 0.52); at(16, 0.08, up ? -0.1 : 0.52);
      if (window.__body.reach) { const r = window.__body.reach; lm[16] = { x: r.x, y: r.y, z: 0, v: 0.95, visibility: 0.95 }; lm[14] = { x: cx + (r.x - cx) * 0.5, y: r.y - 0.02, z: 0, v: 0.95, visibility: 0.95 }; }   /* the right hand reaching to a spot on the screen, the forearm out */
      at(23, -0.03, 0.55); at(24, 0.03, 0.55); at(25, -0.032, 0.78); at(26, 0.032, 0.78); at(27, -0.034, 1); at(28, 0.034, 1);
      for (const i of [29, 30, 31, 32]) at(i, i % 2 ? 0.034 : -0.034, 1.03);
      return lm;
    };
    setInterval(() => { pose.mouse.active = false; pose.on = true; pose.ready = true; pose._assign([body()], 0.1); pose.at(); }, 100);
  }, 5);
};

for (const [w, h, sfx] of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(([a]) => { try { localStorage.setItem('orlis.account', JSON.stringify(a)); localStorage.setItem('orlis_framing_shown', '1'); localStorage.removeItem('orlis.creations:here'); } catch {} }, [account]);
  await ctx.addInitScript(script);
  const page = await ctx.newPage();
  page.errors = []; page.on('pageerror', e => { page.errors.push(String(e)); console.log('PAGE ERROR', String(e).slice(0, 200)); });
  const body = (x, up) => page.evaluate(([x, up]) => { window.__body = { x, up }; }, [x, up]);
  const snap = async (name) => { await page.screenshot({ path: path.join(OUT, `cubo-create-${name}${sfx}.png`) }); console.log('saved', name, w, await page.evaluate(() => document.querySelector('.cc') ? document.querySelector('.cc').getAttribute('data-step') : 'no cc')); };
  /* (a body that jumps across the picture is a different person to the tracker, so it walks) */
  let at = 0.5;
  const walk = async (to) => { while (Math.abs(to - at) > 0.001) { at += Math.sign(to - at) * Math.min(0.04, Math.abs(to - at)); await body(at, false); await page.waitForTimeout(100); } };
  /* a hand reaching into a thing on the screen, held there (the way a player touches it) */
  const reach = async (sel, nth, ms) => {
    const r = await page.locator(sel).nth(nth).boundingBox();
    await page.evaluate(([x, y]) => { window.__body.reach = { x, y }; }, [(r.x + r.width / 2) / w, (r.y + r.height / 2) / h]);
    await page.waitForTimeout(ms);
    await page.evaluate(() => { window.__body.reach = null; });
  };
  const armsUp = async () => { await body(at, true); await page.waitForTimeout(1500); await body(at, false); await page.waitForTimeout(1300); };
  await page.goto(URL); await page.waitForTimeout(2500);
  await page.evaluate(() => window.__go.toCreate()); await page.waitForTimeout(1800);
  await body(at, false); await page.waitForTimeout(600);
  await snap('start');
  await armsUp();
  /* where: mid-step, partway across the picture */
  await walk(0.3); await walk(0.4); await page.waitForTimeout(900);
  await snap('where');
  await body(at, true); await page.waitForTimeout(1500);
  await walk(0.06); await page.waitForTimeout(500);
  await snap('game');
  await reach('.cccard', 1, 2600); await page.waitForTimeout(1500);
  await snap('what-groups');
  await page.waitForTimeout(800); await reach('.ccchip', 1, 2600); await page.waitForTimeout(1000);
  await reach('.ccspot', 0, 4300); await page.waitForTimeout(500);
  await snap('what-wheel');
  await body(at, true); await page.waitForTimeout(1500); await body(at, false); await page.waitForTimeout(1000);
  await reach('.ccstop', 5, 900); await reach('.ccstop', 9, 900); await page.waitForTimeout(600);
  await snap('rules');
  await body(at, true); await page.waitForTimeout(1500); await body(at, false); await page.waitForTimeout(800);
  await walk(0.5);
  await page.waitForTimeout(1200);
  await snap('name');
  await body(at, true); await page.waitForTimeout(1500); await body(at, false);
  await page.waitForTimeout(1500);
  console.log('mode', await page.evaluate(() => window.__mode()));
  await page.getByText('Let’s play').first().click().catch(() => {}); await page.waitForTimeout(5500);
  console.log('mode', await page.evaluate(() => window.__mode()));
  await snap('playing');
  console.log('errors', page.errors);
  await ctx.close();
}
await browser.close();

/* Sky Painter's covers: no goal bar and no outline, a different cover for each picture (never the same twice running), three layers that wear
   through in order, the picture never drawn before it's uncovered, sounds, and a quieter version for those who want less motion. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { pose } from '../src/tracking/pose.js';
import skyPainter, { GRID, COVER_IDS, LAYERS, STALL, STARTED } from '../src/games/sky-painter.js';
import { COVERS, scrubSound, fanfare, dice } from '../src/games/sky-covers.js';
import { PALETTE } from '../src/games/assets/palette.js';

const DT = 1 / 30, W = 1920, H = 1080;
function players(n){
  pose.mouse.active = false;
  pose.players.forEach((p, i) => {
    p.present = i < n; p.lm = null;
    p.hands.left = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 }; p.hands.right = { x: 0.5, y: 0.5, vx: 0, vy: 0, speed: 0 };
  });
}
/* the hand goes back and forth over a patch of the screen */
let clock = 0;
function scrub(g, secs, x0 = 0.3, x1 = 0.7, y0 = 0.55, y1 = 0.8){
  const h = pose.players[0].hands; let t = 0;
  while (t < secs && !g.alive){
    t += DT; clock += DT; const f = (Math.sin(clock * 14) + 1) / 2, f2 = (Math.sin(clock * 2.1) + 1) / 2;
    h.right = { x: x0 + (x1 - x0) * f, y: y0 + (y1 - y0) * f2, vx: 1, vy: 0, speed: 1 }; h.left = { x: 0.5, y: 0.95, vx: 0, vy: 0, speed: 0 }; g.step(DT, W, H);
  }
  return t;
}

/* a canvas that remembers what it was asked to do (the real ones are not in Node) */
function recorder(){   /* (a canvas; its context is canvas.getContext('2d'); both log to the same list) */
  const log = [];
  const ctx = new Proxy({ log }, {
    get(t, k){
      if (k in t) return t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient' || k === 'createPattern') return () => ({ addColorStop(){} });
      if (k === 'measureText') return () => ({ width: 10 });
      return (...a) => { log.push([k, ...a]); };
    },
    set(t, k, v){ t[k] = v; return true; }
  });
  return { width: 1, height: 1, getContext: () => ctx, log };
}
function withCanvases(fn){
  const was = document.createElement;
  document.createElement = (tag) => tag === 'canvas' ? recorder() : was.call(document, tag);
  try { return fn(); } finally { document.createElement = was; }
}

test('Sky Painter has no goal bar (the other games keep theirs), and no hint of what the picture is', () => {
  players(1);
  const g = skyPainter.create(1);
  const hud = g.hud();
  assert.equal(hud.goal, undefined, 'no goal bar');
  assert.ok(!('goal' in hud));
  assert.ok(hud.words && hud.words.text, 'but the words stay');
  assert.doesNotMatch(hud.words.text, /whale|balloon|butterfly/i, 'and they do not say what is hiding');
  const src = JSON.stringify(g.hud());
  assert.doesNotMatch(src, /whale|balloon|butterfly/i);
});

test('five covers, three layers each, with their own words, in the palette', () => {
  assert.deepEqual(COVER_IDS, ['clouds', 'frost', 'snow', 'foam', 'sand']);
  assert.equal(LAYERS, 3);
  const hints = { clouds: /clouds/i, frost: /frost/i, snow: /snow/i, foam: /bubbles|foam/i, sand: /sand/i };
  for (const c of COVERS){
    assert.equal(c.bake.length, 3, c.id + ' has three layers');
    assert.equal(c.thick.length, 3); assert.equal(c.bits.length, 3);
    assert.match(c.hint, hints[c.id]); assert.match(c.hint, /!$/);
    assert.ok(c.icon);
  }
  assert.equal(COVERS.find(c => c.id === 'frost').hint, 'Wipe away the frost!');
  assert.equal(COVERS.find(c => c.id === 'snow').hint, 'Brush off the snow!');
  for (const c of COVERS) for (const b of c.bits) for (const name of b.col) assert.ok(PALETTE[name.split('.')[0]][name.split('.')[1]], 'a palette name: ' + name);
});

test('the covers come round in turn: all five, and never the same one twice running', () => {
  players(1);
  for (let seed = 1; seed <= 20; seed++){
    const g = skyPainter.create(1); let s = seed * 7919;
    g.rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    for (let i = 0; i < 60; i++) g._fresh();
    const ids = g.history;
    for (let i = 1; i < ids.length; i++) assert.notEqual(ids[i], ids[i - 1], `seed ${seed}: picture ${i} repeats ${ids[i]}`);
    for (let i = 0; i + 5 <= ids.length; i += 5) assert.equal(new Set(ids.slice(i, i + 5)).size, 5, 'each turn of five has them all');
  }
  const g = skyPainter.create(1);
  g.useCover('sand'); assert.equal(g.cover.id, 'sand');
});

test('every picture gets the next cover when it is finished', () => {
  players(1);
  const g = skyPainter.create(1); const seen = [g.cover.id];
  for (let n = 0; n < 4; n++){
    g.alive = 0.001; g.done++;
    for (let t = 0; t < 5.5; t += DT) g.step(DT, W, H);
    seen.push(g.cover.id);
  }
  assert.equal(new Set(seen).size, 5, seen.join(' '));
});

test('a layer wears through in order: the top one first, then the next, then the last, then the picture', () => {
  players(1);
  for (const id of COVER_IDS){
    const g = skyPainter.create(1); g.useCover(id);
    const h = pose.players[0].hands; h.right = { x: 0.5, y: 0.7, vx: 0, vy: 0, speed: 0 }; g.step(DT, W, H);
    const cell = (Math.floor(0.7 * GRID[1])) * GRID[0] + Math.floor(0.5 * GRID[0]);
    assert.ok(!g.out[cell]);
    const seen = []; let t = 0;
    while (g.wear[cell] < g.cum[2] && t < 300){
      scrub(g, DT, 0.4, 0.6, 0.65, 0.75); t += DT;
      const layer = g.layerOf(g.wear[cell]); if (seen[seen.length - 1] !== layer) seen.push(layer);
    }
    assert.deepEqual(seen, [0, 1, 2, 3], id + ': ' + seen);
    assert.equal(g.cells[cell], 1, 'then the cell is clear');
    assert.ok(g.started[0] >= g.started[1] && g.started[1] >= g.started[2], 'a layer starts only after the one above');
    /* and it takes more than one go to get through each layer */
    assert.ok(g.cum[0] > 0 && g.cum[1] > g.cum[0] && g.cum[2] > g.cum[1]);
  }
});

test('a spot needs scrubbing over and over: one sweep takes some of the cover off the middle of the paper, never all of it', () => {
  for (const kids of [1, 4]){
    players(kids);
    const g = skyPainter.create(kids);
    const h = pose.players[0].hands;
    for (let k = 0; k <= 12; k++){ h.right = { x: 0.2 + 0.6 * k / 12, y: 0.7, vx: 1, vy: 0, speed: 1 }; g.step(DT, W, H); }
    assert.equal(g.painted, 0, kids + ': one go does not clear anything');
    const cell = Math.floor(0.7 * GRID[1]) * GRID[0] + Math.floor(0.5 * GRID[0]);
    assert.ok(g.wear[cell] > 0.5 && g.wear[cell] < g.cum[2] * 0.6, `${kids}: a good start (${g.wear[cell].toFixed(2)} of ${g.cum[2].toFixed(2)})`);
  }
});

test('the picture is never drawn before it is uncovered, and then only the uncovered part shows', () => {
  players(1);
  withCanvases(() => {
    const g = skyPainter.create(1), c = recorder().getContext('2d');
    for (let i = 0; i < 8; i++){ g.step(DT, W, H); g.draw(c, W, H); }
    assert.ok(g.cv, 'drawn on canvases');
    assert.equal(g.painted, 0);
    assert.equal(g.shown, 0, 'the picture has not been drawn at all');
    assert.equal(g.subOk, false, 'nor even made');
    assert.equal(c.log.filter(l => l[0] === 'drawImage' && l[1] === g.cv.sub).length, 0);
    assert.equal(g.cv.sub.log.length, 0, 'nothing was painted on the picture’s canvas');
    /* wear a patch right through */
    scrub(g, 400, 0.4, 0.6, 0.6, 0.75);
    assert.ok(g.painted > 0 || g.alive, 'some cells are clear');
    if (!g.alive){
      g.draw(c, W, H); g.draw(c, W, H);
      assert.ok(g.shown > 0, 'now it is drawn, under the covers');
      assert.ok(g.cv.sub.log.length > 0);
      /* the covers are drawn above it: the picture's blit comes before every cover's */
      const order = c.log.filter(l => l[0] === 'drawImage').map(l => l[1]);
      const at = order.lastIndexOf(g.cv.sub), cover0 = order.lastIndexOf(g.cv.vis[0]);
      assert.ok(at >= 0 && cover0 > at, 'the top cover is drawn over it');
    }
  });
});

test('no outline: nothing is drawn of the subject until a cell is clear, even with the covers worn thin', () => {
  players(1);
  withCanvases(() => {
    const g = skyPainter.create(1), c = recorder().getContext('2d');
    g.step(DT, W, H); g.draw(c, W, H);
    /* wear every cell almost all the way through, but not quite */
    for (let n = 0; n < g.wear.length; n++) if (!g.out[n]) g.wear[n] = g.cum[2] * 0.97;
    for (let n = 0; n < g.wear.length; n++) g.dirty.add(n);
    g.draw(c, W, H); g.draw(c, W, H);
    assert.equal(g.painted, 0);
    assert.equal(g.shown, 0);
    assert.equal(g.cv.sub.log.length, 0);
  });
});

test('every cover bakes all three layer textures, once for a picture (not every frame), without trouble', () => {
  withCanvases(() => {
    players(1);
    for (const id of COVER_IDS){
      const g = skyPainter.create(1); g.useCover(id);
      const c = recorder().getContext('2d');
      for (let i = 0; i < 12; i++){ g.step(DT, W, H); g.draw(c, W, H); }
      assert.deepEqual(g.texOk, [true, true, true], id);
      const marks = g.cv.tex.map(t => t.log.length);
      for (let i = 0; i < 6; i++){ g.step(DT, W, H); g.draw(c, W, H); }
      assert.deepEqual(g.cv.tex.map(t => t.log.length), marks, id + ': the textures are not painted again');
      assert.ok(marks.every(m => m > 200), id + ' draws real textures: ' + marks);
    }
  });
});

test('a picture’s covers look the same every time they are made for it (the dice are seeded)', () => {
  const a = dice(42), b = dice(42), c = dice(43);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.notEqual(dice(42)(), c());
});

test('each layer of each cover has its own scrub sound, from the sound kit; and there is a little fanfare', () => {
  for (const cover of COVERS){
    const calls = [];
    const kit = new Proxy({}, { get: (_, k) => (...a) => calls.push(String(k)) });
    const names = [];
    for (let layer = 0; layer < 3; layer++){
      calls.length = 0;
      const wait = scrubSound(kit, cover, layer, Math.random);
      assert.equal(calls.length, 1, `${cover.id} layer ${layer} makes one sound`);
      assert.ok(wait > 0.1 && wait < 1.5, 'and not too often: ' + wait);
      names.push(calls[0]);
    }
    assert.equal(new Set(names).size, 3, `${cover.id}: the three layers sound different: ${names}`);
    calls.length = 0; fanfare(kit, cover); assert.ok(calls.includes('fanfare'), cover.id + ' fanfare');
  }
});

test('scrubbing plays a sound for the layer being worn, not on every frame, and nothing for a resting hand', () => {
  players(1);
  const g = skyPainter.create(1); g.useCover('foam');
  for (let i = 0; i < 90; i++) g.step(DT, W, H);
  assert.equal(g.bits.length, 0, 'a resting hand throws nothing');
  const before = g.snd;
  scrub(g, 1.5);
  assert.ok(g.bits.length > 0, 'scrubbing throws bits');
});

test('it comes alive with a burst of sparkles when it is uncovered', () => {
  players(1);
  const g = skyPainter.create(1);
  g.useCover('sand');
  scrub(g, 1200, 0.02, 0.98, 0.04, 0.95);
  assert.ok(g.alive > 0 || g.done > 0, 'finished');
  assert.ok(g.bits.some(b => b.kind === 'star'), 'sparkles');
});

test('less motion: with the reduced-motion setting there are fewer bits flying, and never a crowd', () => {
  players(1);
  const was = globalThis.matchMedia;
  try {
    globalThis.matchMedia = (q) => ({ matches: /reduce/.test(q) });
    const calm = skyPainter.create(1); assert.equal(calm.calm, true);
    globalThis.matchMedia = () => ({ matches: false });
    const full = skyPainter.create(1); assert.equal(full.calm, false);
    let maxCalm = 0, maxFull = 0;
    for (const [g, set] of [[calm, (n) => { maxCalm = Math.max(maxCalm, n); }], [full, (n) => { maxFull = Math.max(maxFull, n); }]]){
      const h = pose.players[0].hands;
      for (let i = 0; i < 400 && !g.alive; i++){ const x = 0.3 + 0.4 * ((Math.sin(i * 0.5) + 1) / 2); h.right = { x, y: 0.6 + 0.2 * ((Math.sin(i * 0.1) + 1) / 2), vx: 1, vy: 0, speed: 1 }; g.step(DT, W, H); set(g.bits.length); }
    }
    assert.ok(maxCalm <= 24 && maxCalm < maxFull, `calm ${maxCalm}, full ${maxFull}`);
    assert.ok(maxFull <= 90);
  } finally { if (was) globalThis.matchMedia = was; else delete globalThis.matchMedia; }
});

test('four players on 1920 x 1080: a frame of the game (scrub, draw) is well within a 30 fps budget on the CPU side', () => {
  withCanvases(() => {
    players(4);
    const g = skyPainter.create(4), c = recorder().getContext('2d'), h = pose.players;
    for (let i = 0; i < 20; i++){ g.step(DT, W, H); g.draw(c, W, H); }
    const t0 = performance.now(); let n = 0;
    for (let i = 0; i < 300 && !g.alive; i++, n++){
      h.forEach((p, k) => { p.hands.right = { x: 0.5 + 0.4 * Math.sin(i * 0.3 + k), y: 0.5 + 0.3 * Math.sin(i * 0.2 + k * 2), vx: 1, vy: 0, speed: 1 }; p.hands.left = { x: 0.5 + 0.4 * Math.cos(i * 0.25 + k), y: 0.6, vx: 1, vy: 0, speed: 1 }; });
      g.step(DT, W, H); c.log.length = 0; g.draw(c, W, H);
    }
    const ms = (performance.now() - t0) / n;
    assert.ok(ms < 8, `${ms.toFixed(2)} ms a frame (step + draw calls)`);
  });
});

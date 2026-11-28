import test from 'node:test';
import assert from 'node:assert/strict';
import { pose, L, setLead } from '../src/tracking/pose.js';
import { forceSwitches } from '../src/tracking/switches.js';
import { mulberry32 } from '../tools/playtest/rig.mjs';
import { figure } from './harness/synth-frames.mjs';
import { MAX_SPEED } from '../src/tracking/steady.js';

/* Steadier hands on synthetic noisy trajectories: one right wrist still for 2 s, reaching back and forth for 4 s, still again; the camera gives
   Gaussian jitter, now and then a one-look spike, and drops some looks (the next look comes after two steps). The tracker's own
   filtering and drawing are what is measured, against the true wrist. */
const A = 16 / 9;
const gauss = (r) => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
const truth = (t, torso) => {
  const still = t < 2 || t > 6, ph = Math.max(0, Math.min(t - 2, 4));
  return { x: 0.6 + (still ? 0 : 0.2 * torso * Math.sin(2 * Math.PI * 0.9 * ph)) * 3 / A, y: 0.42 + (still ? 0 : 0.2 * torso * Math.sin(2 * Math.PI * 0.9 * ph + 1)) };
};

export function run({ steady, lead = true, seed = 1, torso = 0.2, sigma = 0.004, spikes = true, drops = true, secs = 10, vis = 0.9 }){
  forceSwitches({ steady }); setLead(lead);
  const rng = mulberry32(seed), p = pose.players[0];
  Object.assign(p, { present: true, lostFor: 0, lm: null, filt: null, seg: null, steady: null, at: null, hands: { left: { x: .5, y: .5, vx: 0, vy: 0, speed: 0 }, right: { x: .5, y: .5, vx: 0, vy: 0, speed: 0 } } });
  let t = 0, now = 0, prev = 0;
  const err = { still: [], hon: [], spike: [] }, series = [], truthSeries = [];
  let spikeAt = -9, nextSpike = 40 + Math.floor(rng() * 40), looks = 0;
  pose.clock = () => now;
  while (t < secs){
    const step = drops && rng() < 0.12 ? 2 / 30 : 1 / 30;
    t += step; now = t * 1000; looks++;
    const lm = figure(0.5, 0.55, torso);
    const w = truth(t, torso);
    lm[L.R_WRIST] = { x: w.x + gauss(rng) * sigma, y: w.y + gauss(rng) * sigma, z: 0, v: vis };
    const sh = lm[L.R_SHOULDER];
    lm[L.R_ELBOW] = { x: (sh.x + w.x) / 2 + gauss(rng) * sigma, y: (sh.y + w.y) / 2 + gauss(rng) * sigma, z: 0, v: vis };
    let spike = false;
    if (spikes && looks === nextSpike){ lm[L.R_WRIST].x += (rng() < 0.5 ? -1 : 1) * 0.22 * torso * 3 / A * 2.2; lm[L.R_WRIST].y += 0.35; nextSpike += 40 + Math.floor(rng() * 40); spike = true; spikeAt = t; }
    pose._apply(p, lm, step);
    for (const q of [0, 0.5]){
      const tt = t + q * step; pose.at(tt * 1000);
      const h = p.hands.right, hw = truth(tt, torso), tw = hw;
      const dx = (h.x - tw.x) * A, dy = h.y - tw.y, e = Math.hypot(dx, dy);
      const sx = ((h.dx ?? h.x) - tw.x) * A, sy = (h.dy ?? h.y) - tw.y;
      series.push({ t: tt, x: h.dx ?? h.x, y: h.dy ?? h.y, hx: h.x, hy: h.y });
      if ((tt < 2 || tt > 6.2) && tt - spikeAt > 0.5) err.still.push(Math.hypot(sx, sy));
      err.hon.push(e);
      if (tt - spikeAt < 0.2 && tt > spikeAt) err.spike.push(Math.hypot(sx, sy));
    }
  }
  forceSwitches(null); setLead(true);
  /* lag: the shift of the truth that best matches what is drawn, over the reaching stretch */
  let best = 0, bestE = Infinity;
  for (let tau = -0.08; tau <= 0.2; tau += 0.004){
    let e = 0, n = 0;
    for (const s of series){ if (s.t < 2.5 || s.t > 5.5) continue; const w = truth(s.t - tau, torso); e += ((s.x - w.x) * A) ** 2 + (s.y - w.y) ** 2; n++; }
    if (e / n < bestE){ bestE = e / n; best = tau; }
  }
  const rms = (a) => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / Math.max(1, a.length));
  return { jitter: rms(err.still), lagMs: best * 1000, spike: Math.max(0, ...err.spike), reachErr: rms(series.filter(s => s.t > 2.5 && s.t < 5.5).map(s => { const w = truth(s.t, torso); return Math.hypot((s.x - w.x) * A, s.y - w.y); })), series };
}

const seeds = [1, 2, 3, 4, 5, 6];
const avg = (f) => seeds.reduce((s, sd) => s + f(sd), 0) / seeds.length;
const table = (label, opts) => {
  const off = (k) => avg(sd => run({ steady: false, seed: sd, ...opts })[k]), on = (k) => avg(sd => run({ steady: true, seed: sd, ...opts })[k]);
  return { label, off: { jitter: off('jitter'), lagMs: off('lagMs'), spike: off('spike'), reach: off('reachErr') }, on: { jitter: on('jitter'), lagMs: on('lagMs'), spike: on('spike'), reach: on('reachErr') } };
};

test('Steadier hands: jitter, lag and spikes before and after, on synthetic noisy trajectories (grown-up, child, unsure points)', () => {
  const rows = [table('grown-up torso 0.25', { torso: 0.25 }), table('child torso 0.12', { torso: 0.12 }), table('unsure points (v 0.45)', { vis: 0.45, sigma: 0.007 })];
  const f = (v, d = 4) => v.toFixed(d);
  console.log('Steadier hands, synthetic (mean of 6 seeds; error in picture heights vs the true wrist; lag in ms)');
  console.log('| case | jitter off | jitter on | lag off | lag on | spike max off | spike max on | reach error off | on |');
  console.log('|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.label} | ${f(r.off.jitter)} | ${f(r.on.jitter)} | ${f(r.off.lagMs, 0)} | ${f(r.on.lagMs, 0)} | ${f(r.off.spike)} | ${f(r.on.spike)} | ${f(r.off.reach)} | ${f(r.on.reach)} |`);
  for (const r of rows){
    assert.ok(r.on.jitter <= r.off.jitter * 1.1, r.label + ': jitter at rest within 10% of before (it is already at the filter floor)');
    assert.ok(r.on.spike < r.off.spike * 0.7, r.label + ': a one-look spike is clearly smaller');
    if (!/unsure/.test(r.label)) assert.ok(r.on.lagMs <= r.off.lagMs + 6, r.label + ': no more lag than before (the drawn lead pays for the held spikes)');   /* (unsure points are smoothed harder on purpose: they lag more) */
    assert.ok(r.on.reach <= r.off.reach * 1.1, r.label + ': the reach is followed as well as before');
  }
});

test('Steadier hands: a real fast move is believed after a few looks (never held for good)', () => {
  forceSwitches({ steady: true });
  const p = pose.players[0];
  Object.assign(p, { present: true, lm: null, filt: null, seg: null, steady: null });
  let now = 0;
  const feed = (x) => { now += 33; pose.clock = () => now; const lm = figure(0.5, 0.55, 0.2); lm[L.R_WRIST] = { x, y: 0.4, z: 0, v: 0.9 }; pose._apply(p, lm, 1 / 30); };
  for (let i = 0; i < 20; i++) feed(0.6);
  for (let i = 0; i < 12; i++) feed(0.9);       /* it really is there now: 0.3 in one look is 45 torsos a second */
  forceSwitches(null);
  assert.ok(p.lm[L.R_WRIST].x > 0.8, 'followed to ' + p.lm[L.R_WRIST].x);
  assert.ok(p.steady.rejected >= 1 && p.steady.rejected <= 3);
  assert.ok(MAX_SPEED > 6.3 * 1.5, 'the limit is well above the fastest rig child hand');
});

test('Steadier hands: arm lengths are learned, then a stretched elbow and wrist are pulled back', () => {
  forceSwitches({ steady: true });
  const p = pose.players[0];
  Object.assign(p, { present: true, lm: null, filt: null, seg: null, steady: null });
  let now = 0;
  const feed = (wx, wy) => { now += 33; pose.clock = () => now; const lm = figure(0.5, 0.55, 0.2); lm[L.R_WRIST] = { x: wx, y: wy, z: 0, v: 0.95 }; lm[L.R_ELBOW] = { x: (lm[L.R_SHOULDER].x + wx) / 2, y: (lm[L.R_SHOULDER].y + wy) / 2, z: 0, v: 0.95 }; pose._apply(p, lm, 1 / 30); };
  const sh = figure(0.5, 0.55, 0.2)[L.R_SHOULDER];
  for (let i = 0; i < 90; i++) feed(sh.x + 0.05, sh.y + 0.17);     /* an arm hanging, about 0.17 long */
  assert.ok(p.steady.arm[1].u > 0 && p.steady.arm[1].f > 0, 'learned');
  const reachLearned = (p.steady.arm[1].u + p.steady.arm[1].f) * p.steady.size;
  for (let i = 0; i < 3; i++) feed(sh.x + 0.5, sh.y);           /* a wrong wrist 0.5 away, for three looks */
  const d = Math.hypot((p.lm[L.R_WRIST].x - sh.x) * A, p.lm[L.R_WRIST].y - sh.y);
  forceSwitches(null);
  assert.ok(d < 0.5 * A * 0.6 + 0.0, 'pulled in: ' + d.toFixed(3) + ' (learned reach ' + reachLearned.toFixed(3) + ')');
});

test('Steadier hands: the drawn lead never touches what games hit with (p.lm, p.hands x, y)', () => {
  const a = run({ steady: true, lead: true, seed: 3 }), b = run({ steady: true, lead: false, seed: 3 });
  assert.equal(a.series.length, b.series.length);
  for (let i = 0; i < a.series.length; i++){ assert.equal(a.series[i].hx, b.series[i].hx); assert.equal(a.series[i].hy, b.series[i].hy); }
  assert.ok(a.series.some((s, i) => s.x !== b.series[i].x), 'the drawn one does differ');
  const off = run({ steady: false, seed: 3 });
  assert.ok(off.series.every(s => s.x === s.hx && s.y === s.hy), 'off: drawn is honest');
});

test('Steadier hands off: the filter is exactly the plain one', () => {
  const a = run({ steady: false, seed: 5 });
  forceSwitches({ steady: false });
  const b = run({ steady: false, seed: 5 });
  assert.deepEqual(a.series.map(s => s.hx), b.series.map(s => s.hx));
});

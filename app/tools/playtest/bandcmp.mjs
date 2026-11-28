/* Coloured wristbands on the rig (Settings > Testing > "Track coloured wristbands"), measured against known truth:
     node tools/playtest.mjs --bands [--seeds 1,2,3] [--only swing,cross]
   Scenarios (all deterministic for a seed; the pictures are drawn from the rig's own bodies by test/harness/synth-frames.mjs: flat colours and
   plain rectangles for bands, no skin tone variation, no real lighting - it can only show that the logic works, which the report says):
     swing        two children swing their arms hard; the model "loses" a wrist (stale place, low confidence) for 1 to 3 looks when a hand is fast
     swing-blur   the same, and each band is smeared along the stretch the hand moved (motion blur)
     cross        two children, the same shirts, different bands, trade places every 7.5 s
     cross-one    ...only one of them wears a band
     cushion      swinging, and a cushion in one band's colour in the middle of the picture (children cross in front of it)
     shirt-other  crossing, one child's shirt is the other's band colour
     shirt-own    crossing, a child's shirt is their own band colour (the band counts for less for them)
     warm         crossing under a lamp: every colour of the picture moved +14 degrees in hue after the bands were learnt
   Learning: everyone stands for a second and a half, then raises both hands for 3 s with learning on (the camera check), then it is a round.
   Per switch set: swaps / wrong-who looks (who-is-who, exact), wrong at crossing end, and the wrists' error against the bodies' real hands (RMS, in
   thousandths of a picture height: all looks, and the looks where the model had lost the wrist), the number of large errors (over 0.03 H), what was
   learnt (right / wrong), and the tracker's cost per look (ms, one core of this machine; the cut-outs here are drawn in memory, so the cost of the
   real video copy, drawImage and getImageData of 8 small squares, is not in it). */
import { blankFrame, drawFigure, drawRect, cropOfScene, hueShift, SHIRTS, BANDS } from '../../test/harness/synth-frames.mjs';
import { TrackMetrics } from './metrics.mjs';
import { forceSwitches, SWITCH_KEYS } from '../../src/tracking/switches.js';
import { mulberry32 } from './rig.mjs';

const DT = 1 / 30;
export const COMBOS = [[], ['bands'], ['apart'], ['apart', 'bands']];
export const label = (on) => on.length ? on.join('+') : 'none';
const W = 1920, H = 1080;

export function scenarios(rig){
  rig.LINEUPS['2x'] = [{ kind: 'child', x: 0.3, layer: 0 }, { kind: 'child', x: 0.7, layer: 1 }];
  const cross = { act(ctx, p, now){ const home = p.mem.home ??= p.sx; p.walkTo(Math.floor(now / 7.5) % 2 ? 1 - home : home); } };
  /* arms swung hard, one up while the other is down, a third of a second a stroke */
  const swing = { act(ctx, p, now){
    const up = Math.floor(now / 0.34 + (p.idx ? 0.5 : 0)) % 2, J = p.J, R = p.armLen * p.k;
    p.L.goal(J.lSh.x - 0.07 + (up ? 0.03 : -0.01), J.shY + (up ? -R * 0.9 : R * 0.9), now);
    p.R.goal(J.rSh.x + 0.07 - (up ? 0.03 : -0.01), J.shY + (up ? R * 0.9 : -R * 0.9), now);
  } };
  const swingCross = { act(ctx, p, now){ cross.act(ctx, p, now); swing.act(ctx, p, now); } };
  const red = SHIRTS.red;
  const same = () => red;
  return [
    { id: 'swing', lineup: '2x', brain: swing, shirts: [red, SHIRTS.blue], bands: [BANDS.pink, BANDS.cyan], drop: 0.5, secs: 30 },
    { id: 'swing-blur', lineup: '2x', brain: swing, shirts: [red, SHIRTS.blue], bands: [BANDS.pink, BANDS.cyan], drop: 0.5, blur: true, secs: 30 },
    { id: 'cross', lineup: '2x', brain: cross, shirts: [red, red], bands: [BANDS.pink, BANDS.cyan], secs: 60 },
    { id: 'cross-one', lineup: '2x', brain: cross, shirts: [red, red], bands: [BANDS.pink, null], secs: 60 },
    { id: 'cushion', lineup: '2x', brain: swingCross, shirts: [red, SHIRTS.blue], bands: [BANDS.pink, BANDS.cyan], drop: 0.4, cushion: { x: 0.5, y: 0.5, w: 0.2, h: 0.16, rgb: BANDS.pink }, secs: 60 },
    { id: 'shirt-other', lineup: '2x', brain: cross, shirts: [BANDS.cyan, red], bands: [BANDS.pink, BANDS.cyan], secs: 60 },
    { id: 'shirt-own', lineup: '2x', brain: cross, shirts: [BANDS.pink, red], bands: [BANDS.pink, BANDS.cyan], secs: 60 },
    { id: 'warm', lineup: '2x', brain: cross, shirts: [red, red], bands: [BANDS.pink, BANDS.cyan], shift: 14, secs: 60 }
  ];
}

/* one run: a scenario, a seed, a set of switches */
export function run({ pose, rig, lib, sc, seed, on, jitter, cap = 4 }){
  forceSwitches(Object.fromEntries(Object.keys(SWITCH_KEYS).map(k => [k, on.includes(k)])));
  rig.resetPose(pose);
  const world = rig.makeWorld(sc.lineup, seed, { jitter });
  const rng = mulberry32(seed * 977 + 5);
  const bandsOn = on.includes('bands');
  let shift = 0, drops = false;
  /* the picture, drawn from the bodies: what a wrist cut-out and the small whole-picture copy are cut from */
  const sceneOf = (dets) => {
    const list = [...dets].sort((a, b) => a.person.layer - b.person.layer);
    return (f) => {
      if (sc.cushion) drawRect(f, sc.cushion.x, sc.cushion.y, sc.cushion.w, sc.cushion.h, sc.cushion.rgb);
      for (const d of list){
        const i = d.person.idx, b = sc.bands[i];
        const prev = sc.blur && d.person._prev ? d.person._prev : null;
        drawFigure(f, d.lmTrue || d.lm, { shirt: sc.shirts[i], bands: b ? [b, b] : null, prev });
      }
    };
  };
  const lit = (f) => shift ? hueShift(f, shift) : f;
  const bandSrc = bandsOn ? (dets) => {
    const draw = sceneOf(dets);
    return {
      vw: W, vh: H,
      crop: (region) => { const c = cropOfScene(draw, region, 56); if (shift) c.data = hueShift(c, shift).data; return c; },
      picture: () => { const f = blankFrame(); draw(f); return lit(f); }
    };
  } : null;
  /* a wrist lost in a swing: its place stays where it was and the model is unsure of it, 1 to 3 looks at a time */
  const stale = [{}, {}];
  const tamper = (dets, t) => {
    for (const d of dets){
      const p = d.person, lm = d.lm;
      d.lmTrue = lm.map(k => ({ ...k }));            /* (the picture is of the real body, not of what the model reports) */
      p._prev = p._prev || [null, null];
      [[p.L, 15, 13, '_dropL', 0], [p.R, 16, 14, '_dropR', 1]].forEach(([h, wi, ei, flag, side]) => {
        const key = p.idx * 2 + side, st = stale[side][p.idx] || (stale[side][p.idx] = { left: 0, at: null });
        const here = { x: lm[wi].x, y: lm[wi].y };
        if (drops && st.left <= 0 && h.speedH > 0.35 && rng() < sc.drop * 0.35) st.left = 1 + Math.floor(rng() * 3), st.at = st.at || { ...here };
        if (st.left > 0 && drops){ st.left--; lm[wi].x = st.at.x; lm[wi].y = st.at.y; lm[wi].v = 0.12; lm[wi].visibility = 0.12; p[flag] = true; }
        else { p[flag] = false; st.at = here; }
        /* the smear: where the wrist was a look ago, for the band's motion blur */
        const prev = p._prevTrue ? p._prevTrue[side] : null;
        p._prev[side] = prev;
        (p._prevTrue || (p._prevTrue = [null, null]))[side] = { x: h.x, y: h.y };
      });
      p._prev = p._prev.some(Boolean) ? p._prev : null;
    }
  };
  const feeder = new rig.Feeder(pose, lib, { assist: true, cap, frames: bandsOn ? (dets) => { const f = blankFrame(); sceneOf(dets)(f); return lit(f); } : null, bands: bandSrc, tamper: sc.drop ? tamper : null, truth: true });
  /* standing in view, then both hands raised (the camera check) */
  const raise = { act(ctx, p, now){ const J = p.J, R = p.armLen * p.k; p.L.goal(J.lSh.x - 0.02, J.shY - R * 0.75, now); p.R.goal(J.rSh.x + 0.02, J.shY - R * 0.75, now); } };
  for (let i = 0; i < 45; i++){ world.step(DT, null, null); feeder.step(world, DT); }
  if (bandsOn) pose.bandsLearn(true);
  for (let i = 0; i < 90; i++){ world.step(DT, raise, {}); feeder.step(world, DT); }
  if (bandsOn) pose.bandsLearn(false);
  const learnt = bandsOn ? sc.bands.map((b, i) => { const s = pose.players[world.persons[i].slot]; return s && s.band ? s.band.state : null; }) : null;
  const learntRight = learnt ? learnt.filter((s, i) => s === (sc.bands[i] ? 'ok' : 'none')).length : null;
  for (let i = 0; i < 30; i++){ world.step(DT, null, null); feeder.step(world, DT); }
  /* the round */
  shift = sc.shift || 0; drops = !!sc.drop;
  feeder.err = { n: 0, sum2: 0, max: 0, lostN: 0, lostSum2: 0, big: 0 };
  const metrics = new TrackMetrics(); feeder.metrics = metrics;
  /* the wrists as they go into the tracker's filters (after the bands), against the hands' real places */
  const inp = { n: 0, s2: 0, lostN: 0, lostS2: 0, big: 0 }, applyOrig = pose._apply.bind(pose), A = 16 / 9;
  pose._apply = (p, lm, dt) => {
    try {
      const slot = pose.players.indexOf(p), per = world.persons.find(q => q.slot === slot);
      if (per && p.lm) for (const [wi, T, flag] of [[15, per.L, per._dropL], [16, per.R, per._dropR]]){
        const d = Math.hypot((lm[wi].x - T.x) * A, lm[wi].y - T.y);
        inp.n++; inp.s2 += d * d; if (d > 0.03) inp.big++;
        if (flag){ inp.lostN++; inp.lostS2 += d * d; }
      }
    } catch (e){ /* (a measure never stops a run) */ }
    return applyOrig(p, lm, dt);
  };
  const orig = pose._assign.bind(pose); let spent = 0, looks = 0;
  pose._assign = (a, b, c, d) => { const t0 = performance.now(); try { return orig(a, b, c, d); } finally { spent += performance.now() - t0; looks++; } };
  let first = null; const wrong = world.persons.map(() => 0);
  const t0 = feeder.t;
  try {
    for (let i = 0; i < sc.secs / DT; i++){
      world.step(DT, sc.brain, {}); feeder.step(world, DT);
      const t = feeder.t - t0;
      if (sc.id.startsWith('cross') || sc.id.startsWith('shirt') || sc.id === 'warm' || sc.id === 'cushion'){
        if (first === null && t > 5) first = world.persons.map(p => p.slot);
        if (first && Math.abs(t % 7.5 - (7.5 - 0.1)) < DT / 2) world.persons.forEach((p, k) => { if (p.slot !== first[k]) wrong[k]++; });
      }
    }
  } finally { pose._assign = orig; pose._apply = applyOrig; forceSwitches(null); }
  const e = feeder.err, bandMs = pose.bandMs || 0;
  return { m: metrics.result(), ms: looks ? spent / looks : 0, wrongEnd: wrong.reduce((a, b) => a + b, 0), learnt, learntRight, bandMs,
    rms: inp.n ? Math.sqrt(inp.s2 / inp.n) : null, rmsLost: inp.lostN ? Math.sqrt(inp.lostS2 / inp.lostN) : null, lostN: inp.lostN, big: inp.big, n: inp.n,
    drawnRms: e.n ? Math.sqrt(e.sum2 / e.n) : null,
    used: pose.bandsUsed || 0, recovered: pose.bandsRecovered || 0 };
}

const sum = (rs, f) => rs.reduce((s, r) => s + (f(r) || 0), 0);
const mean = (rs, f) => { const v = rs.map(f).filter(x => x != null && Number.isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const fx = (v, d = 1) => v == null ? '-' : (Math.round(v * 10 ** d) / 10 ** d).toString();

/* every scenario under every combo; prints Markdown tables, gives the rows */
export function runAll({ pose, rig, lib, seeds, jitter, only = null, combos = COMBOS, log = console.log }){
  const out = [];
  for (const sc of scenarios(rig)){
    if (only && !only.some(o => sc.id.startsWith(o))) continue;
    const rows = combos.map(on => { pose.bandsUsed = 0; pose.bandsRecovered = 0; const rs = seeds.map(seed => { pose.bandMs = 0; return run({ pose, rig, lib, sc, seed, on, jitter }); }); return { on, rs }; });
    out.push({ sc, rows });
    log(`\n${sc.id} (${sc.lineup}, ${sc.secs} s, ${seeds.length} seeds; bands: ${sc.bands.map(b => b ? 'yes' : 'none').join(', ')}${sc.shift ? ', light +' + sc.shift + ' deg' : ''}${sc.cushion ? ', cushion in a band colour' : ''}${sc.drop ? ', wrist lost in fast swings' : ''})`);
    log('| switches | swaps (wrong-who looks) | wrong at crossing end | wrist input error RMS (mH) | ...looks the wrist was lost (mH) | inputs off by over 0.03 H | drawn wrist error (mH) | learnt right | wrists used / recovered | dropouts | band ms/look | tracker ms/look |');
    log('|---|---|---|---|---|---|---|---|---|---|---|---|');
    for (const { on, rs } of rows){
      const mm = rs.map(r => r.m), n = seeds.length * sc.bands.length;
      log(`| ${label(on)} | ${sum(mm, m => m.swaps)} (${sum(mm, m => m.wrongLooks)}) | ${sum(rs, r => r.wrongEnd)} | ${fx(mean(rs, r => r.rms == null ? null : r.rms * 1000))} | ${fx(mean(rs, r => r.rmsLost == null ? null : r.rmsLost * 1000))} | ${sum(rs, r => r.big)} | ${fx(mean(rs, r => r.drawnRms == null ? null : r.drawnRms * 1000))} | ${on.includes('bands') ? sum(rs, r => r.learntRight) + '/' + n : '-'} | ${on.includes('bands') ? sum(rs, r => r.used) + ' / ' + sum(rs, r => r.recovered) : '-'} | ${sum(mm, m => m.dropouts)} | ${on.includes('bands') ? fx(mean(rs, r => r.bandMs), 3) : '-'} | ${fx(mean(rs, r => r.ms), 3)} |`);
    }
  }
  return out;
}

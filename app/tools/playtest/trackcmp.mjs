/* Who-is-who and steadiness, compared across the Testing switches on the rig's synthetic bodies (where the truth is known):
     node tools/playtest.mjs --track [--seeds 1,2,3,4,5,6] [--secs 60]
   Scenarios (every one deterministic for a seed):
     cross-shirts     two children of one size and build, in different shirts, trade places every 7.5 s
     cross-same       ...in the same shirt (clothes cannot help)
     cross-build      ...in the same shirt, but built differently (one stocky, one lanky: shape can help)
     family3 / family4  a grown-up, a child, a grown-up (and a child) wander about the room at random, crossing now and then;
                      in different shirts (shirts) and all in one colour (same)
     leave-return     3 players; one of them leaves for 12 s as a stranger comes in, and they come back together: does the returner get their own place
                      (and does the stranger take a free one)?   [leave-return-3s: gone for 3 s]
   The numbers per switch set: swaps (a place changing from following one person to following another, exact from the rig's truth), dropouts and
   missed looks (a player lost while a body that could have been theirs was nearby), jumps, join time, wrist jitter and lag (tools/playtest/metrics.mjs),
   and the tracker's cost per look (ms, one core of this machine). The pictures the clothes switch reads are drawn from the rig's own bodies
   (test/harness/synth-frames.mjs): plain flat colours, no light, skin, hair or background - it can only show the logic works. */
import { blankFrame, drawFigure, SHIRTS } from '../../test/harness/synth-frames.mjs';
import { TrackMetrics } from './metrics.mjs';
import { forceSwitches, SWITCH_KEYS } from '../../src/tracking/switches.js';

const DT = 1 / 30;
export const COMBOS = [[], ['steady'], ['apart'], ['appearance'], ['apart', 'appearance'], ['steady', 'apart', 'appearance']];
export const label = (on) => on.length ? on.join('+') : 'none';
const BUILD = { sh: 1.25, hip: 1.2, legs: 1.15, arm: 1.1 };
const PALETTE = [SHIRTS.red, SHIRTS.blue, SHIRTS.green || [60, 160, 80], SHIRTS.yellow || [230, 200, 60]];

export function scenarios(rig){
  rig.LINEUPS['2x'] = [{ kind: 'child', x: 0.3, layer: 0 }, { kind: 'child', x: 0.7, layer: 1 }];
  rig.LINEUPS['2b'] = [{ kind: 'child', x: 0.3, layer: 0 }, { kind: 'child', x: 0.7, layer: 1, build: BUILD }];
  rig.LINEUPS['4x'] = [...rig.LINEUPS['4m']];
  /* a grown-up, a child who will leave (leaver), a grown-up, and a stranger (a child built differently) who comes in on the far left as the leaver returns */
  rig.LINEUPS['4lv'] = [{ kind: 'adult', x: 0.25 }, { kind: 'child', x: 0.45, leaver: true }, { kind: 'adult', x: 0.7 }, { kind: 'child', x: 0.12, stranger: true, build: BUILD }];
  const cross = { act(ctx, p, now){ const home = p.mem.home ??= p.sx; p.walkTo(Math.floor(now / 7.5) % 2 ? 1 - home : home); } };
  const wander = { act(ctx, p, now){ if (!(p.mem.next > now)){ p.mem.next = now + 4 + p.rng() * 4; p.walkTo(0.12 + p.rng() * 0.76); } } };
  const stand = { act(){ } };
  const shirt = (same) => (person) => same ? PALETTE[0] : PALETTE[person.idx % PALETTE.length];
  return [
    { id: 'cross-shirts', lineup: '2x', brain: cross, shirt: shirt(false), secs: 60 },
    { id: 'cross-same', lineup: '2x', brain: cross, shirt: shirt(true), secs: 60 },
    { id: 'cross-build', lineup: '2b', brain: cross, shirt: shirt(true), secs: 60 },
    { id: 'family3-shirts', lineup: '3m', brain: wander, shirt: shirt(false), secs: 90 },
    { id: 'family3-same', lineup: '3m', brain: wander, shirt: shirt(true), secs: 90 },
    { id: 'family4-shirts', lineup: '4m', brain: wander, shirt: shirt(false), secs: 90 },
    { id: 'family4-same', lineup: '4m', brain: wander, shirt: shirt(true), secs: 90 },
    { id: 'leave-return', lineup: '4lv', brain: stand, shirt: shirt(false), secs: 50, leave: { who: 1, from: 18, to: 30, stranger: true } },
    { id: 'leave-return-same', lineup: '4lv', brain: stand, shirt: shirt(true), secs: 50, leave: { who: 1, from: 18, to: 30, stranger: true } },
    { id: 'leave-return-3s', lineup: '4lv', brain: stand, shirt: shirt(false), secs: 40, leave: { who: 1, from: 18, to: 21, stranger: true } }
  ];
}

/* one run: a scenario, a seed, a set of switches. Gives { m: the metrics, ms: tracker ms per look, wrongEnd, back } */
export function run({ pose, rig, lib, sc, seed, on, jitter, cap = 4 }){
  forceSwitches(Object.fromEntries(Object.keys(SWITCH_KEYS).map(k => [k, on.includes(k)])));
  rig.resetPose(pose);
  const world = rig.makeWorld(sc.lineup, seed, { jitter });
  const shirtOf = sc.shirt;
  const frames = on.includes('appearance') ? (dets) => {
    const f = blankFrame();
    for (const d of [...dets].sort((a, b) => a.person.layer - b.person.layer)) drawFigure(f, d.lm, { shirt: shirtOf(d.person) });
    return f;
  } : null;
  const metrics = new TrackMetrics();
  const feeder = new rig.Feeder(pose, lib, { assist: false, cap, frames, metrics });
  /* the cost of the tracker's own work per look */
  const orig = pose._assign.bind(pose); let spent = 0, looks = 0;
  pose._assign = (a, b, c) => { const t0 = performance.now(); try { return orig(a, b, c); } finally { spent += performance.now() - t0; looks++; } };
  const lv = sc.leave ? { ...sc.leave } : null;
  let stranger = null, before = -1, after = -1, strangerSlot = -1, ownSlots = [];
  if (lv){ stranger = world.persons.find(p => p.spec.stranger); stranger.inScene = false; lv.who = world.persons.findIndex(p => p.spec.leaver); }
  let first = null, wrong = world.persons.map(() => 0);
  try {
    for (let i = 0; i < sc.secs / DT; i++){
      const t = (i + 1) * DT;
      if (lv){
        const who = world.persons[lv.who];
        if (t >= lv.from && t < lv.to){ who.inScene = false; if (before < 0) before = who.slot; }
        if (t >= lv.to){ who.inScene = true; if (lv.stranger) stranger.inScene = true; }
      }
      world.step(DT, sc.brain, {}); feeder.step(world, DT);
      if (lv && t > lv.to + 4 && after < 0){ const who = world.persons[lv.who]; after = who.slot; strangerSlot = stranger.slot; }
      if (sc.id.startsWith('cross')){
        if (first === null && t > 5) first = world.persons.map(p => p.slot);
        if (first && Math.abs(t % 7.5 - (7.5 - 0.1)) < DT / 2) world.persons.forEach((p, k) => { if (p.slot !== first[k]) wrong[k]++; });
      }
    }
  } finally { pose._assign = orig; forceSwitches(null); }
  const m = metrics.result();
  return { m, ms: looks ? spent / looks : 0, wrongEnd: wrong.reduce((a, b) => a + b, 0), back: lv ? (before >= 0 && after === before ? 1 : 0) : null, strangerOk: lv && lv.stranger ? (strangerSlot >= 0 && strangerSlot !== before ? 1 : 0) : null, hold: { decisions: pose.holdLog || 0, swapped: pose.swapLog || 0 } };
}

const sum = (rs, f) => rs.reduce((s, r) => s + (f(r) || 0), 0);
const mean = (rs, f) => { const v = rs.map(f).filter(x => x != null && Number.isFinite(x)); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const fx = (v, d = 1) => v == null ? '-' : (Math.round(v * 10 ** d) / 10 ** d).toString();

/* every scenario under every combo; prints Markdown tables, gives the rows */
export function runAll({ pose, rig, lib, seeds, jitter, only = null, combos = COMBOS, log = console.log }){
  const out = [];
  for (const sc of scenarios(rig)){
    if (only && !only.some(o => sc.id.startsWith(o))) continue;
    const rows = combos.map(on => { const rs = seeds.map(seed => run({ pose, rig, lib, sc, seed, on, jitter })); return { on, rs }; });
    out.push({ sc, rows });
    log(`\n${sc.id} (${sc.lineup}, ${sc.secs} s, ${seeds.length} seeds)`);
    const leave = !!sc.leave;
    log(`| switches | swaps (wrong-who looks) | dropouts | missed looks | jumps (during/after) | ${leave ? 'own place back | stranger in a free place | ' : ''}${sc.id.startsWith('cross') ? 'wrong at crossing end | ' : ''}join ms | jitter drawn/raw | lag ms | tracker ms/look |`);
    log(`|---|---|---|---|---|${leave ? '---|---|' : ''}${sc.id.startsWith('cross') ? '---|' : ''}---|---|---|---|`);
    for (const { on, rs } of rows){
      const mm = rs.map(r => r.m);
      const jr = mean(mm, m => m.jitterRaw), jd = mean(mm, m => m.jitterDrawn);
      log(`| ${label(on)} | ${sum(mm, m => m.swaps)} (${sum(mm, m => m.wrongLooks)}) | ${sum(mm, m => m.dropouts)} | ${sum(mm, m => m.missFrames)} | ${sum(mm, m => m.jumps.during)}/${sum(mm, m => m.jumps.after)} | ${leave ? `${sum(rs, r => r.back)}/${seeds.length} | ${sum(rs, r => r.strangerOk)}/${seeds.length} | ` : ''}${sc.id.startsWith('cross') ? sum(rs, r => r.wrongEnd) + ' | ' : ''}${fx(mean(mm, m => m.join.medianMs), 0)} | ${jd == null ? '-' : fx(jd, 3) + '/' + fx(jr, 3)} | ${fx(mean(mm, m => m.lagMs), 0)} | ${fx(mean(rs, r => r.ms), 3)} |`);
    }
  }
  return out;
}

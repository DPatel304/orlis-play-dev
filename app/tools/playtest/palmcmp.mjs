/* Exact hands on the rig (Settings > Testing > "Exact hands"):
     node tools/playtest.mjs --palm [--games pop-party,leaf-pile] [--lineups 1c,4m] [--seeds 1,2,3]
   The rig's bodies are made with a hand a palm's length (PALM forearms, 0.35) beyond the wrist the "model" reports: the rig's brains aim the hand at
   targets, the tracker is told the wrist. With Exact hands off the games hit-test the wrist, so the hand sits PALM forearms short of where it is aimed;
   with it on, a fake hand model (test/harness/synth-hand.mjs: exact synthetic landmarks of a hand at that place, a little noise, a confidence of
   0.9) is asked about 2 hands a look at most (budget.js handBudget), and the palm centre is what the games hit-test. All of this is synthetic
   geometry: it shows that the offset is found, carried between runs, eased and used - never that the real hand model sees what it should.        */
import { forceSwitches, SWITCH_KEYS } from '../../src/tracking/switches.js';
import { fakeHander } from '../../test/harness/synth-hand.mjs';

export const PALM = 0.35;
const A = 16 / 9;
const GRIPS = ['open', 'closed', 'point'];

/* the fake hand model for a look: the hands of everyone in the picture, as the rig's bodies have them (tracker space) */
export function palmHander(world, dets){
  const hands = () => {
    const out = [];
    for (const d of dets){
      const p = d.person, lm = d.lm;
      [[13, 15], [14, 16]].forEach(([ei, wi], side) => {
        const e = lm[ei], w = lm[wi], dx = (w.x - e.x) * A, dy = w.y - e.y, F = Math.hypot(dx, dy) || 1;
        out.push({ wrist: { x: w.x, y: w.y }, u: { x: dx / F, y: dy / F }, S: PALM * F / 0.7, grip: GRIPS[Math.floor(world.t / 3 + side + p.idx) % 3] });
      });
    }
    return out;
  };
  return fakeHander(hands, { score: 0.9, noise: 0.0015, seed: 7 });
}

const sum = (a) => a.reduce((s, x) => s + x, 0);

/* the games, hands off and on: scores per player, and the palm's error (picture heights) against the aimed place, from a short separate run per seed */
export async function runPalm({ pose, rig, lib, games, lineups, seeds, jitter, runOne, setPalm, log = console.log }){
  setPalm(PALM);
  const set = (on) => forceSwitches(Object.fromEntries(Object.keys(SWITCH_KEYS).map(k => [k, k === 'hands' && on])));
  log(`Exact hands: games with the hand ${PALM} forearms beyond the wrist (rig geometry), hands off / on; score per player (child c / adult a), summed over seeds ${seeds.join(',')}`);
  log('| game | line-up | off (scores) | on (scores) | change in total |');
  log('|---|---|---|---|---|');
  let tOff = 0, tOn = 0;
  for (const gid of games) for (const lu of lineups){
    const row = { off: null, on: null };
    for (const on of [false, true]){
      set(on);
      const per = [];
      for (const seed of seeds){ const r = runOne(gid, lu, seed); per.push(r.players.map(p => p.score)); }
      row[on ? 'on' : 'off'] = per[0].map((_, i) => sum(per.map(s => s[i])));
    }
    forceSwitches(null);
    const a = sum(row.off), b = sum(row.on); tOff += a; tOn += b;
    log(`| ${gid} | ${lu} | ${row.off.join(' ')} | ${row.on.join(' ')} | ${a ? (b - a >= 0 ? '+' : '') + Math.round((b - a) / a * 100) + '%' : '-'} (${b - a >= 0 ? '+' : ''}${b - a}) |`);
  }
  log(`total score: off ${tOff}, on ${tOn} (${tOff ? Math.round((tOn - tOff) / tOff * 100) : 0}%)`);
  /* where the hand is, against where it is aimed: still, and in a swing */
  log('\nWhere the hand is, against the real hand (the palm), picture heights x 1000, RMS over 20 s, 2 children, hands swung hard / held out:');
  log('| hands | swung: off | swung: on | held out: off | held out: on | hand-model runs per look | ms per look (fake model, in memory) |');
  log('|---|---|---|---|---|---|---|');
  const res = {};
  for (const mode of ['swing', 'still']){
    for (const on of [false, true]){
      let n = 0, s2 = 0, looks = 0, runs = 0, ms = 0;
      for (const seed of seeds){
        set(on); rig.resetPose(pose);
        rig.LINEUPS['2x'] = [{ kind: 'child', x: 0.3, layer: 0 }, { kind: 'child', x: 0.7, layer: 1 }];
        const world = rig.makeWorld('2x', seed, { jitter, palm: PALM });
        const feeder = new rig.Feeder(pose, lib, { assist: true, cap: 4, truth: true, hander: palmHander });
        const brain = mode === 'swing'
          ? { act(ctx, p, now){ const up = Math.floor(now / 0.5 + (p.idx ? 0.5 : 0)) % 2, J = p.J, R = p.armLen * p.k; p.L.goal(J.lSh.x - 0.07, J.shY + (up ? -R * 0.8 : R * 0.8), now); p.R.goal(J.rSh.x + 0.07, J.shY + (up ? R * 0.8 : -R * 0.8), now); } }
          : { act(ctx, p, now){ const J = p.J, R = p.armLen * p.k; p.L.goal(J.lSh.x - 0.1, J.shY - R * 0.3, now); p.R.goal(J.rSh.x + 0.1, J.shY - R * 0.3, now); } };
        for (let i = 0; i < 45; i++){ world.step(1 / 30, null, null); feeder.step(world, 1 / 30); }
        feeder.err = { n: 0, sum2: 0, max: 0, lostN: 0, lostSum2: 0, big: 0 };
        const r0 = pose.handRuns || 0;
        for (let i = 0; i < 600; i++){ world.step(1 / 30, brain, {}); feeder.step(world, 1 / 30); }
        n += feeder.err.n; s2 += feeder.err.sum2; looks += 600; runs += (pose.handRuns || 0) - r0; ms += feeder.handMsSpent;
        forceSwitches(null);
      }
      res[mode + on] = { rms: Math.sqrt(s2 / Math.max(1, n)) * 1000, runs: runs / looks, ms: ms / Math.max(1, looks) };
    }
  }
  const f = (x) => Math.round(x * 10) / 10;
  log(`| palm vs wrist | ${f(res.swingfalse.rms)} | ${f(res.swingtrue.rms)} | ${f(res.stillfalse.rms)} | ${f(res.stilltrue.rms)} | ${f(res.swingtrue.runs)} (swing) / ${f(res.stilltrue.runs)} (held) | ${Math.round(res.swingtrue.ms * 1000) / 1000} |`);
  forceSwitches(null); setPalm(0);
}

/* The crossing scenario for the clothes feature (Settings > Testing > Recognise players by clothes): two children of one size, one a step in
   front of the other so they can pass, trade places four times in a minute, in different shirts (or both in the same). The rig's own
   bodies and noise make the landmarks; the picture is drawn from them (test/harness/synth-frames.mjs), which is all this rig can offer in
   place of a camera: the clothes colours are as drawn, there is no real lighting, skin, hair or background. The number is how many times,
   just before the next crossing begins (everyone apart again), a child was in a different slot from the one they had at the start: 0
   is every player keeping their own place through every crossing. (Mid-crossing the two are often one body to the detector: nothing
   can be told there, so nothing is counted there.) */
import { blankFrame, drawFigure, SHIRTS } from '../../test/harness/synth-frames.mjs';

const DT = 1 / 30, PHASE = 7.5;

export function crossing({ pose, rig, lib, seeds, jitter, cap = 4, secs = 60 }){
  rig.LINEUPS['2x'] = [{ kind: 'child', x: 0.3, layer: 0 }, { kind: 'child', x: 0.7, layer: 1 }];
  const brain = { act(ctx, p, now){ const home = p.mem.home ??= p.sx; p.walkTo(Math.floor(now / PHASE) % 2 ? 1 - home : home); } };
  const shirts = (same) => (person) => same ? SHIRTS.red : [SHIRTS.red, SHIRTS.blue][person.idx % 2];
  const once = (seed, on, same) => {
    rig.resetPose(pose);
    const world = rig.makeWorld('2x', seed, { jitter });
    const shirtOf = shirts(same);
    const frames = on ? (dets) => {
      const f = blankFrame();
      for (const d of [...dets].sort((a, b) => a.person.layer - b.person.layer)) drawFigure(f, d.lm, { shirt: shirtOf(d.person) });
      return f;
    } : null;
    const feeder = new rig.Feeder(pose, lib, { assist: true, cap, frames });
    let first = null, wrong = world.persons.map(() => 0);
    for (let i = 0; i < secs / DT; i++){
      world.step(DT, brain, {}); feeder.step(world, DT);
      const t = (i + 1) * DT;
      if (first === null && t > 5) first = world.persons.map(p => p.slot);
      if (first && Math.abs(t % PHASE - (PHASE - 0.1)) < DT / 2) world.persons.forEach((p, k) => { if (p.slot !== first[k]) wrong[k]++; });
    }
    return wrong;
  };
  return seeds.map(seed => ({ seed, off: once(seed, false, false), on: once(seed, true, false), sameOff: once(seed, false, true), sameOn: once(seed, true, true) }));
}

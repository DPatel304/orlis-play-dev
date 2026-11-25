/* Games made with Cubo's Create, for the playtest rig: one for each job (collect, dodge, keepup, stack), built by the real recipe
   (create/recipe.js build) and run on the real Orlis.play engine (via madeGame, as the shell does). Also their brains, so the scripted
   bodies of rig.mjs can play them. Ids: made-collect, made-dodge, made-keepup, made-stack. */
import { BRAINS } from './rig.mjs';
import { madeGame } from '../../src/create/made-game.js';
import { defaultPicks } from '../../src/create/recipe.js';

const A = 16 / 9;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
/* (made-dodge-still: the same game with players who never move - the control for the rule that standing still must not win) */
export const MADE_IDS = ['made-collect', 'made-dodge', 'made-dodge-still', 'made-keepup', 'made-stack'];

/* the picks a child would make with the defaults (speed 3, many 3, size 2, together) apart from the job and the piece; two minutes */
const PICKS = {
  'made-collect': { things: [{ id: 'apple', job: 'collect' }] },
  'made-dodge': { things: [{ id: 'bee', job: 'dodge' }] },
  'made-dodge-still': { things: [{ id: 'bee', job: 'dodge' }] },
  'made-keepup': { things: [{ id: 'beachball', job: 'keepup' }] },
  'made-stack': { things: [{ id: 'apple', job: 'stack' }] }
};
export function makeMade(id, extra = {}){
  const picks = { ...defaultPicks(), ...PICKS[id], minutes: 2, ...extra };
  return madeGame({ id, name: id, picks });
}

const lead = (p, key, obj, s) => {
  const m = p.mem[key] || (p.mem[key] = new Map()), prev = m.get(obj);
  m.set(obj, { x: obj.x, y: obj.y, t: p.mem.now });
  if (!prev || p.mem.now === prev.t) return { x: obj.x, y: obj.y };
  const dt = p.mem.now - prev.t, vx = (obj.x - prev.x) / dt, vy = (obj.y - prev.y) / dt, f = p.isChild ? 0.6 : 1;
  return { x: obj.x + vx * s * f, y: obj.y + vy * s * f };
};
const idle = (p, now, laneX) => { p.releaseHands(now); if (laneX != null && Math.abs(laneX - p.sx) > 0.03 && p.rng() < 0.01) p.walkTo(laneX); };
const lane = (ctx, p) => 0.5 + (p.idx - (ctx.world.persons.length - 1) / 2) * 0.2;

/* collect / stack: go for the nearest thing a hand can touch (not a bomb), as Pop Party's players do */
const grab = {
  act(ctx, p, now){
    const g = ctx.inst; p.mem.now = now;
    const cands = [];
    for (const th of g.things){
      if (th.dead || !g._touchable(th) || th.x < 0.04 || th.x > 0.96 || th.y < 0.05 || th.y > 0.95) continue;
      if (th.d.name === 'bomb') continue;
      const l = lead(p, 'th', th, p.delay + 0.15), r = p.reach(l.x, l.y);
      if (r.kind === 'no') continue;
      const walk = r.kind === 'walk' ? Math.max(0, Math.abs(l.x - p.sx) - p.armLen * 0.9 / A) : 0;
      if (r.kind === 'walk' && walk > 0.28) continue;
      const handD = Math.hypot((l.x - (r.side === 'l' ? p.L.x : p.R.x)) * A, l.y - (r.side === 'l' ? p.L.y : p.R.y));
      let cost = walk / (p.kind.walk * p.ppm * 0.5625) + handD / (p.kind.vmax * p.ppm * 0.6) + (r.kind === 'hop' ? 0.6 : r.kind === 'bend' ? 0.3 : 0);
      for (const q of ctx.world.persons) if (q !== p && !q.lapse && q.tgt === th && Math.abs(q.sx - l.x) < Math.abs(p.sx - l.x)) cost += 0.8;
      cands.push({ th, l, r, cost });
    }
    cands.sort((a, b) => a.cost - b.cost);
    const stick = p.tgt && !p.tgt.dead && cands.find(c => c.th === p.tgt), pick = stick && now < (p.mem.until || 0) ? stick : cands[0];
    if (!pick){ p.tgt = null; p.state = 'idle'; idle(p, now, lane(ctx, p)); return; }
    if (p.tgt !== pick.th){ p.tgt = pick.th; p.mem.until = now + 0.6 + p.rng() * 0.5; }
    p.state = 'on';
    p.approach(pick.l.x, pick.l.y, now, { hand: pick.r.side });
    p.other(pick.r.side).goal(p.shoulderOf(pick.r.side === 'l' ? 'r' : 'l').x, p.J.shY + p.armLen * p.k * 0.5, now);
  }
};

/* dodge: hands rest low at the sides; a thing heading for a hand pushes that hand up or down out of its way (after the body's reaction time) */
const dodge = {
  act(ctx, p, now){
    const g = ctx.inst; p.mem.now = now; p.state = 'on';
    const sh = p.J.shY, R = p.armLen * p.k;
    for (const side of ['l', 'r']){
      const Hd = side === 'l' ? p.L : p.R, sx = p.shoulderOf(side).x + (side === 'l' ? -0.04 : 0.04), ry = sh + R * 0.75;
      let ty = ry, tx = sx;
      for (const th of g.things){
        if (th.dead) continue;
        const l = lead(p, 'th' + side, th, p.delay + 0.25);
        const near = Math.hypot((l.x - sx) * A, l.y - ry) < th.sz / 2 + 0.16, near2 = Math.hypot((th.x - sx) * A, th.y - ry) < th.sz / 2 + 0.16;
        if (near || near2){ ty = th.y > ry ? ry - R * 0.9 : ry + R * 0.35; tx = sx + (side === 'l' ? 0.02 : -0.02); break; }
      }
      Hd.goal(tx, ty, now);
    }
    if (p.rng() < 0.002) p.walkTo(lane(ctx, p));
  }
};

/* keep up: meet the ball where it comes down, about chest high (as Keep It Up's players do) */
const keepup = {
  act(ctx, p, now){
    const g = ctx.inst; p.mem.now = now;
    let best = null, bc = 1e9;
    for (const b of g.things){
      if (b.dead) continue;
      /* (a ball each: players go for the ball in their own colour; only that one can be batted by them) */
      if (b.owner != null && b.owner !== p.slot) continue;
      const sy = p.restShY() + p.armLen * p.k * 0.2, gr = 0.5;
      let yHit = clamp(sy, 0.3, 0.8), disc = b.vy * b.vy + 2 * gr * (yHit - b.y);
      for (let k = 0; disc < 0 && k < 8; k++){ yHit = Math.min(0.88, yHit + 0.06); disc = b.vy * b.vy + 2 * gr * (yHit - b.y); }
      if (disc < 0) continue;
      const tt = (-b.vy + Math.sqrt(disc)) / gr, x = clamp(b.x + b.vx * tt * 0.8, 0.05, 0.95);
      const walkNeed = Math.max(0, Math.abs(x - p.sx) * A - p.armLen * p.k * 0.9);
      if (walkNeed / (p.kind.walk * p.ppm) > tt + 0.3) continue;
      let cost = Math.abs(x - p.sx) * 2 + tt * 0.3;
      for (const q of ctx.world.persons) if (q !== p && !q.lapse && q.tgt === b && Math.abs(q.sx - x) < Math.abs(p.sx - x) - 0.03) cost += 1.5;
      if (cost < bc){ bc = cost; best = { b, x, yHit }; }
    }
    if (!best){ p.tgt = null; p.state = 'idle'; idle(p, now, null); return; }
    p.tgt = best.b; p.state = 'on';
    const r = p.reach(best.x, best.yHit);
    if (r.kind === 'walk') p.walkTo(best.x);
    p.approach(best.x, best.yHit - 0.02, now, { hand: r.side, allowHop: false });
    p.other(r.side).release(now);
  }
};
/* dodge, standing still: hands at the sides, never a step: what a child who does not know it is a game does */
const still = { act(ctx, p, now){ p.mem.now = now; p.state = 'on'; p.releaseHands(now); } };
BRAINS['made-dodge-still'] = still;
BRAINS['made-collect'] = grab; BRAINS['made-stack'] = grab; BRAINS['made-dodge'] = dodge; BRAINS['made-keepup'] = keepup;

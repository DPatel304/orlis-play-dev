/* Playtest rig, headless: plays every Home game with scripted children and grown-ups and writes numbers.

     cd app && node tools/playtest.mjs                         # everything: 10 games x 4 line-ups x 3 seeds -> ../docs/playtest/results.json
     node tools/playtest.mjs --games pop-party,leaf-pile       # some games
     node tools/playtest.mjs --lineups 1c,4m --seeds 1,2       # some line-ups, some seeds
     node tools/playtest.mjs --real                            # the real tracker's rules decide who joins (default: "assist": anyone it would
                                                               #   turn away or drop is let in anyway, so the game itself can be judged)
     node tools/playtest.mjs --jitter 0.004                    # camera jitter (picture widths, one sigma; default 0.0018)
     node tools/playtest.mjs --admission                       # only who the tracker lets in, for each line-up and for cap 2 and 4
     node tools/playtest.mjs --watchers                        # the sofa person and the passer-by (lineups s, p, sp, 1c+s ... 4m+sp): share of 3 minutes they were a player
     node tools/playtest.mjs --tables                          # print the summary tables from results.json (nothing is run)
     node tools/playtest.mjs --calibrate                       # how big a hop / squat / lean / knee lift must be to count (game detectors)
     node tools/playtest.mjs --sensitivity                     # Sleepy Bear: stars against reaction time and camera jitter
     node tools/playtest.mjs --falsejumps                      # moves that must NOT count as a hop (squat, bend, tiptoe, reach, lean, march, flap), 3 min each; --blind hides the ankles
     node tools/playtest.mjs --crossing                        # two children in different shirts trade places: slot changes with the clothes feature off and on (synthetic frames drawn from the rig's bodies)
     --track [--only cross,family,leave]                       # who is who and steadiness across the Testing switches, exact swaps (tools/playtest/trackcmp.mjs)
     --bands [--only swing,cross,cushion,shirt,warm]           # coloured wristbands on the rig, off and on, alone and with Tell players apart better (tools/playtest/bandcmp.mjs)
     --palm [--games a,b] [--lineups ..]                       # Exact hands: the same games with the hand a palm's length beyond the wrist, hands off and on (tools/playtest/palmcmp.mjs)
     --switches steady,apart                                   # run with those Testing switches on (default none)
     --jp rise,speed                                           # try other hop thresholds in --calibrate / --falsejumps / game runs (default: jump.js HOP); --oldjump the old 0.08 / 0.5
     (every game run also reports, per player, jumpsDetected / falseJumps / falseJumpsPer3min: a second hop detector looking on)
     other flags: --cap N (places that can fill; 4 default, the app ships 2), --react X (scale reaction times), --seeds 1,2,3, --force, --fresh
   (the full set in results.json was made with: --fresh; --calibrate; --sensitivity; --admission; --real --lineups 1c,4c,4m; --real --cap 2 --lineups 4c,4m)

   Line-ups: 1c one child, 1a one adult, 4c four children, 4m two adults + two children (the family: children in front, lower), 2m an adult and
   a child, 3m two adults and a child; add +s (a person seated on the sofa behind, 35-45% of an adult's size, mostly still, sometimes an arm up),
   +p (someone walking across the back of the room) or +sp to any of them (s, p, sp alone too): watchers, who must never play (see --watchers).
   Deterministic: a fixed seed gives the same round (the games' dice and the bodies' dice both come from it). 30 fps steps.
   Not a test; it changes no game code. See tools/playtest/rig.mjs for the bodies and how each game is played, and
   docs/playtest/REPORT.md for what the numbers mean (what is measured, what is assumed). */
import '../test/harness/browser.mjs';
import { register } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
register('../test/harness/hooks.mjs', import.meta.url);

const HERE = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, def = null) => { const i = argv.indexOf('--' + name); return i < 0 ? def : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : true); };
const OUT = resolve(HERE, opt('out', '../../docs/playtest/results.json'));

if (opt('tables')){ const { tables } = await import('./playtest/tables.mjs'); tables(JSON.parse(readFileSync(OUT, 'utf8'))); process.exit(0); }

const poseMod = await import('../src/tracking/pose.js');
const { pose, sizeOf, seated, CLOSE, STAY_CLOSE, WATCH_AFTER, headOf } = poseMod;
const { L } = await import('../src/tracking/pose-shared.js');
const { music } = await import('../src/audio/sound.js');
const { byId: byIdReal } = await import('../src/games/index.js');
const madeMod = await import('./playtest/made.mjs');
/* made-collect, made-dodge, made-keepup, made-stack: games made in Cubo's Create (tools/playtest/made.mjs) */
const byId = (id) => madeMod.MADE_IDS.includes(id) ? madeMod.makeMade(id) : byIdReal(id);
const { underHud, hudZones } = await import('../src/games/hud.js');
/* which of the shell's areas a point is under (the first), or null */
const underWhich = (W, H, x, y, spec) => { for (const [k, z] of Object.entries(hudZones(W, H, spec))) if (x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h) return k; return null; };
const rig = await import('./playtest/rig.mjs');
const jumpMod = await import('../src/tracking/jump.js');
/* --jp rise,speed: try other hop thresholds (default: the games' HOP) */
const JP = opt('jp') ? (([a, b]) => ({ rise: +a, speed: +b, feet: !opt('nofeet') }))(String(opt('jp')).split(',')) : null;
const { makeWorld, Feeder, resetPose, BRAINS, mulberry32, W, H, A } = rig;
const lib = { sizeOf, seated, CLOSE, STAY: STAY_CLOSE ?? CLOSE, WATCH_AFTER, headOf };
music.hold = () => {};

/* --switches steady,apart: run with those Testing switches on (default none: the tracker as it ships) */
if (opt('switches') && opt('switches') !== true){ const { forceSwitches, SWITCH_KEYS } = await import('../src/tracking/switches.js'); const on = String(opt('switches')).split(','); forceSwitches(Object.fromEntries(Object.keys(SWITCH_KEYS).map(k => [k, on.includes(k)]))); }
if (opt('nolead')) (await import('../src/tracking/pose.js')).setLead(false);      /* (with steady: the drawn lead off, to show scores do not depend on it) */
const DT = 1 / 30;
let PALM = 0;      /* (--palm: the bodies' hands are a palm's length past the wrist the model reports; see tools/playtest/palmcmp.mjs) */
const { palmHander } = await import('./playtest/palmcmp.mjs');
const GAME_IDS = ['pop-party', 'sky-painter', 'sleepy-bear', 'leaf-pile', 'stack-it-high', 'animal-gym', 'keep-it-up', 'ptero-flight', 'save-the-harvest', 'cubions-long-way-home'];
const games = String(opt('games', GAME_IDS.join(','))).split(',');   /* (--games made adds the four made-* games) */
if (games.includes('made')) games.splice(games.indexOf('made'), 1, ...madeMod.MADE_IDS);
const lineups = String(opt('lineups', '1c,1a,4c,4m')).split(',');
const seeds = String(opt('seeds', '1,2,3')).split(',').map(Number);
const assist = !opt('real');
const jitter = Number(opt('jitter', 0.0018));
const CAP = Number(opt('cap', 4));
const REACT = Number(opt('react', 1));

/* the games roll dice (where a balloon rises, when the music stops): one seeded stream per run */
const realRandom = Math.random;
const reseed = (n) => { Math.random = mulberry32(n); };
const hash = (s) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

const KINDS_DELAY = { child: [0.25, 0.6], adult: [0.4, 0.8] };
const med = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const mean = (a) => { const b = a.filter(Number.isFinite); return b.length ? b.reduce((s, x) => s + x, 0) / b.length : null; };
const r2 = (v) => v == null || !Number.isFinite(v) ? v : Math.round(v * 100) / 100;

/* ---------------------------------------------------------------- checks the tests also make */
function nonFinite(obj, path = 'game', seen = new Set(), depth = 0){
  if (obj == null || depth > 4 || seen.has(obj)) return null;
  if (typeof obj === 'number') return Number.isFinite(obj) ? null : `${path} is ${obj}`;
  if (typeof obj !== 'object' || ArrayBuffer.isView(obj)) return null;
  seen.add(obj);
  if (obj.getContext || obj.nodeType) return null;
  for (const [k, v] of Object.entries(obj)){
    if (['scene', 'avatars', 'j', 'jumps', 'mask', 'bg', 'tmp', 'prev', 'last', 'jw'].includes(k)) continue;
    const f = nonFinite(v, `${path}.${k}`, seen, depth + 1); if (f) return f;
  }
  return null;
}

/* ---------------------------------------------------------------- per-game probes: what to watch inside each game */
const PROBES = {
  'pop-party'(ctx){
    const seen = new Map(), done = [];
    const kindOf = (b) => b.giant ? 'giant' : b.parade ? 'parade' : b.bouquet ? 'bouquet' : b.r < 0.02 ? 'teeny' : b.r < 0.05 ? 'small' : b.r < 0.082 ? 'medium' : 'big';
    let spec = null, an = null, animals = { seen: 0, popped: 0 };
    return {
      frame(dt, t, step){
        const g = ctx.inst, live = new Set();
        if (step % 30 === 0) spec = g.hud();
        for (const b of g.balloons){
          if (b.parade && b.x < 0 || b.parade && b.x > 1) { /* still marching in */ }
          let rec = seen.get(b);
          if (!rec){ if (b.y == null || b.y > 1.0 || b.bouquet) continue; rec = { b, kind: kindOf(b), worth: b.worth, born: t, dwell: ctx.world.persons.map(() => 0), dwellHop: ctx.world.persons.map(() => 0), above: ctx.world.persons.map(() => 0), aboveHop: ctx.world.persons.map(() => 0), hud: 0, life: 0, lastY: b.y }; seen.set(b, rec); }
          live.add(b); rec.life += dt; rec.lastY = b.y;
          ctx.world.persons.forEach((p, i) => {
            if (!p.inScene) return;
            const r = p.reach(b.x, b.y); if (r.kind === 'ok') rec.dwell[i] += dt; if (r.kind === 'ok' || r.kind === 'hop') rec.dwellHop[i] += dt;
            const ceil = p.J.shY - p.armLen * p.k * 1.08, ceilHop = ceil - p.kind.hopGainM * p.ppm * p.k;
            if (b.y < ceil) rec.above[i] += dt; if (b.y < ceilHop) rec.aboveHop[i] += dt;
          });
          if (underHud(W, H, b.x * W, b.y * H, spec)) rec.hud += dt;
        }
        for (const [b, rec] of seen) if (!live.has(b)){ rec.popped = !!b.dead; done.push(rec); seen.delete(b); }
        if (g.animal && g.animal !== an){ an = g.animal; animals.seen++; }
        if (an && an.popT >= 0 && !an.counted){ an.counted = true; animals.popped++; }
      },
      finish(){
        for (const [b, rec] of seen){ rec.popped = !!b.dead; rec.open = true; done.push(rec); }
        const recs = done.filter(r => r.kind !== 'bouquet');
        const n = ctx.world.persons.length;
        const per = ctx.world.persons.map((p, i) => ({
          who: p.name, idx: i,
          inZoneShare: r2(recs.filter(r => r.dwell[i] >= 0.3).length / Math.max(1, recs.length)),
          inZoneWithHopShare: r2(recs.filter(r => r.dwellHop[i] >= 0.3).length / Math.max(1, recs.length)),
          shareOfBalloonLifeAboveReach: r2(recs.reduce((s, r) => s + r.above[i] / Math.max(0.1, r.life), 0) / Math.max(1, recs.length)),
          shareOfBalloonLifeAboveReachEvenHopping: r2(recs.reduce((s, r) => s + r.aboveHop[i] / Math.max(0.1, r.life), 0) / Math.max(1, recs.length)),
          reachCeilingY: r2(p.J.shY - p.armLen * p.k * 1.08)
        }));
        const by = {};
        for (const r of recs){ const k = by[r.kind] || (by[r.kind] = { n: 0, popped: 0, anyReach: 0, above: n ? ctx.world.persons.map(() => 0) : [] }); k.n++; r.above.forEach((a, i) => { k.above[i] = r2(k.above[i] + a / Math.max(0.1, r.life)); }); if (r.popped) k.popped++; if (r.dwell.some(d => d >= 0.3)) k.anyReach++; }
        return { balloons: recs.length, popped: recs.filter(r => r.popped).length, escaped: recs.filter(r => !r.popped && !r.open).length,
          medianPopHeightY: r2(med(recs.filter(r => r.popped).map(r => r.lastY))),
          underHudShare: r2(recs.reduce((s, r) => s + r.hud, 0) / Math.max(0.01, recs.reduce((s, r) => s + r.life, 0))),
          pointsPoppedTotal: recs.filter(r => r.popped).reduce((s, r) => s + r.worth, 0), byKind: by, perPerson: per, animals };
      }
    };
  },
  'sleepy-bear'(ctx){
    const freezes = []; let prev = 'dance', cur = null;
    return {
      frame(dt, t){
        const g = ctx.inst;
        if (prev === 'dance' && g.phase === 'freeze'){ cur = { at: t, len: 0, outcome: {}, before: g.score.slice() }; }
        if (g.phase === 'freeze' && cur) cur.len += dt;
        if (prev === 'freeze' && g.phase === 'dance' && cur){
          ctx.world.persons.forEach((p, i) => {
            const s = p.slot; if (s < 0) { cur.outcome[i] = 'absent'; return; }
            cur.outcome[i] = g.score[s] > cur.before[s] ? 'star' : g.caught[s] ? 'wobble' : 'nearly';
          });
          freezes.push(cur); cur = null;
        }
        prev = g.phase;
      },
      finish(){
        const out = ctx.world.persons.map((p, i) => {
          const o = freezes.map(f => f.outcome[i]).filter(Boolean), c = (k) => o.filter(x => x === k).length;
          return { who: p.name, idx: i, freezes: o.length, stars: c('star'), wobbles: c('wobble'), nearly: c('nearly'), absent: c('absent'), starRate: r2(c('star') / Math.max(1, o.length)) };
        });
        return { freezes: freezes.length, meanFreezeLen: r2(mean(freezes.map(f => f.len))), perPerson: out };
      }
    };
  },
  'leaf-pile'(ctx){
    const s = { pileAt: [], reachedBigAt: null, readyAt: null, burstAt: null, jumpedOfPresent: null, leavesLyingMin: 999 };
    return {
      frame(dt, t, step){
        const g = ctx.inst;
        if (step % 300 === 0) s.pileAt.push([Math.round(t), g.pile]);
        if (s.reachedBigAt == null && g.pile >= 120) s.reachedBigAt = r2(t);
        if (s.readyAt == null && g.ready) s.readyAt = r2(t);
        if (s.burstAt == null && g.piles) s.burstAt = r2(t);
        if (g.ready) s.jumpedOfPresent = [g.jumped.size, ctx.world.persons.filter(p => p.present).length];
      },
      finish(){ const g = ctx.inst; return { ...s, finalPile: g.pile, peakPile: g.peak, pileAtSweepEnd: s.pileAt.length ? s.pileAt[s.pileAt.length - 1][1] : null, leavesInPlay: g.leaves.length }; }
    };
  },
  'stack-it-high'(ctx){
    /* sandbox: blocks placed, the tallest thing, and whether anything gets stuck (held far too long, in the air, never taken) */
    const holdT = new Map(), airT = new Map(); let longestHold = 0, longKind = '', tooLong = 0, airLong = 0, maxHeld = 0;
    return {
      frame(dt){
        const g = ctx.inst;
        for (const b of g.blocks){
          if (b.held != null){ const t = (holdT.get(b) || 0) + dt; holdT.set(b, t); if (t > longestHold){ longestHold = t; longKind = b.kind; } if (t > 25 && t - dt <= 25) tooLong++; } else holdT.delete(b);
          const air = b.held == null && b.state !== 'rest' && !b.fade;
          if (air){ const t = (airT.get(b) || 0) + dt; airT.set(b, t); if (t > 20 && t - dt <= 20) airLong++; } else airT.delete(b);
        }
        maxHeld = Math.max(maxHeld, g.blocks.filter(b => b.held != null).length);
      },
      finish(){
        const g = ctx.inst, y = g.yard;
        return { blocksPlaced: g.stacked, placedPerPlayer: g.score.slice(0, ctx.world.persons.length).join('/'), tallestBlocks: g.peak, tallestAtEnd: y.tallest(),
          blocksOnGroundAtEnd: y.blocks.length, neverTaken: y.blocks.filter(b => !b.used && !b.fade).length, carriedAtOnce: maxHeld,
          longestHoldSecs: r2(longestHold), longestHoldKind: longKind, heldOver25s: tooLong, inAirOver20s: airLong, stuckHeldAtEnd: g.blocks.filter(b => b.held != null).length, summary: g.summary() };
      }
    };
  },
  'sky-painter'(ctx){
    const s = { doneAt: [], topRow: 99, cov: [], lastDone: 0, grew: 0, longestStall: 0, lastPainted: 0, stallsOver10: 0, inStall: false, handGrew: 0, lastHand: 0, longestHandStall: 0 };
    return {
      frame(dt, t, step){
        const g = ctx.inst;
        /* a stall: nobody (and no spreading) has worn a layer through anywhere for this long (the covers have three layers: a cell counts at each);
           a finished picture starts it afresh */
        const worn = g.handNew + g.spreadN;
        if (g.alive || g.done > s.lastDone || worn > s.lastPainted) s.grew = t;
        s.lastPainted = g.alive ? 0 : worn;
        /* (hands only: the spreading doesn't count) */
        if (g.handNew > s.lastHand || g.alive) s.handGrew = t;
        s.lastHand = g.alive ? 0 : g.handNew; s.longestHandStall = Math.max(s.longestHandStall, t - s.handGrew);
        const stall = t - s.grew; s.longestStall = Math.max(s.longestStall, stall);
        if (stall > 10 && !s.inStall){ s.stallsOver10++; s.inStall = true; } else if (stall < 1) s.inStall = false;
        if (g.done > s.lastDone){ s.doneAt.push(r2(t)); s.lastDone = g.done; }
        if (step % 150 === 0) s.cov.push([Math.round(t), r2(g.covered), Math.round(g.wear.reduce((a, b, i) => a + (g.out[i] ? 0 : b), 0)), g.live, g.painted, g.wear.reduce((a, b, i) => a + (!g.out[i] && b >= g.cum[2] ? 1 : 0), 0), g.cells.reduce((a, b, i) => a + (!g.out[i] && b ? 1 : 0), 0)]);
        for (let c = 0; c < g.cells.length; c += 1){ if (g.cells[c]){ const row = (c / 48) | 0; if (row < s.topRow) s.topRow = row; break; } }
      },
      finish(){
        const g = ctx.inst, handCells = g.score.reduce((a, b) => a + b, 0), allCells = g.done * g.cells.length + g.painted;
        return { pictures: g.done, longestStall: r2(s.longestStall), longestHandStall: r2(s.longestHandStall), stallsOver10s: s.stallsOver10, doneAt: s.doneAt, paintedFinal: r2(g.covered), spreadShare: r2(g.spreadN != null ? g.spreadN / Math.max(1, g.spreadN + handCells) : 1 - handCells / Math.max(1, allCells)), cells: allCells, handCells, covAt: s.cov };
      }
    };
  },
  'animal-gym'(ctx){
    const segs = []; let cur = null, prevSeg = -1;
    return {
      frame(dt, t){
        const g = ctx.inst;
        if (g.seg !== prevSeg){
          if (cur){ cur.fill = r2(cur.lastFill); cur.filled = cur.filledAt != null; cur.len = t - cur.start; segs.push(cur); }
          cur = { seg: g.seg, move: g.move, start: t, lastFill: 0, filledAt: null, triesBy: ctx.world.persons.map(() => 0), base: ctx.world.persons.map(p => p.slot >= 0 ? g.score[p.slot] : 0) };
          prevSeg = g.seg;
        }
        cur.lastFill = g.fill; if (g.fill >= 1 && cur.filledAt == null) cur.filledAt = t - cur.start;
        ctx.world.persons.forEach((p, i) => { if (p.slot >= 0) cur.triesBy[i] = g.score[p.slot] - cur.base[i]; });
      },
      finish(t){
        if (cur){ cur.fill = r2(cur.lastFill); cur.filled = cur.filledAt != null; cur.len = t - cur.start; segs.push(cur); }
        return { segments: segs.map(s => ({ move: s.move, filled: s.filled, len: r2(s.len), filledAfter: r2(s.filledAt), fill: s.fill, tries: s.triesBy })), circuits: ctx.inst.circuits,
          filledOf: [segs.filter(s => s.filled).length, segs.length] };
      }
    };
  },
  'keep-it-up'(ctx){
    const s = { drops: 0, lostBalls: 0, maxBalls: 1, prevStreak: 0, prevBalls: 1, lastHitT: 0, longestNoHit: 0, hitAt: [], bestAt: null, ballT: 0, ballOk: 0 };
    let prevHits = 0;
    return {
      frame(dt, t){
        const g = ctx.inst;
        /* ball time where its player (anybody, for a ball that's anybody's) could get a hand to it, standing where they are (a hop, bend or walk allowed) */
        for (const b of g.balls){ s.ballT += dt; if (ctx.world.persons.some(p => (b.owner == null || b.owner === p.slot) && p.reach(b.x, b.y).kind !== 'no')) s.ballOk += dt; }
        if (g.streak === 0 && s.prevStreak > 0) s.drops++;
        s.prevStreak = g.streak;
        if (g.balls.length < s.prevBalls) s.lostBalls += s.prevBalls - g.balls.length;
        s.prevBalls = g.balls.length; s.maxBalls = Math.max(s.maxBalls, g.balls.length);
        if (g.hits > prevHits){ s.longestNoHit = Math.max(s.longestNoHit, t - s.lastHitT); s.lastHitT = t; prevHits = g.hits; }
      },
      finish(t){ const g = ctx.inst; s.longestNoHit = Math.max(s.longestNoHit, t - s.lastHitT); return { bestStreak: g.best, totalHits: g.hits, streakResets: s.drops, ballsPopped: s.lostBalls, maxBalls: s.maxBalls, longestNoHit: r2(s.longestNoHit), ballReachableShare: r2(s.ballOk / Math.max(1e-6, s.ballT)) }; }
    };
  },
  'ptero-flight'(ctx){
    const s = { atMin: 0, atMax: 0, spawned: 0, finds: [], prevFound: 0, born: new Map(), missed: 0 };
    return {
      frame(dt, t){
        const g = ctx.inst;
        if (g.alt <= 1.11) s.atMin += dt; if (g.alt >= 4.99) s.atMax += dt;
        for (const w of g.wonders) if (!s.born.has(w)) s.born.set(w, t);
        if (g.found.length > s.prevFound){ s.finds.push(r2(t)); s.prevFound = g.found.length; }
      },
      finish(t){
        const g = ctx.inst, spawned = s.born.size, found = g.found.length;
        const waiting = g.wonders.filter(w => !w.got).length;
        const times = []; for (const [w, b] of s.born) if (w.got && w.goneAt != null) times.push(w.goneAt - b - 1.2 + 0);
        return { wondersSpawned: spawned, found, missed: spawned - found - waiting, findAt: s.finds, secondsAtMinAlt: r2(s.atMin), secondsAtMaxAlt: r2(s.atMax), meanSecondsSpawnToFind: r2(mean(times)), distance: r2(g.dist) };
      }
    };
  },
  'save-the-harvest'(ctx){
    const rounds = []; let prevPhase = null, prevKind = null;
    return {
      frame(dt, t){
        const g = ctx.inst;
        if (prevPhase === 'move' && g.phase !== 'move') rounds.push({ kind: g.kind, tries: g.tries, need: g.need, ok: !!g.ok, at: r2(t), len: r2(g.pt) });
        prevPhase = g.phase;
      },
      finish(t){
        const g = ctx.inst;
        return { rounds: rounds.length, okRounds: rounds.filter(r => r.ok).length, byKind: ['apple', 'pear', 'berry', 'raven'].map(k => ({ kind: k, rounds: rounds.filter(r => r.kind === k).length, ok: rounds.filter(r => r.kind === k && r.ok).length, meanTries: r2(mean(rounds.filter(r => r.kind === k).map(r => r.tries))), need: r2(mean(rounds.filter(r => r.kind === k).map(r => r.need))) })),
          won: !!g.win, wonAt: g.win ? r2(g.t) : null, basket: g.value(), ravenSnacks: 0, raven: g.raven };
      }
    };
  },
  'cubions-long-way-home'(ctx){
    const cards = []; let cur = null, lastCardEnd = 0, longestGap = 0;
    return {
      frame(dt, t){
        const g = ctx.inst, c = g.card && g.card();
        if (c && !cur){ cur = { card: c, at: t }; longestGap = Math.max(longestGap, t - lastCardEnd); }
        if (!c && cur){ cur.len = t - cur.at; cards.push(cur); cur = null; lastCardEnd = t; }
      },
      finish(t){
        const g = ctx.inst; longestGap = Math.max(longestGap, t - lastCardEnd);
        const words = g.beats.reduce((s, b) => s + (b.t ? b.t.trim().split(/\s+/).length : 0), 0);
        return { beats: g.beats.length, words, cards: cards.length, cardMoves: [...new Set(cards.map(c => c.card))], cardTimeTotal: r2(cards.reduce((s, c) => s + c.len, 0)), longestGapBetweenCards: r2(longestGap), cardAt: cards.map(c => [r2(c.at), c.card, r2(c.len)]), estTotalNoVoice: r2(g.total) };
      }
    };
  }
};


/* games made in Create (the Orlis.play engine): how long a thing is on the screen, how much of that a body could reach it, and how much it spends under the shell's areas */
const madeProbe = (ctx, balls = false) => {
  const seen = new Map(), done = [];
  let spec = null;
  return {
    frame(dt, t, step){
      const g = ctx.inst, live = new Set();
      if (step % 30 === 0) try { spec = g.hud ? g.hud() : null; } catch (e){ spec = null; }
      for (const th of g.things){
        if (!g._touchable(th) || (th.d.move === 'bounce') !== balls) continue;
        let rec = seen.get(th); if (!rec){ rec = { kind: th.d.name, life: 0, reach: ctx.world.persons.map(() => 0), hud: 0, x0: th.x, y0: th.y }; seen.set(th, rec); }
        rec.x1 = th.x; rec.y1 = th.y;
        live.add(th); rec.life += dt;
        /* (a thing under the clock, goal bar or scores, or not yet in reach of the smallest player, is not there to be touched: it does not count as reachable) */
        const under = underHud(W, H, th.x * W, th.y * H, spec), inReach = g._live ? g._live(th) : true;
        ctx.world.persons.forEach((p, i) => { if (p.inScene && !under && inReach && th.y > 0.05 && th.y < 0.98 && p.reach(th.x, th.y).kind !== 'no') rec.reach[i] += dt; });
        if (under){ rec.hud += dt; const k = underWhich(W, H, th.x * W, th.y * H, spec); rec.by = rec.by || {}; rec.by[k] = (rec.by[k] || 0) + dt; }
      }
      for (const [th, rec] of seen) if (!live.has(th)){ done.push(rec); seen.delete(th); }
    },
    finish(){
      for (const rec of seen.values()) done.push(rec);
      const recs = done.filter(r => r.life > 0.3), tot = Math.max(0.01, recs.reduce((s, r) => s + r.life, 0));
      /* (never reachable: nobody could touch it for as long as 0.3 s, and it left the screen rather than being touched the moment it was in reach) */
      const missed = (r) => r.reach.every(x => x < 0.3) && (r.y1 > 0.95 || r.y1 < 0.05 || r.x1 < 0.02 || r.x1 > 0.98);
      const by = {}; for (const r of recs) for (const [k, v] of Object.entries(r.by || {})) by[k] = r2((by[k] || 0) + v / tot);
      return { things: recs.length, underHudShare: r2(recs.reduce((s, r) => s + r.hud, 0) / tot), underHudBy: by,
        reachableShareByPerson: ctx.world.persons.map((p, i) => ({ who: p.name, idx: i, share: r2(recs.reduce((s, r) => s + r.reach[i], 0) / tot) })),
        neverReachableByAnyone: recs.filter(missed).length,
        sampleNeverReached: recs.filter(missed).slice(0, 4).map(r => ({ kind: r.kind, life: r2(r.life), from: [r2(r.x0), r2(r.y0)], to: [r2(r.x1), r2(r.y1)] })) };
    }
  };
};
for (const id of ['made-collect', 'made-stack']) PROBES[id] = madeProbe;
/* a Dodge game has a health bar each and no score (decision 0064): how many hits each player took, whether and when (seconds into the round) they went out, and where their bar stood at the end */
const dodgeProbe = (ctx) => {
  const base = madeProbe(ctx);
  return { frame: base.frame, finish(t){
    const r = base.finish(t), g = ctx.inst;
    r.health = { perPerson: ctx.world.persons.map((p, i) => ({ who: p.name, idx: i, hits: g.hits[p.slot] || 0, out: !!g.out[p.slot], outAt: g.outAt[p.slot] == null ? null : r2(g.outAt[p.slot]), finalFill: r2(g.hp[p.slot] ?? 1) })) };
    return r;
  } };
};
PROBES['made-dodge'] = dodgeProbe; PROBES['made-dodge-still'] = dodgeProbe;
PROBES['made-keepup'] = (ctx) => madeProbe(ctx, true);

/* the hand orbs (decision 0062): where they are, are they apart, are they under the shell's areas, are bursts left at the end */
const feelOf = (inst) => (inst.avatars && inst.avatars.feel) || inst.feel || null;
function orbSample(o, inst){
  const f = feelOf(inst); if (!f) return;
  const list = f.list(); o.samples++; o.maxOrbs = Math.max(o.maxOrbs, list.length); o.burstsMax = Math.max(o.burstsMax, f.bursts.alive);
  let spec = null; try { spec = inst.hud ? inst.hud() : null; } catch (e){ spec = null; }
  let close = false;
  for (const e of list){ o.orbFrames++; if (underHud(W, H, e.orb.x * W, e.orb.y * H, spec)) o.underHud++; }
  for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++){
    if (list[a].who === list[b].who) continue;
    const d = Math.hypot((list[a].orb.x - list[b].orb.x) * W, (list[a].orb.y - list[b].orb.y) * H);
    o.minGapPx = Math.min(o.minGapPx, d); if (d < 0.04 * H) close = true;
    if (list[a].col && list[a].col === list[b].col) o.colourClash++;
  }
  if (close) o.tooClose++;
}

/* ---------------------------------------------------------------- one run */
function runOne(gid, lineup, seed, o = {}){
  const game = byId(gid);
  if (!game) throw new Error('no game ' + gid);
  reseed(seed * 7919 + hash(gid));
  resetPose(pose);
  const world = makeWorld(lineup, seed, { jitter: o.jitter ?? jitter, react: o.react ?? REACT, palm: PALM });
  const feeder = new Feeder(pose, lib, { assist: o.assist ?? assist, cap: o.cap ?? CAP, hander: PALM ? palmHander : null });
  pose.keepSitters = !!game.keepSitters;
  const passive = !!game.passive;
  /* before the round: everyone stands in view for a moment and the tracker lets them in */
  if (!passive) for (let i = 0; i < 45; i++){ world.step(DT, null, null); feeder.step(world, DT); }
  const joinedAtStart = world.persons.map(p => p.present);
  world.t = 0;
  const inst = game.create(o.cap ?? CAP);
  const ctx = { inst, world, game };
  const brain = BRAINS[gid];
  const probe = (PROBES[gid] || (() => ({ frame(){}, finish(){ return {}; } })))(ctx);
  const n = world.persons.length;
  const stat = world.persons.map(p => ({ score: 0, firstPoint: null, lastPoint: 0, longestNoPoints: 0, present: 0, lost: 0, wasPresent: p.present, scoreWhileAway: 0, offTarget: 0, longestOff: 0, curOff: 0 }));
  const limit = game.endless ? (gid === 'save-the-harvest' ? 340 : 420) : game.secs + 5;
  /* a second hop detector looking on (the games' own is HOP): a detection with no real hop in the second before is a false jump */
  const { JumpWatch: JW, HOP: HOPP } = jumpMod, obs = new JW(JP || HOPP), jstat = world.persons.map(() => ({ jumps: 0, false: 0, lastLift: -9 }));
  let prev = inst.score ? inst.score.slice() : [], step = 0, t = 0, issues = [], scoreDown = 0, scoreAbsent = 0, absentWhy = [], stuckFor = 0, longestStuck = 0, lastSum = 0, nonFin = null;
  let ended = 'time';
  const orbs = { samples: 0, orbFrames: 0, underHud: 0, maxOrbs: 0, minGapPx: 1e9, tooClose: 0, colourClash: 0, burstsAtOver: null, burstsMax: 0 };
  for (;;){
    world.step(DT, brain, ctx);
    if (!passive) feeder.step(world, DT);
    const before = inst.score ? inst.score.slice() : [];
    inst.step(DT, W, H);
    t += DT; step++;
    world.persons.forEach((p, i) => { if (p.lift > 0.001) jstat[i].lastLift = t; });
    for (const slot of obs.step(DT, pose.players, 4)){
      const i = world.persons.findIndex(p => p.slot === slot); if (i < 0) continue;
      jstat[i].jumps++; if (t - jstat[i].lastLift > 1){ jstat[i].false++; }
    }
    if (inst.score){
      for (let s = 0; s < inst.score.length; s++){
        if (inst.score[s] < before[s]) scoreDown++;
        /* points for a place nobody stands in (an absent player, or a place that was never filled) */
        if (inst.score[s] > before[s] && !world.persons.some(p => p.slot === s && p.present)){ scoreAbsent++; if (absentWhy.length < 4) absentWhy.push({ t: r2(t), slot: s, by: inst.score[s] - before[s], trackerSaysPresent: !!(pose.players[s] && pose.players[s].present), people: world.persons.map(p => `${p.name}:slot${p.slot}:${p.present ? 'in' : 'out'}`).join(' ') }); }
      }
      world.persons.forEach((p, i) => {
        const st = stat[i], s = p.slot;
        if (p.present){ st.present++; if (!st.wasPresent) { /* came back */ } } else if (st.wasPresent) st.lost++;
        st.wasPresent = p.present;
        if (s >= 0 && s < before.length){
          const d = inst.score[s] - before[s];
          if (d > 0){ st.score += d; if (st.firstPoint == null) st.firstPoint = t; st.longestNoPoints = Math.max(st.longestNoPoints, t - st.lastPoint); st.lastPoint = t; }
        }
        if (p.state === 'on') st.curOff = 0; else { st.curOff += DT; st.longestOff = Math.max(st.longestOff, st.curOff); }
      });
      const sum = inst.score.reduce((a, b) => a + b, 0);
      if (sum > lastSum){ stuckFor = 0; lastSum = sum; } else if (world.persons.some(p => p.present)) stuckFor += DT;
      longestStuck = Math.max(longestStuck, stuckFor);
    }
    probe.frame(DT, t, step);
    if (step % 3 === 0) orbSample(orbs, inst, step % 30 === 0 ? inst : null);
    if (step % 90 === 0 && !nonFin){ nonFin = nonFinite(inst, gid); }
    if (inst.over || (!game.endless && t >= game.secs)){ ended = inst.over ? 'over' : 'time'; { const f = feelOf(inst); orbs.burstsAtOver = f ? f.bursts.alive : null; } break; }
    if (t >= limit){ ended = 'cap'; break; }
  }
  const roundSecs = t;
  /* the ending some games have before the results (Pop Party's bouquets) */
  let outro = 0;
  if (inst.outro){ for (let i = 0; i < 30 * 30 && !inst.outro(DT, W, H); i++) outro += DT; for (let i = 0; i < 30; i++){ world.step(DT, null, null); } }
  if (!nonFin) nonFin = nonFinite(inst, gid);
  const tally = (() => { try { return inst.tally(); } catch (e){ return null; } })();
  const winner = (() => { try { return inst.winner(); } catch (e){ return 'error'; } })();
  const value = (() => { try { return inst.value(); } catch (e){ return null; } })();
  const summary = (() => { try { return inst.summary ? inst.summary(n) : null; } catch (e){ return null; } })();
  const ex = probe.finish(t);
  const frames = Math.max(1, step);
  const players = world.persons.map((p, i) => {
    const st = stat[i], ps = p.stats, tot = Math.max(1, ps.frames);
    const score = st.score;
    return {
      who: p.name, idx: i, startX: r2(p.homeX), heightPic: r2(p.h), joinedAtStart: joinedAtStart[i], sizeRatioToBiggest: r2(p.sizeRatio),
      score, perMin: r2(score / (roundSecs / 60)), firstPoint: st.firstPoint == null ? null : r2(st.firstPoint),
      longestNoPoints: r2(Math.max(st.longestNoPoints, roundSecs - st.lastPoint)),
      onShare: r2((ps.on || 0) / tot), idleShare: r2((ps.idle || 0) / tot), waitShare: r2((ps.wait || 0) / tot), lapseShare: r2((ps.lapse || 0) / tot),
      longestOffTarget: r2(st.longestOff),
      presentShare: r2(st.present / frames), timesLost: st.lost, slotChanges: p.slotChanges || 0, forcedIn: p.forced || 0, wouldBeDropped: p.ejections || 0,
      jumpsDetected: jstat[i].jumps, falseJumps: jstat[i].false, falseJumpsPer3min: r2(jstat[i].false / (roundSecs / 180)),
      armsUpShare: r2(ps.armsUp / tot), bentShare: r2(ps.bent / tot), hops: ps.hops, handPathM: r2((p.L.path + p.R.path)), handsOrHeadOffPictureShare: r2(ps.offFrame / tot), tooCloseShare: r2(ps.closeTime / roundSecs)
    };
  });
  const kids = players.filter(p => p.who === 'child'), adults = players.filter(p => p.who === 'adult');
  const scores = players.map(p => p.score), top = Math.max(...scores), tieTop = scores.filter(s => s === top).length;
  const res = {
    game: gid, lineup, seed, mode: (o.assist ?? assist) ? 'assist' : 'real', cap: o.cap ?? CAP,
    roundSecs: r2(roundSecs), outroSecs: r2(outro), ended, nominalSecs: game.endless ? null : game.secs,
    value, tally: tally ? tally.map(r => ({ label: r.label, value: r.value })) : null, winner, summary,
    players, childMeanPerMin: r2(mean(kids.map(k => k.perMin))), adultMeanPerMin: r2(mean(adults.map(k => k.perMin))),
    childMeanScore: r2(mean(kids.map(k => k.score))), adultMeanScore: r2(mean(adults.map(k => k.score))),
    topTied: tieTop > 1 && top > 0, spread: Math.max(...scores) - Math.min(...scores),
    issues: { nonFinite: nonFin, scoreWentDown: scoreDown, scoreWhileAbsent: scoreAbsent, scoreWhileAbsentWhy: absentWhy, longestSecondsNoScoreAnywhere: r2(longestStuck), roundEndedEarly: ended === 'over' && !game.endless && roundSecs < game.secs - 1 ? r2(roundSecs) : null, neverEnded: ended === 'cap', anyoneNeverJoined: joinedAtStart.some(j => !j) && !passive },
    orbs: { ...orbs, minGapPx: orbs.minGapPx > 1e8 ? null : r2(orbs.minGapPx), underHudShare: r2(orbs.underHud / Math.max(1, orbs.orbFrames)), tooCloseShare: r2(orbs.tooClose / Math.max(1, orbs.samples)) },
    watchers: world.watchers.map(w => ({ role: w.role, frames: w.frames || 0, playerShare: r2((w.playerFrames || 0) / Math.max(1, w.frames || 0)) })),
    game_: ex
  };
  return res;
}

/* ---------------------------------------------------------------- who the tracker lets in (the real rules; no assisting) */
function admission(lineup, seed, cap){
  resetPose(pose);
  const world = makeWorld(lineup, seed, { jitter });
  const feeder = new Feeder(pose, lib, { assist: false, cap });
  pose.keepSitters = false;
  const when = world.persons.map(() => null);
  let t = 0;
  for (let i = 0; i < 30 * 40; i++){
    world.noLapse = false; world.step(DT, null, null); feeder.step(world, DT); t += DT;
    world.persons.forEach((p, k) => { if (p.present && when[k] == null) when[k] = r2(t); });
  }
  return { lineup, seed, cap, people: world.persons.map((p, k) => ({ who: p.name, sizeRatio: r2(p.sizeRatio), joinedAfter: when[k], inAtEnd: p.present, ratioPicHeightToAdult: null })), inAtEnd: world.persons.filter(p => p.present).length, of: world.persons.length };
}


/* ---------------------------------------------------------------- how big a move has to be to count (the game's own detectors, on bodies of each size) */
async function calibrate(){
  const { triesOf } = await import('../src/games/animal-gym.js');
  const { JumpWatch, HOP } = await import('../src/tracking/jump.js');
  const out = [];
  const sets = [['jump', [0.25, 0.4, 0.6, 0.75, 0.82, 1, 1.25, 1.5, 2]], ['squat', [0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.2]], ['lean', [0.3, 0.5, 0.7, 0.9, 1.2, 1.5]], ['march', [0.3, 0.5, 0.7, 1]]];
  for (const kind of ['child', 'adult']) for (const [move, amps] of sets) for (const amp of amps){
    let reps = 0, tries = 0;
    for (const seed of [1, 2, 3]){
      resetPose(pose);
      const world = makeWorld(kind === 'child' ? '1c' : '1a', seed, { jitter, noLapse: true });
      const p = world.persons[0]; p.amp[move] = amp; p.closeNext = 1e9;
      const feeder = new Feeder(pose, lib, { assist: true, cap: 4 });
      for (let i = 0; i < 45; i++){ world.step(DT, null, null); feeder.step(world, DT); }
      world.t = 0; const jw = new JumpWatch(JP || (opt('oldjump') ? { rise: 0.08, speed: 0.5 } : HOP)), st = {};
      const mover = { act(c, q, now, dt){ rig.doMove(q, move, now, dt); } };
      let n = 0;
      for (let i = 0; i < 30 * 30; i++){
        world.step(DT, mover, {}); feeder.step(world, DT);
        const slot = p.slot >= 0 ? p.slot : 0, q = pose.players[slot];
        if (opt('blind')) for (const q of pose.players) if (q.lm){ q.lm[27].v = 0; q.lm[28].v = 0; }
        if (move === 'jump') n += jw.step(DT, pose.players, 4).filter(k => k === slot).length;
        else n += triesOf(move, q, st, DT);
      }
      const period = { jump: [1.1, 1.6], squat: [1.2, 2.0], lean: [1.3, 2.0], march: [0.9, 1.3] }[move][kind === 'child' ? 0 : 1];
      const per = move === 'march' || move === 'lean' ? 2 : 1;
      tries += n; reps += move === 'jump' ? p.stats.hops : Math.floor(30 / period) * per;        /* (a hop is counted when the body really left the floor) */
    }
    const real = kind === 'child' ? 1.2 : 1.75;
    const cm = { jump: (kind === 'child' ? 20 : 22) * amp, squat: 0.85 * amp * 0.30 * real * 100, lean: 0.9 * amp * 0.22 * real * 100, march: amp * 0.5 * 0.30 * real * 100 }[move];
    out.push({ kind, move, amp, approxCm: Math.round(cm), detected: tries, attempts: reps, rate: r2(tries / Math.max(1, reps)) });
  }
  return out;
}

/* ---------------------------------------------------------------- main */
mkdirSync(dirname(OUT), { recursive: true });
const prior = existsSync(OUT) && !opt('fresh') ? JSON.parse(readFileSync(OUT, 'utf8')) : { runs: [], admission: [], meta: {} };
const started = Date.now();
if (opt('admission')){
  prior.admission = [];
  for (const cap of [2, 4]) for (const lu of ['1c', '1a', '4c', '4m']) for (const s of seeds) prior.admission.push(admission(lu, s, cap));
  prior.meta.admissionNote = 'The tracker\'s own rules, nothing assisted: 40 s standing in view. cap 2 is what ships today (PLAYING = 2); cap 4 is what the games are built for.';
  writeFileSync(OUT, JSON.stringify(prior, null, 1));
  console.log('admission written', OUT);
  process.exit(0);
}
if (opt('crossing')){
  /* two children of one size trade places, in different shirts (frames drawn from the rig's own bodies): slot changes with the clothes switch off and on */
  const { crossing } = await import('./playtest/crossing.mjs');
  const rows = crossing({ pose, rig, lib, seeds, jitter, cap: CAP });
  console.log('crossing: two children trade places 4 times in 60 s (times a child was in the other child\'s slot once the crossing was over; fewer is better)');
  for (const r of rows) console.log(' ', 'seed', r.seed, 'clothes off:', r.off.join(' + '), ' on:', r.on.join(' + '), ' same shirts off:', r.sameOff.join(' + '), ' on:', r.sameOn.join(' + '));
  const sum = (k) => rows.reduce((t, r) => t + r[k].reduce((a, b) => a + b, 0), 0);
  console.log('total wrong slots: off', sum('off'), 'on', sum('on'), '| same shirt off', sum('sameOff'), 'on', sum('sameOn'));
  process.exit(0);
}
if (opt('track')){
  /* who is who and how steady, across the Testing switches, on the rig's bodies with known truth (tools/playtest/trackcmp.mjs) */
  const { runAll } = await import('./playtest/trackcmp.mjs');
  const only = opt('only') && opt('only') !== true ? String(opt('only')).split(',') : null;
  runAll({ pose, rig, lib, seeds, jitter, only });
  process.exit(0);
}
if (opt('bands')){
  /* coloured wristbands, off and on, alone and with Tell players apart better, on the rig's bodies with known truth (tools/playtest/bandcmp.mjs) */
  const { runAll } = await import('./playtest/bandcmp.mjs');
  const only = opt('only') && opt('only') !== true ? String(opt('only')).split(',') : null;
  runAll({ pose, rig, lib, seeds, jitter, only });
  process.exit(0);
}
if (opt('palm')){
  /* Exact hands: games played with the hand a palm's length past the wrist the model reports, hands off and on (tools/playtest/palmcmp.mjs) */
  const { runPalm } = await import('./playtest/palmcmp.mjs');
  await runPalm({ pose, rig, lib, byId, games, lineups, seeds, jitter, runOne, setPalm: (k) => { PALM = k; } });
  process.exit(0);
}
if (opt('watchers')){
  /* who must never play: a person seated on the sofa behind, someone walking across the back; alone, with a child, with a grown-up, with the family */
  prior.watchers = [];
  for (const lu of ['s', 'p', 'sp', '1c+s', '1c+p', '1a+s', '1a+p', '4m+s', '4m+p', '4m+sp']) for (const keep of [false, true]) for (const s of seeds){
    resetPose(pose); pose.keepSitters = keep;
    const world = makeWorld(lu, s, { jitter }), feeder = new Feeder(pose, lib, { assist: false, cap: CAP });
    for (let i = 0; i < 30 * 180; i++){ world.step(DT, null, null); feeder.step(world, DT); }
    for (const w of world.watchers) prior.watchers.push({ lineup: lu, keepSitters: keep, seed: s, role: w.role, size: r2(w.sizeRatio), inPictureSecs: r2((w.frames || 0) * DT), playerSecs: r2((w.playerFrames || 0) * DT) });
  }
  const bad = prior.watchers.filter(w => w.playerSecs > 0);
  console.log('watchers: ' + prior.watchers.length + ' runs of 180 s, ' + bad.length + ' with any time as a player');
  for (const w of bad) console.log(' ', w.lineup, 'keepSitters', w.keepSitters, 'seed', w.seed, w.role, 'player for', w.playerSecs, 's of', w.inPictureSecs);
  writeFileSync(OUT, JSON.stringify(prior, null, 1));
  process.exit(0);
}
if (opt('falsejumps')){
  /* the moves that must NOT count as a jump, done for 3 minutes each by one body (3 seeds): squat, bend, up on tiptoe, reach, lean, march, walk about */
  const { JumpWatch, HOP } = jumpMod, rows = [];
  for (const kind of ['child', 'adult']) for (const move of ['squat', 'bend', 'tiptoe', 'reach', 'lean', 'march', 'flap']){
    let n = 0, secs = 0;
    for (const seed of [1, 2, 3]){
      resetPose(pose);
      const world = makeWorld(kind === 'child' ? '1c' : '1a', seed, { jitter, noLapse: true });
      const p = world.persons[0]; p.closeNext = 1e9;
      const feeder = new Feeder(pose, lib, { assist: true, cap: 4 });
      for (let i = 0; i < 45; i++){ world.step(DT, null, null); feeder.step(world, DT); }
      world.t = 0; const jw = new JumpWatch(JP || HOP), mover = { act(c, q, now, dt){ rig.doMove(q, move, now, dt); } };
      for (let i = 0; i < 30 * 180; i++){
        world.step(DT, mover, {}); feeder.step(world, DT);
        if (opt('blind')) for (const q of pose.players) if (q.lm){ q.lm[27].v = 0; q.lm[28].v = 0; }
        n += jw.step(DT, pose.players, 4).length;
      }
      secs += 180;
    }
    rows.push({ kind, move, jumpsPer3min: r2(n / (secs / 180)) });
  }
  prior.falseJumps = rows;
  for (const r of rows) console.log(r.kind.padEnd(6), r.move.padEnd(7), 'false jumps per 3 min', r.jumpsPer3min);
  writeFileSync(OUT, JSON.stringify(prior, null, 1));
  process.exit(0);
}
if (opt('sensitivity')){
  /* Sleepy Bear: how quick does the stop have to be, and does camera jitter matter? */
  prior.sensitivity = [];
  for (const lu of ['1c', '1a']) for (const react of [0.25, 0.4, 0.55, 0.7, 1]) for (const jit of [0.0018, 0.004]){
    let stars = 0, wob = 0, fr = 0;
    for (const seed of [1, 2, 3]){
      const r = runOne('sleepy-bear', lu, seed, { react, jitter: jit });
      const pp = r.game_.perPerson[0]; stars += pp.stars; wob += pp.wobbles; fr += pp.freezes;
    }
    const kind = lu === '1c' ? 'child' : 'adult', base = KINDS_DELAY[kind];
    prior.sensitivity.push({ game: 'sleepy-bear', kind, reactionScale: react, reactionSecs: [r2(base[0] * react), r2(base[1] * react)], jitter: jit, freezes: fr, stars, wobbles: wob, starRate: r2(stars / Math.max(1, fr)) });
    console.log(kind, 'react x', react, 'jitter', jit, 'star rate', r2(stars / Math.max(1, fr)));
  }
  prior.meta.sensitivityNote = 'Sleepy Bear, one body, 3 seeds x 13 freezes. reactionScale 1 = the child 0.25-0.6 s / adult 0.4-0.8 s of the main runs; jitter is the camera noise in picture widths (one sigma).';
  writeFileSync(OUT, JSON.stringify(prior, null, 1));
  process.exit(0);
}
if (opt('calibrate')){
  prior.calibration = await calibrate();
  prior.meta.calibrationNote = 'Each move done at a steady rhythm for 3 x 30 s by one body (3 seeds), counted by the game\'s own detector (Animal Gym / Save the Harvest: triesOf and JumpWatch) behind the real tracker. approxCm: how big the move is (jump height; torso drop of a squat; sideways lean of the shoulders over the hips; knee raise). rate = detected / attempted (march and lean count each side).';
  writeFileSync(OUT, JSON.stringify(prior, null, 1));
  for (const r of prior.calibration) console.log(r.kind.padEnd(6), r.move.padEnd(6), String(r.approxCm).padStart(3) + ' cm', 'rate', r.rate);
  process.exit(0);
}
const key = (r) => `${r.game}|${r.lineup}|${r.seed}|${r.mode}|${r.cap}|${jitter}`;
const have = new Set(prior.runs.map(r => `${r.game}|${r.lineup}|${r.seed}|${r.mode}|${r.cap}|${r.jitter ?? 0.0018}`));
for (const gid of games) for (const lu of lineups) for (const seed of seeds){
  const k = `${gid}|${lu}|${seed}|${assist ? 'assist' : 'real'}|${CAP}|${jitter}`;
  if (have.has(k) && !opt('force')) continue;
  const t0 = Date.now();
  let r;
  try { r = runOne(gid, lu, seed); } catch (e){ console.log('ERROR', gid, lu, seed, e.stack); r = { game: gid, lineup: lu, seed, mode: assist ? 'assist' : 'real', cap: CAP, error: String(e.stack || e) }; }
  r.jitter = jitter;
  prior.runs = prior.runs.filter(x => `${x.game}|${x.lineup}|${x.seed}|${x.mode}|${x.cap}|${x.jitter ?? 0.0018}` !== k);
  prior.runs.push(r);
  console.log(`${gid} ${lu} seed ${seed}: ${r.error ? 'ERROR' : r.players.map(p => `${p.who[0]}${p.score}`).join(' ')} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  writeFileSync(OUT, JSON.stringify(prior));
}
prior.meta = { ...prior.meta, made: new Date().toISOString().slice(0, 10), dt: DT, picture: [W, H], note: 'tools/playtest.mjs; see docs/playtest/REPORT.md' };
writeFileSync(OUT, JSON.stringify(prior, null, 1));
Math.random = realRandom;
console.log('done in', ((Date.now() - started) / 1000).toFixed(0), 's ->', OUT);

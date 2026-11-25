/* Animal Gym's coaches: a full-body animal for each move, drawn on canvas from a few painted parts (body, head, limbs, ears,
   wings, neck) that move on a loop. Each head and its colours come from the animal's picture in the library (assets/icons.js), so the
   coach is the same character, now with a body. House style (decisions 0040, 0041): palette colours by name, rounded shapes, a thick
   ink edge, a soft shadow wash on the lower right, a shadow on the ground.

   Two halves:
     poseAt(animal, t, o)   PURE. The joint angles and offsets of that animal at time t (seconds). No canvas. Tested.
     drawCoach(c, animal, pose, x, y, u, o)   draws it standing with its feet at (x, y), u pixels per unit (the animal is about 1 unit tall).

   The loop is counted in beats of the game's music (BPM below), so a hop lands on the beat: jump and flap take 2 beats, squat, march
   and lean 4, the stretch 6. o.slow stretches the loop (the cool-down), o.reduced makes the movement slower and smaller (it still shows
   the pose), o.tryK (1 -> 0) is a try that has just counted (a tiny hop and a sparkle), o.joy is seconds since "Great job!" (-1 for
   none): a happy flourish. */
import { color as pal, alpha as palAlpha } from './assets/palette.js';

export const COACH_BPM = 140;                     /* the music's tempo (audio/action.js) */
const BEAT = 60 / COACH_BPM;
/* beats for one loop of each move */
export const BEATS = { reach: 6, jump: 2, flap: 2, squat: 4, march: 4, lean: 4 };
/* the animal that coaches each move (the same table as MOVES in animal-gym.js; a test keeps them together) */
export const COACH_OF = { reach: 'giraffe', jump: 'bunny', flap: 'bird', squat: 'frog', march: 'elephant', lean: 'penguin' };
export const COACHES = Object.values(COACH_OF);
/* how tall each stands at most, in units (the giraffe with its neck right up), so the game can size them to a share of the screen */
export const EXTENT = { giraffe: 1.95, bunny: 1.2, bird: 0.98, frog: 0.95, elephant: 1.08, penguin: 0.92 };
/* and how far each may rise off the ground (a hop, the flourish), so the highest point still has room above it */
export const RISE = { giraffe: 0.15, bunny: 0.32, bird: 0.15, frog: 0.27, elephant: 0.15, penguin: 0.15 };

/* every joint at rest; a pose is this with some of it moved */
export const REST = { lift: 0, squash: 1, lean: 0, shift: 0, neck: 0, tilt: 0, armL: 0.25, armR: 0.25, legL: 0, legR: 0, spread: 0, ears: 0.15, wing: 0.2, trunk: 0 };
/* what a pose may ask for (a test keeps every animal and move inside): lift and shift in units, angles in radians, squash a ratio,
   arm and wing 0 = hanging down, about 1.57 = straight out, 3.14 = straight up */
export const LIMITS = {
  lift: [-0.05, 0.5], squash: [0.55, 1.25], lean: [-0.4, 0.4], shift: [-0.25, 0.25], neck: [0, 1], tilt: [-0.5, 0.5], armL: [0, 3.3], armR: [0, 3.3],
  legL: [0, 0.3], legR: [0, 0.3], spread: [0, 1], ears: [-0.5, 1.3], wing: [0, 2.6], trunk: [-1, 1]
};

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const smooth = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const lerp = (a, b, k) => a + (b - a) * k;
const frac = (x) => x - Math.floor(x);
const hump = (p) => 0.5 - 0.5 * Math.cos(TAU * p);        /* 0 -> 1 -> 0 over one loop */

/* the move each animal does, as a pose from the loop's phase p (0..1) */
const MOVE = {
  /* giraffe: the neck goes right up, holds, comes back down */
  giraffe(p){
    const n = smooth(0.5 - 0.72 * Math.cos(TAU * p) + 0.08);
    return { neck: n, tilt: 0.1 * Math.sin(TAU * p * 2) * n, lift: 0.03 * n, armL: 0.2, armR: 0.2, trunk: 0.5 * Math.sin(TAU * p * 2) };
  },
  /* bunny: crouch, spring, land - on every second beat; the ears flop behind it */
  bunny(p){
    const h = 4 * p * (1 - p), crouch = Math.pow(1 - h, 5), v = 4 * (1 - 2 * p);
    return { lift: 0.28 * h, squash: 1 - 0.15 * crouch + 0.07 * h, ears: clamp(0.15 + 0.11 * v, -0.2, 0.6), armL: 0.4 + 1.5 * h, armR: 0.4 + 1.5 * h, legL: 0.1 * h, legR: 0.1 * h };
  },
  /* bird: both wings sweep up and down */
  bird(p){
    const f = hump(p);
    return { wing: 0.35 + 2.15 * f, lift: 0.05 * Math.sin(Math.PI * clamp(p * 2, 0, 1)) , tilt: 0.06 * Math.sin(TAU * p), legL: 0.03 * f, legR: 0.03 * f };
  },
  /* frog: sink down low, hold, spring up and land */
  frog(p){
    const down = p < 0.45 ? smooth(p / 0.45) : p < 0.58 ? 1 : p < 0.68 ? 1 - smooth((p - 0.58) / 0.1) : 0;
    const a = clamp((p - 0.68) / 0.24, 0, 1), air = 4 * a * (1 - a);
    const land = p > 0.92 ? Math.sin(Math.PI * (p - 0.92) / 0.08) * 0.3 : 0;
    const d = Math.max(down, land);
    return { lift: 0.24 * air - 0.07 * d, squash: 1 - 0.34 * d + 0.18 * air, spread: d * (1 - air), armL: 0.3 + 2 * air + 0.4 * d, armR: 0.3 + 2 * air + 0.4 * d, tilt: 0.02 * Math.sin(TAU * p) };
  },
  /* elephant: lifts one foot, then the other; the trunk and ears swing */
  elephant(p){
    const s = Math.sin(TAU * p), l = Math.max(0, s), r = Math.max(0, -s);
    return { legL: 0.22 * Math.pow(l, 0.7), legR: 0.22 * Math.pow(r, 0.7), lean: -0.05 * s, shift: -0.03 * s, lift: 0.01 * Math.abs(s), trunk: 0.7 * Math.sin(TAU * p * 2 - 0.6), ears: 0.2 + 0.25 * Math.sin(TAU * p * 2), tilt: 0.05 * s };
  },
  /* penguin: waddles from one foot to the other, flippers out */
  penguin(p){
    const s = Math.sin(TAU * p), c = Math.cos(TAU * p);
    return { lean: 0.2 * s, shift: 0.11 * s, lift: 0.012 * Math.abs(c), legL: 0.07 * Math.max(0, -s), legR: 0.07 * Math.max(0, s), armL: 0.55 + 0.45 * s, armR: 0.55 - 0.45 * s, tilt: 0.08 * s };
  }
};

/* the happy flourish for "Great job!": a hop and a wiggle with every arm, wing, ear and neck up */
function flourish(animal, j){
  const w = Math.sin(j * TAU * 1.25), h = Math.abs(Math.sin(j * Math.PI * 2.5));
  return { lift: 0.06 + 0.1 * h, squash: 1 + 0.05 * h - 0.06 * (1 - h), lean: 0.13 * w, shift: 0.02 * w, neck: animal === 'giraffe' ? 0.75 + 0.25 * w : 0, tilt: 0.12 * w, armL: 2.5 + 0.4 * w, armR: 2.5 - 0.4 * w,
    legL: 0.06 * h, legR: 0.06 * h, spread: 0, ears: 0.9, wing: 2.2 + 0.3 * w, trunk: 0.9 * w };
}

/* The pose of an animal at time t. Pure: same inputs, same pose; every key of REST is there. */
export function poseAt(animal, t, o = {}){
  const move = Object.keys(COACH_OF).find(k => COACH_OF[k] === animal) || 'reach';
  const slow = (o.slow ? 1.6 : 1) * (o.reduced ? 1.6 : 1);
  const p = frac(t / (BEATS[move] * BEAT * slow));
  let q = { ...REST, ...MOVE[animal](p) };
  /* reduced: smaller movement, about the rest pose, but still the pose */
  if (o.reduced) for (const k of Object.keys(REST)) q[k] = REST[k] + (q[k] - REST[k]) * 0.7;
  /* a try that has just counted: a tiny hop */
  const tk = clamp(o.tryK || 0, 0, 1);
  q.lift += 0.045 * tk;
  /* the flourish blends in over a fifth of a second */
  if (o.joy != null && o.joy >= 0){
    const f = flourish(animal, o.joy), k = smooth(o.joy / 0.25) * (o.reduced ? 0.7 : 1);
    for (const key of Object.keys(REST)) q[key] = lerp(q[key], f[key], k);
  }
  for (const key of Object.keys(LIMITS)) q[key] = clamp(q[key], LIMITS[key][0], LIMITS[key][1]);
  return q;
}

/* ---------- painting ---------- */
const INK = () => pal('shade.ink');
const OUT = 0.04;                                  /* the ink edge, in units */

/* a shape: path() starts its own path; .b = [cx, cy, r] says where its shade wash goes */
const ell = (x, y, rx, ry, rot = 0) => { const f = (c) => { c.beginPath(); c.ellipse(x, y, rx, ry, rot, 0, 7); }; f.b = [x, y, Math.max(rx, ry)]; return f; };
const circ = (x, y, r) => ell(x, y, r, r);
const poly = (pts) => { const f = (c) => { c.beginPath(); pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath(); }; const n = pts.length; f.b = [pts.reduce((a, q) => a + q[0], 0) / n, pts.reduce((a, q) => a + q[1], 0) / n, 0.1]; return f; };

/* one painted part: fill, a soft shade wash on its lower right, the ink edge */
function part(c, col, shape, o = {}){
  shape(c); c.fillStyle = col; c.fill();
  if (o.shade !== false && shape.b){
    const [cx, cy, r] = shape.b;
    c.save(); shape(c); c.clip(); c.beginPath(); c.rect(cx - 3, cy - 3, 6, 6); c.arc(cx - r * 0.22, cy - r * 0.26, r * 1.02, 0, 7);
    c.fillStyle = palAlpha('shade.shadow', 0.2); c.fill('evenodd'); c.restore();
  }
  shape(c); c.lineWidth = o.w || OUT; c.strokeStyle = INK(); c.lineJoin = 'round'; c.stroke();
}
/* a thick limb from (x0, y0) to (x1, y1), with its ink edge */
function limb(c, x0, y0, x1, y1, w, col){
  c.lineCap = 'round'; c.lineJoin = 'round';
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineWidth = w + OUT * 2; c.strokeStyle = INK(); c.stroke();
  c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineWidth = w; c.strokeStyle = col; c.stroke();
}
/* a bent limb through a middle point */
function limb2(c, x0, y0, x1, y1, x2, y2, w, col){
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const [ww, cc] of [[w + OUT * 2, INK()], [w, col]]){ c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.lineTo(x2, y2); c.lineWidth = ww; c.strokeStyle = cc; c.stroke(); }
}
const dot = (c, x, y, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); };
function eye(c, x, y, r){ dot(c, x, y, r, INK()); dot(c, x - r * 0.3, y - r * 0.32, r * 0.36, pal('earth.snow')); }
function smile(c, x, y, w){ c.beginPath(); c.moveTo(x - w, y); c.quadraticCurveTo(x, y + w * 0.9, x + w, y); c.lineWidth = 0.03; c.lineCap = 'round'; c.strokeStyle = INK(); c.stroke(); }
const wash = (c, shape, col, a) => { shape(c); c.save(); c.globalAlpha *= a; c.fillStyle = col; c.fill(); c.restore(); };
/* an arm that hangs from (sx, sy) at angle a (0 = down, 1.57 = out, 3.14 = up); side +1 right, -1 left (as the viewer sees) */
const reach = (sx, sy, a, len, side) => [sx + side * Math.sin(a) * len, sy + Math.cos(a) * len];

/* ---------- the animals, each standing on y = 0, facing us, about 1 unit tall ---------- */
const DRAW = {
  giraffe(c, p){
    const yel = pal('touch.sunflower'), brown = pal('fur.brown'), sand = pal('earth.sand');
    const tailA = 0.35 * Math.sin(p.trunk * 2);
    /* tail */
    limb(c, 0.22, -0.42, 0.34 + tailA * 0.2, -0.28, 0.035, yel); dot(c, 0.34 + tailA * 0.2, -0.26, 0.04, brown);
    /* legs */
    for (const s of [-1, 1]){ const lift = s < 0 ? p.legL : p.legR; limb(c, s * 0.13, -0.36, s * 0.15, -0.06 - lift, 0.1, yel); part(c, brown, ell(s * 0.15, -0.03 - lift, 0.07, 0.04), { shade: false }); }
    /* body */
    part(c, yel, ell(0, -0.48, 0.27, 0.19));
    part(c, sand, ell(0, -0.42, 0.18, 0.1), { shade: false });
    for (const [x, y, r] of [[-0.14, -0.55, 0.04], [0.1, -0.56, 0.035], [0.16, -0.46, 0.03], [-0.17, -0.44, 0.03]]) dot(c, x, y, r, brown);
    /* neck: base up to the head, which sways a little */
    const len = 0.4 + 0.72 * p.neck, hx = Math.sin(p.tilt) * 0.5 * (0.3 + p.neck), hy = -0.58 - len;
    const mx = hx * 0.5, my = -0.58 - len * 0.5;
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const [w, col] of [[0.2 + OUT * 2, INK()], [0.2, yel]]){ c.beginPath(); c.moveTo(0, -0.58); c.quadraticCurveTo(mx, my, hx, hy); c.lineWidth = w; c.strokeStyle = col; c.stroke(); }
    for (let k = 1; k <= 4; k++){ const f = k / 5, x = hx * f * f + (k % 2 ? -0.03 : 0.03), y = -0.58 - len * f; if (k * 0.18 < 0.2 + p.neck) dot(c, x, y, 0.025 + (k % 2) * 0.01, brown); }
    /* head (the library's face) */
    c.save(); c.translate(hx, hy - 0.1); c.rotate(p.tilt); c.scale(1.3, 1.3);
    for (const s of [-1, 1]){ part(c, yel, ell(s * 0.17, 0, 0.09, 0.055, s * 0.5)); c.beginPath(); c.moveTo(s * 0.06, -0.09); c.lineTo(s * 0.07, -0.2); c.lineWidth = OUT; c.strokeStyle = INK(); c.lineCap = 'round'; c.stroke(); dot(c, s * 0.07, -0.21, 0.035, brown); }
    part(c, yel, ell(0, 0, 0.15, 0.13));
    part(c, sand, ell(0, 0.055, 0.1, 0.06), { shade: false });
    dot(c, -0.04, 0.06, 0.012, INK()); dot(c, 0.04, 0.06, 0.012, INK());
    eye(c, -0.075, -0.035, 0.028); eye(c, 0.075, -0.035, 0.028);
    c.restore();
  },
  bunny(c, p){
    const white = pal('earth.snow'), pink = pal('touch.bubblegum');
    const fur = pal('shade.light');
    /* feet */
    for (const s of [-1, 1]){ const lift = s < 0 ? p.legL : p.legR; part(c, white, ell(s * 0.15, -0.045 - lift, 0.13, 0.06)); }
    /* body */
    part(c, white, ell(0, -0.3, 0.25, 0.27));
    wash(c, ell(0, -0.25, 0.14, 0.17), pal('earth.peach'), 0.35);
    /* arms */
    for (const s of [-1, 1]){ const a = s < 0 ? p.armL : p.armR, [x, y] = reach(s * 0.2, -0.44, a, 0.22, s); limb(c, s * 0.2, -0.44, x, y, 0.1, white); }
    /* ears: long, flopping on the loop */
    for (const s of [-1, 1]){
      const a = s * (0.1 + p.ears), bx = s * 0.12, by = -0.8;
      c.save(); c.translate(bx, by); c.rotate(a);
      part(c, white, ell(0, -0.2, 0.1, 0.25)); wash(c, ell(0, -0.19, 0.045, 0.17), pal('earth.brick', 'light'), 0.9);
      c.restore();
    }
    /* head: the library's face */
    c.save(); c.translate(0, -0.66); c.rotate(p.tilt);
    part(c, white, ell(0, 0, 0.29, 0.23));
    wash(c, ell(-0.19, 0.07, 0.05, 0.03), pink, 0.55); wash(c, ell(0.19, 0.07, 0.05, 0.03), pink, 0.55);
    eye(c, -0.12, -0.02, 0.04); eye(c, 0.12, -0.02, 0.04);
    dot(c, 0, 0.05, 0.035, pal('earth.brick')); smile(c, 0, 0.09, 0.07);
    c.restore();
  },
  bird(c, p){
    const blue = pal('touch.skyBlue'), org = pal('touch.tangerine');
    /* feet */
    for (const s of [-1, 1]){ const lift = s < 0 ? p.legL : p.legR; limb(c, s * 0.1, -0.12, s * 0.1, -0.04 - lift, 0.04, org); part(c, org, ell(s * 0.12, -0.03 - lift, 0.09, 0.03), { shade: false }); }
    /* wings sit behind the body; 0 = hanging down, up past straight out is the flap */
    const wing = (s, a) => {
      c.save(); c.translate(s * 0.26, -0.45); c.rotate(-s * a);
      part(c, pal('touch.skyBlue', 'shade'), ell(s * 0.02, 0.17, 0.095, 0.21, 0));
      c.restore();
    };
    wing(-1, p.wing); wing(1, p.wing);
    /* tuft and body */
    part(c, blue, poly([[-0.06, -0.72], [0.02, -0.9], [0.05, -0.7]]));
    part(c, blue, circ(0, -0.42, 0.34));
    part(c, pal('touch.skyBlue', 'light'), ell(0, -0.3, 0.22, 0.17), { shade: false });
    c.save(); c.translate(0, -0.42); c.rotate(p.tilt);
    part(c, org, poly([[-0.07, 0.02], [0.07, 0.02], [0, 0.14]]));
    eye(c, -0.15, -0.08, 0.05); eye(c, 0.15, -0.08, 0.05);
    c.restore();
  },
  frog(c, p){
    const g = pal('meadow.fresh'), gl = pal('meadow.fresh', 'light');
    const sp = p.spread;
    /* hind legs: thigh out to a knee, shin back in to the foot */
    for (const s of [-1, 1]){
      const kx = s * (0.38 + 0.1 * sp), ky = -0.16 - 0.04 * sp, fx = s * (0.3 + 0.14 * sp), fy = -0.04;
      limb2(c, s * 0.22, -0.26, kx, ky - 0.04 + 0.1 * (1 - sp), fx, fy, 0.13, g);
      part(c, g, ell(fx + s * 0.04, -0.03, 0.14, 0.045));
    }
    /* arms */
    for (const s of [-1, 1]){ const a = s < 0 ? p.armL : p.armR, [x, y] = reach(s * 0.28, -0.22, a, 0.2, s); limb(c, s * 0.28, -0.22, x, y, 0.09, g); part(c, g, circ(x, y, 0.055), { shade: false }); }
    part(c, g, ell(0, -0.32, 0.4, 0.28));
    part(c, gl, ell(0, -0.22, 0.26, 0.15), { shade: false });
    c.save(); c.translate(0, -0.32); c.rotate(p.tilt);
    for (const s of [-1, 1]){ part(c, g, circ(s * 0.22, -0.24, 0.15)); dot(c, s * 0.22, -0.24, 0.1, pal('earth.snow')); eye(c, s * 0.22, -0.23, 0.06); }
    smile(c, 0, 0.0, 0.25);
    dot(c, -0.05, -0.08, 0.015, INK()); dot(c, 0.05, -0.08, 0.015, INK());
    c.restore();
  },
  elephant(c, p){
    const grey = pal('shade.light'), pink = pal('touch.bubblegum');
    part(c, grey, ell(0, -0.5, 0.31, 0.25));
    /* legs, over the belly: the lifted one swings its knee out and its foot up */
    for (const s of [-1, 1]){
      const lift = s < 0 ? p.legL : p.legR, fy = -0.06 - lift * 1.15, kx = s * (0.19 + lift * 0.5), ky = -0.3 - lift * 0.3;
      limb2(c, s * 0.17, -0.36, kx, ky, s * 0.2, fy, 0.17, grey); part(c, grey, ell(s * 0.2, fy + 0.0, 0.1, 0.045));
      for (const k of [-1, 0, 1]) dot(c, s * 0.2 + k * 0.05, fy + 0.012, 0.016, pal('earth.snow'));
    }
    /* ears: big, flapping a little */
    for (const s of [-1, 1]){ c.save(); c.translate(s * 0.2, -0.82); c.rotate(s * (p.ears - 0.15) * 0.5); part(c, grey, circ(s * 0.13, 0.02, 0.2)); wash(c, circ(s * 0.13, 0.02, 0.12), pink, 0.35); c.restore(); }
    /* head (the library's face) and trunk */
    c.save(); c.translate(0, -0.8); c.rotate(p.tilt);
    const tx = Math.sin(p.trunk) * 0.14, ty = 0.4 - Math.abs(p.trunk) * 0.12;
    limb2(c, 0, 0.1, tx * 0.5, 0.26, tx, ty, 0.12, grey);
    part(c, grey, circ(0, 0, 0.26));
    limb2(c, 0, 0.1, tx * 0.5, 0.26, tx, ty, 0.1, grey);
    eye(c, -0.1, -0.05, 0.04); eye(c, 0.1, -0.05, 0.04);
    c.restore();
  },
  penguin(c, p){
    const dark = pal('fur.charcoal'), org = pal('touch.tangerine'), snow = pal('earth.snow');
    /* feet */
    for (const s of [-1, 1]){ const lift = s < 0 ? p.legL : p.legR; part(c, org, ell(s * 0.14, -0.04 - lift, 0.1, 0.045), { shade: false }); }
    /* flippers */
    for (const s of [-1, 1]){ const a = s < 0 ? p.armL : p.armR; c.save(); c.translate(s * 0.26, -0.52); c.rotate(-s * a); part(c, dark, ell(s * 0.03, 0.14, 0.07, 0.18)); c.restore(); }
    part(c, dark, ell(0, -0.42, 0.29, 0.4));
    part(c, snow, ell(0, -0.32, 0.2, 0.29), { shade: false });
    c.save(); c.translate(0, -0.42); c.rotate(p.tilt);
    part(c, org, poly([[-0.07, -0.1], [0.07, -0.1], [0, 0.02]]));
    dot(c, -0.1, -0.2, 0.06, snow); dot(c, 0.1, -0.2, 0.06, snow); eye(c, -0.1, -0.2, 0.04); eye(c, 0.1, -0.2, 0.04);
    c.restore();
  }
};

const sparkle = (c, x, y, r) => { c.beginPath(); for (let k = 0; k < 8; k++){ const a = -Math.PI / 2 + k * Math.PI / 4, q = k % 2 ? r * 0.28 : r; c.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q); } c.closePath(); };

/* Draw a coach standing with its feet at (x, y), u pixels per unit. o.tryK (1 -> 0) is a try that
   has just counted, o.joy the seconds since "Great job!" (-1 none). */
export function drawCoach(c, animal, pose, x, y, u, o = {}){
  if (!DRAW[animal]) return;
  const tk = clamp(o.tryK || 0, 0, 1), joy = o.joy != null ? o.joy : -1;
  c.save();
  /* the soft shadow on the ground, smaller as the animal rises */
  const hi = clamp(pose.lift / 0.35, 0, 1);
  c.fillStyle = palAlpha('shade.shadow', 0.17 - 0.06 * hi); c.beginPath(); c.ellipse(x + pose.shift * u * 0.6, y + u * 0.02, u * (0.42 - 0.12 * hi), u * 0.07, 0, 0, 7); c.fill();
  c.translate(x, y); c.rotate(pose.lean); c.translate(pose.shift * u, -pose.lift * u); c.scale(u, u);
  const sq = pose.squash; c.scale(1 + (1 - sq) * 0.3, sq);
  DRAW[animal](c, pose);
  c.restore();
  /* sparkles: a few at a counted try, a ring of them for the flourish (they follow the coach) */
  const cols = [pal('touch.sunflower'), pal('touch.bubblegum'), pal('touch.mint'), pal('touch.skyBlue')];
  const draw1 = (px, py, r, col, a) => { c.save(); c.globalAlpha = clamp(a, 0, 1); sparkle(c, px, py, r); c.fillStyle = col; c.fill(); c.lineWidth = r * 0.14; c.strokeStyle = INK(); c.lineJoin = 'round'; c.stroke(); c.restore(); };
  const top = EXTENT[animal] || 1;
  if (tk > 0.02) for (let k = 0; k < 3; k++){
    const a = (k - 1) * 0.9 - 1.57, rr = u * (0.42 + 0.25 * (1 - tk));
    draw1(x + Math.cos(a) * rr * 1.1 + pose.shift * u, y - u * top * 0.55 + Math.sin(a) * rr, u * (0.06 + 0.03 * tk), cols[k % 4], tk * 1.6);
  }
  if (joy >= 0 && joy < 2.4){
    const fade = joy < 1.8 ? 1 : (2.4 - joy) / 0.6;
    for (let k = 0; k < 6; k++){
      const a = k * TAU / 6 + joy * 1.4, rr = u * (0.55 + 0.1 * Math.sin(joy * 6 + k));
      draw1(x + Math.cos(a) * rr * 1.25 + pose.shift * u, y - u * top * 0.5 + Math.sin(a) * rr * 0.8, u * (0.07 + 0.025 * Math.sin(joy * 9 + k * 2)), cols[k % 4], fade);
    }
  }
}

/* How big a coach is drawn: its tallest reach (its highest hop included) is the given share of the screen height (about 0.5, with the room it rises into), and not wider than a fraction of the width */
export function coachUnit(animal, H, share = 0.5){ return H * share / ((EXTENT[animal] || 1) + (RISE[animal] || 0)); }

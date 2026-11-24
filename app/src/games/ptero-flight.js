/* Pterry Flight: you are a pterodactyl, gliding over a prehistoric world. Spread your arms like wings and tip them to
   steer - the lower arm is the way you turn - and raise or lower both to climb and dive. The land rolls out in front
   of you and far below: forests and ferns, lakes, mountains, a smoking volcano, herds of long-necked dinosaurs. Now and
   then something wonderful is waiting ahead, ringed with sparkles - fly over it and it goes in your sticker book.

   Scenery, not a test: no way to crash, no clock to beat, nothing ever costs a point. Everyone whose arms are out steers
   the same pterodactyl (their tilts and heights are averaged; someone who lets their arms drop to rest drops out of the
   average, and if everyone rests it glides on by itself toward what's ahead), and the morning turns to day and then to
   sunset as the minute and a half goes by.

   Along the way: sparkly rings and fruit hang in the air in little trails - fly through them for a chime and a burst of
   sparkles - and a few soft clouds drift across the way. Fly into one and it's a wobble and a boing, nothing else.

   The world is endless and the same wherever you fly: a grid of cells, each deciding from its position what grows
   there. A cell's things are drawn from far to near, scaled by how far ahead they are. */
import { color, alpha } from './assets/palette.js';
import { assets } from './assets/index.js';
import { Juice } from './common.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { L } from '../tracking/pose-shared.js';
import { sfx } from '../audio/sound.js';
import { Avatars } from '../ui/avatars.js';

export const ROUND = 90;
/* the world, in its own units: a cell is CELL wide; things show up to FAR ahead */
export const CELL = 3, FAR = 34, NEAR = 0.7;
/* flying: height (above the ground) and how fast the arms turn it and move it up and down */
export const ALT_MIN = 1.1, ALT_MAX = 5, ALT_RATE = 1.4, TURN = 0.7, SPEED = 4.2;
/* a wonder is found by flying within this of it (and below this height) */
export const FIND = 2.8, FIND_ALT = 4.6;
/* about how often a new wonder appears ahead, in seconds */
export const WONDER_EVERY = [11, 15];
/* a ring or a piece of fruit is collected by flying within TREAT of it (across) and TREAT_ALT of its height; a trail of them comes about
   every TRAIL_EVERY seconds, and a soft cloud about every PUFF_EVERY; a cloud wobbles you when you're within PUFF of it and PUFF_ALT of its height */
export const TREAT = 1.7, TREAT_ALT = 1.0, TRAIL_EVERY = [8, 12], PUFF_EVERY = [12, 18], PUFF = 1.6, PUFF_ALT = 1.0;
export const FRUIT = ['apple', 'pear', 'cherry', 'strawberry', 'banana', 'orange'];
/* wrists at least this many shoulder-widths apart: the wings are out (resting arms hang by the sides, about one and a half) */
export const WINGS_OUT = 2.3;
/* the goal bar fills as wonders are found, full at this many */
export const GOAL = 6;

export const WONDERS = [
  { emoji: 'volcano', text: 'a smoking volcano', size: 4.2 },
  { emoji: 'dinosaur', text: 'a long-necked dinosaur', size: 2.2 },
  { emoji: 'egg', text: 'a nest of eggs', size: 1.4 },
  { emoji: 'dinosaur', text: 'a big friendly roarer', size: 2.2 },
  { emoji: 'flower', text: 'giant flowers', size: 2.2 },
  { emoji: 'lizard', text: 'a sunbathing lizard', size: 1.6 },
  { emoji: 'palm', text: 'the tallest palm tree', size: 3.4 },
  { emoji: 'waterfall', text: 'a sparkling waterfall', size: 2.6 }
];

/* sky and ground through the day: dawn, midday, sunset (top of the sky, the horizon, the near and far ground) */
const DAY = [
  { t: 0,    top: color('dusk.deep'), hor: color('earth.peach'), near: color('meadow.grass'), far: color('meadow.soft') },
  { t: 0.45, top: color('fav.sky'), hor: color('sky.low'), near: color('meadow.fresh'), far: color('meadow.lawn') },
  { t: 1,    top: color('night.dusk'), hor: color('earth.peach'), near: color('meadow.leaf'), far: color('sky.sunGlow', 'shade') }
];
const lerp = (a, b, k) => a + (b - a) * k;
const rgbOf = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => { const x = rgbOf(a), y = rgbOf(b); return '#' + x.map((v, i) => Math.round(lerp(v, y[i], k)).toString(16).padStart(2, '0')).join(''); };
export function skyAt(f){
  let i = 0; while (i < DAY.length - 2 && f > DAY[i + 1].t) i++;
  const a = DAY[i], b = DAY[i + 1], k = Math.max(0, Math.min(1, (f - a.t) / (b.t - a.t)));
  return { top: mix(a.top, b.top, k), hor: mix(a.hor, b.hor, k), near: mix(a.near, b.near, k), far: mix(a.far, b.far, k) };
}

/* a number from a cell, the same every time: 0 to 1 */
export const hash = (i, j, s = 0) => { let h = (i * 374761393 + j * 668265263 + s * 2246822519) | 0; h = (h ^ (h >>> 13)) * 1274126177; h = (h ^ (h >>> 16)) >>> 0; return h / 4294967295; };

/* The pictures (painted library icons, named by id; the field is still called `emoji`) are drawn once each into a small picture and stamped from then on - far quicker than drawing text a
   hundred times a frame. (Where there's no document - the tests - they're drawn straight on.) */
const SPRITES = new Map();
function sprite(e){
  if (SPRITES.has(e)) return SPRITES.get(e);
  let cv = null;
  if (typeof document !== 'undefined'){
    cv = document.createElement('canvas'); cv.width = cv.height = 160;
    const x = cv.getContext && cv.getContext('2d');
    if (x) assets.draw(x, e, 80, 84, 128); else cv = null;
  }
  SPRITES.set(e, cv);
  return cv;
}

const REST = 'Resting? Pterry glides on.';

export default {
  id: 'ptero-flight', unit: 'wonders', name: 'Pterry Flight', stars: 1, accent: color('earth.clay'),
  secs: ROUND, moves: ['steer', 'glide'],
  create(n){ return new PteroFlight(n); }
};

/* How one player steers: how far to turn (-1 left, 1 right) and to climb (-1 dive, 1 climb), or null when they aren't
   showing arms. The lower arm is the way you bank; the arms above the shoulders climb. `out` says whether the wings are out
   (wrists well apart, compared with the shoulders) or the arms are resting by the sides: only wings that are out steer. */
export function steerOf(p){
  if (!p || !p.present) return null;
  if (pose.mouse.active){
    const m = pose.mouse;
    return { bank: Math.max(-1, Math.min(1, (m.x - 0.5) * 2)), pitch: Math.max(-1, Math.min(1, (0.5 - m.y) * 2)), out: true };
  }
  const s = p.scale || 0.3, lm = p.lm;
  let a = null, b = null, shy = null, sw = 0;
  if (lm && lm[L.L_WRIST] && lm[L.R_WRIST] && (lm[L.L_WRIST].v ?? 1) > 0.4 && (lm[L.R_WRIST].v ?? 1) > 0.4){
    const w = [lm[L.L_WRIST], lm[L.R_WRIST]].sort((x, y) => x.x - y.x);       /* by where they are on the screen */
    a = w[0]; b = w[1];
    const sh = [lm[L.L_SHOULDER], lm[L.R_SHOULDER]].filter(Boolean);
    shy = sh.length ? sh.reduce((t, q) => t + q.y, 0) / sh.length : (p.centre ? p.centre.y - 0.1 : 0.4);
    if (sh.length === 2) sw = Math.abs(sh[1].x - sh[0].x);
  } else if (p.hands && p.hands.left && p.hands.right){
    const w = [p.hands.left, p.hands.right].sort((x, y) => x.x - y.x);
    a = w[0]; b = w[1]; shy = p.centre ? p.centre.y - 0.1 : 0.4;
  }
  if (!a) return null;
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  /* (no shoulders to measure by: a span of a third of the body's size will do) */
  const out = sw > 0.01 ? (b.x - a.x) >= WINGS_OUT * sw : (b.x - a.x) >= 0.35 * s;
  return { bank: clamp((b.y - a.y) / s / 0.5), pitch: clamp((shy - (a.y + b.y) / 2) / s / 0.5), out };
}

class PteroFlight {
  constructor(players){
    this.players = players;
    this.score = Array.from({ length: MAX_PLAYERS }, () => 0);
    this.t = 0; this.over = false;
    this.x = 0; this.z = 0; this.head = 0; this.alt = 2.6; this.dist = 0;
    this.bank = 0; this.pitch = 0; this.flap = 0;
    this.found = [];            /* the wonders in the sticker book */
    this.wonders = [];          /* wonders waiting ahead */
    this.treats = [];           /* rings and fruit hanging in the air ahead: { x, z, alt, kind: 'ring' | a fruit, got } */
    this.puffs = [];            /* soft clouds drifting across the way: { x, z, alt, bumped } */
    this.gathered = 0;          /* rings and fruit flown through */
    this.bumps = 0; this.wob = 0;   /* soft clouds flown into; how much the wobble is on now */
    this.wing = {};             /* each player's wings: 0 (resting) to 1 (out), eased */
    this.restFor = 0;
    this.nextTrail = 5; this.nextPuff = 24;
    this.nextAt = 4; this.nth = 0;
    this.say = { icon: 'dinosaur', text: 'Spread your arms!', t: 0 };
    this.hintUntil = 9;
    this.j = new Juice();
    this.avatars = new Avatars();
  }

  /* where a wonder goes: ahead, a little to one side */
  _spawn(){
    const a = this.head + (Math.random() - 0.5) * 0.7, d = 20 + Math.random() * 6;
    this.wonders.push({ x: this.x + Math.sin(a) * d, z: this.z + Math.cos(a) * d, w: WONDERS[this.nth % WONDERS.length], born: this.t });
    this.nth++;
  }

  /* a trail of rings and fruit, curving gently ahead and drifting up and down */
  _trail(){
    let a = this.head + (Math.random() - 0.5) * 0.7, d = 17 + Math.random() * 4, alt = Math.max(1.8, Math.min(4.2, this.alt + (Math.random() - 0.5) * 1.6));
    const wave = Math.random() * 6, fruit = FRUIT[(Math.random() * FRUIT.length) | 0];
    for (let n = 0; n < 5; n++){
      this.treats.push({ x: this.x + Math.sin(a) * d, z: this.z + Math.cos(a) * d, alt: Math.max(1.7, Math.min(4.3, alt + Math.sin(wave + n * 0.9) * 0.5)), kind: n % 2 ? fruit : 'ring', got: false });
      a += (Math.random() - 0.5) * 0.22; d += 3.4; alt += (Math.random() - 0.5) * 0.3;
    }
  }
  /* a soft cloud across the way (not on top of anything to collect) */
  _puff(){
    const a = this.head + (Math.random() - 0.5) * 0.6, d = 22 + Math.random() * 5;
    const x = this.x + Math.sin(a) * d, z = this.z + Math.cos(a) * d, alt = Math.max(1.5, Math.min(4.4, this.alt + (Math.random() - 0.5) * 1.2));
    if (this.treats.some(q => !q.got && Math.hypot(q.x - x, q.z - z) < 4.5)) return false;
    this.puffs.push({ x, z, alt, bumped: false, born: this.t });
    return true;
  }

  step(dt, W, H){
    this.t += dt; this.say.t += dt;
    this.j.step(dt);
    if (this.t >= ROUND) this.over = true;

    /* the arms: everyone whose wings are out - their tilts and heights, averaged. Arms at rest count for nothing (eased, so a
       wobbly moment doesn't flicker). */
    const present = [];
    let tb = 0, tp = 0, sum = 0;
    for (let i = 0; i < this.players; i++){
      const q = steerOf(pose.players[i]);
      if (!q){ this.wing[i] = 0; continue; }
      present.push(i);
      const w = this.wing[i] = (this.wing[i] || 0) + ((q.out ? 1 : 0) - (this.wing[i] || 0)) * Math.min(1, dt * 3);
      tb += q.bank * w; tp += q.pitch * w; sum += w;
    }
    const flying = sum > 0.15;
    if (flying){ tb /= sum; tp /= sum; }
    else { tb = Math.sin(this.t * 0.3) * 0.25; tp = Math.sin(this.t * 0.2) * 0.2; }      /* nobody's wings out: a gentle drift */
    /* everyone resting: say so, kindly */
    this.restFor = present.length && !flying ? this.restFor + dt : 0;
    if (this.restFor > 2.5 && this.say.text !== REST) this.say = { icon: 'dinosaur', text: REST, t: 0, until: 5 };
    /* a little pull toward the nearest wonder (or ring or fruit), so a wobbly wing still finds it; when nobody's flying it glides on toward
       what's ahead by itself */
    const near = this._nearest(), pull = flying ? 1 : 1.6;
    if (near){
      const dx = near.x - this.x, dz = near.z - this.z, ang = Math.atan2(dx, dz) - this.head;
      const a = Math.atan2(Math.sin(ang), Math.cos(ang));
      if (Math.abs(a) < (flying ? 0.9 : 0.5)) tb += Math.max(-0.3, Math.min(0.3, a * 0.6)) * pull;
      if (near.alt != null && Math.hypot(dx, dz) < 14) tp += Math.max(-0.3, Math.min(0.3, (near.alt - this.alt) * 0.3)) * pull;
    }
    /* gliding on its own, it eases back toward straight ahead, so it never circles round something it can't turn to reach */
    if (!flying) tb -= Math.max(-1, Math.min(1, this.head)) * 0.5;
    const k = Math.min(1, dt * 3);
    this.bank += (Math.max(-1, Math.min(1, tb)) - this.bank) * k;
    this.pitch += (tp - this.pitch) * k;
    this.flap += dt * (4 + Math.max(0, this.pitch) * 3);

    this.head += this.bank * TURN * dt;
    this.alt = Math.max(ALT_MIN, Math.min(ALT_MAX, this.alt + this.pitch * ALT_RATE * dt));
    const v = SPEED - this.pitch * 0.8;
    this.x += Math.sin(this.head) * v * dt; this.z += Math.cos(this.head) * v * dt; this.dist += v * dt;

    /* rings and fruit: a trail now and then; flying through one is a chime and some sparkles */
    this.nextTrail -= dt;
    if (this.nextTrail <= 0){ this._trail(); this.nextTrail = TRAIL_EVERY[0] + Math.random() * (TRAIL_EVERY[1] - TRAIL_EVERY[0]); }
    for (const q of this.treats){
      if (q.got) continue;
      if (Math.hypot(q.x - this.x, q.z - this.z) < TREAT && Math.abs(q.alt - this.alt) < TREAT_ALT){
        q.got = true; q.goneAt = this.t; this.gathered++;
        sfx.chime?.(1); if (this.gathered % 5 === 0) sfx.twinkle?.();
        const bx = W * (0.4 + Math.random() * 0.2), by = H * (0.3 + Math.random() * 0.15);
        for (let n = 0; n < 8; n++) this.j.burst(bx, by, [color('touch.sunflower'), color('touch.bubblegum'), color('touch.mint'), color('touch.skyBlue')][n % 4], 3, 1);
      }
    }
    this.treats = this.treats.filter(q => q.got ? this.t - q.goneAt < 0.5 : this._ahead(q.x, q.z) > -6);
    /* soft clouds: a few, drifting across; a bump is a wobble and a boing and nothing else (never a point lost, never slower) */
    this.nextPuff -= dt;
    if (this.nextPuff <= 0 && this.puffs.length < 3){ if (this._puff()) this.nextPuff = PUFF_EVERY[0] + Math.random() * (PUFF_EVERY[1] - PUFF_EVERY[0]); else this.nextPuff = 1; }
    for (const q of this.puffs){
      if (q.bumped) continue;
      if (Math.hypot(q.x - this.x, q.z - this.z) < PUFF && Math.abs(q.alt - this.alt) < PUFF_ALT){
        q.bumped = true; q.goneAt = this.t; this.bumps++; this.wob = 1;
        sfx.boing?.(0.5);
        for (let n = 0; n < 10; n++) this.j.burst(W * (0.4 + Math.random() * 0.2), H * (0.4 + Math.random() * 0.2), color('earth.snow'), 3, 1);
        if (this.bumps === 1 && !this.say.until) this.say = { icon: 'cloudy', text: 'Boing! A soft cloud.', t: 0, until: 3.5 };
      }
    }
    this.wob = Math.max(0, this.wob - dt * 0.7);
    this.puffs = this.puffs.filter(q => q.bumped ? this.t - q.goneAt < 0.6 : this._ahead(q.x, q.z) > -6);
    /* a hint, once the first trail is in sight */
    if (this.t > 9 && !this.hinted && !this.gathered && !this.found.length){ this.hinted = true; this.say = { icon: 'sparkles', text: 'Fly through the sparkly rings!', t: 0, until: 7 }; }

    /* wonders: one appears now and then; flying over one finds it */
    this.nextAt -= dt;
    if (this.nextAt <= 0 && this.wonders.length < 2){ this._spawn(); this.nextAt = WONDER_EVERY[0] + Math.random() * (WONDER_EVERY[1] - WONDER_EVERY[0]); }
    for (const w of this.wonders){
      const d = Math.hypot(w.x - this.x, w.z - this.z);
      if (d < FIND && this.alt < FIND_ALT && !w.got){
        w.got = true; this.found.push(w.w);
        for (let i = 0; i < this.players; i++) if (pose.players[i] && pose.players[i].present) this.score[i]++;
        this.say = { text: `You found ${w.w.text}!`, t: 0, until: 4.5 };
        sfx.hooray?.(); sfx.chime?.(1);
        for (let q = 0; q < 14; q++) this.j.burst(W * (0.3 + Math.random() * 0.4), H * (0.25 + Math.random() * 0.3), [color('touch.sunflower'), color('touch.bubblegum'), color('touch.mint'), color('touch.skyBlue')][q % 4], 4, 1);
      }
    }
    /* a wonder goes a moment after it's found, or when it's well behind us */
    this.wonders = this.wonders.filter(w => {
      if (w.got){ if (w.goneAt == null) w.goneAt = this.t; return this.t - w.goneAt < 1.2; }
      return this._ahead(w.x, w.z) > -6;
    });
    this.avatars.step(dt, this.players);
  }

  /* how far in front of the pterodactyl a place is (behind: negative) */
  _ahead(x, z){ return (z - this.z) * Math.cos(this.head) + (x - this.x) * Math.sin(this.head); }

  /* the nearest wonder (it comes first), or else the nearest ring or fruit that's ahead */
  _nearest(){
    let best = null, bd = 1e9;
    for (const w of this.wonders){ if (w.got) continue; const d = Math.hypot(w.x - this.x, w.z - this.z); if (d < bd){ bd = d; best = w; } }
    if (best) return best;
    for (const q of this.treats){ if (q.got || this._ahead(q.x, q.z) < 1) continue; const d = Math.hypot(q.x - this.x, q.z - this.z); if (d < bd && d < 26){ bd = d; best = q; } }
    return best;
  }

  /* a point in the world, as the pterodactyl sees it: how far ahead (rz), across (rx) */
  _rel(wx, wz){
    const dx = wx - this.x, dz = wz - this.z, c = Math.cos(this.head), s = Math.sin(this.head);
    return { rx: dx * c - dz * s, rz: dx * s + dz * c };
  }

  draw(c, W, H){
    const f = Math.min(1, this.t / ROUND), sky = skyAt(f);
    const F = H * 1.05, horizon = H * (0.36 - this.pitch * 0.04);
    c.save();
    /* the horizon tips with the bank */
    c.translate(W / 2, H * 0.5); c.rotate(-this.bank * 0.1 + Math.sin(this.t * 16) * 0.012 * this.wob); c.scale(1.18, 1.18); c.translate(-W / 2, -H * 0.5);
    /* sky */
    const g = c.createLinearGradient(0, 0, 0, horizon); g.addColorStop(0, sky.top); g.addColorStop(1, sky.hor);
    c.fillStyle = g; c.fillRect(-W * 0.2, -H * 0.2, W * 1.4, horizon + H * 0.2);
    this._sun(c, W, H, horizon, f);
    this._ranges(c, W, H, horizon);
    /* the ground, in bands that rush toward us */
    const gg = c.createLinearGradient(0, horizon, 0, H * 1.2); gg.addColorStop(0, sky.far); gg.addColorStop(1, sky.near);
    c.fillStyle = gg; c.fillRect(-W * 0.2, horizon, W * 1.4, H * 1.2);
    for (let k = 0; k < 28; k++){
      const rz = 1.2 + k * 1.2, y0 = horizon + this.alt * F / (rz + 1.2), y1 = horizon + this.alt * F / rz;
      if (Math.floor((rz + this.dist) / 1.2) % 2) continue;
      c.fillStyle = alpha('earth.snow', 0.05); c.fillRect(-W * 0.2, y0, W * 1.4, y1 - y0);
    }
    /* what's on the ground and what's waiting, far to near */
    const things = [];
    const ci = Math.floor(this.x / CELL), cj = Math.floor(this.z / CELL), R = Math.ceil(FAR / CELL);
    for (let i = ci - R; i <= ci + R; i++) for (let j = cj - R; j <= cj + R; j++){
      if (hash(i, j, 1) > 0.4) continue;
      const wx = (i + hash(i, j, 2)) * CELL, wz = (j + hash(i, j, 3)) * CELL, r = this._rel(wx, wz);
      if (r.rz < NEAR || r.rz > FAR || Math.abs(r.rx) > r.rz * 1.5 + 2) continue;
      things.push({ rz: r.rz, rx: r.rx, kind: hash(i, j, 4), big: hash(i, j, 5) });
    }
    for (const w of this.wonders){ const r = this._rel(w.x, w.z); if (r.rz >= NEAR && r.rz < FAR + 8 && Math.abs(r.rx) < r.rz * 1.6 + 2) things.push({ rz: r.rz, rx: r.rx, wonder: w }); }
    for (const q of this.treats){ const r = this._rel(q.x, q.z); if (r.rz >= NEAR && r.rz < FAR && Math.abs(r.rx) < r.rz * 1.6 + 2) things.push({ rz: r.rz, rx: r.rx, treat: q }); }
    for (const q of this.puffs){ const r = this._rel(q.x, q.z); if (r.rz >= NEAR && r.rz < FAR && Math.abs(r.rx) < r.rz * 1.6 + 2) things.push({ rz: r.rz, rx: r.rx, puff: q }); }
    things.sort((a, b) => b.rz - a.rz);
    for (const o of things) this._thing(c, W, H, horizon, F, o);
    c.restore();
    this.j.draw(c, H);
    this._ptero(c, W, H);
    this._book(c, W, H);
    this.avatars.drawMitts(c, W, H, this.players);
  }

  _sun(c, W, H, horizon, f){
    const az = lerp(-0.9, 0.9, f), x = W / 2 + (az - this.head) * W * 0.6, y = horizon - H * (0.28 - Math.abs(f - 0.45) * 0.3);
    const r = H * 0.07, g = c.createRadialGradient(x, y, r * 0.2, x, y, r * 3.2);
    g.addColorStop(0, alpha('sky.sun', 0.95)); g.addColorStop(1, alpha('sky.sun', 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3.2, 0, 6.2832); c.fill();
  }

  /* far mountains slide sideways as you turn */
  _ranges(c, W, H, horizon){
    for (const [k, col, hgt, sp] of [[0, alpha('shade.mid', 0.65), 0.16, 0.9], [1, alpha('shade.inkSoft', 0.7), 0.1, 1.5]]){
      const seg = W * 0.07, shift = this.head * sp * W * 0.6, base = Math.floor(shift / seg), off = shift - base * seg;
      c.fillStyle = col; c.beginPath(); c.moveTo(-W * 0.3, horizon);
      for (let i = 0; i <= 26; i++) c.lineTo(i * seg - off - seg * 3, horizon - (0.35 + hash(base + i, k, 7) * 0.65) * H * hgt);
      c.lineTo(W * 1.3, horizon); c.closePath(); c.fill();
    }
  }

  _thing(c, W, H, horizon, F, o){
    const s = F / o.rz, x = W / 2 + o.rx * s, y = horizon + this.alt * s;
    /* far things melt into the haze; things right beside us melt away too (they'd fill the screen) */
    const fade = Math.max(0, Math.min(1, (FAR - o.rz) / 12)) * Math.max(0, Math.min(1, (o.rz - 1.6) / 2.4));
    /* things in the air: a ring of sparkles or a piece of fruit to fly through, a soft cloud to wobble off */
    if (o.treat || o.puff){
      const q = o.treat || o.puff, ay = horizon + (this.alt - q.alt) * s, gone = q.got || q.bumped, k = gone ? Math.max(0, 1 - (this.t - q.goneAt) / (o.puff ? 0.6 : 0.5)) : 1;
      const fa = Math.max(0.25, fade) * k;
      if (o.puff){
        const size = 2.8 * s * (gone ? 1 + (1 - k) * 0.5 : 1);
        this._emoji(c, 'cloudy', x, ay + size * 0.38, size, 0.92 * fa);
      } else if (q.kind === 'ring'){
        const r = TREAT * 0.8 * s * (gone ? 1 + (1 - k) * 0.8 : 1), pulse = 1 + Math.sin(this.t * 4 + q.x) * 0.06;
        c.save(); c.globalAlpha = fa; c.lineCap = 'round';
        c.strokeStyle = alpha('sky.sunGlow', 0.5); c.lineWidth = Math.max(4, r * 0.28); c.beginPath(); c.ellipse(x, ay, r * pulse, r * pulse * 1.04, 0, 0, 6.2832); c.stroke();
        c.strokeStyle = color('touch.sunflower'); c.lineWidth = Math.max(2, r * 0.12); c.beginPath(); c.ellipse(x, ay, r * pulse, r * pulse * 1.04, 0, 0, 6.2832); c.stroke();
        c.restore();
        const sp = r * 0.45; this._emoji(c, 'sparkles', x + r * 0.7, ay - r * 0.7 + sp * 0.38, sp, fa * (0.6 + 0.4 * Math.sin(this.t * 6 + q.z)));
      } else {
        const size = 1.5 * s * (gone ? 1 + (1 - k) * 0.8 : 1);
        this._emoji(c, q.kind, x, ay + size * 0.38 + Math.sin(this.t * 3 + q.x) * size * 0.05, size, fa);
      }
      return;
    }
    if (o.wonder){
      const w = o.wonder, size = w.w.size * s;
      if (!w.got){
        /* a ring of sparkle round it, so it's easy to see from far off */
        const pulse = 1 + Math.sin(this.t * 4) * 0.08;
        c.save(); c.globalAlpha = 0.9 * Math.max(0.25, fade); c.strokeStyle = color('sky.sunGlow'); c.lineWidth = Math.max(2, size * 0.05);
        c.beginPath(); c.ellipse(x, y - size * 0.3, size * 0.75 * pulse, size * 0.75 * pulse, 0, 0, 6.2832); c.stroke();
        c.restore();
      }
      this._emoji(c, w.w.emoji, x, y, size * (w.got ? 1.2 : 1), (w.got ? 0.4 : 1) * Math.max(0.25, fade));
      return;
    }
    const k = o.kind;
    if (k < 0.07){                       /* a lake, flat on the ground */
      const wd = (1.8 + o.big * 2.2) * s, flat = Math.max(0.05, Math.min(0.5, this.alt / o.rz));
      c.save(); c.globalAlpha = 0.85 * fade; c.fillStyle = color('sky.high'); c.beginPath(); c.ellipse(x, y, wd, wd * flat, 0, 0, 6.2832); c.fill();
      c.fillStyle = alpha('earth.snow', 0.3); c.beginPath(); c.ellipse(x - wd * 0.2, y - wd * flat * 0.2, wd * 0.5, wd * flat * 0.3, 0, 0, 6.2832); c.fill(); c.restore();
      return;
    }
    const emoji = k < 0.5 ? 'pinetree' : k < 0.72 ? 'palm' : k < 0.85 ? 'roundtree' : k < 0.93 ? 'fern' : k < 0.97 ? 'dinosaur' : 'volcano';
    const size = (emoji === 'volcano' ? 4 : emoji === 'dinosaur' ? 1.4 : 1.2 + o.big * 1.1) * s;
    this._emoji(c, emoji, x, y, size, fade);
  }

  _emoji(c, e, x, y, size, alpha){
    if (size < 3) return;
    const sp = sprite(e);
    c.save(); c.globalAlpha = alpha;
    if (sp){ const k = size / 128; c.drawImage(sp, x - 80 * k, y - size * 0.38 - 84 * k, 160 * k, 160 * k); }
    else assets.draw(c, e, x, y - size * 0.38, size);
    c.restore();
  }

  /* the pterodactyl, from behind: wings spread, rolling with the turn, flapping gently */
  _ptero(c, W, H){
    const fl = Math.sin(this.flap) * 0.18, span = W * 0.2;
    const wob = Math.sin(this.t * 16) * 0.16 * this.wob;         /* (a soft cloud: a quick wobble) */
    c.save(); c.translate(W / 2 + wob * W * 0.03, H * 0.8 - this.pitch * H * 0.03); c.rotate(this.bank * 0.28 + wob);
    c.fillStyle = alpha('shade.ink', 0.15); c.beginPath(); c.ellipse(0, H * 0.1, span * 0.7, H * 0.02, 0, 0, 6.2832); c.fill();
    for (const side of [-1, 1]){
      c.fillStyle = color('earth.clay'); c.beginPath(); c.moveTo(side * span * 0.06, 0);
      c.quadraticCurveTo(side * span * 0.6, -H * (0.1 + fl), side * span * 1.05, -H * (0.02 + fl * 1.6));
      c.quadraticCurveTo(side * span * 0.8, H * 0.01, side * span * 0.7, H * 0.045);
      c.quadraticCurveTo(side * span * 0.4, H * 0.01, side * span * 0.25, H * 0.05);
      c.quadraticCurveTo(side * span * 0.12, H * 0.03, side * span * 0.06, H * 0.05);
      c.closePath(); c.fill();
      c.strokeStyle = color('fav.teal', 'shade'); c.lineWidth = Math.max(3, H * 0.006); c.lineCap = 'round';
      c.beginPath(); c.moveTo(side * span * 0.06, 0); c.quadraticCurveTo(side * span * 0.6, -H * (0.1 + fl), side * span * 1.05, -H * (0.02 + fl * 1.6)); c.stroke();
    }
    c.fillStyle = color('fav.teal', 'shade'); c.beginPath(); c.ellipse(0, H * 0.02, span * 0.13, H * 0.06, 0, 0, 6.2832); c.fill();
    c.fillStyle = color('fav.teal'); c.beginPath(); c.ellipse(0, H * 0.035, span * 0.07, H * 0.035, 0, 0, 6.2832); c.fill();
    /* the head and its crest, ahead of us */
    c.fillStyle = color('fav.teal', 'shade'); c.beginPath(); c.ellipse(0, -H * 0.045, span * 0.07, H * 0.035, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.moveTo(-span * 0.03, -H * 0.06); c.lineTo(0, -H * 0.115); c.lineTo(span * 0.05, -H * 0.055); c.closePath(); c.fill();
    c.restore();
  }

  /* the sticker book: a picture for every wonder found, along the bottom */
  _book(c, W, H){
    if (!this.found.length) return;
    /* along the bottom left, out of the pterodactyl's way */
    const size = H * 0.05, gap = size * 1.2, x0 = W * 0.04 + size * 0.7, y = H * 0.94, n = this.found.length;
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = alpha('earth.snow', 0.7); c.beginPath(); c.roundRect(x0 - gap * 0.7, y - size * 0.7, gap * (n - 1) + gap * 1.4, size * 1.4, size * 0.7); c.fill();
    this.found.forEach((w, i) => { const sp = sprite(w.emoji); if (sp){ const k = size / 128; c.drawImage(sp, x0 + i * gap - 80 * k, y - 84 * k, 160 * k, 160 * k); } else assets.draw(c, w.emoji, x0 + i * gap, y, size); });
    c.restore();
  }

  /* the move card: which move the card in the corner shows right now, or null for none (show it for the first few seconds) */
  card(){ return this.t < 8 ? 'flap' : null; }
  hud(){ return { score: this.score, showLives: false, goal: Math.min(1, this.found.length / GOAL),
    words: { ...this.say, until: this.say.until || (this.say.text.startsWith('Spread') ? this.hintUntil : Infinity) } }; }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++){
      if (!this.score[i] && !pose.players[i].present) continue;
      rows.push({ label: `Player ${i + 1}`, value: this.score[i], color: PLAYER_COLORS[i] });
    }
    return rows;
  }
  winner(){
    const played = this.score.slice(0, this.players).map((s, i) => i).filter(i => this.score[i] > 0 || pose.players[i].present);
    if (played.length < 2) return null;
    const top = Math.max(...played.map(i => this.score[i]));
    const best = played.filter(i => this.score[i] === top);
    return best.length > 1 ? -1 : best[0];
  }
  value(){ return this.found.length; }
  /* what the round was, in a line: the wonders in the sticker book, and the sparkles flown through (a cloud bump never shows) */
  summary(){
    const w = this.found.length, g = this.gathered;
    if (!w && !g) return 'What a lovely flight!';
    const parts = [];
    if (w) parts.push(`${w} ${w === 1 ? 'wonder' : 'wonders'}`);
    if (g) parts.push(`${g} ${g === 1 ? 'sparkle' : 'sparkles'}`);
    return `You found ${parts.join(' and ')}!`;
  }
}

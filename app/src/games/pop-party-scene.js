/* The world Pop Party happens in. The game owns the balloons; this owns
   everything around them, and is told just enough to react:

   - the round's progress, which moves the sun from morning to sunset;
   - the wind, which the trees and grass lean into - harder through the
     balloon storm at the end, which is balloons, not weather: no dark
     clouds, rain or lightning;
   - how well someone is doing, which makes the sun grin;
   - where the players stand, which shifts the layers a little against each
     other, like looking through a window;
   - every pop, which grows a flower of that colour in the meadow.

   drawBack paints what sits behind the balloons, drawFront the grass and
   flowers in front of them. Nothing here is an image file, and
   the per-frame cost is kept to a few dozen shapes plus a couple of batched
   strokes, since the pose model is sharing the same laptop. */

import { color, alpha } from './assets/palette.js';

const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
/* a palette colour (with its tone) as the [r, g, b] this scene works in */
const pal = (name, t) => hex(color(name, t));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const byte = (v) => (Math.max(0, Math.min(255, v | 0))).toString(16).padStart(2, '0');
const css = (c, a = 1) => '#' + byte(c[0]) + byte(c[1]) + byte(c[2]) + (a < 1 ? byte(Math.round(a * 255)) : '');
const BLACK = [0, 0, 0];

/* Time of day across the round, by progress 0..1. light/amt tint the
   ground; dark dims it. */
const DAY = [
  { p:0,    top:'sky.mid',  mid:'sky.low', low:['touch.sunflower', 'light'], light:['earth.peach', 'light'], amt:0.08, dark:0.00, sun:'sky.sun',     cloud:'earth.snow' },
  { p:0.35, top:'sky.high', mid:'sky.low', low:['touch.sunflower', 'light'], light:'earth.snow',             amt:0.00, dark:0.00, sun:'sky.sun',     cloud:'earth.snow' },
  { p:0.72, top:'dusk.high', mid:'earth.sand', low:'earth.path',             light:'earth.peach',            amt:0.18, dark:0.03, sun:'sky.sunGlow', cloud:['earth.peach', 'light'] },
  { p:1,    top:'dusk.deep', mid:'dusk.rose', low:'earth.peach',              light:'earth.peach',            amt:0.25, dark:0.14, sun:'earth.peach', cloud:['fav.orange', 'light'] }
].map(k => ({ ...k, ...Object.fromEntries(['top','mid','low','light','sun','cloud'].map(f => [f, [].concat(k[f]).length > 1 ? pal(...k[f]) : pal(k[f])])) }));

export function lighting(p){
  let i = 0;
  while (i < DAY.length - 2 && p > DAY[i + 1].p) i++;
  const a = DAY[i], b = DAY[i + 1], t = Math.min(1, Math.max(0, (p - a.p) / (b.p - a.p)));
  const L = {};
  for (const f of ['top','mid','low','light','sun','cloud']) L[f] = mix(a[f], b[f], t);
  for (const f of ['amt','dark']) L[f] = a[f] + (b[f] - a[f]) * t;
  return L;
}

const GROUND = {
  hills: ['meadow.soft', 'meadow.lawn', 'meadow.grass'].map(n => pal(n)),
  trunk: pal('earth.bark'), leaf: pal('meadow.leaf'), leafLit: pal('meadow.lawn'), leafShade: pal('meadow.leaf', 'shade'),
  grass: [pal('meadow.deep'), pal('meadow.soft')],
  farPeak: pal('sky.low', 'shade'), nearPeak: pal('sky.high', 'shade'),
  /* the one shadow tone everything takes on its right */
  shade: pal('shade.shadow')
};

/* Deterministic scatter, so the landscape holds still between frames. */
const hash = (i, k = 1) => (((i + 1) * 2654435761 * k) % 4294967296) / 4294967296;

const PEAKS_FAR  = Array.from({ length: 11 }, (_, i) => ({ x: -0.1 + i * 0.12 + hash(i, 3) * 0.05, y: 0.47 + hash(i, 5) * 0.12 }));
const PEAKS_NEAR = Array.from({ length: 9 },  (_, i) => ({ x: -0.12 + i * 0.16 + hash(i, 7) * 0.06, y: 0.58 + hash(i, 11) * 0.08 }));
const CLOUDS = Array.from({ length: 9 }, (_, i) => ({
  seed: (i * 0.618) % 1, y: 0.06 + ((i * 0.37) % 1) * 0.36,
  s: i % 3 === 0 ? 1.4 : (i % 3 === 1 ? 1 : 0.65), speed: i % 3 === 0 ? 0.012 : (i % 3 === 1 ? 0.008 : 0.005)
}));
const TREES = [[0.07,0.775,0.7,0],[0.17,0.85,0.95,1],[0.30,0.785,0.6,0],[0.70,0.845,0.85,1],[0.86,0.775,0.65,0],[0.95,0.855,0.95,1]];
const TUFTS = Array.from({ length: 110 }, (_, i) => ({ x: -0.06 + hash(i, 13) * 1.12, y: 0.9 + Math.pow(hash(i, 17), 0.6) * 0.1,
                                                       h: 0.02 + hash(i, 19) * 0.026, ph: hash(i, 23) * 6.28 }));
/* petals and seeds drifting on the wind */
const PETALS = Array.from({ length: 26 }, (_, i) => ({ seed: hash(i, 29), y: 0.08 + hash(i, 31) * 0.75, sp: 0.02 + hash(i, 37) * 0.03, ph: hash(i, 41) * 6.28, col: [color('sky.sun'), color('touch.bubblegum', 'light'), color('meadow.haze')][i % 3] }));
/* Each band of hills fades toward the horizon's colour by its haze: the
   way distance looks, and what lets the bright balloons sit in front. */
const HILLS = [{ y:0.74, h:0.07, n:3, depth:0.03, haze:0.40 },
               { y:0.82, h:0.10, n:4, depth:0.042, haze:0.20 },
               { y:0.90, h:0.14, n:3, depth:0.055, haze:0.04 }];
const FRONT = 0.055;

export class Scene {
  /* theme: { ground: colours to use instead of GROUND's (an autumn meadow,
     say), petals: the colours drifting on the wind } */
  constructor(theme = {}){
    this.G = { ...GROUND, ...(theme.ground || {}) };
    this.petalCols = theme.petals || null;
    this.t = 0; this.p = 0; this.storm = 0; this.wind = 0; this.joy = 0; this.look = 0;
    this.flowers = [];
    this.flock = null; this.nextFlock = 6 + Math.random() * 10;
    this.rainbow = 0;
    /* One unprompted rainbow a round, besides the parade's. */
    this.rainbowAt = 35 + Math.random() * 55;
    this.gw = Array.from({ length: 3 }, () => ({ f: 0.3 + Math.random() * 0.9, ph: Math.random() * 6.2832 }));
    /* Lite mode: if the laptop really can't keep up - the pose model shares it -
       the scene sheds its extras (the sun's glow, the drifting petals, fewer flowers) for the rest of the round rather than let
       the game stutter. It never switches back, so it can't flicker, and it never takes the grass: a meadow with no grass
       looks broken. A stall (the camera starting, the window switching) isn't the laptop struggling, and the first seconds
       don't count. */
    this.lite = false; this.frame = 1 / 60; this.slowFor = 0;
  }

  gustNoise(t){ let n = 0; for (const g of this.gw) n += Math.sin(t * g.f + g.ph); return n / this.gw.length; }

  /* s: { t, p, storm (bool: the finale, which only stiffens the breeze), wind,
        joy 0..1, look 0..1, rainbow (bool) } */
  step(dt, s){
    this.t = s.t; this.p = Math.min(1, s.p);
    const stall = dt > 0.25;
    if (!stall) this.frame += (dt - this.frame) * 0.05;
    this.slowFor = !stall && this.t > 8 && this.frame > 1 / 42 ? this.slowFor + dt : 0;
    if (this.slowFor > 4) this.lite = true;
    this.storm += ((s.storm ? 1 : 0) - this.storm) * Math.min(1, dt * 0.7);
    this.joy += (s.joy - this.joy) * Math.min(1, dt * 3);
    /* Eased hard, so a lunge for a balloon nudges the world rather than
       swinging it; plus a slow drift so it never sits dead still. */
    this.look += ((s.look - 0.5) - this.look) * Math.min(1, dt * 1.5);
    /* a light, uneven breeze in the storm: slow waves of odd lengths, never a steady sweep */
    const gust = this.storm * (0.35 + this.gustNoise(this.t) * 0.3);
    this.wind = s.wind / 0.022 + gust;

    const wantBow = s.rainbow || (this.t >= this.rainbowAt && this.t < this.rainbowAt + 25);
    this.rainbow += ((wantBow ? 0.42 : 0) - this.rainbow) * Math.min(1, dt * 0.8);

    for (const f of this.flowers) f.age += dt;
    if (this.flowers.length > 60) this.flowers.splice(0, this.flowers.length - 60);

    if (this.flock){
      this.flock.x += this.flock.dir * this.flock.speed * dt;
      if (this.flock.dir > 0 ? this.flock.x > 1.2 : this.flock.x < -0.2) this.flock = null;
    } else if ((this.nextFlock -= dt) <= 0){
      const dir = Math.random() < 0.5 ? 1 : -1;
      this.flock = { dir, x: dir > 0 ? -0.15 : 1.15, y: 0.12 + Math.random() * 0.22, speed: 0.055 + Math.random() * 0.03 };
      this.nextFlock = 18 + Math.random() * 22;
    }
  }

  /* A flower comes up in the meadow under every pop, in the balloon's
     colour. Over five minutes the meadow becomes a record of the round. */
  pop(x, hue){
    this.flowers.push({ x: Math.max(0.02, Math.min(0.98, x + (Math.random() - 0.5) * 0.04)),
                        y: 0.905 + Math.random() * 0.075, hue, age: 0, s: 0.8 + Math.random() * 0.5 });
  }

  _shift(depth, W){ return -(this.look + Math.sin(this.t * 0.04) * 0.08) * depth * W; }

  drawBack(c, W, H){
    const L = lighting(this.p);
    const ground = (base) => mix(mix(base, L.light, L.amt), BLACK, L.dark);

    const sky = c.createLinearGradient(0, 0, 0, H * 0.8);
    sky.addColorStop(0, css(L.top)); sky.addColorStop(0.55, css(L.mid)); sky.addColorStop(1, css(L.low));
    c.fillStyle = sky; c.fillRect(0, 0, W, H);

    this._sun(c, W, H, L);
    this._clouds(c, W, H, L, 0, 0.8);
    if (this.rainbow > 0.01) this._rainbow(c, W, H);
    this._mountains(c, W, H, L, ground);
    this._mist(c, W, H, L, 0.5, 0.76, 0.6);
    if (this.flock) this._birds(c, W, H);
    this._clouds(c, W, H, L, 0.8, 9);
    this._hills(c, W, H, ground, L);
    /* far things fade toward the sky, the nearer the horizon the more (the gradient is made once per screen height) */
    if (this._hzH !== H){ this._hzH = H; const hz = c.createLinearGradient(0, H * 0.38, 0, H * 0.78); hz.addColorStop(0, alpha('sky.horizon', 0)); hz.addColorStop(0.55, alpha('sky.horizon', 0.3)); hz.addColorStop(1, alpha('sky.horizon', 0)); this._hz = hz; }
    c.fillStyle = this._hz; c.fillRect(0, H * 0.38, W, H * 0.4);
  }

  drawFront(c, W, H){
    const L = lighting(this.p);
    const ground = (base) => mix(mix(base, L.light, L.amt), BLACK, L.dark);
    this._grass(c, W, H, ground);
    this._flowers(c, W, H);
    if (!this.lite) this._petals(c, W, H);
    this._grain(c, W, H);
  }

  /* petals and seeds on the wind, drifting across */
  _petals(c, W, H){
    const wind = 1 + Math.max(0, this.wind) * 0.5;
    for (const pt of PETALS){
      const x = (((pt.seed + this.t * pt.sp * wind) % 1.2) - 0.1) * W, y = (pt.y + Math.sin(this.t * 0.9 + pt.ph) * 0.02) * H;
      c.save(); c.translate(x, y); c.rotate(-0.5 + Math.sin(this.t * 2 + pt.ph) * 0.4);
      c.fillStyle = this.petalCols ? this.petalCols[PETALS.indexOf(pt) % this.petalCols.length] : pt.col; c.beginPath(); c.ellipse(0, 0, H * 0.0075, H * 0.0036, 0, 0, 6.2832); c.fill();
      c.restore();
    }
  }

  /* a faint paper grain over the whole picture: made once, laid down whole */
  _grain(c, W, H){
    if (this._grainFail) return;
    try {
      if (!this._grainCv || this._grainCv.width !== Math.round(W / 2)){
        const cv = typeof document !== 'undefined' ? document.createElement('canvas') : null;
        if (!cv || !cv.getContext) { this._grainFail = true; return; }
        cv.width = Math.round(W / 2); cv.height = Math.round(H / 2);
        const g = cv.getContext('2d');
        let sd = 3; const r = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
        for (let i = 0; i < cv.width * cv.height / 18; i++){ g.fillStyle = r() < 0.5 ? alpha('earth.snow', 0.08) : alpha('shade.shadow', 0.05); g.fillRect(r() * cv.width, r() * cv.height, 1, 1); }
        this._grainCv = cv;
      }
      c.drawImage(this._grainCv, 0, 0, W, H);
    } catch (e){ this._grainFail = true; }
  }

  /* ---------- layers ---------- */

  _sun(c, W, H, L){
    /* Rises on the left, high at midday, low on the right by sunset. */
    const sx = W * (0.12 + this.p * 0.76) + this._shift(0.01, W);
    const sy = H * (0.62 - Math.sin(Math.PI * (0.1 + 0.8 * this.p)) * 0.48);
    const sr = H * 0.065 * (1 + this.joy * 0.12);
    /* The glow is a gradient worked out for every pixel it covers, so it
       covers only where it can be seen, and lite mode goes without. */
    if (!this.lite){
      const glow = c.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 4);
      glow.addColorStop(0, css(mix(L.sun, [255, 255, 255], 0.4), 0.75));
      glow.addColorStop(1, css(L.sun, 0));
      c.fillStyle = glow; c.fillRect(sx - sr * 4, sy - sr * 4, sr * 8, sr * 8);
    }

    c.save(); c.translate(sx, sy); c.rotate(this.t * (0.08 + this.joy * 0.5));
    c.fillStyle = css(mix(L.sun, [255, 255, 255], 0.3), 0.1 + this.joy * 0.12);
    const len = sr * (4.2 + this.joy * 1.8);
    c.beginPath();
    for (let i = 0; i < 12; i++){
      const a = i * Math.PI / 6, ca = Math.cos(a), sa = Math.sin(a);
      /* a wedge that is wide where it leaves the sun and tapers to a point, so the rays fade out instead of ending in hard edges */
      c.moveTo(sr * 1.05 * ca + sr * 0.38 * sa, sr * 1.05 * sa - sr * 0.38 * ca);
      c.lineTo(len * ca, len * sa);
      c.lineTo(sr * 1.05 * ca - sr * 0.38 * sa, sr * 1.05 * sa + sr * 0.38 * ca);
      c.closePath();
    }
    c.fill();
    c.restore();

    c.fillStyle = css(L.sun);
    c.beginPath(); c.arc(sx, sy, sr, 0, 6.2832); c.fill();
    /* A face, which grins wider as the room does better. */
    const ink = alpha('earth.bark', 0.75, 'shade');
    c.fillStyle = ink;
    const blink = (this.t % 4.3) < 0.12 ? 0.15 : 1;
    for (const ex of [-0.32, 0.32]){
      c.beginPath(); c.ellipse(sx + ex * sr, sy - sr * 0.15, sr * 0.09, sr * 0.13 * blink, 0, 0, 6.2832); c.fill();
    }
    c.strokeStyle = ink; c.lineWidth = Math.max(2, sr * 0.08); c.lineCap = 'round';
    const grin = 0.35 + this.joy * 0.25;
    c.beginPath(); c.arc(sx, sy + sr * 0.05, sr * grin, 0.2 * Math.PI, 0.8 * Math.PI); c.stroke();
    if (this.joy > 0.05){
      c.fillStyle = alpha('touch.cherry', 0.45 * this.joy);
      for (const ex of [-0.55, 0.55]){ c.beginPath(); c.arc(sx + ex * sr, sy + sr * 0.2, sr * 0.14, 0, 6.2832); c.fill(); }
    }
    c.globalAlpha = 1;
  }

  _clouds(c, W, H, L, from, to){
    const col = css(L.cloud);
    for (const cl of [...CLOUDS].sort((a, b) => a.s - b.s)){
      if (cl.s < from || cl.s >= to) continue;
      const w = H * 0.22 * cl.s;
      const x = ((cl.seed + this.t * cl.speed * (1 + Math.max(0, this.wind) * 0.4)) % 1) * (W + w * 2) - w
                + this._shift(0.012 * cl.s, W);
      cloud(c, x, H * cl.y, w, col, 0.55 + cl.s * 0.3);
    }
  }

  _rainbow(c, W, H){
    const cx = W * 0.5 + this._shift(0.012, W), cy = H * 0.86, r0 = H * 0.62, band = H * 0.018;
    const cols = ['cherry', 'tangerine', 'sunflower', 'mint', 'lagoon', 'skyBlue', 'grape'].map(n => color('touch.' + n));
    c.lineWidth = band;
    c.globalAlpha = this.rainbow;
    cols.forEach((col, i) => {
      c.strokeStyle = col;
      c.beginPath(); c.arc(cx, cy, r0 - i * band, Math.PI, 2 * Math.PI); c.stroke();
    });
    c.globalAlpha = 1;
  }

  _mountains(c, W, H, L, ground){
    for (const [peaks, base, haze, depth, snow] of [[PEAKS_FAR, this.G.farPeak, 0.7, 0.012, true],
                                                    [PEAKS_NEAR, this.G.nearPeak, 0.5, 0.02, false]]){
      const dx = this._shift(depth, W);
      const col = ground(mix(base, L.low, haze));
      c.fillStyle = css(col);
      c.beginPath(); c.moveTo(-W * 0.2, H * 0.8);
      for (let i = 0; i < peaks.length; i++){
        const p = peaks[i], q = peaks[i + 1];
        c.lineTo(p.x * W + dx, p.y * H);
        if (q) c.lineTo(((p.x + q.x) / 2) * W + dx, Math.max(p.y, q.y) * H + H * 0.06);
      }
      c.lineTo(W * 1.2, H * 0.8); c.closePath(); c.fill();
      /* the shadow side of each peak, one flat tone */
      c.fillStyle = css(mix(col, this.G.shade, 0.12));
      c.beginPath();
      for (let i = 0; i < peaks.length - 1; i++){
        const p = peaks[i], q = peaks[i + 1], vx = ((p.x + q.x) / 2) * W + dx, vy = Math.max(p.y, q.y) * H + H * 0.06;
        c.moveTo(p.x * W + dx, p.y * H); c.lineTo(vx, vy); c.lineTo(vx, H * 0.8); c.lineTo(p.x * W + dx + H * 0.02, H * 0.8); c.closePath();
      }
      c.fill();
      if (snow){
        c.fillStyle = css(mix([255, 255, 255], col, 0.5));
        for (const p of peaks){
          if (p.y > 0.52) continue;
          const x = p.x * W + dx, y = p.y * H, w = H * 0.025;
          c.beginPath(); c.moveTo(x, y); c.lineTo(x - w, y + w * 0.9); c.lineTo(x + w, y + w * 0.9); c.closePath(); c.fill();
        }
      }
    }
  }

  /* A band of haze in the horizon's colour, thickest near its bottom edge. */
  _mist(c, W, H, L, from, to, strength){
    const g = c.createLinearGradient(0, H * from, 0, H * to);
    g.addColorStop(0, css(L.low, 0));
    g.addColorStop(0.75, css(L.low, strength));
    g.addColorStop(1, css(L.low, 0));
    c.fillStyle = g; c.fillRect(0, H * from, W, H * (to - from));
  }

  _birds(c, W, H){
    const f = this.flock, w = H * 0.013;
    const pos = [[0, 0], [-1, -1], [-1, 1], [-2, -2], [-2, 2]];
    c.strokeStyle = alpha('shade.ink', 0.45); c.lineWidth = Math.max(1.5, H * 0.0024); c.lineCap = 'round';
    c.beginPath();
    pos.forEach(([bx, by], i) => {
      const x = f.x * W + f.dir * bx * W * 0.03 + this._shift(0.01, W), y = f.y * H + by * H * 0.025;
      const flap = Math.sin(this.t * 9 + i * 0.8) * w * 0.6;
      c.moveTo(x - w, y - flap); c.quadraticCurveTo(x - w * 0.5, y - w * 0.4, x, y);
      c.quadraticCurveTo(x + w * 0.5, y - w * 0.4, x + w, y - flap);
    });
    c.stroke();
  }

  _hills(c, W, H, ground, L){
    HILLS.forEach((band, b) => {
      const dx = this._shift(band.depth, W), m = W * 0.08;
      const far = (col) => css(mix(ground(col), L.low, band.haze));
      c.fillStyle = far(this.G.hills[b]);
      c.beginPath(); c.moveTo(-m + dx, H); c.lineTo(-m + dx, H * band.y);
      const span = (W + m * 2) / band.n;
      for (let i = 0; i < band.n; i++){
        const x0 = -m + dx + i * span;
        c.quadraticCurveTo(x0 + span * 0.5, H * (band.y - band.h * 0.5), x0 + span, H * band.y);
      }
      c.lineTo(W + m + dx, H); c.closePath(); c.fill();

      /* The trees standing on this band, swaying with the wind. */
      for (const [fx, fy, fs, onBand] of TREES){
        if (onBand !== b) continue;
        const x = W * fx + dx, y = H * fy, sc = (H / 900) * fs;
        const sway = (Math.sin(this.t * 1.3 + fx * 20) * 0.25 + this.wind * 0.5) * 6 * sc;
        /* its shadow on the grass, falling right */
        c.fillStyle = alpha('shade.shadow', 0.14); c.beginPath(); c.ellipse(x + 30 * sc, y + 42 * sc, 40 * sc, 9 * sc, 0, 0, 6.2832); c.fill();
        c.fillStyle = far(this.G.trunk); c.fillRect(x - 5 * sc, y, 10 * sc, 42 * sc);
        /* clumps: lit on the left, one shadow tone on the right */
        const clumps = [[0, -12, 30], [-20, -2, 21], [20, 0, 22], [2, -34, 20]];
        for (const [cx, cy, cr] of clumps){
          const px = x + sway * (1 + cy / -60) + cx * sc, py = y + cy * sc, rr = cr * sc;
          c.fillStyle = far(this.G.leaf); c.beginPath(); c.arc(px, py, rr, 0, 6.2832); c.fill();
          c.save(); c.beginPath(); c.arc(px, py, rr, 0, 6.2832); c.clip();
          c.fillStyle = far(this.G.leafLit); c.beginPath(); c.arc(px - rr * 0.3, py - rr * 0.3, rr * 0.75, 0, 6.2832); c.fill();
          c.fillStyle = far(this.G.leafShade); c.beginPath(); c.arc(px + rr * 0.7, py + rr * 0.45, rr * 0.75, 0, 6.2832); c.fill();
          c.restore();
        }
      }
      /* A thinner veil of mist between the far hills and the nearer ones. */
      if (b === 0) this._mist(c, W, H, L, 0.7, 0.84, 0.3);
    });
  }

  _grass(c, W, H, ground){
    const dx = this._shift(FRONT, W);
    c.lineCap = 'round'; c.lineWidth = Math.max(2, H * 0.004);
    this.G.grass.forEach((col, k) => {
      c.strokeStyle = css(ground(col));
      c.beginPath();
      TUFTS.forEach((tf, i) => {
        if (i % 2 !== k) return;
        const x = tf.x * W + dx, y = tf.y * H, h = tf.h * H;
        const bend = (0.35 + this.wind * 0.35 + Math.sin(this.t * 2.2 + tf.ph) * 0.18) * h;
        for (const off of [-0.35, 0, 0.35]){
          c.moveTo(x + off * h * 0.4, y);
          c.quadraticCurveTo(x + off * h * 0.5 + bend * 0.3, y - h * 0.6, x + off * h * 0.7 + bend, y - h * (0.9 + Math.abs(off) * -0.2));
        }
      });
      c.stroke();
    });
  }

  /* Batched: one stroke for every stem, one fill per flower for its petals,
     one fill for every centre. Sixty flowers is otherwise four hundred
     separate shapes a frame. */
  _flowers(c, W, H){
    const dx = this._shift(FRONT, W), heads = [];
    c.strokeStyle = color('meadow.fresh', 'shade'); c.lineWidth = Math.max(1.5, H * 0.0025);
    c.beginPath();
    for (const f of this.lite ? this.flowers.slice(-25) : this.flowers){
      const grow = Math.min(1, f.age / 0.5), x = f.x * W + dx, y = f.y * H;
      const stem = H * 0.03 * f.s * grow, r = H * 0.008 * f.s * Math.min(1, Math.max(0, (f.age - 0.25) / 0.35));
      const lean = (this.wind * 0.15 + Math.sin(this.t * 2 + f.x * 30) * 0.08) * stem;
      c.moveTo(x, y); c.quadraticCurveTo(x, y - stem * 0.6, x + lean, y - stem);
      if (r > 0) heads.push([x + lean, y - stem, r, f]);
    }
    c.stroke();
    for (const [hx, hy, r, f] of heads){
      c.fillStyle = `hsl(${f.hue} 85% 65%)`;
      c.beginPath();
      for (let i = 0; i < 5; i++){
        const a = i * 1.2566 + f.x * 7, px = hx + Math.cos(a) * r, py = hy + Math.sin(a) * r;
        c.moveTo(px + r * 0.75, py); c.arc(px, py, r * 0.75, 0, 6.2832);
      }
      c.fill();
    }
    c.fillStyle = color('touch.sunflower');
    c.beginPath();
    for (const [hx, hy, r] of heads){ c.moveTo(hx + r * 0.55, hy); c.arc(hx, hy, r * 0.55, 0, 6.2832); }
    c.fill();
  }

}

/* A painted cloud: long and soft, stretched by the wind - layered
   translucent washes rather than a hard shape, a cooler tone underneath. */
function cloud(c, x, y, w, col, alpha){
  c.globalAlpha = alpha * 0.45;
  c.fillStyle = color('sky.low');
  c.beginPath(); c.ellipse(x + w * 0.04, y + w * 0.05, w * 0.62, w * 0.09, 0, 0, 6.2832); c.fill();
  c.fillStyle = col;
  for (const [dx, dy, rx, ry, a] of [[0, 0, 0.7, 0.12, 0.5], [-0.12, -0.03, 0.45, 0.1, 0.7], [0.15, -0.05, 0.38, 0.09, 0.8], [0.02, -0.07, 0.28, 0.07, 0.9]]){
    c.globalAlpha = alpha * a;
    c.beginPath(); c.ellipse(x + dx * w, y + dy * w, rx * w, ry * w, 0, 0, 6.2832); c.fill();
  }
  c.globalAlpha = 1;
}

/* (for themes: a colour code as the [r, g, b] the scene works in) */
export { hex as rgbOf };

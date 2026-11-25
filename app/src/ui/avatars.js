import { pose, L, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { figure } from './avatar-art.js';
import { handsMode } from './handsmode.js';
import { keepOut } from './keepout.js';
import { HandFeel } from './handfeel.js';
import { sfx } from '../audio/sound.js';

/* The players, in the picture. Two layers, drawn by the game at different
   depths:

   - bodies: a soft silhouette of each player in their colour, built from the
     pose landmarks, so a child can see themselves standing in the scene. It
     uses the same coordinates as the hands, so the silhouette's arms end
     exactly where the mitts are.
   - mitts: a glow orb for each hand (ui/handfeel.js, decision 0062): smoothed,
     a comet and a trail when it moves fast, a halo that burns bigger on a
     streak - the thing a child actually aims with. A game also tells it
     where things were hit (hit), where its targets are (targets) and asks
     how near a hand is to one (near), for the squash and burst on impact,
     the gentle pull and the hover glow.

   Nothing here decides anything about the game; it only shows where people
   are. The pull, the hover and the smoothing change only what is drawn:
   hits are always worked out by the game from the hand itself. */

const SWIFT = 0.9;   /* screen-widths per second: fast enough for a trail */

export class Avatars {
  constructor(){
    this.sparks = [];
    this.glow = Array(MAX_PLAYERS).fill(0);     /* 0..1 per player, from their streak */
    this.flash = Array(MAX_PLAYERS).fill(0);    /* a combo burst, decaying */
    this.t = 0;
    this.layer = null;       /* an offscreen canvas for the bodies, if there is one */
    this.feel = new HandFeel({ reduced: typeof matchMedia === 'function' && !!matchMedia('(prefers-reduced-motion: reduce)').matches });
  }

  /* A game's calls (all drawing only; see the top of this file) ------------------------------------------------------ */
  /* Something was hit (popped, caught, grabbed) at (x, y), shares of the picture, by player i: the orb squashes, a burst plays. */
  hit(x, y, i = -1){ this.feel.hit(x, y, i, PLAYER_COLORS[i]); }
  /* The things a hand can touch this frame, once a frame: [{ x, y, r }] (x, y shares of the picture, r in screen heights).
     A hand near one is drawn a little toward it. */
  targets(list){ this.feel.targets(list); }
  /* 0..1: how near a hand is to a target at (x, y) with radius r (screen heights), so the game can grow it by up to 8% and glow it. */
  near(x, y, r){ return this.feel.near(x, y, r); }

  /* level: each player's streak level, 0 none, 1 for x2, 2 for x3. */
  step(dt, players, levels = []){
    this.t += dt;
    for (let i = 0; i < MAX_PLAYERS; i++){
      this.glow[i] += ((levels[i] || 0) / 2 - this.glow[i]) * Math.min(1, dt * 4);
      this.flash[i] = Math.max(0, this.flash[i] - dt * 1.6);
    }
    /* the orbs follow the hands (smoothed), and a quick hand is heard */
    const list = [];
    for (const [i, h, side] of this._hands(players)){
      if (keepOut(h.x, h.y)) continue;
      list.push({ key: i + side, who: i, x: h.x, y: h.y, col: PLAYER_COLORS[i] });
    }
    this.feel.step(dt, list, (k) => { try { sfx.handWhoosh(k); } catch (e){ /* (no sound) */ } });
    for (const [i, hand] of this._hands(players)){
      if (hand.speed > SWIFT && Math.random() < dt * 40){
        this.sparks.push({ x: hand.x + (Math.random() - 0.5) * 0.01, y: hand.y + (Math.random() - 0.5) * 0.01,
                           vx: -(hand.vx || 0) * 0.08, vy: -(hand.vy || 0) * 0.08 + 0.05,
                           who: i, age: 0, life: 0.45, s: 0.6 + Math.random() * 0.6,
                           hue: this.glow[i] > 0.9 ? (Math.random() * 360) | 0 : null });
      }
    }
    for (const s of this.sparks){ s.age += dt; s.x += s.vx * dt; s.y += s.vy * dt; }
    this.sparks = this.sparks.filter(s => s.age < s.life);
    if (this.sparks.length > 220) this.sparks.splice(0, this.sparks.length - 220);
  }

  /* A streak: sparkles burst out of both of that player's hands. */
  burst(i, players){
    this.flash[i] = 1;
    for (const [who, hand] of this._hands(players)){
      if (who !== i) continue;
      for (let k = 0; k < 18; k++){
        const a = (k / 18) * 6.2832, sp = 0.25 + Math.random() * 0.25;
        this.sparks.push({ x: hand.x, y: hand.y, vx: Math.cos(a) * sp * 0.56, vy: Math.sin(a) * sp,
                           who, age: 0, life: 0.7, s: 1 + Math.random() * 0.6,
                           hue: (k * 20) % 360 });
      }
    }
  }

  _hands(players){
    const out = [];
    for (let i = 0; i < players; i++){
      const p = pose.players[i];
      if (!p || !p.present) continue;
      /* The mouse drives both hands at once; show it as one. */
      const hands = pose.mouse.active ? [['R', p.hands.right]] : [['L', p.hands.left], ['R', p.hands.right]];
      for (const [side, h] of hands) if (h && h.x >= -0.2 && h.x <= 1.2) out.push([i, h, side]);
    }
    return out;
  }

  /* lift: how far each player has floated up, in screen heights; alpha: how
     strongly the silhouettes show. looks(i): a player's avatar, to draw them
     as it - posed as they are - instead of a silhouette. */
  drawBodies(c, W, H, players, lift = [], alpha = 0.32, looks = null){
    const people = [];
    for (let i = 0; i < players; i++){
      const p = pose.players[i];
      if (p && p.present && p.lm) people.push([i, p.lm]);
    }
    if (!people.length) return;
    if (looks){
      for (const [i, lm] of people) figure(c, lm, W, H, looks(i), this.t + i * 1.7, { lift: (lift[i] || 0) * H });
      return;
    }

    /* Drawn solid onto a half-size layer and laid down translucent in one
       go, so where an arm crosses the body it doesn't show a darker seam -
       and the half size softens the edges for free. */
    const layer = this._layer(W, H);
    const lc = layer ? layer.getContext('2d') : c;
    const k = layer ? 0.5 : 1;
    if (layer) lc.clearRect(0, 0, layer.width, layer.height);
    for (const [i, lm] of people){
      lc.save(); lc.translate(0, -(lift[i] || 0) * H * k);
      silhouette(lc, lm, W * k, H * k, PLAYER_COLORS[i], layer ? 1 : alpha);
      lc.restore();
    }
    if (layer){
      c.globalAlpha = alpha;
      c.drawImage(layer, 0, 0, W, H);
      c.globalAlpha = 1;
    }
  }

  _layer(W, H){
    if (this.layer === false) return null;
    try {
      if (!this.layer){
        const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(1, 1)
                 : (typeof document !== 'undefined' && document.createElement) ? document.createElement('canvas') : null;
        if (!cv || !cv.getContext || !cv.getContext('2d')) { this.layer = false; return null; }
        this.layer = cv;
      }
      const w = Math.max(1, Math.round(W / 2)), h = Math.max(1, Math.round(H / 2));
      if (this.layer.width !== w || this.layer.height !== h){ this.layer.width = w; this.layer.height = h; }
      return this.layer;
    } catch (e){ this.layer = false; return null; }
  }

  /* the sparkles a quick hand throws (a trail), a little fainter by `fade` */
  _drawSparks(c, W, H, fade){
    for (const s of this.sparks){
      const k = s.age / s.life, r = H * 0.009 * s.s * (1 - k * 0.5);
      c.globalAlpha = (1 - k) * fade;
      c.fillStyle = s.hue == null ? PLAYER_COLORS[s.who] : `hsl(${s.hue} 95% 65%)`;
      star(c, s.x * W, s.y * H, r);
    }
    c.globalAlpha = 1;
  }

  drawMitts(c, W, H, players){
    /* (Settings > Testing > Hands on screen: only what is drawn changes) */
    const way = handsMode();
    if (way !== 'orb') return this._drawOtherWay(c, W, H, players, way);
    this._drawSparks(c, W, H, 0.7);
    /* (a game that never stepped them: the orbs start where the hands are) */
    const here = this._hands(players).filter(([, h]) => !keepOut(h.x, h.y));
    if (here.some(([i, , side]) => !this.feel.orbs.has(i + side)) && here.length){
      this.feel.step(1 / 60, here.map(([i, h, side]) => ({ key: i + side, who: i, x: h.x, y: h.y, col: PLAYER_COLORS[i] })));
    }
    /* The halo grows with the streak and flares on each new level. */
    this.feel.draw(c, W, H, (who) => ({ boost: this.glow[who] || 0, flash: this.flash[who] || 0 }));
  }
}

/* ---------- the other ways to show hands (handshow.js) ---------- */
Avatars.prototype._drawOtherWay = function(c, W, H, players, way){
  /* body: a faint outline of each player, on top but so see-through that the game still shows through it */
  if (way === 'body') this.drawBodies(c, W, H, players, [], 0.25);
  /* glow: the sparkle trail when a hand is quick; body: just a brighter glow */
  if (way === 'glow') this._drawSparks(c, W, H, 0.9);
  for (const [i, h] of this._hands(players)){
    const x = h.x * W, y = h.y * H, col = PLAYER_COLORS[i];
    const r = H * (way === 'body' ? 0.07 : 0.06) * (1 + this.glow[i] * 0.25 + this.flash[i] * 0.3);
    const g = c.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(col, way === 'body' ? 0.7 : 0.6)); g.addColorStop(0.45, hexA(col, way === 'body' ? 0.32 : 0.26)); g.addColorStop(1, hexA(col, 0));
    c.fillStyle = g;
    c.beginPath(); c.arc(x, y, r, 0, 6.2832); c.fill();
  }
};

export function silhouette(c, lm, W, H, col, alpha){
  const P = (i) => [lm[i].x * W, lm[i].y * H];
  const seen = (i) => (lm[i].v ?? 1) > 0.3;
  const sw = Math.hypot((lm[L.L_SHOULDER].x - lm[L.R_SHOULDER].x) * W, (lm[L.L_SHOULDER].y - lm[L.R_SHOULDER].y) * H);
  if (sw < 4) return;
  c.globalAlpha = alpha;
  c.fillStyle = col; c.strokeStyle = col; c.lineCap = 'round'; c.lineJoin = 'round';

  /* Torso, rounded off by stroking its own outline. */
  const torso = [L.L_SHOULDER, L.R_SHOULDER, L.R_HIP, L.L_HIP].map(P);
  c.lineWidth = sw * 0.35;
  c.beginPath(); torso.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.closePath();
  c.fill(); c.stroke();

  const limb = (a, b, d, w) => {
    if (!seen(a) || !seen(b)) return;
    c.lineWidth = w;
    c.beginPath(); c.moveTo(...P(a)); c.lineTo(...P(b));
    if (seen(d)) c.lineTo(...P(d));
    c.stroke();
  };
  limb(L.L_SHOULDER, L.L_ELBOW, L.L_WRIST, sw * 0.3);
  limb(L.R_SHOULDER, L.R_ELBOW, L.R_WRIST, sw * 0.3);
  limb(L.L_HIP, L.L_KNEE, L.L_ANKLE, sw * 0.38);
  limb(L.R_HIP, L.R_KNEE, L.R_ANKLE, sw * 0.38);

  /* Neck and head. */
  if (seen(L.NOSE)){
    const [nx, ny] = P(L.NOSE);
    const mx = (torso[0][0] + torso[1][0]) / 2, my = (torso[0][1] + torso[1][1]) / 2;
    c.lineWidth = sw * 0.3;
    c.beginPath(); c.moveTo(mx, my); c.lineTo(nx, ny); c.stroke();
    c.beginPath(); c.arc(nx, ny - sw * 0.08, sw * 0.42, 0, 6.2832); c.fill();
  }
  c.globalAlpha = 1;
}

function star(c, x, y, s){
  c.beginPath();
  for (let i = 0; i < 8; i++){
    const a = i * Math.PI / 4, d = i % 2 ? s * 0.38 : s;
    c.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  c.closePath(); c.fill();
}

function hexA(hex, a){
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}

/* Leaf Pile: an autumn afternoon. Leaves lie all over the grass and keep
   drifting down from the trees; sweep them with your hands into the pile in
   the middle. When the pile's big enough it's "Jump in!" - everyone jumps,
   and the pile bursts into the air and comes down all over again. Then you
   sweep it up again, bigger.

   Sweeping is a hand moving through the leaves: a leaf the hand passes
   over is pushed the way it was going. The leaves lie low, so it's a game
   of bending down and swooshing your arms - with a gentle pull toward the
   pile once a leaf is nearly there, so the youngest's sweeps land.

   Nothing to lose: no clock pressure, no wrong moves. Each player's count
   is the leaves they swept in. First person: the players are their hands. */
import { Juice } from './common.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { JumpWatch } from '../tracking/jump.js';
import { Scene, rgbOf } from './pop-party-scene.js';
import { Avatars } from '../ui/avatars.js';

export const ROUND = 150;
/* leaves in the pile before it's ready to jump in, the first time (each
   pile after that wants a few more) */
export const PILE_FULL = 24, PILE_MORE = 6;
/* a sweep: a hand moving at least this fast (screen widths a second)
   within REACH (screen heights) of a leaf pushes it */
export const SWEEP_SPEED = 0.3, REACH = 0.09;
/* if nobody jumps, the pile bursts by itself after this long */
export const JUMP_WAIT = 6;
/* where the pile sits (screen fractions), and how far its pull reaches */
export const PILE = { x: 0.5, y: 0.86 }, PULL = 0.28;
/* where leaves lie: knee to shin height, where bending hands reach */
const GROUND_TOP = 0.7, GROUND_BOTTOM = 0.9, START_LEAVES = 46, MAX_LEAVES = 90;
const COLS = ['#e0893b', '#d4643a', '#e8b44a', '#c9503a', '#d99a3b'];

export default {
  id: 'leaf-pile', name: 'Leaf Pile', stars: 1, accent: '#d9853b', secs: ROUND,
  moves: ['sweep', 'jump'],
  create(n){ return new LeafPile(n); }
};

const AUTUMN = {
  ground: {
    hills: ['#c8c07c', '#b9b06a', '#a8a05c'].map(rgbOf),
    leaf: rgbOf('#d9853b'), leafLit: rgbOf('#ecb35a'), leafShade: rgbOf('#a9522f'), trunk: rgbOf('#6e5644'),
    grass: [rgbOf('#8d8a46'), rgbOf('#c9c27e')],
    farPeak: rgbOf('#b9a690'), nearPeak: rgbOf('#a38a6c')
  },
  petals: COLS
};

class LeafPile {
  constructor(players){
    this.players = players;
    this.score = Array.from({ length: MAX_PLAYERS }, () => 0);
    this.leaves = [];
    for (let i = 0; i < START_LEAVES; i++) this._leaf(true);
    this.pile = 0; this.piles = 0; this.need = PILE_FULL;
    this.ready = 0;             /* seconds the pile's been ready to jump in (0: not ready) */
    this.jumped = new Set();
    this.burstT = 0;
    this.fallT = 1;
    this.t = 0; this.over = false;
    this.j = new Juice();
    this.jumps = new JumpWatch({ rise: 0.08, speed: 0.5 });
    this.scene = new Scene(AUTUMN);
    this.avatars = new Avatars();
    this.say = { text: 'Sweep the leaves into the pile!', t: 0 };
  }

  /* a leaf: lying on the grass (onGround), or falling from the trees */
  _leaf(onGround, x = Math.random(), y = null){
    if (this.leaves.length >= MAX_LEAVES){
      /* full: the lying leaf furthest from anyone playing makes way */
      const here = pose.players.slice(0, this.players).filter(p => p && p.present && p.centre).map(p => p.centre.x);
      if (!here.length) return;
      let worst = -1, far = -1;
      this.leaves.forEach((L, n) => { if (L.air) return; const d = Math.min(...here.map(hx => Math.abs(L.x - hx))); if (d > far){ far = d; worst = n; } });
      if (worst < 0) return;
      this.leaves.splice(worst, 1);
    }
    const away = Math.abs(x - PILE.x) < 0.12 ? (x < PILE.x ? -0.14 : 0.14) : 0;
    this.leaves.push({
      x: Math.min(0.98, Math.max(0.02, x + away)), y: y ?? (onGround ? GROUND_TOP + Math.random() * (GROUND_BOTTOM - GROUND_TOP) : -0.05),
      vx: 0, vy: 0, rot: Math.random() * 6.28, spin: 0, s: 0.8 + Math.random() * 0.5,
      col: COLS[(Math.random() * COLS.length) | 0], air: !onGround, rest: onGround ? 0 : GROUND_TOP + Math.random() * (GROUND_BOTTOM - GROUND_TOP),
      ph: Math.random() * 6.28, who: -1
    });
  }

  step(dt, W, H){
    this.t += dt; this.say.t += dt;
    this.j.step(dt);
    if (this.t >= ROUND) this.over = true;
    const aspect = W / H;

    /* leaves keep drifting down from the trees */
    this.fallT -= dt;
    if (this.fallT <= 0){
      this.fallT = 0.8 + Math.random() * 1.2;
      /* they come down near someone who's playing, within reach */
      const here = pose.players.slice(0, this.players).filter(p => p && p.present && p.centre);
      const near = here.length ? here[(Math.random() * here.length) | 0].centre.x + (Math.random() - 0.5) * 0.5 : Math.random();
      this._leaf(false, Math.min(0.95, Math.max(0.05, near)));
    }

    /* hands sweeping */
    const hands = [];
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (!p || !p.present) continue;
      for (const h of pose.mouse.active ? [p.hands.right] : [p.hands.left, p.hands.right]) if (h && h.speed > SWEEP_SPEED) hands.push([i, h]);
    }
    for (const L of this.leaves){
      if (L.inPile) continue;
      for (const [i, h] of hands){
        const dx = (L.x - h.x) * aspect, dy = L.y - h.y;
        if (dx * dx + dy * dy > REACH * REACH) continue;
        /* sweeping back the other way (away from the pile) barely moves them:
           children sweep back and forth, and only the way in should count */
        const inward = Math.sign(h.vx) === Math.sign(PILE.x - L.x) ? 1 : 0.25;
        L.vx = clampV(L.vx + h.vx * 0.9 * inward); L.vy = clampV(L.vy + h.vy * 0.5 * inward);
        if (!L.air && L.vy < 0){ L.air = true; L.rest = Math.min(GROUND_BOTTOM, Math.max(GROUND_TOP, L.y + 0.04)); }
        L.spin = (Math.random() - 0.5) * 12; L.who = i;
        if (Math.random() < 0.08) sfx.rustle?.();
      }
    }

    /* the leaves move: falling ones flutter down; pushed ones slide and slow */
    for (const L of this.leaves){
      if (L.inPile) continue;
      if (L.air){
        L.vy += 0.35 * dt; L.vy = Math.min(L.vy, 0.16);
        L.x += (L.vx + Math.sin(this.t * 2 + L.ph) * 0.03) * dt; L.y += L.vy * dt;
        L.vx *= Math.pow(0.4, dt);
        L.rot += (L.spin || 1.5) * dt;
        if (L.y >= L.rest && L.vy > 0){ L.y = L.rest; L.air = false; L.vy = 0; }
      } else {
        L.x += L.vx * dt; L.y += L.vy * dt * 0.3;
        L.vx *= Math.pow(0.15, dt); L.vy *= Math.pow(0.15, dt); L.rot += L.spin * dt; L.spin *= Math.pow(0.1, dt);
        L.y = Math.min(GROUND_BOTTOM, Math.max(GROUND_TOP, L.y));
      }
      if (L.x < -0.05 || L.x > 1.05){ L.x = Math.min(1.02, Math.max(-0.02, L.x)); L.vx = -L.vx * 0.3; }
      /* leaves at the very edges drift back in, where hands can reach them */
      if (!L.air && (L.x < 0.07 || L.x > 0.93)) L.x += (L.x < 0.5 ? 1 : -1) * 0.03 * dt;
      /* nearly there: a gentle pull in, so a toddler's sweep lands */
      const px = (PILE.x - L.x) * aspect, py = PILE.y - L.y, d = Math.hypot(px, py);
      const moving = Math.hypot(L.vx, L.vy) > 0.05;
      if (moving && d < PULL){ L.vx += (px / aspect) * dt * 2.5; L.vy += py * dt * 2.5; }
      /* lying right beside the pile: it creeps in by itself (the pile gathers
         what's at its edge - nobody's sweep, so nobody's count) */
      else if (!L.air && d < PULL * 0.6){ L.x += (px / aspect) / d * 0.05 * dt; L.y += py / d * 0.05 * dt; }
      /* in! */
      if (!this.ready && d < this._pileR()){
        L.inPile = true; this.pile++;
        if (L.who >= 0) this.score[L.who]++;
        sfx.pop?.(0.6 + Math.min(1, this.pile / this.need) * 0.6);
        if (this.pile >= this.need) this._full();
      }
    }
    this.leaves = this.leaves.filter(L => !L.inPile);
    /* leaves come back down after a burst; keep the lawn stocked */
    while (this.leaves.length < 18) this._leaf(true);

    /* ready to jump in: whoever jumps; a little wait, then it bursts anyway */
    if (this.ready){
      this.ready += dt;
      for (const i of this.jumps.step(dt, pose.players, this.players)){ this.jumped.add(i); sfx.spring?.(i * 3); }
      const here = pose.players.slice(0, this.players).filter(p => p.present).length;
      if ((here && this.jumped.size >= here) || this.ready > JUMP_WAIT) this._burst();
    } else this.jumps.step(dt, pose.players, this.players);
    this.burstT = Math.max(0, this.burstT - dt);

    this.scene.step(dt, { t: this.t, p: 0.65 + 0.3 * Math.min(1, this.t / ROUND), storm: false, wind: 0.01, joy: this.ready ? 1 : 0.4, look: 0.5, rainbow: false });
    this.avatars.step(dt, this.players);
  }

  _pileR(){ return 0.06 + Math.min(1, this.pile / this.need) * 0.08; }
  _full(){
    this.ready = 0.001; this.jumped.clear();
    this.say = { text: 'Jump in!', t: 0 };
    sfx.tada?.(0);
  }
  /* everyone jumped in: the pile bursts, and comes down all over */
  _burst(){
    this.piles++; this.ready = 0; this.burstT = 1.2;
    const n = Math.min(this.pile, 60);
    for (let k = 0; k < n; k++){
      this._leaf(false, PILE.x + (Math.random() - 0.5) * 0.1, PILE.y - 0.02);
      const L = this.leaves[this.leaves.length - 1];
      if (!L) break;
      L.vx = (Math.random() - 0.5) * 1.4; L.vy = -0.5 - Math.random() * 0.6; L.spin = (Math.random() - 0.5) * 14;
    }
    this.pile = 0; this.need += PILE_MORE;
    sfx.hooray?.(); sfx.whoosh?.();
    this.j.kick(10);
    this.say = { text: this.piles === 1 ? 'Wheee! Sweep them up again!' : 'Wheee!', t: 0 };
  }

  draw(c, W, H){
    this.scene.drawBack(c, W, H);
    const shook = this.j.applyShake ? this.j.applyShake(c) : false;
    /* leaves on the ground behind the pile, the pile, then the rest */
    const sorted = [...this.leaves].sort((a, b) => a.y - b.y);
    for (const L of sorted) if (!L.air && L.y < PILE.y) leaf(c, L.x * W, L.y * H, L.s * H / 900, L.rot, L.col);
    this._pile(c, W, H);
    for (const L of sorted) if (!L.air && L.y >= PILE.y) leaf(c, L.x * W, L.y * H, L.s * H / 900, L.rot, L.col);
    this.scene.drawFront(c, W, H);
    for (const L of this.leaves) if (L.air) leaf(c, L.x * W, L.y * H, L.s * H / 900, L.rot, L.col);
    if (shook) c.restore();
    this.avatars.drawMitts(c, W, H, this.players);
    this._say(c, W, H);
    this._meter(c, W, H);
  }

  /* the pile: a mound of leaves, growing; bouncing when it's ready */
  _pile(c, W, H){
    const k = Math.min(1, this.pile / this.need), r = (0.06 + k * 0.14) * H, cx = PILE.x * W, cy = PILE.y * H;
    const bounce = this.ready ? Math.abs(Math.sin(this.t * 6)) * H * 0.008 : 0;
    c.fillStyle = 'rgba(58,51,96,.16)'; c.beginPath(); c.ellipse(cx + r * 0.25, cy + r * 0.12, r * 1.6, r * 0.32, 0, 0, 6.2832); c.fill();
    const n = 20 + Math.round(k * 140);
    let sd = 7; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++){
      const a = R() * Math.PI, rr = Math.sqrt(R());
      leaf(c, cx + Math.cos(a) * r * 1.5 * rr, cy - Math.sin(a) * r * rr - bounce * rr, (1 + R() * 0.5) * H / 900, R() * 6.28, COLS[i % COLS.length]);
    }
  }

  _say(c, W, H){
    const k = Math.min(1, this.say.t / 0.25), size = Math.round(H * 0.04);
    const text = this.say.text;
    c.save(); c.font = `800 ${size}px Inter, Segoe UI, sans-serif`;
    const w = c.measureText(text).width + size * 1.6, x = W * 0.5, y = H * 0.19;
    c.globalAlpha = k; c.translate(x, y); c.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
    c.fillStyle = 'rgba(250,247,238,.95)'; c.beginPath(); c.roundRect(-w / 2, -size * 0.95, w, size * 1.9, size * 0.95); c.fill();
    c.fillStyle = '#33322e'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 0, 2);
    c.restore();
  }
  /* how big the pile is: a bar under the words */
  _meter(c, W, H){
    const w = W * 0.2, h = H * 0.022, x = W * 0.5 - w / 2, y = H * 0.25;
    c.fillStyle = 'rgba(250,247,238,.9)'; c.beginPath(); c.roundRect(x, y, w, h, h / 2); c.fill();
    const k = this.ready ? 1 : Math.min(1, this.pile / this.need);
    if (k > 0){ c.fillStyle = this.ready ? '#e8b44a' : '#e0893b'; c.beginPath(); c.roundRect(x + 3, y + 3, Math.max(h - 6, (w - 6) * k), h - 6, (h - 6) / 2); c.fill(); }
  }

  hud(){ return { score: this.score, showLives: false, hideScore: true }; }
  /* arms go up a lot (and in the jump); Back on the remote still pauses */
  pausable(){ return false; }
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
  value(){ return Math.max(0, ...this.score.slice(0, this.players)); }
}

const clampV = (v) => Math.max(-1.6, Math.min(1.6, v));

/* a leaf: pointed at both ends, lit on top, its shadow side underneath, a vein */
export function leaf(c, x, y, s, rot, col){
  c.save(); c.translate(x, y); c.rotate(rot);
  c.fillStyle = col;
  c.beginPath(); c.moveTo(-20 * s, 0); c.quadraticCurveTo(0, -14 * s, 22 * s, 0); c.quadraticCurveTo(0, 14 * s, -20 * s, 0); c.fill();
  c.fillStyle = 'rgba(58,51,96,.18)';
  c.beginPath(); c.moveTo(-20 * s, 0); c.quadraticCurveTo(0, 14 * s, 22 * s, 0); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(90,58,32,.45)'; c.lineWidth = 2 * s; c.beginPath(); c.moveTo(-24 * s, 0); c.lineTo(20 * s, 0); c.stroke();
  c.restore();
}

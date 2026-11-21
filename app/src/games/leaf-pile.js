/* Leaf Pile: an autumn afternoon. Leaves lie all over the grass and keep
   drifting down from the trees; sweep them with your hands into the pile in
   the middle. The pile grows slowly and steadily, a little with every leaf,
   from a small heap to a really big one - and only at the very end of the
   game is it "Jump in!": everyone jumps, and the whole pile bursts into the
   air and comes down all over you.

   Sweeping is a hand moving through the leaves: a leaf the hand passes
   over is pushed the way it was going. The leaves lie low, so it's a game
   of bending down and swooshing your arms - with a gentle pull toward the
   pile once a leaf is nearly there, so the youngest's sweeps land.

   Nothing to lose: no clock pressure, no wrong moves. Each player's count
   is the leaves they swept in. First person: the players are their hands. */
import { color, alpha } from './assets/palette.js';
import { Juice } from './common.js';
import { sayBubble, goalBar } from './hud.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { JumpWatch } from '../tracking/jump.js';
import { Scene, rgbOf } from './pop-party-scene.js';
import { Avatars } from '../ui/avatars.js';

export const ROUND = 180;
/* The pile is one pile for the whole game. Its size follows how many leaves are in it, slowly: GROW leaves make it
   about two thirds of its biggest, and it is still growing long after. BIG is the pile the goal bar's last star is for.
   Sweeping goes on until SWEEP_END; then it's "Jump in!", and after the burst the leaves come down for FINALE seconds. */
export const GROW = 70, BIG = 120;
export const SWEEP_END = ROUND - 24, FINALE = 6;
/* a sweep: a hand moving at least this fast (screen widths a second)
   within REACH (screen heights) of a leaf pushes it */
export const SWEEP_SPEED = 0.3, REACH = 0.09;
/* A sweep is one gentle push, not a swat: a leaf is pushed once (then not again for SWEEP_GAP seconds, however long
   the hand stays over it), at most MAX_SLIDE screen widths a second whatever the hand's speed, nudged toward the pile
   (STEER: how much of the push goes toward it), and only when the hand is going the pile's way. It slides along the
   ground - never up into the air. */
export const SWEEP_GAP = 0.5, MAX_SLIDE = 0.6, STEER = 0.5;
/* if nobody jumps, the pile bursts by itself after this long */
export const JUMP_WAIT = 6;
/* where the pile sits (screen fractions), and how far its pull reaches */
export const PILE = { x: 0.5, y: 0.86 }, PULL = 0.28;
/* where leaves lie: knee to shin height, where bending hands reach */
const GROUND_TOP = 0.7, GROUND_BOTTOM = 0.9, START_LEAVES = 46, MAX_LEAVES = 180;
const COLS = [color('autumn.amber'), color('fav.orange', 'shade'), color('fav.yellow', 'shade'), color('autumn.rust'), color('ui.gold', 'shade')];

/* (the words when the pile is big enough: the move card shows a jump while they're up) */
const JUMP_IN = '\u{1F342} Jump in!';

export default {
  id: 'leaf-pile', unit: 'leaves', name: 'Leaf Pile', stars: 1, accent: color('autumn.amber'), secs: ROUND,
  moves: ['sweep', 'jump'],
  create(n){ return new LeafPile(n); }
};

export const AUTUMN = {
  ground: {
    hills: ['autumn.straw', 'autumn.hay', 'autumn.hay'].map(n => rgbOf(color(n))),
    leaf: rgbOf(color('autumn.amber')), leafLit: rgbOf(color('ui.gold', 'shade')), leafShade: rgbOf(color('autumn.amber', 'shade')), trunk: rgbOf(color('earth.bark')),
    grass: [rgbOf(color('autumn.hay')), rgbOf(color('autumn.straw'))],
    farPeak: rgbOf(color('earth.sand', 'shade')), nearPeak: rgbOf(color('earth.sand', 'shade'))
  },
  petals: COLS
};

class LeafPile {
  constructor(players){
    this.players = players;
    this.score = Array.from({ length: MAX_PLAYERS }, () => 0);
    this.leaves = [];
    for (let i = 0; i < START_LEAVES; i++) this._leaf(true);
    this.pile = 0; this.piles = 0; this.peak = 0; this.finale = 0;      /* (piles: 1 once it has burst) */
    this.told = new Set();
    this.ready = 0;             /* seconds the pile's been ready to jump in (0: not ready) */
    this.jumped = new Set();
    this.burstT = 0;
    this.fallT = 1;
    this.t = 0; this.over = false;
    this.j = new Juice();
    this.jumps = new JumpWatch({ rise: 0.08, speed: 0.5 });
    this.scene = new Scene(AUTUMN);
    this.avatars = new Avatars();
    this.say = { text: '\u{1F342} Sweep to the pile!', t: 0 };
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
      this.fallT = 0.5 + Math.random() * 0.8;
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
      if (L.cool > 0) L.cool -= dt;
      for (const [i, h] of hands){
        const dx = (L.x - h.x) * aspect, dy = L.y - h.y;
        if (dx * dx + dy * dy > REACH * REACH) continue;
        /* once per sweep, and only the way in: children sweep back and forth, and the way out does nothing */
        if (L.cool > 0) continue;
        const toward = Math.sign(PILE.x - L.x);
        if (!h.vx || Math.sign(h.vx) !== toward) continue;
        const speed = Math.min(MAX_SLIDE, Math.abs(h.vx) * 0.9);
        /* the hand's way, bent toward the pile */
        const px = (PILE.x - L.x) * aspect, py = PILE.y - L.y, d = Math.hypot(px, py) || 1;
        const ux = (1 - STEER) * toward + STEER * (px / d), uy = STEER * (py / d), n = Math.hypot(ux, uy) || 1;
        L.vx = (ux / n) * speed; if (!L.air) L.vy = (uy / n) * speed;     /* (a leaf still fluttering down keeps falling) */
        L.cool = SWEEP_GAP;
        L.spin = (Math.random() - 0.5) * 6; L.who = i;
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
      if (!this.ready && !this.piles && d < this._pileR()){
        L.inPile = true; this.pile++;
        if (L.who >= 0) this.score[L.who]++;
        sfx.pop?.(0.5 + this._k() * 0.7);
        this._milestone();
      }
    }
    this.leaves = this.leaves.filter(L => !L.inPile);
    /* leaves come back down after a burst; keep the lawn stocked */
    while (this.leaves.length < 18) this._leaf(true);

    /* the end of the sweeping: now, at last, jump in */
    if (!this.ready && !this.piles && this.t >= SWEEP_END) this._full();
    /* ready to jump in: whoever jumps; a little wait, then it bursts anyway */
    if (this.ready){
      this.ready += dt;
      for (const i of this.jumps.step(dt, pose.players, this.players)){ this.jumped.add(i); sfx.spring?.(i * 3); }
      const here = pose.players.slice(0, this.players).filter(p => p.present).length;
      if ((here && this.jumped.size >= here) || this.ready > JUMP_WAIT) this._burst();
    } else this.jumps.step(dt, pose.players, this.players);
    this.burstT = Math.max(0, this.burstT - dt);
    /* after the burst, the leaves come down, and that's the end */
    if (this.piles && (this.finale += dt) >= FINALE) this.over = true;

    this.scene.step(dt, { t: this.t, p: 0.65 + 0.3 * Math.min(1, this.t / ROUND), storm: false, wind: 0.01, joy: this.ready ? 1 : 0.4, look: 0.5, rainbow: false });
    this.avatars.step(dt, this.players);
  }

  /* how big the pile is, 0 to 1: steady, a little with every leaf, never quite full */
  _k(){ return 1 - Math.exp(-this.pile / GROW); }
  /* how far from its middle a leaf has to be to count as in (screen heights) */
  _pileR(){ return 0.04 + this._k() * 0.22; }
  /* the words as it grows (each said once) */
  _milestone(){
    const says = [[BIG / 3, '\u{1F342} It\u2019s getting big!'], [BIG * 2 / 3, '\u{1F342} Huge! Keep going!'], [BIG, '\u{1F342} What a pile!']];
    for (const [n, text] of says) if (this.pile >= n && !this.told.has(n)){ this.told.add(n); this.say = { text, t: 0 }; sfx.twinkle?.(); }
  }
  _full(){
    this.ready = 0.001; this.jumped.clear();
    this.say = { text: JUMP_IN, t: 0 };
    sfx.tada?.(0);
  }
  /* everyone jumped in: the pile bursts, and comes down all over */
  _burst(){
    this.piles++; this.ready = 0; this.burstT = 1.2; this.finale = 0;
    const n = Math.min(this.pile, 140);
    for (let k = 0; k < n; k++){
      this._leaf(false, PILE.x + (Math.random() - 0.5) * 0.1, PILE.y - 0.02);
      const L = this.leaves[this.leaves.length - 1];
      if (!L) break;
      L.vx = (Math.random() - 0.5) * 1.4; L.vy = -0.5 - Math.random() * 0.6; L.spin = (Math.random() - 0.5) * 14;
    }
    this.peak = this.pile; this.pile = 0;
    sfx.hooray?.(); sfx.whoosh?.();
    this.j.kick(10);
    this.say = { text: '\u{1F342} Wheee!', t: 0 };
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
    const k = this._k(), r = (0.035 + k * 0.28) * H, cx = PILE.x * W, cy = PILE.y * H;
    const bounce = this.ready ? Math.abs(Math.sin(this.t * 6)) * H * 0.008 : 0;
    c.fillStyle = alpha('shade.shadow', 0.16); c.beginPath(); c.ellipse(cx + r * 0.25, cy + r * 0.12, r * 1.6, r * 0.32, 0, 0, 6.2832); c.fill();
    const n = 14 + Math.round(k * 230);
    let sd = 7; const R = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < n; i++){
      const a = R() * Math.PI, rr = Math.sqrt(R());
      leaf(c, cx + Math.cos(a) * r * 1.5 * rr, cy - Math.sin(a) * r * rr - bounce * rr, (1 + R() * 0.5) * H / 900, R() * 6.28, COLS[i % COLS.length]);
    }
  }

  _say(c, W, H){ sayBubble(c, W, H, { text: this.say.text, t: this.say.t }); }
  /* how big the pile is: a bar under the words */
  _meter(c, W, H){ goalBar(c, W, H, this.ready || this.piles ? 1 : Math.min(1, this.pile / BIG)); }

  /* the move card: which move the card in the corner shows right now, or null for none (show it when the game says to jump in) */
  card(){ return this.say.text === JUMP_IN && this.say.t < 6 ? 'jump' : null; }
  hud(){ return { score: this.score, showLives: false }; }
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
  c.fillStyle = alpha('shade.shadow', 0.18);
  c.beginPath(); c.moveTo(-20 * s, 0); c.quadraticCurveTo(0, 14 * s, 22 * s, 0); c.closePath(); c.fill();
  c.strokeStyle = alpha('earth.bark', 0.6, 'shade'); c.lineWidth = 2 * s; c.beginPath(); c.moveTo(-24 * s, 0); c.lineTo(20 * s, 0); c.stroke();
  c.restore();
}

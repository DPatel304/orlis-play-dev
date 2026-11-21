/* Save the Harvest: a co-op board game, in the spirit of the children's classic Orchard. Everyone works together: the family
   picks the fruit off the tree before a cheeky raven hops across the sky to the orchard.

   A round: the wheel spins and lands on apple, pear, strawberry or a raven's feather. For fruit, everyone does the move that
   picks it - reach up for apples, hop for pears, squat for strawberries - and when enough tries are in, two fruits fly into
   the basket. For the raven, everyone flaps to shoo him: he hops two steps closer, and the shooing sends him one step back.
   There is nothing to lose. If the raven reaches the tree he nibbles one fruit back onto the tree and hops home to start
   again (no game over, no telling-off); the game ends when the basket is full, and the raven gets the last apple as a treat.

   Moves are the body's, from the camera's landmarks, by the same detectors Animal Gym uses (with no landmarks - the mouse,
   in testing - a fast hand is a try). A try is a try: anyone's counts toward the same bar. */
import { color, alpha } from './assets/palette.js';
import { Juice } from './common.js';

import { sayBubble, goalBar } from './hud.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { JumpWatch } from '../tracking/jump.js';
import { triesOf } from './animal-gym.js';

export const FRUIT_EACH = 4, PER_PICK = 2, RAVEN_STEPS = 6, RAVEN_START = 1;
/* tries a round needs: this many per player present, and never fewer than the least */
export const TRIES_EACH = 2, TRIES_LEAST = 3;
export const SPIN = 2.4, MOVE_MAX = 11, RESULT = 2.2, END = 5;
/* which move picks what */
export const KINDS = {
  apple: { e: '\u{1F34E}', move: 'reach', text: '\u{1F34E} Reach for apples!' },
  pear:  { e: '\u{1F350}', move: 'jump',  text: '\u{1F350} Hop for pears!' },
  berry: { e: '\u{1F353}', move: 'squat', text: '\u{1F353} Squat for berries!' },
  raven: { e: '\u{1FAB6}', move: 'flap',  text: '\u{1FAB6} Flap! Shoo him!' }
};
const WHEEL = ['apple', 'pear', 'berry', 'raven', 'apple', 'raven'];
/* the tree's leaves: one green, and its shade by the rule */
const LEAF = color('meadow.fresh'), LEAF_SHADE = color('meadow.fresh', 'shade');
const WHEEL_COL = [color('touch.cherry', 'light'), color('touch.sunflower', 'light'), color('touch.bubblegum', 'light'), color('touch.grape', 'light'), color('touch.cherry', 'light'), color('touch.grape', 'light')];

export default {
  id: 'save-the-harvest', unit: 'fruit', name: 'Save the Harvest', stars: 1, accent: color('earth.brick'), secs: 300, endless: true,
  moves: ['reach', 'jump', 'squat', 'flap'], keepSitters: true,
  create(n){ return new SaveTheHarvest(n); }
};

/* the world is drawn 1280 by 720 and scaled to fit */
const VW = 1280, VH = 720;
const TREE = [560, 450], BASKET = [1010, 560];
const RAVEN = [[1200, 120], [1100, 165], [1000, 125], [900, 185], [820, 150], [760, 205], [690, 235]];     /* 0 .. RAVEN_STEPS: the last is the tree */
/* where each kind hangs: apples high, pears in the middle of the crown, strawberries in the grass */
const SLOTS = {
  apple: [[-110, -125], [-20, -165], [80, -135], [140, -70]],
  pear: [[-150, -30], [-60, -70], [40, -45], [120, 10]],
  berry: [[-190, 165], [-110, 180], [110, 170], [200, 165]]
};
const ease = (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));

class SaveTheHarvest {
  constructor(players){
    this.players = players;
    this.score = Array.from({ length: MAX_PLAYERS }, () => 0);
    this.t = 0; this.over = false;
    this.picked = { apple: 0, pear: 0, berry: 0 };      /* in the basket */
    this.taken = { apple: 0, pear: 0, berry: 0 };       /* off the tree (some still flying) */
    this.flights = [];
    this.raven = RAVEN_START; this.ravenShown = RAVEN_START;
    this.kind = null; this.last = null; this.phase = 'spin'; this.pt = 0;
    this.tries = 0; this.need = TRIES_LEAST; this.win = false; this.snack = 0;
    this.st = Array.from({ length: MAX_PLAYERS }, () => ({}));
    this.jw = new JumpWatch({ rise: 0.08, speed: 0.5 });
    this.j = new Juice();
    this.say = { text: '\u{1F3B2} Spin the wheel!', t: 0 };
    this._spin();
  }

  /* what the wheel lands on: a kind that still has fruit, or the raven - never the raven twice running */
  _spin(){
    const open = ['apple', 'pear', 'berry'].filter(k => this.taken[k] < FRUIT_EACH);
    const pool = [...open, ...open, ...(this.last === 'raven' ? [] : ['raven', ...(open.length > 1 ? ['raven'] : [])])];
    this.kind = pool[Math.floor(Math.random() * pool.length)];
    this.last = this.kind;
    this.sector = WHEEL.map((k, i) => k === this.kind ? i : -1).filter(i => i >= 0);
    this.sector = this.sector[Math.floor(Math.random() * this.sector.length)];
    this.phase = 'spin'; this.pt = 0; this.tries = 0; this.fill = 0;
    this._say('\u{1F3B2} Spin the wheel!');
  }
  _say(text){ this.say = { text, t: 0 }; }
  _present(){ return pose.players.slice(0, this.players).filter(p => p && p.present).length; }

  step(dt, W, H){
    this.t += dt; this.pt += dt; this.say.t += dt;
    this.j.step(dt);
    /* the raven and the fruit move smoothly towards where they should be */
    this.ravenShown += (this.raven - this.ravenShown) * Math.min(1, dt * 3);
    for (const f of this.flights) f.age += dt;
    for (const f of this.flights.filter(f => f.age >= f.len)){ this.picked[f.kind] = Math.min(FRUIT_EACH, this.picked[f.kind] + 1); sfx.pop?.(0.8); }
    this.flights = this.flights.filter(f => f.age < f.len);

    if (this.phase === 'spin' && this.pt >= SPIN){
      this.phase = 'move'; this.pt = 0; this.tries = 0; this.fill = 0;
      this.need = Math.max(TRIES_LEAST, TRIES_EACH * this._present());
      this.st.forEach(s => { for (const k of Object.keys(s)) delete s[k]; });
      this._say(KINDS[this.kind].text);
      if (this.kind === 'raven'){ this.raven = Math.min(RAVEN_STEPS, this.raven + 2); sfx.startle?.(); }
      sfx.whoosh?.();
    }
    else if (this.phase === 'move') this._move(dt, W, H);
    else if (this.phase === 'result' && this.pt >= RESULT) this._after();
    else if (this.phase === 'snack' && this.pt >= 2.4) this._after(true);
    else if (this.phase === 'end' && this.pt >= END) this.over = true;
  }

  /* everyone does the move: every try, by anyone, fills the same bar */
  _move(dt, W, H){
    const move = KINDS[this.kind].move, present = this._present();
    const jumpers = move === 'jump' ? this.jw.step(dt, pose.players, this.players) : [];
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      let n = move === 'jump' ? (jumpers.includes(i) ? 1 : 0) : triesOf(move, p, this.st[i], dt);
      if (move === 'jump' && p && p.present && !p.lm) n = triesOf('jump', p, this.st[i], dt);   /* (with no landmarks a jump is a fast hand) */
      if (!n) continue;
      this.score[i] += n; this.tries += n;
      const c = p.centre || { x: 0.5, y: 0.5 };
      this.j.pop(c.x * W, (c.y - 0.15) * H, '+1', PLAYER_COLORS[i]);
      sfx.pop?.(0.5 + this.fill * 0.6);
    }
    this.fill = clamp(this.tries / this.need);
    if (this.fill >= 1 || this.pt >= MOVE_MAX) this._result(present);
  }

  /* the move's done (or the time's up): what happened */
  _result(){
    const ok = this.fill >= 0.5;                         /* a good effort is enough; a whole lot of nothing tries again */
    this.phase = 'result'; this.pt = 0; this.ok = ok;
    if (this.kind === 'raven'){
      if (ok){ this.raven = Math.max(RAVEN_START, this.raven - 1); sfx.whoosh?.(); this._say('\u{1F4A8} Shoo! He hops back'); }
      else this._say('\u{1F4A2} He’s coming closer!');
      return;
    }
    if (!ok){ this._say('\u{1F4AA} Let’s try again!'); return; }
    const k = this.kind, left = FRUIT_EACH - this.taken[k], n = Math.min(PER_PICK, left);
    for (let i = 0; i < n; i++) this.flights.push({ kind: k, slot: this.taken[k] + i, age: -i * 0.18, len: 1.1 });
    this.taken[k] += n;
    this.j.kick(4); sfx.hooray?.();
    this._say('\u{1F9FA} Into the basket!');
  }

  _after(snacked = false){
    if (this.taken.apple + this.taken.pear + this.taken.berry >= FRUIT_EACH * 3 && !this.flights.length && !this.win){
      this.win = true; this.phase = 'end'; this.pt = 0; this._say('\u{1F389} Harvest saved!'); sfx.fanfare?.(); return;
    }
    /* the raven made it to the tree: he nibbles one fruit back on, then hops home to try again */
    if (!snacked && this.raven >= RAVEN_STEPS){
      const have = ['apple', 'pear', 'berry'].filter(k => this.taken[k] > 0 && this.picked[k] > 0);
      if (have.length){ const k = have[Math.floor(Math.random() * have.length)]; this.taken[k]--; this.picked[k]--; }
      this.phase = 'snack'; this.pt = 0; this._say('\u{1F60B} The raven took a nibble!'); sfx.uhoh?.(); return;
    }
    if (snacked) this.raven = RAVEN_START;
    this._spin();
  }

  /* ---------- the picture ---------- */
  draw(c, W, H){
    const s = Math.min(W / VW, H / VH), ox = (W - VW * s) / 2, oy = (H - VH * s) / 2;
    /* sky and meadow fill the whole screen */
    const gr = c.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, color('sky.high')); gr.addColorStop(0.3, color('sky.low')); gr.addColorStop(0.31, color('meadow.lawn')); gr.addColorStop(1, color('meadow.fresh'));
    c.fillStyle = gr; c.fillRect(0, 0, W, H);
    const shook = this.j.applyShake ? this.j.applyShake(c) : false;
    c.save(); c.translate(ox, oy); c.scale(s, s);
    this._world(c);
    c.restore();
    this.j.draw(c, H);
    if (shook) c.restore();
    sayBubble(c, W, H, { text: this.say.text, t: this.say.t });
    goalBar(c, W, H, (this.picked.apple + this.picked.pear + this.picked.berry) / (FRUIT_EACH * 3));
  }

  _emoji(c, e, x, y, size, rot = 0, a = 1){
    c.save(); c.globalAlpha *= a; c.translate(x, y); if (rot) c.rotate(rot);
    c.fillStyle = color('shade.ink');          /* (a colour emoji takes the fill's transparency) */
    c.font = `${size}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(e, 0, 0); c.restore();
  }

  _world(c){
    const t = this.t;
    c.fillStyle = alpha('earth.snow', 0.55);
    for (let i = 0; i < 3; i++){ const x = (i * 470 + t * 7) % 1500 - 100; c.beginPath(); c.roundRect(x, 60 + i * 16, 150, 34, 17); c.fill(); }
    c.fillStyle = color('meadow.fresh'); c.beginPath(); c.moveTo(-40, 330);
    for (let x = -40; x <= VW + 40; x += 20) c.lineTo(x, 290 + 26 * Math.sin(x / 180 + 1));
    c.lineTo(VW + 40, VH + 40); c.lineTo(-40, VH + 40); c.fill();
    /* the raven's road: stepping stones across the sky to the tree */
    c.strokeStyle = alpha('earth.snow', 0.5); c.lineWidth = 4; c.setLineDash([4, 12]); c.lineCap = 'round'; c.beginPath();
    RAVEN.forEach((p, i) => i ? c.lineTo(p[0], p[1] + 34) : c.moveTo(p[0], p[1] + 34)); c.stroke(); c.setLineDash([]);
    for (let i = 0; i < RAVEN.length - 1; i++){ c.fillStyle = alpha('earth.snow', 0.7); c.beginPath(); c.ellipse(RAVEN[i][0], RAVEN[i][1] + 34, 20, 9, 0, 0, 7); c.fill(); }
    /* the tree */
    c.fillStyle = color('fur.brown'); c.beginPath();
    c.moveTo(TREE[0] - 34, 640); c.quadraticCurveTo(TREE[0] - 18, 540, TREE[0] - 24, TREE[1]); c.lineTo(TREE[0] + 26, TREE[1]); c.quadraticCurveTo(TREE[0] + 22, 540, TREE[0] + 40, 640); c.closePath(); c.fill();
    for (const [dx, dy, r, col] of [[-120, -60, 120, LEAF_SHADE], [130, -60, 115, LEAF], [0, -130, 125, LEAF], [-10, -10, 130, LEAF], [-150, 40, 90, LEAF_SHADE], [150, 40, 92, LEAF_SHADE]]){
      c.fillStyle = col; c.beginPath(); c.arc(TREE[0] + dx, TREE[1] + dy, r, 0, 7); c.fill();
    }
    c.fillStyle = alpha('shade.shadow', 0.2); c.beginPath(); c.ellipse(TREE[0], 650, 200, 28, 0, 0, 7); c.fill();
    /* the fruit still on the tree - the kind being picked trembles */
    for (const k of ['apple', 'pear', 'berry']){
      SLOTS[k].forEach((p, i) => {
        if (i < this.taken[k]) return;
        const shake = this.phase === 'move' && this.kind === k ? Math.sin(t * 10 + i) * 3 : 0;
        const bob = k === 'berry' ? 0 : Math.sin(t * 2 + i + k.length) * 3;
        this._emoji(c, KINDS[k].e, TREE[0] + p[0] + shake, TREE[1] + p[1] + bob, k === 'berry' ? 44 : 50);
      });
      /* ...and the ones in the air, on their way to the basket */
      for (const f of this.flights){
        if (f.kind !== k || f.age < 0) continue;
        const p = SLOTS[k][f.slot % 4], x0 = TREE[0] + p[0], y0 = TREE[1] + p[1], q = ease(clamp(f.age / f.len));
        this._emoji(c, KINDS[k].e, x0 + (BASKET[0] - x0) * q, y0 + (BASKET[1] - 30 - y0) * q - Math.sin(q * Math.PI) * 90, 50);
      }
    }
    /* the basket, with what's in it */
    c.save(); c.translate(BASKET[0], BASKET[1]);
    c.fillStyle = color('earth.clay'); c.beginPath();
    c.moveTo(-90, -20); c.lineTo(-70, 60); c.quadraticCurveTo(0, 80, 70, 60); c.lineTo(90, -20); c.closePath(); c.fill();
    let n = 0;
    for (const k of ['apple', 'pear', 'berry']) for (let i = 0; i < this.picked[k]; i++){ this._emoji(c, KINDS[k].e, -62 + (n % 6) * 25, -38 - Math.floor(n / 6) * 20 - (n % 2) * 6, 38); n++; }
    c.fillStyle = color('earth.clay'); c.beginPath(); c.roundRect(-100, -34, 200, 24, 12); c.fill(); c.restore();
    this._raven(c);
    if (this.phase === 'spin') this._wheel(c);
  }

  /* the raven: flat, friendly, a big eye; he hops along his stones, flaps harder when he's being shooed, and at the end flies down for the last apple */
  _raven(c){
    const t = this.t, rs = clamp(this.ravenShown, 0, RAVEN_STEPS), i = Math.min(RAVEN_STEPS - 1, Math.floor(rs)), f = rs - i;
    let x = RAVEN[i][0] + (RAVEN[i + 1][0] - RAVEN[i][0]) * f, y = RAVEN[i][1] + (RAVEN[i + 1][1] - RAVEN[i][1]) * f + Math.sin(t * 6) * 5;
    let flap = Math.sin(t * (this.phase === 'move' && this.kind === 'raven' ? 16 : 7)) * 0.5 + 0.5;
    if (this.phase === 'end'){ const k = ease(clamp(this.pt / 2.6)); x += (BASKET[0] - 30 - x) * k; y += (BASKET[1] - 120 - y) * k; flap = Math.sin(t * 14) * 0.5 + 0.5; }
    if (this.phase === 'snack'){ x = TREE[0] + 90; y = TREE[1] - 150 + Math.sin(t * 8) * 4; flap = Math.sin(t * 12) * 0.5 + 0.5; }
    c.save(); c.translate(x, y); c.scale(0.9, 0.9); c.lineJoin = 'round'; c.strokeStyle = color('shade.ink'); c.lineWidth = 5; c.fillStyle = color('fur.charcoal');
    c.beginPath(); c.ellipse(0, 0, 44, 30, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-6, -8); c.quadraticCurveTo(6, -46 - flap * 30, 58, -26 - flap * 30); c.quadraticCurveTo(28, -10, 10, 2); c.closePath(); c.fillStyle = color('shade.inkSoft'); c.fill(); c.stroke();
    c.beginPath(); c.arc(-34, -18, 20, 0, 7); c.fillStyle = color('fur.charcoal'); c.fill(); c.stroke();
    c.fillStyle = color('earth.peach'); c.beginPath(); c.moveTo(-52, -18); c.lineTo(-72, -10); c.lineTo(-52, -8); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = color('earth.snow'); c.beginPath(); c.arc(-38, -24, 7, 0, 7); c.fill(); c.fillStyle = color('shade.ink'); c.beginPath(); c.arc(-40, -24, 3.5, 0, 7); c.fill();
    c.restore();
    if (this.phase === 'end' && this.pt > 2.6) this._emoji(c, KINDS.apple.e, BASKET[0] + 30, BASKET[1] - 110, 40);
  }

  _wheel(c){
    const R = 130, cx = VW / 2 + 60, cy = 420, k = clamp(this.pt / SPIN), a = this.pt < SPIN - 0.5 ? 1 : 1 - (this.pt - (SPIN - 0.5)) / 0.5;
    const rest = -Math.PI / 2 - (this.sector + 0.5) * (Math.PI * 2 / 6), ang = rest - (1 - ease(clamp(this.pt / 2))) * Math.PI * 6;
    c.save(); c.globalAlpha = Math.max(0, a); c.translate(cx, cy);
    c.shadowColor = alpha('shade.shadow', 0.4); c.shadowBlur = 24; c.shadowOffsetY = 10; c.fillStyle = color('earth.snow'); c.beginPath(); c.arc(0, 0, R + 14, 0, 7); c.fill(); c.shadowBlur = 0; c.shadowOffsetY = 0;
    c.rotate(ang);
    WHEEL.forEach((kind, i) => {
      const a0 = i * Math.PI * 2 / 6, a1 = (i + 1) * Math.PI * 2 / 6;
      c.fillStyle = WHEEL_COL[i]; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, R, a0, a1); c.closePath(); c.fill(); c.strokeStyle = color('shade.ink'); c.lineWidth = 4; c.stroke();
      c.save(); c.rotate((a0 + a1) / 2); this._emoji(c, KINDS[kind].e, R * 0.62, 0, 50, Math.PI / 2); c.restore();
    });
    c.restore();
    c.save(); c.globalAlpha = Math.max(0, a); c.fillStyle = color('shade.ink'); c.beginPath(); c.moveTo(cx, cy - R - 30); c.lineTo(cx - 18, cy - R - 2); c.lineTo(cx + 18, cy - R - 2); c.closePath(); c.fill(); c.restore();
    void k;
  }

  /* the move card: the move this round asks for, while it's being done */
  card(){ return this.phase === 'move' ? KINDS[this.kind].move : null; }
  /* the game's own corner: how close the raven is (a bar, full when he's at the tree) */
  hud(){
    return { score: this.score, showLives: false, hideScore: true, hideClock: true,
      panel: [{ icon: '\u{1FAB6}', fill: clamp((this.ravenShown - RAVEN_START) / (RAVEN_STEPS - RAVEN_START)), color: 'rose' }] };
  }
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++){
      if (!this.score[i] && !pose.players[i].present) continue;
      rows.push({ label: `Player ${i + 1}`, value: this.score[i], color: PLAYER_COLORS[i] });
    }
    return rows;
  }
  /* a team game: nobody wins against anybody */
  winner(){ return this.players >= 2 ? 0 : null; }
  value(){ return this.picked.apple + this.picked.pear + this.picked.berry; }
  summary(){ return this.win ? 'You saved the whole harvest together!' : null; }
}

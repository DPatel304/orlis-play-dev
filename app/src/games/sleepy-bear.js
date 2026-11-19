/* Sleepy Bear: freeze dance, with a bear.

   Music plays and everyone dances. Then the music stops dead and it's
   "Freeze!": the bear in the cave on the hill opens one eye and peeks.
   Hold still and frost gathers on your hands, and you earn a star. Wobble,
   and the bear grumbles and rolls over to sleep again - funny, never a
   telling-off, and nothing is lost. Then the music's back.

   For the very youngest: no reading (the pictures say it all - notes
   bouncing, notes frozen, the bear's eye), nothing to avoid, no way out.
   First person, like every Orlis game: the players are their glowing hands.

   How still is still: each player's movement is how fast their body's
   points (head, shoulders, wrists, hips) are going - the two fastest, so
   waving just your arms counts - in screen widths a second, smoothed a
   little; the camera's jitter is well under STILL. */
import { Juice, clamp } from './common.js';
import { sayBubble } from './hud.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { sfx, music } from '../audio/sound.js';
import { Scene } from './pop-party-scene.js';
import { Avatars } from '../ui/avatars.js';

export const ROUND = 180;
/* how long the dancing goes between freezes (a range, so it can't be
   timed), how long a freeze lasts, and the grace at its start - nobody
   stops on the exact beat */
export const DANCE = [6, 11], FREEZE = [3.5, 5], GRACE = 0.7;
/* movement, in screen widths a second: under STILL is frozen, over WOBBLE
   is a wobble the bear notices (between: nearly - no frost yet, no grumble) */
export const STILL = 0.06, WOBBLE = 0.2;
/* the first dance is longer, to get going */
const FIRST_DANCE = 9;
const POINTS = [0, 11, 12, 15, 16, 23, 24];

export default {
  id: 'sleepy-bear', unit: 'stars', name: 'Sleepy Bear', stars: 1, accent: '#a0704a', secs: ROUND,
  moves: ['dance'],
  create(n){ return new SleepyBear(n); }
};

/* How much a player is moving, from their landmarks between two frames
   (or their hands, when there are no landmarks - the mouse). */
export function motionOf(p, prev, dt){
  if (!p || !p.present) return 0;
  if (p.lm && prev){
    /* the two fastest points: waving just your arms is still moving */
    const v = [];
    for (const i of POINTS){ const a = p.lm[i], b = prev[i]; if (a && b) v.push(Math.hypot(a.x - b.x, a.y - b.y)); }
    if (!v.length) return 0;
    v.sort((a, b) => b - a);
    const top = v.slice(0, 2);
    return top.reduce((a, b) => a + b, 0) / top.length / Math.max(dt, 1 / 120);
  }
  const h = p.hands || {};
  return Math.max((h.left && h.left.speed) || 0, (h.right && h.right.speed) || 0);
}

class SleepyBear {
  constructor(players){
    this.players = players;
    const each = (v) => Array.from({ length: MAX_PLAYERS }, () => v);
    this.score = each(0);          /* stars: good freezes */
    this.move = each(0);           /* smoothed movement */
    this.frost = each(0);          /* 0..1: how frozen their hands look */
    this.caught = each(false);     /* wobbled this freeze */
    this.prev = each(null);
    this.t = 0; this.over = false;
    this.phase = 'dance'; this.left = FIRST_DANCE; this.inPhase = 0;
    this.bear = { eye: 0, roll: 0, grumble: 0, wake: 0, snore: 2 };
    this.notes = [];
    this.noteT = 0;
    this.say = { text: '\u{1F483} Dance!', t: 0 };
    this.j = new Juice();
    this.scene = new Scene();
    this.avatars = new Avatars();
  }

  step(dt, W, H){
    this.t += dt;
    this.j.step(dt);
    this.inPhase += dt;
    this.say.t += dt;

    /* everyone's movement */
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      const m = motionOf(p, this.prev[i], dt);
      this.prev[i] = p && p.present && p.lm ? p.lm.map(k => ({ x: k.x, y: k.y })) : null;
      this.move[i] += (m - this.move[i]) * Math.min(1, dt * 6);
      if (!p || !p.present) this.move[i] = 0;
    }

    if (this.t >= ROUND && !this.over){ this.over = true; music.hold(false); }

    this.left -= dt;
    if (this.phase === 'dance'){
      /* notes bob up with the music; the bear snores */
      this.noteT -= dt;
      if (this.noteT <= 0){ this.noteT = 0.45 + Math.random() * 0.3; this.notes.push({ x: 0.15 + Math.random() * 0.55, y: 0.75, vy: -0.09 - Math.random() * 0.04, ph: Math.random() * 6, age: 0 }); }
      this.bear.snore -= dt;
      if (this.bear.snore <= 0){ this.bear.snore = 3 + Math.random() * 2; sfx.snore?.(); }
      for (let i = 0; i < this.players; i++) this.frost[i] = Math.max(0, this.frost[i] - dt * 2);
      if (this.left <= 0 && !this.over) this._freeze();
    } else {
      const graced = this.inPhase > GRACE;
      /* the bear's eye opens */
      this.bear.eye = Math.min(1, this.bear.eye + dt * 3);
      for (let i = 0; i < this.players; i++){
        const p = pose.players[i];
        if (!p || !p.present || !graced) continue;
        if (this.caught[i]) continue;
        if (this.move[i] < STILL) this.frost[i] = Math.min(1, this.frost[i] + dt * 0.9);
        else if (this.move[i] > WOBBLE){ this._wobble(i); }
      }
      if (this.left <= 0) this._dance();
    }

    /* the notes: rising and swaying while the music plays, stopped dead in a freeze */
    for (const n of this.notes){
      if (this.phase === 'dance'){ n.age += dt; n.y += n.vy * dt; }
    }
    this.notes = this.notes.filter(n => n.y > 0.08 && n.age < 7);

    const b = this.bear;
    if (this.phase === 'dance') b.eye = Math.max(0, b.eye - dt * 2.5);
    b.grumble = Math.max(0, b.grumble - dt);
    b.roll = Math.max(0, b.roll - dt * 0.8);
    b.wake = this.over ? Math.min(1, b.wake + dt) : 0;

    this.scene.step(dt, { t: this.t, p: Math.min(1, this.t / ROUND), storm: false, wind: 0.004, joy: this.phase === 'dance' ? 0.6 : 0.2, look: 0.5, rainbow: this.over });
    this.avatars.step(dt, this.players);
  }

  _freeze(){
    this.phase = 'freeze'; this.inPhase = 0;
    this.left = FREEZE[0] + Math.random() * (FREEZE[1] - FREEZE[0]);
    this.caught.fill(false);
    music.hold(true);
    sfx.startle?.();
    this.say = { text: 'Freeze!', t: 0 };
  }
  _dance(){
    /* everyone who held still gets a star */
    let still = 0;
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (p && p.present && !this.caught[i] && this.frost[i] > 0.6){ this.score[i]++; still++; }
    }
    if (still) sfx.gold?.(); else sfx.yawn?.();
    this.phase = 'dance'; this.inPhase = 0;
    this.left = DANCE[0] + Math.random() * (DANCE[1] - DANCE[0]);
    music.hold(false);
    this.say = { text: still ? 'Hooray! Dance!' : '\u{1F483} Dance!', t: 0 };
  }
  _wobble(i){
    this.caught[i] = true; this.frost[i] = 0;
    const b = this.bear;
    if (b.grumble <= 0){ b.grumble = 1.2; b.roll = 1; sfx.grumble?.(); }
    this.say = { text: 'Wobble! Hrrmph…', t: 0 };
  }

  draw(c, W, H){
    this.scene.drawBack(c, W, H);
    this._cave(c, W, H);
    this._notes(c, W, H);
    this.scene.drawFront(c, W, H);
    /* the hands: glowing mitts, with frost round them when frozen */
    this.avatars.drawMitts(c, W, H, this.players);
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i];
      if (!p || !p.present || this.frost[i] < 0.05) continue;
      const hands = pose.mouse.active ? [p.hands.right] : [p.hands.left, p.hands.right];
      for (const h of hands) frost(c, h.x * W, h.y * H, H * 0.03, this.frost[i], this.t);
    }
    this._say(c, W, H);
  }

  /* the bear's hill, with the cave and the bear in it, on the right */
  _cave(c, W, H){
    const cx = W * 0.78, base = H * 0.72, s = H / 900;
    c.fillStyle = '#86ad6f';
    c.beginPath(); c.ellipse(cx, base, W * 0.26, H * 0.33, 0, Math.PI, 0); c.fill();
    c.save(); c.beginPath(); c.ellipse(cx, base, W * 0.26, H * 0.33, 0, Math.PI, 0); c.clip();
    c.fillStyle = '#759e60'; c.beginPath(); c.ellipse(cx + W * 0.2, base - H * 0.05, W * 0.18, H * 0.4, 0, 0, Math.PI * 2); c.fill(); c.restore();
    c.fillStyle = '#3b3a36'; c.beginPath(); c.ellipse(cx - W * 0.01, base, 190 * s, 170 * s, 0, Math.PI, 0); c.fill();
    const b = this.bear;
    /* rolling over: a tip to the side and back */
    const tip = Math.sin(b.roll * Math.PI) * 0.35;
    c.save(); c.translate(cx - W * 0.01, base - 80 * s); c.rotate(tip);
    bearHead(c, 0, 0, 0.85 * s, b, this.t);
    c.restore();
    c.fillStyle = '#8a5a3b'; for (const d of [-1, 1]){ c.beginPath(); c.ellipse(cx - W * 0.01 + d * 120 * s, base - 2 * s, 46 * s, 22 * s, 0, 0, Math.PI * 2); c.fill(); }
    /* asleep: Zzz */
    if (this.phase === 'dance' && !this.over){
      c.fillStyle = 'rgba(60,60,90,.5)'; c.textAlign = 'left'; c.textBaseline = 'alphabetic';
      for (let k = 0; k < 3; k++){
        const a = ((this.t * 0.35 + k / 3) % 1);
        c.globalAlpha = Math.sin(a * Math.PI) * 0.8;
        c.font = `800 ${Math.round((26 + k * 8) * s)}px Inter, sans-serif`;
        c.fillText('z', cx + (110 + a * 80 + k * 10) * s, base - (200 + a * 140) * s);
      }
      c.globalAlpha = 1;
    }
  }

  _notes(c, W, H){
    const frozen = this.phase === 'freeze';
    c.fillStyle = frozen ? 'rgba(120,170,220,.75)' : 'rgba(90,80,140,.55)';
    for (const n of this.notes){
      const x = (n.x + (frozen ? 0 : Math.sin(n.age * 2.5 + n.ph) * 0.012)) * W, y = n.y * H, r = H * 0.02;
      c.beginPath(); c.ellipse(x, y, r, r * 0.72, -0.4, 0, Math.PI * 2); c.fill();
      c.fillRect(x + r * 0.75, y - r * 3.4, r * 0.32, r * 3.4);
    }
  }

  _say(c, W, H){ sayBubble(c, W, H, { text: (this.phase === 'freeze' && this.say.text === 'Freeze!' ? '\u2744 ' : '') + this.say.text, t: this.say.t }); }


  /* the move card: which move the card in the corner shows right now, or null for none (dancing, then frozen) */
  card(){ return this.phase === 'dance' ? 'dance' : 'freeze'; }
  hud(){ return { score: this.score, showLives: false }; }
  /* both hands up is a dance move here; Back on the remote still pauses */
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

/* the bear: asleep (eye 0), one eye peeking (eye 1), grumbling (frown),
   wide awake and waving goodbye at the end (wake) */
export function bearHead(c, x, y, s, b, t){
  const fur = '#8a5a3b', dark = '#6e452c', muzzle = '#d9b48c', ink = '#33322e';
  for (const d of [-1, 1]){ c.fillStyle = fur; c.beginPath(); c.arc(x + d * 95 * s, y - 85 * s, 42 * s, 0, Math.PI * 2); c.fill(); c.fillStyle = '#c99a72'; c.beginPath(); c.arc(x + d * 95 * s, y - 85 * s, 22 * s, 0, Math.PI * 2); c.fill(); }
  const head = () => { c.beginPath(); c.ellipse(x, y, 140 * s, 120 * s, 0, 0, Math.PI * 2); };
  c.fillStyle = fur; head(); c.fill();
  c.save(); head(); c.clip(); c.fillStyle = dark; c.beginPath(); c.ellipse(x + 90 * s, y + 60 * s, 130 * s, 120 * s, 0, 0, Math.PI * 2); c.fill(); c.restore();
  c.fillStyle = muzzle; c.beginPath(); c.ellipse(x, y + 45 * s, 62 * s, 46 * s, 0, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#3b2a20'; c.beginPath(); c.ellipse(x, y + 22 * s, 24 * s, 16 * s, 0, 0, Math.PI * 2); c.fill();
  c.strokeStyle = ink; c.lineCap = 'round'; c.lineWidth = 6 * s;
  const open = Math.max(b.eye, b.wake);
  for (const d of [-1, 1]){
    const ex = x + d * 52 * s, ey = y - 18 * s;
    /* the left eye peeks; both open when awake */
    const o = d < 0 ? open : b.wake;
    if (o > 0.3){ c.fillStyle = '#fff'; c.beginPath(); c.arc(ex, ey, 15 * s * o, 0, Math.PI * 2); c.fill(); c.fillStyle = ink; c.beginPath(); c.arc(ex + 3 * s, ey + 2 * s, 9 * s * o, 0, Math.PI * 2); c.fill(); }
    else { c.beginPath(); c.arc(ex, ey - 4 * s, 14 * s, 0.2, Math.PI - 0.2); c.stroke(); }
  }
  /* a grumpy brow */
  if (b.grumble > 0){ c.beginPath(); c.moveTo(x - 76 * s, y - 50 * s); c.lineTo(x - 30 * s, y - 40 * s); c.moveTo(x + 76 * s, y - 50 * s); c.lineTo(x + 30 * s, y - 40 * s); c.stroke(); }
  /* the mouth: a sleepy smile, a grumble, a big happy grin at the end */
  c.beginPath();
  if (b.wake > 0.5) c.arc(x, y + 50 * s, 26 * s, 0.15, Math.PI - 0.15);
  else if (b.grumble > 0) c.arc(x, y + 78 * s, 18 * s, Math.PI + 0.3, -0.3);
  else c.arc(x, y + 48 * s, 14 * s, 0.3, Math.PI - 0.3);
  c.stroke();
}

/* frost round a frozen hand: little ice spikes, growing with how frozen */
function frost(c, x, y, r, k, t){
  c.save();
  c.strokeStyle = `rgba(200,235,255,${0.5 + 0.4 * k})`; c.lineWidth = Math.max(2, r * 0.12); c.lineCap = 'round';
  for (let i = 0; i < 6; i++){
    const a = i * Math.PI / 3 + t * 0.2, r0 = r * 1.6, r1 = r * (1.6 + 1.1 * k);
    c.beginPath(); c.moveTo(x + Math.cos(a) * r0, y + Math.sin(a) * r0); c.lineTo(x + Math.cos(a) * r1, y + Math.sin(a) * r1); c.stroke();
  }
  c.restore();
}

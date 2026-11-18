/* Pterry Flight: you are a pterodactyl, gliding over a prehistoric world. Spread your arms like wings and tip them to
   steer - the lower arm is the way you turn - and raise or lower both to climb and dive. The land rolls out in front
   of you and far below: forests and ferns, lakes, mountains, a smoking volcano, herds of long-necked dinosaurs. Now and
   then something wonderful is waiting ahead, ringed with sparkles - fly over it and it goes in your sticker book.

   Scenery, not a test: nothing to hit, no way to crash, no clock to beat. Everyone who's playing steers the same
   pterodactyl (their tilts and heights are averaged), and the morning turns to day and then to sunset as the three
   minutes go by.

   The world is endless and the same wherever you fly: a grid of cells, each deciding from its position what grows
   there. A cell's things are drawn from far to near, scaled by how far ahead they are. */
import { Juice } from './common.js';
import { sayBubble, goalBar } from './hud.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { L } from '../tracking/pose-shared.js';
import { sfx } from '../audio/sound.js';
import { Avatars } from '../ui/avatars.js';

export const ROUND = 180;
/* the world, in its own units: a cell is CELL wide; things show up to FAR ahead */
export const CELL = 3, FAR = 34, NEAR = 0.7;
/* flying: height (above the ground) and how fast the arms turn it and move it up and down */
export const ALT_MIN = 1.1, ALT_MAX = 5, ALT_RATE = 1.4, TURN = 0.7, SPEED = 4.2;
/* a wonder is found by flying within this of it (and below this height) */
export const FIND = 2.8, FIND_ALT = 4.6;
/* about how often a new wonder appears ahead, in seconds */
export const WONDER_EVERY = [13, 19];

export const WONDERS = [
  { emoji: '\u{1F30B}', text: 'a smoking volcano', size: 4.2 },
  { emoji: '\u{1F995}', text: 'a long-necked dinosaur', size: 2.2 },
  { emoji: '\u{1F95A}', text: 'a nest of eggs', size: 1.4 },
  { emoji: '\u{1F996}', text: 'a big friendly roarer', size: 2.2 },
  { emoji: '\u{1F33A}', text: 'giant flowers', size: 2.2 },
  { emoji: '\u{1F98E}', text: 'a sunbathing lizard', size: 1.6 },
  { emoji: '\u{1F334}', text: 'the tallest palm tree', size: 3.4 },
  { emoji: '\u{1F30A}', text: 'a sparkling waterfall', size: 2.6 }
];

/* sky and ground through the day: dawn, midday, sunset (top of the sky, the horizon, the near and far ground) */
const DAY = [
  { t: 0,    top: '#7b86c9', hor: '#ffc7a0', near: '#6fae6f', far: '#a9c98c' },
  { t: 0.45, top: '#4da3e6', hor: '#bfe6f7', near: '#4fa860', far: '#9ccf86' },
  { t: 1,    top: '#6a4f9b', hor: '#ffb56b', near: '#5a8f5e', far: '#c9b27a' }
];
const lerp = (a, b, k) => a + (b - a) * k;
const rgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => { const x = rgb(a), y = rgb(b); return `rgb(${x.map((v, i) => Math.round(lerp(v, y[i], k))).join(',')})`; };
export function skyAt(f){
  let i = 0; while (i < DAY.length - 2 && f > DAY[i + 1].t) i++;
  const a = DAY[i], b = DAY[i + 1], k = Math.max(0, Math.min(1, (f - a.t) / (b.t - a.t)));
  return { top: mix(a.top, b.top, k), hor: mix(a.hor, b.hor, k), near: mix(a.near, b.near, k), far: mix(a.far, b.far, k) };
}

/* a number from a cell, the same every time: 0 to 1 */
export const hash = (i, j, s = 0) => { let h = (i * 374761393 + j * 668265263 + s * 2246822519) | 0; h = (h ^ (h >>> 13)) * 1274126177; h = (h ^ (h >>> 16)) >>> 0; return h / 4294967295; };

/* The emoji are drawn once each into a small picture and stamped from then on - far quicker than drawing text a
   hundred times a frame. (Where there's no document - the tests - they're drawn as text.) */
const SPRITES = new Map(), EMOJI_FONT = '"Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
function sprite(e){
  if (SPRITES.has(e)) return SPRITES.get(e);
  let cv = null;
  if (typeof document !== 'undefined'){
    cv = document.createElement('canvas'); cv.width = cv.height = 160;
    const x = cv.getContext && cv.getContext('2d');
    if (x){ x.font = `128px ${EMOJI_FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 80, 84); } else cv = null;
  }
  SPRITES.set(e, cv);
  return cv;
}

export default {
  id: 'ptero-flight', unit: 'wonders', name: 'Pterry Flight', stars: 1, accent: '#e0915b',
  secs: ROUND, moves: ['steer', 'glide'],
  create(n){ return new PteroFlight(n); }
};

/* How one player steers: how far to turn (-1 left, 1 right) and to climb (-1 dive, 1 climb), or null when they aren't
   showing arms. The lower arm is the way you bank; the arms above the shoulders climb. */
export function steerOf(p){
  if (!p || !p.present) return null;
  if (pose.mouse.active){
    const m = pose.mouse;
    return { bank: Math.max(-1, Math.min(1, (m.x - 0.5) * 2)), pitch: Math.max(-1, Math.min(1, (0.5 - m.y) * 2)) };
  }
  const s = p.scale || 0.3, lm = p.lm;
  let a = null, b = null, shy = null;
  if (lm && lm[L.L_WRIST] && lm[L.R_WRIST] && (lm[L.L_WRIST].v ?? 1) > 0.4 && (lm[L.R_WRIST].v ?? 1) > 0.4){
    const w = [lm[L.L_WRIST], lm[L.R_WRIST]].sort((x, y) => x.x - y.x);       /* by where they are on the screen */
    a = w[0]; b = w[1];
    const sh = [lm[L.L_SHOULDER], lm[L.R_SHOULDER]].filter(Boolean);
    shy = sh.length ? sh.reduce((t, q) => t + q.y, 0) / sh.length : (p.centre ? p.centre.y - 0.1 : 0.4);
  } else if (p.hands && p.hands.left && p.hands.right){
    const w = [p.hands.left, p.hands.right].sort((x, y) => x.x - y.x);
    a = w[0]; b = w[1]; shy = p.centre ? p.centre.y - 0.1 : 0.4;
  }
  if (!a) return null;
  const clamp = (v) => Math.max(-1, Math.min(1, v));
  return { bank: clamp((b.y - a.y) / s / 0.5), pitch: clamp((shy - (a.y + b.y) / 2) / s / 0.5) };
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
    this.nextAt = 4; this.nth = 0;
    this.say = { text: 'Spread your arms like wings!', t: 0 };
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

  step(dt, W, H){
    this.t += dt; this.say.t += dt;
    this.j.step(dt);
    if (this.t >= ROUND) this.over = true;

    /* the arms: everyone's tilts and heights, averaged */
    const st = pose.players.slice(0, this.players).map(steerOf).filter(Boolean);
    let tb = 0, tp = 0;
    if (st.length){ tb = st.reduce((s, q) => s + q.bank, 0) / st.length; tp = st.reduce((s, q) => s + q.pitch, 0) / st.length; }
    else { tb = Math.sin(this.t * 0.3) * 0.25; tp = Math.sin(this.t * 0.2) * 0.2; }      /* nobody: a gentle drift */
    /* a little pull toward the nearest wonder, so a wobbly wing still finds it */
    const near = this._nearest();
    if (near && st.length){
      const dx = near.x - this.x, dz = near.z - this.z, ang = Math.atan2(dx, dz) - this.head;
      const a = Math.atan2(Math.sin(ang), Math.cos(ang));
      if (Math.abs(a) < 0.9) tb += Math.max(-0.3, Math.min(0.3, a * 0.6));
    }
    const k = Math.min(1, dt * 3);
    this.bank += (Math.max(-1, Math.min(1, tb)) - this.bank) * k;
    this.pitch += (tp - this.pitch) * k;
    this.flap += dt * (4 + Math.max(0, this.pitch) * 3);

    this.head += this.bank * TURN * dt;
    this.alt = Math.max(ALT_MIN, Math.min(ALT_MAX, this.alt + this.pitch * ALT_RATE * dt));
    const v = SPEED - this.pitch * 0.8;
    this.x += Math.sin(this.head) * v * dt; this.z += Math.cos(this.head) * v * dt; this.dist += v * dt;

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
        for (let q = 0; q < 14; q++) this.j.burst(W * (0.3 + Math.random() * 0.4), H * (0.25 + Math.random() * 0.3), ['#ffd35c', '#ff7eb3', '#7fd6a2', '#7ab8ff'][q % 4], 4, 1);
      }
    }
    /* a wonder goes a moment after it's found, or when it's well behind us */
    this.wonders = this.wonders.filter(w => {
      if (w.got){ if (w.goneAt == null) w.goneAt = this.t; return this.t - w.goneAt < 1.2; }
      return (w.z - this.z) * Math.cos(this.head) + (w.x - this.x) * Math.sin(this.head) > -6;
    });
    this.avatars.step(dt, this.players);
  }

  _nearest(){
    let best = null, bd = 1e9;
    for (const w of this.wonders){ if (w.got) continue; const d = Math.hypot(w.x - this.x, w.z - this.z); if (d < bd){ bd = d; best = w; } }
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
    c.translate(W / 2, H * 0.5); c.rotate(-this.bank * 0.1); c.scale(1.18, 1.18); c.translate(-W / 2, -H * 0.5);
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
      c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(-W * 0.2, y0, W * 1.4, y1 - y0);
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
    things.sort((a, b) => b.rz - a.rz);
    for (const o of things) this._thing(c, W, H, horizon, F, o);
    c.restore();
    this.j.draw(c, H);
    this._ptero(c, W, H);
    this._book(c, W, H);
    sayBubble(c, W, H, { text: this.say.text, t: this.say.t, until: this.say.until || (this.say.text.startsWith('Spread') ? this.hintUntil : Infinity) });
    goalBar(c, W, H, this.found.length / WONDERS.length, { color: '#e0915b' });
    this.avatars.drawMitts(c, W, H, this.players);
  }

  _sun(c, W, H, horizon, f){
    const az = lerp(-0.9, 0.9, f), x = W / 2 + (az - this.head) * W * 0.6, y = horizon - H * (0.28 - Math.abs(f - 0.45) * 0.3);
    const r = H * 0.07, g = c.createRadialGradient(x, y, r * 0.2, x, y, r * 3.2);
    g.addColorStop(0, 'rgba(255,248,220,.95)'); g.addColorStop(1, 'rgba(255,248,220,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 3.2, 0, 6.2832); c.fill();
  }

  /* far mountains slide sideways as you turn */
  _ranges(c, W, H, horizon){
    for (const [k, col, hgt, sp] of [[0, 'rgba(120,110,150,.55)', 0.16, 0.9], [1, 'rgba(90,100,120,.7)', 0.1, 1.5]]){
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
    if (o.wonder){
      const w = o.wonder, size = w.w.size * s;
      if (!w.got){
        /* a ring of sparkle round it, so it's easy to see from far off */
        const pulse = 1 + Math.sin(this.t * 4) * 0.08;
        c.save(); c.globalAlpha = 0.9 * Math.max(0.25, fade); c.strokeStyle = '#fff2a8'; c.lineWidth = Math.max(2, size * 0.05);
        c.beginPath(); c.ellipse(x, y - size * 0.3, size * 0.75 * pulse, size * 0.75 * pulse, 0, 0, 6.2832); c.stroke();
        c.restore();
      }
      this._emoji(c, w.w.emoji, x, y, size * (w.got ? 1.2 : 1), (w.got ? 0.4 : 1) * Math.max(0.25, fade));
      return;
    }
    const k = o.kind;
    if (k < 0.07){                       /* a lake, flat on the ground */
      const wd = (1.8 + o.big * 2.2) * s, flat = Math.max(0.05, Math.min(0.5, this.alt / o.rz));
      c.save(); c.globalAlpha = 0.85 * fade; c.fillStyle = '#7ec8e8'; c.beginPath(); c.ellipse(x, y, wd, wd * flat, 0, 0, 6.2832); c.fill();
      c.fillStyle = 'rgba(255,255,255,.3)'; c.beginPath(); c.ellipse(x - wd * 0.2, y - wd * flat * 0.2, wd * 0.5, wd * flat * 0.3, 0, 0, 6.2832); c.fill(); c.restore();
      return;
    }
    const emoji = k < 0.5 ? '\u{1F332}' : k < 0.72 ? '\u{1F334}' : k < 0.85 ? '\u{1F333}' : k < 0.93 ? '\u{1F33F}' : k < 0.97 ? '\u{1F995}' : '\u{1F30B}';
    const size = (emoji === '\u{1F30B}' ? 4 : emoji === '\u{1F995}' ? 1.4 : 1.2 + o.big * 1.1) * s;
    this._emoji(c, emoji, x, y, size, fade);
  }

  _emoji(c, e, x, y, size, alpha){
    if (size < 3) return;
    const sp = sprite(e);
    c.save(); c.globalAlpha = alpha;
    if (sp){ const k = size / 128; c.drawImage(sp, x - 80 * k, y - size * 0.38 - 84 * k, 160 * k, 160 * k); }
    else { c.font = `${Math.round(size)}px ${EMOJI_FONT}`; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.fillStyle = '#000'; c.fillText(e, x, y + size * 0.12); }
    c.restore();
  }

  /* the pterodactyl, from behind: wings spread, rolling with the turn, flapping gently */
  _ptero(c, W, H){
    const fl = Math.sin(this.flap) * 0.18, span = W * 0.2;
    c.save(); c.translate(W / 2, H * 0.8 - this.pitch * H * 0.03); c.rotate(this.bank * 0.28);
    c.fillStyle = 'rgba(40,40,70,.15)'; c.beginPath(); c.ellipse(0, H * 0.1, span * 0.7, H * 0.02, 0, 0, 6.2832); c.fill();
    for (const side of [-1, 1]){
      c.fillStyle = '#e9915b'; c.beginPath(); c.moveTo(side * span * 0.06, 0);
      c.quadraticCurveTo(side * span * 0.6, -H * (0.1 + fl), side * span * 1.05, -H * (0.02 + fl * 1.6));
      c.quadraticCurveTo(side * span * 0.8, H * 0.01, side * span * 0.7, H * 0.045);
      c.quadraticCurveTo(side * span * 0.4, H * 0.01, side * span * 0.25, H * 0.05);
      c.quadraticCurveTo(side * span * 0.12, H * 0.03, side * span * 0.06, H * 0.05);
      c.closePath(); c.fill();
      c.strokeStyle = '#2d6a78'; c.lineWidth = Math.max(3, H * 0.006); c.lineCap = 'round';
      c.beginPath(); c.moveTo(side * span * 0.06, 0); c.quadraticCurveTo(side * span * 0.6, -H * (0.1 + fl), side * span * 1.05, -H * (0.02 + fl * 1.6)); c.stroke();
    }
    c.fillStyle = '#2d6a78'; c.beginPath(); c.ellipse(0, H * 0.02, span * 0.13, H * 0.06, 0, 0, 6.2832); c.fill();
    c.fillStyle = '#7cc6c0'; c.beginPath(); c.ellipse(0, H * 0.035, span * 0.07, H * 0.035, 0, 0, 6.2832); c.fill();
    /* the head and its crest, ahead of us */
    c.fillStyle = '#2d6a78'; c.beginPath(); c.ellipse(0, -H * 0.045, span * 0.07, H * 0.035, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.moveTo(-span * 0.03, -H * 0.06); c.lineTo(0, -H * 0.115); c.lineTo(span * 0.05, -H * 0.055); c.closePath(); c.fill();
    c.restore();
  }

  /* the sticker book: a picture for every wonder found, along the bottom */
  _book(c, W, H){
    if (!this.found.length) return;
    /* along the bottom left, out of the pterodactyl's way */
    const size = H * 0.05, gap = size * 1.2, x0 = W * 0.04 + size * 0.7, y = H * 0.94, n = this.found.length;
    c.save(); c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.roundRect(x0 - gap * 0.7, y - size * 0.7, gap * (n - 1) + gap * 1.4, size * 1.4, size * 0.7); c.fill();
    this.found.forEach((w, i) => { const sp = sprite(w.emoji); if (sp){ const k = size / 128; c.drawImage(sp, x0 + i * gap - 80 * k, y - 84 * k, 160 * k, 160 * k); } else { c.font = `${Math.round(size)}px ${EMOJI_FONT}`; c.fillStyle = '#000'; c.fillText(w.emoji, x0 + i * gap, y); } });
    c.restore();
  }

  /* the move card: which move the card in the corner shows right now, or null for none (show it for the first few seconds) */
  card(){ return this.t < 8 ? 'flap' : null; }
  hud(){ return { score: this.score, showLives: false, hideScore: true }; }
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
}

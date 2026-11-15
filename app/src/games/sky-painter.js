/* Sky Painter: the sky's a blank sheet of paper, and your hands are
   paintbrushes. Sweep your arms and the colour goes on - and a picture
   that was hiding there shows through: a whale, a hot-air balloon, a
   butterfly. A faint dashed outline hints where it is. Paint enough of it
   and the whole picture comes alive - the whale swims off, the balloon
   floats away - and there's fresh paper for the next one.

   No score to chase, nothing to lose: the calm one. Each player's count is
   how much of the sky they painted. First person: the players are their
   hands, and every hand is a brush.

   How much is painted is kept on a coarse grid (GRID), so it's cheap to
   ask; the picture shows through a mask painted with the same strokes. */
import { Juice } from './common.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { Avatars } from '../ui/avatars.js';

export const ROUND = 180;
/* the brush (screen heights across), how much painted finishes a picture,
   and how long it plays before the next */
export const BRUSH = 0.18, DONE = 0.8, ALIVE = 5;
export const GRID = [48, 27];
export const PICTURES = ['whale', 'balloon', 'butterfly'];
const PAPER = '#f2ebdc';

export default {
  id: 'sky-painter', name: 'Sky Painter', stars: 1, accent: '#7398c4', secs: ROUND,
  moves: ['arms'],
  create(n){ return new SkyPainter(n); }
};

const canvas = (w, h) => {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h));
  return cv.getContext ? cv : null;
};

class SkyPainter {
  constructor(players){
    this.players = players;
    this.score = Array.from({ length: MAX_PLAYERS }, () => 0);
    this.t = 0; this.over = false;
    this.done = 0;               /* pictures finished */
    this.which = 0;              /* the picture now */
    this.alive = 0;              /* seconds since it came alive (0: still painting) */
    this.last = {};              /* each hand's last place */
    this.flecks = [];
    this.j = new Juice();
    this.avatars = new Avatars();
    this._fresh();
  }

  /* fresh paper */
  _fresh(){
    this.cells = new Uint8Array(GRID[0] * GRID[1]);
    this.painted = 0;
    this.mask = null; this.bg = null; this.size = null;
    this.alive = 0;
    this.last = {};
  }
  get covered(){ return this.painted / this.cells.length; }

  step(dt, W, H){
    this.t += dt;
    this.j.step(dt);
    if (this.t >= ROUND) this.over = true;
    const aspect = W / H;

    if (this.alive){
      this.alive += dt;
      if (this.alive > ALIVE){ this.which = (this.which + 1) % PICTURES.length; this._fresh(); sfx.whoosh?.(); }
    } else {
      /* every hand paints a stroke from where it was to where it is */
      for (let i = 0; i < this.players; i++){
        const p = pose.players[i];
        if (!p || !p.present){ delete this.last[i + 'l']; delete this.last[i + 'r']; continue; }
        const hands = pose.mouse.active ? [['r', p.hands.right]] : [['l', p.hands.left], ['r', p.hands.right]];
        for (const [k, h] of hands){
          if (!h || h.x < -0.1 || h.x > 1.1) continue;
          const key = i + k, from = this.last[key] || { x: h.x, y: h.y };
          this._stroke(i, from.x, from.y, h.x, h.y, aspect);
          this.last[key] = { x: h.x, y: h.y };
          if (h.speed > 0.4 && Math.random() < dt * 20) this.flecks.push({ x: h.x, y: h.y, vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2, age: 0, col: PALETTE[this._pic()][(Math.random() * 3) | 0] });
        }
      }
      if (this.covered >= DONE){ this.alive = 0.001; this.done++; sfx.hooray?.(); sfx.chime?.(); }
    }
    for (const f of this.flecks){ f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    this.flecks = this.flecks.filter(f => f.age < 0.6);
    this.avatars.step(dt, this.players);
  }

  _pic(){ return PICTURES[this.which]; }

  /* paint along a line: the grid's cells it covers (and the mask, if it's made) */
  _stroke(who, x0, y0, x1, y1, aspect){
    const r = BRUSH / 2, steps = Math.max(1, Math.ceil(Math.hypot((x1 - x0) * aspect, y1 - y0) / (r * 0.5)));
    const [gx, gy] = GRID;
    for (let s = 0; s <= steps; s++){
      const x = x0 + (x1 - x0) * s / steps, y = y0 + (y1 - y0) * s / steps;
      /* the cells within the brush (in screen heights, so it's round) */
      const cx0 = Math.max(0, Math.floor((x - r / aspect) * gx)), cx1 = Math.min(gx - 1, Math.floor((x + r / aspect) * gx));
      const cy0 = Math.max(0, Math.floor((y - r) * gy)), cy1 = Math.min(gy - 1, Math.floor((y + r) * gy));
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++){
        const mx = ((cx + 0.5) / gx - x) * aspect, my = (cy + 0.5) / gy - y;
        if (mx * mx + my * my > r * r) continue;
        const n = cy * gx + cx;
        if (!this.cells[n]){ this.cells[n] = 1; this.painted++; this.score[who]++; }
      }
    }
    if (this.mask){
      const m = this.mask.getContext('2d'), sx = this.mask.width, sy = this.mask.height;
      m.strokeStyle = '#000'; m.lineCap = 'round'; m.lineJoin = 'round';
      /* a brushy edge: a solid core and two softer, wider passes */
      for (const [w, a] of [[1, 1], [1.15, 0.5], [1.3, 0.25]]){
        m.globalAlpha = a; m.lineWidth = BRUSH * w * sy;
        m.beginPath(); m.moveTo(x0 * sx, y0 * sy); m.lineTo(x1 * sx + 0.01, y1 * sy); m.stroke();
      }
      m.globalAlpha = 1;
    }
  }

  /* the picture's background and the mask, made for this screen size */
  _make(W, H){
    if (this.size === W + 'x' + H || this._noCanvas) return;
    const bg = canvas(W, H), mask = canvas(W / 4, H / 4), tmp = canvas(W, H);
    if (!bg || !mask || !tmp){ this._noCanvas = true; return; }
    this.size = W + 'x' + H; this.bg = bg; this.mask = mask; this.tmp = tmp;
    background(bg.getContext('2d'), W, H, this._pic());
    /* (repaint what's already been painted, at the new size) */
    const m = mask.getContext('2d'), [gx, gy] = GRID;
    m.fillStyle = '#000';
    for (let n = 0; n < this.cells.length; n++) if (this.cells[n]) m.fillRect((n % gx) / gx * mask.width, Math.floor(n / gx) / gy * mask.height, mask.width / gx + 1, mask.height / gy + 1);
  }

  draw(c, W, H){
    this._make(W, H);
    c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
    const pic = this._pic(), k = this.alive ? Math.min(1, this.alive / 0.8) : 0;
    /* the hint: the subject's outline, dashed and faint, until it's alive */
    if (!this.alive) subject(c, W, H, pic, this.t, 0, true);
    if (this.bg && this.tmp){
      const t = this.tmp.getContext('2d');
      t.globalCompositeOperation = 'source-over'; t.globalAlpha = 1;
      t.clearRect(0, 0, W, H); t.drawImage(this.bg, 0, 0);
      if (!this.alive) subject(t, W, H, pic, this.t, 0, false);
      t.globalCompositeOperation = 'destination-in'; t.drawImage(this.mask, 0, 0, W, H);
      t.globalCompositeOperation = 'source-over';
      c.drawImage(this.tmp, 0, 0);
      /* alive: the whole picture, and the subject off on its way */
      if (this.alive){ c.globalAlpha = k; c.drawImage(this.bg, 0, 0); c.globalAlpha = 1; subject(c, W, H, pic, this.t, this.alive, false); }
    } else if (this.alive) subject(c, W, H, pic, this.t, this.alive, false);
    for (const f of this.flecks){ c.globalAlpha = 1 - f.age / 0.6; c.fillStyle = f.col; c.beginPath(); c.arc(f.x * W, f.y * H, H * 0.006, 0, 6.2832); c.fill(); }
    c.globalAlpha = 1;
    this.avatars.drawMitts(c, W, H, this.players);
    this._say(c, W, H);
  }

  _say(c, W, H){
    const text = this.alive ? ['Look - a whale!', 'Look - a hot-air balloon!', 'Look - a butterfly!'][this.which] : 'What’s hiding in the sky? Keep painting!';
    const size = Math.round(H * 0.036);
    c.save(); c.font = `800 ${size}px Inter, Segoe UI, sans-serif`;
    const w = c.measureText(text).width + size * 1.6, x = W * 0.5, y = H * 0.19;
    c.fillStyle = 'rgba(250,247,238,.95)'; c.beginPath(); c.roundRect(x - w / 2, y - size * 0.95, w, size * 1.9, size * 0.95); c.fill();
    c.fillStyle = '#33322e'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, x, y + 2);
    /* how much is painted: a bar under the words */
    const bw = W * 0.2, bh = H * 0.02, bx = x - bw / 2, by = y + size * 1.4;
    c.fillStyle = 'rgba(250,247,238,.9)'; c.beginPath(); c.roundRect(bx, by, bw, bh, bh / 2); c.fill();
    const kk = this.alive ? 1 : Math.min(1, this.covered / DONE);
    if (kk > 0){ c.fillStyle = '#7398c4'; c.beginPath(); c.roundRect(bx + 3, by + 3, Math.max(bh - 6, (bw - 6) * kk), bh - 6, (bh - 6) / 2); c.fill(); }
    c.restore();
  }

  hud(){ return { score: this.score, showLives: false, hideScore: true }; }
  /* big arm sweeps go everywhere; Back on the remote still pauses */
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
  value(){ return this.done; }
}

/* ---------- the pictures ---------- */
const PALETTE = {
  whale: ['#7398c4', '#9fc8e6', '#efe6d4'],
  balloon: ['#e8513d', '#ffd25a', '#79b3aa'],
  butterfly: ['#a98bff', '#ff9cc0', '#ffd25a']
};

/* the sky behind every picture: a soft wash, hills, a few clouds */
function background(c, W, H, pic){
  const g = c.createLinearGradient(0, 0, 0, H * 0.85);
  const top = pic === 'butterfly' ? '#b9d7c4' : pic === 'balloon' ? '#a9c9e6' : '#9fc8e6';
  g.addColorStop(0, top); g.addColorStop(1, '#f6ead2');
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const sun = c.createRadialGradient(W * 0.15, H * 0.15, 10, W * 0.15, H * 0.15, H * 0.6);
  sun.addColorStop(0, 'rgba(255,244,214,.85)'); sun.addColorStop(1, 'rgba(255,244,214,0)'); c.fillStyle = sun; c.fillRect(0, 0, W, H);
  for (const [x, y, w] of [[0.2, 0.22, 0.12], [0.82, 0.16, 0.14], [0.72, 0.62, 0.09], [0.12, 0.6, 0.08]]){
    c.globalAlpha = 0.85; c.fillStyle = '#ffffff';
    c.beginPath(); c.ellipse(x * W, y * H, w * W, w * W * 0.18, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.ellipse(x * W + w * W * 0.2, y * H - w * W * 0.08, w * W * 0.55, w * W * 0.15, 0, 0, 6.2832); c.fill();
    c.globalAlpha = 1;
  }
  for (const [y, col, amp] of [[0.82, '#a9c48f', 0.05], [0.9, '#8fbf6a', 0.04]]){
    c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += W / 40) c.lineTo(x, H * (y - amp * (0.5 + 0.5 * Math.sin(x / W * 7 + y * 10))));
    c.lineTo(W, H); c.closePath(); c.fill();
  }
  if (pic === 'butterfly'){
    for (let i = 0; i < 40; i++){ const x = ((i * 0.618) % 1) * W, y = H * (0.88 + ((i * 0.37) % 1) * 0.1); c.fillStyle = ['#ffd25a', '#ff9cc0', '#ffffff'][i % 3]; c.beginPath(); c.arc(x, y, H * 0.008, 0, 6.2832); c.fill(); }
  }
}

/* the subject: drawn in the middle; `alive` seconds into coming alive it
   moves off (0: still); outline: just a faint dashed hint of its shape */
function subject(c, W, H, pic, t, alive, outline){
  const s = H / 900;
  c.save();
  if (outline){ c.setLineDash([14 * s, 12 * s]); c.lineWidth = 4 * s; c.strokeStyle = 'rgba(120,110,95,.35)'; }
  if (pic === 'whale'){
    const x = W * 0.52 + alive * W * 0.18, y = H * 0.45 - Math.sin(alive * 2) * H * 0.03;
    whale(c, x, y, s, outline, t);
  } else if (pic === 'balloon'){
    const x = W * 0.5 + Math.sin(t * 0.8) * W * 0.005 + alive * W * 0.04, y = H * 0.44 - alive * alive * H * 0.03;
    hotAir(c, x, y, s, outline);
  } else {
    const x = W * 0.5 + alive * W * 0.12 + Math.sin(alive * 3) * W * 0.03, y = H * 0.45 - alive * H * 0.07 + Math.sin(alive * 5) * H * 0.02;
    butterfly(c, x, y, s, outline, alive ? t : 0);
  }
  c.restore();
}

function cel(c, path, col, shade = 'rgba(58,51,96,.2)', ox = 0.6, oy = 0.5, r = 1){ /* fill a shape, then its shadow side */
  c.fillStyle = col; path(); c.fill();
  c.save(); path(); c.clip(); c.fillStyle = shade; c.beginPath(); c.ellipse(ox, oy, r, r, 0, 0, 6.2832); c.fill(); c.restore();
}

function whale(c, x, y, s, outline, t){
  const body = () => { c.beginPath(); c.ellipse(x, y, 260 * s, 120 * s, -0.08, 0, 6.2832); };
  const tail = () => { c.beginPath(); c.moveTo(x - 240 * s, y - 10 * s); c.lineTo(x - 380 * s, y - 110 * s); c.lineTo(x - 350 * s, y + 20 * s); c.lineTo(x - 390 * s, y + 110 * s); c.closePath(); };
  if (outline){ body(); c.stroke(); tail(); c.stroke(); return; }
  c.fillStyle = '#5f84b0'; tail(); c.fill();
  cel(c, body, '#7398c4', '#5f84b0', x + 80 * s, y + 70 * s, 260 * s);
  c.save(); body(); c.clip(); c.fillStyle = '#efe6d4'; c.beginPath(); c.ellipse(x + 20 * s, y + 95 * s, 230 * s, 60 * s, 0, 0, 6.2832); c.fill(); c.restore();
  c.fillStyle = '#5f84b0'; c.beginPath(); c.ellipse(x + 40 * s, y + 70 * s, 70 * s, 26 * s, 0.5 + Math.sin(t * 3) * 0.15, 0, 6.2832); c.fill();
  c.fillStyle = '#33322e'; c.beginPath(); c.arc(x + 170 * s, y - 20 * s, 14 * s, 0, 6.2832); c.fill();
  c.fillStyle = '#fff'; c.beginPath(); c.arc(x + 166 * s, y - 25 * s, 5 * s, 0, 6.2832); c.fill();
  c.strokeStyle = '#33322e'; c.lineWidth = 6 * s; c.lineCap = 'round'; c.beginPath(); c.arc(x + 200 * s, y + 20 * s, 34 * s, 0.2, 1.3); c.stroke();
  c.fillStyle = 'rgba(255,140,150,.45)'; c.beginPath(); c.ellipse(x + 120 * s, y + 10 * s, 22 * s, 13 * s, 0, 0, 6.2832); c.fill();
  c.fillStyle = '#d9ecf5';
  for (const [dx, dy, r] of [[0, -150, 16], [-30, -185, 12], [30, -185, 12], [-50, -215, 9], [50, -215, 9]]){ c.beginPath(); c.arc(x + 60 * s + dx * s, y + dy * s - Math.abs(Math.sin(t * 2)) * 10 * s, r * s, 0, 6.2832); c.fill(); }
}

function hotAir(c, x, y, s, outline){
  const env = () => { c.beginPath(); c.moveTo(x, y + 180 * s); c.bezierCurveTo(x - 260 * s, y + 20 * s, x - 200 * s, y - 230 * s, x, y - 230 * s); c.bezierCurveTo(x + 200 * s, y - 230 * s, x + 260 * s, y + 20 * s, x, y + 180 * s); c.closePath(); };
  const basket = () => { c.beginPath(); c.roundRect(x - 50 * s, y + 250 * s, 100 * s, 70 * s, 10 * s); };
  if (outline){ env(); c.stroke(); basket(); c.stroke(); return; }
  c.fillStyle = '#e8513d'; env(); c.fill();
  c.save(); env(); c.clip();
  c.fillStyle = '#ffd25a'; for (const dx of [-120, 0, 120]){ c.beginPath(); c.ellipse(x + dx * s, y - 20 * s, 36 * s, 260 * s, 0, 0, 6.2832); c.fill(); }
  c.fillStyle = 'rgba(58,51,96,.2)'; c.beginPath(); c.ellipse(x + 160 * s, y + 40 * s, 170 * s, 300 * s, 0, 0, 6.2832); c.fill();
  c.restore();
  c.strokeStyle = '#7a6550'; c.lineWidth = 4 * s;
  for (const d of [-1, 1]){ c.beginPath(); c.moveTo(x + d * 70 * s, y + 140 * s); c.lineTo(x + d * 45 * s, y + 252 * s); c.stroke(); }
  c.fillStyle = '#b5845a'; basket(); c.fill();
  c.fillStyle = 'rgba(58,51,96,.2)'; c.fillRect(x + 15 * s, y + 252 * s, 35 * s, 66 * s);
}

function butterfly(c, x, y, s, outline, t){
  const flap = 0.55 + 0.45 * Math.abs(Math.cos(t * 9));
  const wing = (d, big) => () => { c.beginPath(); c.ellipse(x + d * (big ? 120 : 95) * s * flap, y + (big ? -60 : 70) * s, (big ? 135 : 95) * s * flap, (big ? 110 : 80) * s, d * (big ? -0.5 : 0.4), 0, 6.2832); };
  if (outline){ for (const d of [-1, 1]){ wing(d, true)(); c.stroke(); wing(d, false)(); c.stroke(); } return; }
  for (const d of [-1, 1]){
    cel(c, wing(d, true), '#a98bff', 'rgba(58,51,96,.2)', x + d * 170 * s, y - 10 * s, 120 * s);
    cel(c, wing(d, false), '#ff9cc0', 'rgba(58,51,96,.2)', x + d * 130 * s, y + 110 * s, 80 * s);
    c.fillStyle = '#ffd25a'; c.beginPath(); c.arc(x + d * 130 * s * flap, y - 70 * s, 28 * s, 0, 6.2832); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x + d * 100 * s * flap, y + 75 * s, 16 * s, 0, 6.2832); c.fill();
  }
  c.fillStyle = '#4a3b5c'; c.beginPath(); c.ellipse(x, y + 10 * s, 18 * s, 120 * s, 0, 0, 6.2832); c.fill();
  c.beginPath(); c.arc(x, y - 120 * s, 26 * s, 0, 6.2832); c.fill();
  c.strokeStyle = '#4a3b5c'; c.lineWidth = 5 * s; c.lineCap = 'round';
  for (const d of [-1, 1]){ c.beginPath(); c.moveTo(x + d * 8 * s, y - 140 * s); c.quadraticCurveTo(x + d * 40 * s, y - 210 * s, x + d * 70 * s, y - 220 * s); c.stroke(); }
  c.fillStyle = '#fff'; for (const d of [-1, 1]){ c.beginPath(); c.arc(x + d * 10 * s, y - 124 * s, 6 * s, 0, 6.2832); c.fill(); }
}

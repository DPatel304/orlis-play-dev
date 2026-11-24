/* Sky Painter: the sky's a blank sheet of paper, and your hands are
   paintbrushes. Sweep your arms and the colour goes on - and a picture
   that was hiding there shows through: a whale, a hot-air balloon, a
   butterfly. A faint dashed outline hints where it is. Paint enough of it
   and the whole picture comes alive - the whale swims off, the balloon
   floats away - and there's fresh paper for the next one.

   No score to chase, nothing to lose: the calm one. What counts is pictures finished, and a star for everyone who helped paint
   one (the only per-player number; how many bits each hand painted is kept inside, for the tests, and never shown). First
   person: the players are their hands, and every hand is a brush.

   The paper is fitted to the people playing: its top is the highest the shortest player can reach, and the picture is scaled
   to sit inside it (above that the sky is already painted, and so is the corner the move card covers). A picture that
   stalls for STALL seconds is helped along - the paint spreads like watercolour from what's painted - so it always finishes.

   How much is painted is kept on a coarse grid (GRID), so it's cheap to
   ask; the picture shows through a mask painted with the same strokes. */
import { color, alpha, tone } from './assets/palette.js';
import { Juice } from './common.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { Avatars } from '../ui/avatars.js';
import { L } from '../tracking/pose-shared.js';
import { hudZones } from './hud.js';

export const ROUND = 180;
/* the brush (screen heights across), how much painted finishes a picture,
   and how long it plays before the next */
export const BRUSH = 0.18, DONE = 0.8, ALIVE = 5;
/* if nobody's painted anywhere new for STALL seconds (a hand has to add FRESH new bits to count), the paint spreads from the painted
   edge by itself, like watercolour - so a child alone, or one who stays in one spot, still sees the picture through */
export const STALL = 8, FRESH = 3;
/* a star for each picture you helped paint: at least this many bits of it (more than the dot a resting hand leaves, which is a dozen or two) */
export const HELPED = 60;
/* the watercolour only helps once a picture has really been started: this share of the paper (a resting hand's dot is well under it) */
export const STARTED = 0.08;
/* the paper is fitted again if a player's reach turns out very different, but only in a picture's first REFIT seconds */
export const REFIT = 8;
/* how high a player reaches, as a number of torsos (shoulder to hip) above the shoulders: about an arm */
export const ARM = 1.0;
export const GRID = [48, 27];
export const PICTURES = ['whale', 'balloon', 'butterfly'];
const PAPER = color('shade.paper');
/* the whale's one blue, its shade by the rule, and its belly */
const WHALE = color('sky.high', 'shade'), WHALE_SHADE = tone(WHALE, 'shade'), BELLY = color('shade.line');

export default {
  id: 'sky-painter', unit: 'stars', done: ['stars', 'earned'], name: 'Sky Painter', stars: 1, accent: WHALE, secs: ROUND,
  moves: ['arms'],
  create(n){ return new SkyPainter(n); }
};

const canvas = (w, h) => {
  if (typeof document === 'undefined' || !document.createElement) return null;
  const cv = document.createElement('canvas'); cv.width = Math.max(1, Math.round(w)); cv.height = Math.max(1, Math.round(h));
  return cv.getContext ? cv : null;
};

/* How high up the picture this player can paint (0 is the top of the screen), from their shoulders and torso, or null when there's
   nothing to go on (no camera landmarks: the mouse, a test). TODO: switch to games/reach.js (the shared reach band) once it lands. */
export function reachTop(p){
  if (!p || !p.present || !p.lm) return null;
  const a = p.lm[L.L_SHOULDER], b = p.lm[L.R_SHOULDER], c = p.lm[L.L_HIP], d = p.lm[L.R_HIP];
  if (!a || !b || !c || !d) return null;
  const sh = (a.y + b.y) / 2, torso = (c.y + d.y) / 2 - sh;
  if (!(torso > 0.02)) return null;
  return sh - torso * ARM;
}
/* each picture's height, from the top of its highest bit to the bottom of its lowest, in the units subject() draws in (a screen 900 high) and
   measured from the spot the picture is drawn about */
const EXTENT = { whale: [-231, 125], balloon: [-230, 320], butterfly: [-225, 150] };
/* the paper: never higher than this (a tall person can reach almost to the top; the sun stays up there), never lower than this */
const TOP_MIN = 0.04, TOP_MAX = 0.56, BOTTOM = 0.94;

class SkyPainter {
  constructor(players){
    this.players = players;
    this.score = Array.from({ length: MAX_PLAYERS }, () => 0);
    this.t = 0; this.over = false;
    this.done = 0;               /* pictures finished */
    this.spreadN = 0;            /* bits the watercolour painted by itself (the help along) */
    this.stars = Array.from({ length: MAX_PLAYERS }, () => 0);   /* each player's stars: pictures they helped paint */
    this.reach = {};             /* each player's reach (the top of what they can paint), smoothed */
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
    this.cells = new Uint8Array(GRID[0] * GRID[1]);   /* 1: painted, or not paper (see _fit) */
    this.ink = new Uint8Array(this.cells.length);     /* 1: painted by a hand or by the watercolour */
    this.out = new Uint8Array(this.cells.length);     /* 1: not paper - already shows the sky; nobody has to paint it */
    this.live = this.cells.length;                    /* how many bits of paper there are */
    this.painted = 0;                                 /* how many of them are painted */
    this.mask = null; this.bg = null; this.size = null;
    this.alive = 0;
    this.last = {};
    this.still = 0; this.handNew = 0; this.mark = 0;   /* seconds since fresh bits were painted; bits painted by hands this picture */
    this.mine = Array.from({ length: MAX_PLAYERS }, () => 0);
    this.top = 0; this.fit = null; this.age = 0;
  }
  get covered(){ return this.live ? this.painted / this.live : 1; }

  /* Fit the paper to who's playing: its top is the highest the shortest player can reach, the move card's corner isn't paper, and the
     picture is scaled to sit inside. Done as the picture starts (and again if a player's reach is found to be quite different in its first
     seconds); after that the paper stays, and a player who arrives later waits for the next one - the watercolour covers what they can't. */
  _fit(W, H, dt){
    this.age += dt;
    for (let i = 0; i < this.players; i++){
      const r = reachTop(pose.players[i]);
      if (r == null){ delete this.reach[i]; continue; }
      /* (leaning to paint low, or a hop, is a moment: the reach follows a higher reach quickly and a lower one slowly) */
      const e = this.reach[i];
      this.reach[i] = e == null ? r : e + (r - e) * Math.min(1, dt * (r < e ? 0.8 : 0.15));
    }
    const vals = Object.values(this.reach);
    const want = Math.max(TOP_MIN, Math.min(TOP_MAX, vals.length ? Math.max(...vals) : TOP_MIN));
    const [gx, gy] = GRID, row = Math.round(want * gy), top = row / gy;
    const key = W + 'x' + H, f = this.fit;
    if (f && f.key === key && (this.age > REFIT || Math.abs(row - f.row) < 2 || this.age - f.at < 1)) return;
    const card = hudZones(W, H).card, cr = (card.x + card.w) / W + 0.01, ct = card.y / H - 0.01;
    this.live = 0; this.painted = 0;
    for (let c = 0; c < this.out.length; c++){
      const x = ((c % gx) + 0.5) / gx, y = (((c / gx) | 0) + 0.5) / gy, away = y < top || (x < cr && y > ct);
      this.out[c] = away ? 1 : 0; this.cells[c] = away || this.ink[c] ? 1 : 0;
      if (!away){ this.live++; if (this.ink[c]) this.painted++; }
    }
    this.top = top;
    /* the picture: as big as the paper allows (never bigger than it always was), centred on the paper's height */
    const [e0, e1] = EXTENT[this._pic()], mid = (top + BOTTOM) / 2 * H, free = (BOTTOM - top) * H * 0.9;
    const s = Math.min(H / 900, free / (e1 - e0));
    this.fit = { key, row, at: this.age, s, x: W * 0.5, y: mid - s * (e0 + e1) / 2 };
    this.size = null;                 /* (the mask and the picture are made again for the new paper) */
  }

  step(dt, W, H){
    this.t += dt;
    this.j.step(dt);
    if (this.t >= ROUND) this.over = true;
    const aspect = W / H;
    this._fit(W, H, dt);

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
          if (h.speed > 0.4 && Math.random() < dt * 20) this.flecks.push({ x: h.x, y: h.y, vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2, age: 0, col: PAINT[this._pic()][(Math.random() * 3) | 0] });
        }
      }
      /* nobody painting anywhere new for a while: the paint spreads from what's painted, so the picture always finishes */
      if (this.handNew - this.mark >= FRESH){ this.still = 0; this.mark = this.handNew; } else this.still += dt;
      if (this.still > STALL && this.covered >= STARTED) this._spread(dt);
      if (this.covered >= DONE){
        this.alive = 0.001; this.done++;
        for (let i = 0; i < this.players; i++) if (this.mine[i] >= HELPED) this.stars[i]++;
        sfx.hooray?.(); sfx.chime?.();
      }
    }
    for (const f of this.flecks){ f.age += dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    this.flecks = this.flecks.filter(f => f.age < 0.6);
    this.avatars.step(dt, this.players);
  }

  _pic(){ return PICTURES[this.which]; }

  /* watercolour: unpainted cells next to painted ones fill in, a few a
     frame (nobody's, so no one's count goes up), and the mask with them */
  _spread(dt){
    const [gx, gy] = GRID, n = Math.max(1, Math.round(this.live * 0.04 * dt)), edge = [];
    const on = (c) => this.cells[c] && !this.out[c];          /* painted paper (the sky beyond the paper doesn't start anything) */
    for (let c = 0; c < this.cells.length; c++){
      if (this.cells[c]) continue;
      const x = c % gx, y = (c / gx) | 0;
      if ((x > 0 && on(c - 1)) || (x < gx - 1 && on(c + 1)) || (y > 0 && on(c - gx)) || (y < gy - 1 && on(c + gx))) edge.push(c);
    }
    const m = this.mask && this.mask.getContext('2d');
    for (let k = 0; k < n && edge.length; k++){
      const c = edge.splice((Math.random() * edge.length) | 0, 1)[0];
      this.cells[c] = 1; this.ink[c] = 1; this.painted++; this.spreadN++;
      if (m){ const sx = this.mask.width / gx, sy = this.mask.height / gy; m.fillStyle = color('shade.ink'); m.beginPath(); m.arc(((c % gx) + 0.5) * sx, (((c / gx) | 0) + 0.5) * sy, Math.max(sx, sy) * 0.9, 0, 6.2832); m.fill(); }
    }
  }

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
        if (!this.cells[n]){ this.cells[n] = 1; this.ink[n] = 1; this.painted++; this.score[who]++; this.mine[who]++; this.handNew++; }
      }
    }
    if (this.mask){
      const m = this.mask.getContext('2d'), sx = this.mask.width, sy = this.mask.height;
      m.strokeStyle = color('shade.ink'); m.lineCap = 'round'; m.lineJoin = 'round';
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
    m.fillStyle = color('shade.ink');
    for (let n = 0; n < this.cells.length; n++) if (this.cells[n]) m.fillRect((n % gx) / gx * mask.width, Math.floor(n / gx) / gy * mask.height, mask.width / gx + 1, mask.height / gy + 1);
  }

  draw(c, W, H){
    this._make(W, H);
    c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
    const pic = this._pic(), k = this.alive ? Math.min(1, this.alive / 0.8) : 0, fit = this.fit || { s: H / 900, x: W * 0.5, y: H * 0.45 };
    /* the hint: the subject's outline, dashed and faint, until it's alive */
    if (!this.alive) subject(c, W, H, pic, this.t, 0, true, fit);
    if (this.bg && this.tmp){
      const t = this.tmp.getContext('2d');
      t.globalCompositeOperation = 'source-over'; t.globalAlpha = 1;
      t.clearRect(0, 0, W, H); t.drawImage(this.bg, 0, 0);
      if (!this.alive) subject(t, W, H, pic, this.t, 0, false, fit);
      t.globalCompositeOperation = 'destination-in'; t.drawImage(this.mask, 0, 0, W, H);
      t.globalCompositeOperation = 'source-over';
      c.drawImage(this.tmp, 0, 0);
      /* alive: the whole picture, and the subject off on its way */
      if (this.alive){ c.globalAlpha = k; c.drawImage(this.bg, 0, 0); c.globalAlpha = 1; subject(c, W, H, pic, this.t, this.alive, false, fit); }
    } else if (this.alive) subject(c, W, H, pic, this.t, this.alive, false, fit);
    for (const f of this.flecks){ c.globalAlpha = 1 - f.age / 0.6; c.fillStyle = f.col; c.beginPath(); c.arc(f.x * W, f.y * H, H * 0.006, 0, 6.2832); c.fill(); }
    c.globalAlpha = 1;
    this.avatars.drawMitts(c, W, H, this.players);
  }

  /* the words, and how much of the sky is painted: the goal bar */
  _words(){
    const text = this.alive ? ['Look - a whale!', 'Look - a hot-air balloon!', 'Look - a butterfly!'][this.which] : 'What\u2019s hiding in the sky? Keep painting!';
    if (text !== this.sayText){ this.sayText = text; this.sayAt = this.t; }      /* (the words ease in when they change) */
    return { icon: this.alive ? ['whale', 'sailboat', 'bee'][this.which] : 'paintbrush', text, t: this.t - this.sayAt };
  }

  /* the move card: which move the card in the corner shows right now, or null for none (show it for the first few seconds) */
  card(){ return this.t < 8 ? 'wave' : null; }
  /* the goal bar's three stars are this picture; the badge is the pictures finished (stars) so far */
  hud(){ return { score: this.score, showLives: false, hideScore: true, goal: this.alive ? 1 : this.covered / DONE, words: this._words(),
    badge: this.done ? { icon: 'star', value: this.done } : undefined }; }
  /* big arm sweeps go everywhere; Back on the remote still pauses */
  pausable(){ return false; }
  /* a player's number is their stars: the pictures they helped paint (not how much they painted: a tall arm reaches more) */
  tally(){
    const rows = [];
    for (let i = 0; i < this.players; i++){
      if (!this.stars[i] && !this.score[i] && !pose.players[i].present) continue;
      rows.push({ label: `Player ${i + 1}`, value: this.stars[i], color: PLAYER_COLORS[i] });
    }
    return rows;
  }
  /* nobody beats anybody: with two or more, it's a tie */
  winner(){
    const played = this.score.slice(0, this.players).map((s, i) => i).filter(i => this.score[i] > 0 || pose.players[i].present);
    return played.length < 2 ? null : -1;
  }
  summary(n = 1){
    const w = n > 1 ? 'Together you finished' : 'You finished';
    return this.done ? `${w} ${this.done} ${this.done === 1 ? 'picture' : 'pictures'}!` : 'Lovely painting!';
  }
  value(){ return this.done; }
}

/* ---------- the pictures ---------- */
const PAINT = {
  whale: [WHALE, color('sky.mid'), BELLY],
  balloon: [color('touch.cherry'), color('touch.sunflower'), color('touch.lagoon')],
  butterfly: [color('touch.grape'), color('touch.bubblegum'), color('touch.sunflower')]
};

/* the sky behind every picture: a soft wash, hills, a few clouds */
export function background(c, W, H, pic){
  const g = c.createLinearGradient(0, 0, 0, H * 0.85);
  const top = pic === 'butterfly' ? color('meadow.far') : color('sky.mid');
  g.addColorStop(0, top); g.addColorStop(1, color('touch.sunflower', 'light'));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  const sun = c.createRadialGradient(W * 0.15, H * 0.15, 10, W * 0.15, H * 0.15, H * 0.6);
  sun.addColorStop(0, alpha('sky.sun', 0.85)); sun.addColorStop(1, alpha('sky.sun', 0)); c.fillStyle = sun; c.fillRect(0, 0, W, H);
  for (const [x, y, w] of [[0.2, 0.22, 0.12], [0.82, 0.16, 0.14], [0.72, 0.62, 0.09], [0.12, 0.6, 0.08]]){
    c.globalAlpha = 0.85; c.fillStyle = color('earth.snow');
    c.beginPath(); c.ellipse(x * W, y * H, w * W, w * W * 0.18, 0, 0, 6.2832); c.fill();
    c.beginPath(); c.ellipse(x * W + w * W * 0.2, y * H - w * W * 0.08, w * W * 0.55, w * W * 0.15, 0, 0, 6.2832); c.fill();
    c.globalAlpha = 1;
  }
  for (const [y, col, amp] of [[0.82, color('meadow.soft'), 0.05], [0.9, color('meadow.grass'), 0.04]]){
    c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
    for (let x = 0; x <= W; x += W / 40) c.lineTo(x, H * (y - amp * (0.5 + 0.5 * Math.sin(x / W * 7 + y * 10))));
    c.lineTo(W, H); c.closePath(); c.fill();
  }
  if (pic === 'butterfly'){
    for (let i = 0; i < 40; i++){ const x = ((i * 0.618) % 1) * W, y = H * (0.88 + ((i * 0.37) % 1) * 0.1); c.fillStyle = [color('touch.sunflower'), color('touch.bubblegum'), color('earth.snow')][i % 3]; c.beginPath(); c.arc(x, y, H * 0.008, 0, 6.2832); c.fill(); }
  }
}

/* the subject: drawn in the middle; `alive` seconds into coming alive it
   moves off (0: still); outline: just a faint dashed hint of its shape */
function subject(c, W, H, pic, t, alive, outline, fit = { s: H / 900, x: W * 0.5, y: H * 0.45 }){
  const s = fit.s, X = fit.x, Y = fit.y;
  c.save();
  if (outline){ c.setLineDash([14 * s, 12 * s]); c.lineWidth = 4 * s; c.strokeStyle = alpha('shade.inkSoft', 0.35); }
  if (pic === 'whale'){
    const x = X + W * 0.02 + alive * W * 0.18, y = Y - Math.sin(alive * 2) * H * 0.03;
    whale(c, x, y, s, outline, t);
  } else if (pic === 'balloon'){
    const x = X + Math.sin(t * 0.8) * W * 0.005 + alive * W * 0.04, y = Y - alive * alive * H * 0.03;
    hotAir(c, x, y, s, outline);
  } else {
    const x = X + alive * W * 0.12 + Math.sin(alive * 3) * W * 0.03, y = Y - alive * H * 0.07 + Math.sin(alive * 5) * H * 0.02;
    butterfly(c, x, y, s, outline, alive ? t : 0);
  }
  c.restore();
}

function cel(c, path, col, shade = alpha('shade.shadow', 0.2), ox = 0.6, oy = 0.5, r = 1){ /* fill a shape, then its shadow side */
  c.fillStyle = col; path(); c.fill();
  c.save(); path(); c.clip(); c.fillStyle = shade; c.beginPath(); c.ellipse(ox, oy, r, r, 0, 0, 6.2832); c.fill(); c.restore();
}

export function whale(c, x, y, s, outline, t){
  const body = () => { c.beginPath(); c.ellipse(x, y, 260 * s, 120 * s, -0.08, 0, 6.2832); };
  const tail = () => { c.beginPath(); c.moveTo(x - 240 * s, y - 10 * s); c.lineTo(x - 380 * s, y - 110 * s); c.lineTo(x - 350 * s, y + 20 * s); c.lineTo(x - 390 * s, y + 110 * s); c.closePath(); };
  if (outline){ body(); c.stroke(); tail(); c.stroke(); return; }
  c.fillStyle = WHALE_SHADE; tail(); c.fill();
  cel(c, body, WHALE, WHALE_SHADE, x + 80 * s, y + 70 * s, 260 * s);
  c.save(); body(); c.clip(); c.fillStyle = BELLY; c.beginPath(); c.ellipse(x + 20 * s, y + 95 * s, 230 * s, 60 * s, 0, 0, 6.2832); c.fill(); c.restore();
  c.fillStyle = WHALE_SHADE; c.beginPath(); c.ellipse(x + 40 * s, y + 70 * s, 70 * s, 26 * s, 0.5 + Math.sin(t * 3) * 0.15, 0, 6.2832); c.fill();
  c.fillStyle = color('shade.ink'); c.beginPath(); c.arc(x + 170 * s, y - 20 * s, 14 * s, 0, 6.2832); c.fill();
  c.fillStyle = color('earth.snow'); c.beginPath(); c.arc(x + 166 * s, y - 25 * s, 5 * s, 0, 6.2832); c.fill();
  c.strokeStyle = color('shade.ink'); c.lineWidth = 6 * s; c.lineCap = 'round'; c.beginPath(); c.arc(x + 200 * s, y + 20 * s, 34 * s, 0.2, 1.3); c.stroke();
  c.fillStyle = alpha('fav.pink', 0.45); c.beginPath(); c.ellipse(x + 120 * s, y + 10 * s, 22 * s, 13 * s, 0, 0, 6.2832); c.fill();
  c.fillStyle = color('touch.lagoon', 'light');
  for (const [dx, dy, r] of [[0, -150, 16], [-30, -185, 12], [30, -185, 12], [-50, -215, 9], [50, -215, 9]]){ c.beginPath(); c.arc(x + 60 * s + dx * s, y + dy * s - Math.abs(Math.sin(t * 2)) * 10 * s, r * s, 0, 6.2832); c.fill(); }
}

export function hotAir(c, x, y, s, outline){
  const env = () => { c.beginPath(); c.moveTo(x, y + 180 * s); c.bezierCurveTo(x - 260 * s, y + 20 * s, x - 200 * s, y - 230 * s, x, y - 230 * s); c.bezierCurveTo(x + 200 * s, y - 230 * s, x + 260 * s, y + 20 * s, x, y + 180 * s); c.closePath(); };
  const basket = () => { c.beginPath(); c.roundRect(x - 50 * s, y + 250 * s, 100 * s, 70 * s, 10 * s); };
  if (outline){ env(); c.stroke(); basket(); c.stroke(); return; }
  c.fillStyle = color('touch.cherry'); env(); c.fill();
  c.save(); env(); c.clip();
  c.fillStyle = color('touch.sunflower'); for (const dx of [-120, 0, 120]){ c.beginPath(); c.ellipse(x + dx * s, y - 20 * s, 36 * s, 260 * s, 0, 0, 6.2832); c.fill(); }
  c.fillStyle = alpha('shade.shadow', 0.2); c.beginPath(); c.ellipse(x + 160 * s, y + 40 * s, 170 * s, 300 * s, 0, 0, 6.2832); c.fill();
  c.restore();
  c.strokeStyle = color('earth.bark'); c.lineWidth = 4 * s;
  for (const d of [-1, 1]){ c.beginPath(); c.moveTo(x + d * 70 * s, y + 140 * s); c.lineTo(x + d * 45 * s, y + 252 * s); c.stroke(); }
  c.fillStyle = color('earth.clay', 'shade'); basket(); c.fill();
  c.fillStyle = alpha('shade.shadow', 0.2); c.fillRect(x + 15 * s, y + 252 * s, 35 * s, 66 * s);
}

function butterfly(c, x, y, s, outline, t){
  const flap = 0.55 + 0.45 * Math.abs(Math.cos(t * 9));
  const wing = (d, big) => () => { c.beginPath(); c.ellipse(x + d * (big ? 120 : 95) * s * flap, y + (big ? -60 : 70) * s, (big ? 135 : 95) * s * flap, (big ? 110 : 80) * s, d * (big ? -0.5 : 0.4), 0, 6.2832); };
  if (outline){ for (const d of [-1, 1]){ wing(d, true)(); c.stroke(); wing(d, false)(); c.stroke(); } return; }
  for (const d of [-1, 1]){
    cel(c, wing(d, true), color('touch.grape'), alpha('shade.shadow', 0.2), x + d * 170 * s, y - 10 * s, 120 * s);
    cel(c, wing(d, false), color('touch.bubblegum'), alpha('shade.shadow', 0.2), x + d * 130 * s, y + 110 * s, 80 * s);
    c.fillStyle = color('touch.sunflower'); c.beginPath(); c.arc(x + d * 130 * s * flap, y - 70 * s, 28 * s, 0, 6.2832); c.fill();
    c.fillStyle = color('earth.snow'); c.beginPath(); c.arc(x + d * 100 * s * flap, y + 75 * s, 16 * s, 0, 6.2832); c.fill();
  }
  c.fillStyle = color('fur.charcoal'); c.beginPath(); c.ellipse(x, y + 10 * s, 18 * s, 120 * s, 0, 0, 6.2832); c.fill();
  c.beginPath(); c.arc(x, y - 120 * s, 26 * s, 0, 6.2832); c.fill();
  c.strokeStyle = color('fur.charcoal'); c.lineWidth = 5 * s; c.lineCap = 'round';
  for (const d of [-1, 1]){ c.beginPath(); c.moveTo(x + d * 8 * s, y - 140 * s); c.quadraticCurveTo(x + d * 40 * s, y - 210 * s, x + d * 70 * s, y - 220 * s); c.stroke(); }
  c.fillStyle = color('earth.snow'); for (const d of [-1, 1]){ c.beginPath(); c.arc(x + d * 10 * s, y - 124 * s, 6 * s, 0, 6.2832); c.fill(); }
}

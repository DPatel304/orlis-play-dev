/* Sky Painter: the sky is covered over, and your hands are brushes. Scrub and scrub: the cover wears away, layer by layer, and a picture
   that was hiding underneath shows through - a whale, a hot-air balloon, a butterfly. Nothing says what it is (no outline, no hint) until
   it's uncovered. Wear enough of it away and the whole picture comes alive - the whale swims off, the balloon floats away - and there's a
   new cover for the next one.

   The covers (sky-covers.js): clouds, a frosty window, deep snow, car-wash foam, beach sand; a different one for each picture, chosen in turn so
   no two in a row are the same. Each has three layers, and each layer looks and sounds different as it goes. A spot of paper has to be
   scrubbed over again and again: how much is how far a hand has travelled over it, so a hand resting on a spot does next to nothing and a
   scrub back and forth wears it through. A picture takes about a minute alone and half a minute for four.

   No score to chase, nothing to lose: the calm one. What counts is pictures finished, and a star for everyone who helped uncover
   one (the only per-player number; how much each hand wore away is kept inside, for the tests, and never shown). First
   person: the players are their hands, and every hand is a brush.

   The paper is fitted to the people playing: its top is the highest the shortest player can reach, and the picture is scaled
   to sit inside it (above that the sky is already clear, and so is the corner the move card covers). A picture that
   stalls for STALL seconds, after a real start, is helped along - the wearing spreads like watercolour from what's clear - so it always finishes.

   How much is worn is kept on a coarse grid (GRID), a wear count for each cell; the layers are drawn on offscreen canvases that are
   rubbed out cell by cell as the counts rise. */
import { color, alpha, tone } from './assets/palette.js';
import { Juice, fxState } from './common.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { sfx } from '../audio/sound.js';
import { Avatars } from '../ui/avatars.js';
import { L } from '../tracking/pose-shared.js';
import { hudZones } from './hud.js';
import { COVERS, dice, scrubSound, fanfare, makeBit, burst, stepBit, drawBit } from './sky-covers.js';

export const ROUND = 180;
/* the brush (screen heights across), how much worn through finishes a picture, and how long it plays before the next */
export const BRUSH = 0.28, DONE = 0.8, ALIVE = 5;
/* how thick the covers are: every layer's thickness (in the covers' table, in passes of a hand over a spot) times this. Tuned with the playtest rig:
   a child alone about 60-90 s a picture, four players 30-40 s (docs/playtest/REPORT.md) */
export const THICK = 1.35;
/* ...more for more players, less for more paper (the share of the screen that is paper; a child alone has about half) */
const PLAYERS = 0.35, AREA0 = 1.3, AREA1 = 0.6;
/* if nobody has worn anything through anywhere new for STALL seconds (a layer worn through, FRESH of them, is what counts), the wearing spreads from
   what's clear by itself, like watercolour, but slowly (SPREAD passes a second) - so a child alone, or one who stays in one spot, still sees the
   picture through, after a real effort */
export const STALL = 12, FRESH = 3, SPREAD = 0.45;
/* a star for each picture you helped uncover: at least this many cells' worth of wearing (more than a resting hand does) */
export const HELPED = 60;
/* the spreading only helps once a picture has really been started: this share of the paper is clear (a resting hand does nothing like it) */
export const STARTED = 0.2;
/* the paper is fitted again if a player's reach turns out very different, but only in a picture's first REFIT seconds */
export const REFIT = 8;
/* how high a player reaches, as a number of torsos (shoulder to hip) above the shoulders: about an arm */
export const ARM = 1.0;
/* a hand's strokes count for no more than this many screen heights a frame (3.6 a second: a brisk scrub) */
const FAST = 0.12;
export const GRID = [48, 27];
export const PICTURES = ['whale', 'balloon', 'butterfly'];
export const COVER_IDS = COVERS.map(c => c.id);
export const LAYERS = 3;
/* how many bits fly at most (fewer when the person wants less motion) */
const BITS = 90, BITS_CALM = 24;
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
const wantsCalm = () => { try { return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };

/* How high up the picture this player can paint (0 is the top of the screen), from their shoulders and torso, or null when there's
   nothing to go on (no camera landmarks: the mouse, a test). This is its own measure on purpose, not games/reach.js (the shared reach band, for placing
   things: arm-based and smoothed): the paper's fit and its tests are tuned to this torso-based top, and switching moves where the paper starts. */
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
    this.spreadN = 0;            /* cells the spreading wore through by itself (the help along) */
    this.stars = Array.from({ length: MAX_PLAYERS }, () => 0);   /* each player's stars: pictures they helped uncover */
    this.reach = {};             /* each player's reach (the top of what they can paint), smoothed */
    this.which = 0;              /* the picture now */
    this.alive = 0;              /* seconds since it came alive (0: still covered) */
    this.last = {};              /* each hand's last place */
    this.bits = [];              /* the bits flying off the cover */
    this.calm = wantsCalm();     /* reduced motion: fewer bits */
    this.rnd = Math.random;
    this.queue = []; this.coverIx = -1; this.pics = 0; this.history = [];
    this.j = new Juice();
    this.avatars = new Avatars();
    this._fresh();
  }

  /* the next cover: all five in a shuffled turn, and never the one just used (not even across two turns) */
  _pickCover(){
    if (!this.queue.length){
      const q = COVERS.map((_, i) => i);
      for (let i = q.length - 1; i > 0; i--){ const j = Math.floor(this.rnd() * (i + 1)); [q[i], q[j]] = [q[j], q[i]]; }
      if (q[0] === this.coverIx){ const j = 1 + Math.floor(this.rnd() * (q.length - 1)); [q[0], q[j]] = [q[j], q[0]]; }
      this.queue = q;
    }
    return this.queue.shift();
  }
  /* (the shots and the tests: this picture again, with this cover) */
  useCover(id){
    const i = COVER_IDS.indexOf(id); if (i < 0) return;
    this.queue = this.queue.filter(x => x !== i); this._fresh(i);
  }

  /* fresh paper under a new cover */
  _fresh(cover = this._pickCover()){
    this.coverIx = cover; this.cover = COVERS[cover]; this.pics++; this.history.push(this.cover.id);
    this.fitArea = 1; this._thicken(1);                /* (cum: the wear at which each layer is gone; made again when the paper is fitted) */
    this.cells = new Uint8Array(GRID[0] * GRID[1]);   /* 1: worn all the way through, or not paper (see _fit) */
    this.ink = new Uint8Array(this.cells.length);     /* 1: worn through by a hand or by the spreading */
    this.out = new Uint8Array(this.cells.length);     /* 1: not paper - already shows the sky; nobody has to wear it */
    this.wear = new Float64Array(this.cells.length);  /* how much each cell has been scrubbed (passes of a hand), up to cum[2] */
    this.started = [0, 0, 0];                         /* cells where each layer has started to wear (not counting what isn't paper) */
    this.live = this.cells.length;                    /* how many cells of paper there are */
    this.painted = 0;                                 /* how many of them are worn through */
    this.alive = 0;
    this.last = {};
    this.still = 0; this.handNew = 0; this.mark = 0;   /* seconds since a layer was worn through anywhere new; layers worn through by hands this picture */
    this.mine = Array.from({ length: MAX_PLAYERS }, () => 0);
    this.top = 0; this.fit = null; this.age = 0;
    this.wl = [0, 0, 0]; this.snd = 0; this.bitDue = 0; this.act = null; this.shown = 0;
    this.cvFresh = true;                              /* (the canvases make this picture's covers) */
    this.dirty = new Set(); this.frames = 0;
  }
  get covered(){ return this.live ? this.painted / this.live : 1; }
  /* the layer a wear count is in (0, 1, 2; 3 when it's all gone) and how far through a layer it is (0..1) */
  layerOf(w){ return w < this.cum[0] ? 0 : w < this.cum[1] ? 1 : w < this.cum[2] ? 2 : 3; }
  prog(w, k){ const lo = k ? this.cum[k - 1] : 0; return Math.max(0, Math.min(1, (w - lo) / (this.cum[k] - lo))); }

  /* How thick the layers are, in passes of a hand over a spot: the cover's own table times THICK, thicker for more players (they share the work,
     but not evenly: more hands are not that many times quicker) and thinner for more paper (a tall player alone has twice the sky to do) */
  _thicken(area){
    let here = 0; for (let i = 0; i < this.players; i++) if (pose.players[i] && pose.players[i].present) here++;
    const k = THICK * (1 + PLAYERS * (Math.max(1, here) - 1)) * (AREA0 - AREA1 * area), th = this.cover.thick.map(v => v * k);
    this.cum = [th[0], th[0] + th[1], th[0] + th[1] + th[2]];
  }

  /* Fit the paper to who's playing: its top is the highest the shortest player can reach, the move card's corner isn't paper, and the
     picture is scaled to sit inside. Done as the picture starts (and again if a player's reach is found to be quite different in its first
     seconds); after that the paper stays, and a player who arrives later waits for the next one - the spreading covers what they can't. */
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
    const away = (c) => { const x = ((c % gx) + 0.5) / gx, y = (((c / gx) | 0) + 0.5) / gy; return y < top || (x < cr && y > ct); };
    let live = 0; for (let c = 0; c < this.out.length; c++) if (!away(c)) live++;
    this._thicken(live / this.out.length);
    const T = this.cum[2], lo = [0, this.cum[0], this.cum[1]];
    this.live = 0; this.painted = 0; this.started = [0, 0, 0];
    for (let c = 0; c < this.out.length; c++){
      const gone = away(c);
      if (gone || this.ink[c]) this.wear[c] = T; else if (this.out[c]) this.wear[c] = 0;     /* (paper that was sky before starts bare-faced) */
      this.out[c] = gone ? 1 : 0; this.cells[c] = gone || this.ink[c] ? 1 : 0;
      if (!gone){ this.live++; if (this.ink[c]) this.painted++; for (let j = 0; j < 3; j++) if (this.wear[c] > lo[j]) this.started[j]++; }
    }
    this.top = top;
    /* the picture: as big as the paper allows (never bigger than it always was), centred on the paper's height */
    const [e0, e1] = EXTENT[this._pic()], mid = (top + BOTTOM) / 2 * H, free = (BOTTOM - top) * H * 0.9;
    const s = Math.min(H / 900, free / (e1 - e0));
    this.fit = { key, row, at: this.age, s, x: W * 0.5, y: mid - s * (e0 + e1) / 2 };
    this.refit = true;                /* (the covers are rubbed out again for the new paper, and the picture made again) */
  }

  step(dt, W, H){
    this.t += dt;
    this.j.step(dt);
    if (this.t >= ROUND) this.over = true;
    const aspect = W / H;
    this._fit(W, H, dt);
    this.wl[0] = this.wl[1] = this.wl[2] = 0;

    if (this.alive){
      this.alive += dt;
      if (this.alive > ALIVE){ this.which = (this.which + 1) % PICTURES.length; this._fresh(); sfx.whoosh?.(); }
    } else {
      /* every hand wears away a stroke from where it was to where it is */
      for (let i = 0; i < this.players; i++){
        const p = pose.players[i];
        if (!p || !p.present){ delete this.last[i + 'l']; delete this.last[i + 'r']; continue; }
        const hands = pose.mouse.active ? [['r', p.hands.right]] : [['l', p.hands.left], ['r', p.hands.right]];
        for (const [k, h] of hands){
          if (!h || h.x < -0.1 || h.x > 1.1) continue;
          const key = i + k, from = this.last[key] || { x: h.x, y: h.y };
          this._stroke(i, from.x, from.y, h.x, h.y, aspect);
          this.last[key] = { x: h.x, y: h.y };
        }
      }
      this._flurry(dt);
      /* nobody wearing through anywhere new for a while: the wearing spreads from what's clear, so the picture always finishes */
      if (this.handNew - this.mark >= FRESH){ this.still = 0; this.mark = this.handNew; } else this.still += dt;
      if (this.still > STALL && this.covered >= STARTED) this._spread(dt);
      if (this.covered >= DONE){
        this.alive = 0.001; this.done++;
        for (let i = 0; i < this.players; i++) if (this.mine[i] >= HELPED) this.stars[i]++;
        fanfare(sfx, this.cover);
        this.bits.push(...burst(this.cover, this.calm ? 10 : 36, this.rnd));
      }
    }
    for (const b of this.bits) stepBit(b, dt);
    this.bits = this.bits.filter(b => b.age < b.life);
    this.avatars.step(dt, this.players);
  }

  _pic(){ return PICTURES[this.which]; }

  /* the sound and the bits of scrubbing, for what the hands wore away this frame (a layer's own sound, a few bits at a time) */
  _flurry(dt){
    const wl = this.wl, total = wl[0] + wl[1] + wl[2];
    this.snd -= dt;
    if (total < 0.3 || !this.act) return;
    const layer = wl[0] >= wl[1] && wl[0] >= wl[2] ? 0 : wl[1] >= wl[2] ? 1 : 2;
    if (this.snd <= 0) this.snd = scrubSound(sfx, this.cover, layer, this.rnd);
    this.bitDue += total * (this.calm ? 0.05 : 0.14);
    const cap = this.calm ? BITS_CALM : BITS, a = this.act;
    for (let n = 0; this.bitDue >= 1 && n < (this.calm ? 1 : 3); n++, this.bitDue -= 1)
      if (this.bits.length < cap) this.bits.push(makeBit(this.cover, layer, a.x, a.y, a.dx, a.dy, this.rnd, this.calm));
    this.bitDue = Math.min(this.bitDue, 3);
  }

  /* add wear to a cell, and what follows: layers worn through, the cell clear, whose it is (who: the player, or -1 for the spreading) */
  _wear(who, n, w){
    const T = this.cum, wb = this.wear[n];
    if (this.out[n] || wb >= T[2] || !(w > 0)) return;
    const wa = Math.min(T[2], wb + w), eff = wa - wb, lb = this.layerOf(wb), la = this.layerOf(wa);
    this.wear[n] = wa; this.wl[lb] += eff; this.dirty.add(n);
    if (wb <= 0 && wa > 0) this.started[0]++;
    if (wb <= T[0] && wa > T[0]) this.started[1]++;
    if (wb <= T[1] && wa > T[1]) this.started[2]++;
    if (who >= 0){ this.mine[who] += eff / T[2]; this.handNew += la - lb; }
    if (la === 3){
      this.cells[n] = 1; this.ink[n] = 1; this.painted++;
      if (who >= 0) this.score[who]++; else this.spreadN++;
    }
  }

  /* the wearing spreads: cells next to ones that are clear wear a little by themselves (nobody's, so no one's count goes up) */
  _spread(dt){
    const [gx, gy] = GRID, cl = (c) => this.cells[c] && !this.out[c];
    const edge = [];
    for (let c = 0; c < this.cells.length; c++){
      if (this.cells[c]) continue;
      const x = c % gx, y = (c / gx) | 0; let near = false;
      for (let dy = -1; dy <= 1 && !near; dy++) for (let dx = -1; dx <= 1; dx++){
        const xx = x + dx, yy = y + dy;
        if ((dx || dy) && xx >= 0 && xx < gx && yy >= 0 && yy < gy && cl(yy * gx + xx)){ near = true; break; }
      }
      if (near) edge.push(c);
    }
    for (const c of edge) this._wear(-1, c, SPREAD * dt * (0.5 + this.rnd()));
  }

  /* wear along a line: the grid's cells it passes over, by how far the hand has travelled (a resting hand wears nothing) */
  _stroke(who, x0, y0, x1, y1, aspect){
    const r = BRUSH / 2, len = Math.hypot((x1 - x0) * aspect, y1 - y0);
    if (len < 1e-5 || len > 1.2) return;                    /* (not moved; or a jump, not a stroke) */
    /* (scrubbing as fast as a hand can fly counts for no more than FAST screen heights a frame: beyond that it's flailing) */
    const gap = r * 0.5, steps = Math.max(1, Math.ceil(len / gap)), per = Math.min(len, FAST) / steps / gap * 0.375;
    const [gx, gy] = GRID;
    for (let s = 1; s <= steps; s++){
      const x = x0 + (x1 - x0) * s / steps, y = y0 + (y1 - y0) * s / steps;
      /* the cells within the brush (in screen heights, so it's round); the middle of the brush wears most */
      const cx0 = Math.max(0, Math.floor((x - r / aspect) * gx)), cx1 = Math.min(gx - 1, Math.floor((x + r / aspect) * gx));
      const cy0 = Math.max(0, Math.floor((y - r) * gy)), cy1 = Math.min(gy - 1, Math.floor((y + r) * gy));
      for (let cy = cy0; cy <= cy1; cy++) for (let cx = cx0; cx <= cx1; cx++){
        const mx = ((cx + 0.5) / gx - x) * aspect, my = (cy + 0.5) / gy - y, d2 = (mx * mx + my * my) / (r * r);
        if (d2 >= 1) continue;
        this._wear(who, cy * gx + cx, per * (1 - d2));
      }
    }
    this.act = { x: x1, y: y1, dx: (x1 - x0) * 30, dy: (y1 - y0) * 30 };
  }

  /* ---------- the canvases ---------- */

  /* the canvases for this screen size */
  _make(W, H){
    const key = W + 'x' + H;
    if (this.size === key || this._noCanvas) return;
    const mk = () => canvas(W, H), bg = mk(), sub = mk(), vis = [mk(), mk(), mk()];
    const R = Math.ceil(Math.max(W / GRID[0], H / GRID[1]) * 1.25), sprite = canvas(R * 2, R * 2);
    if (!bg || !sub || vis.some(v => !v) || !sprite){ this._noCanvas = true; return; }
    /* the little soft round that rubs a cell out */
    const s = sprite.getContext('2d'), g = s.createRadialGradient(R, R, 0, R, R, R);
    g.addColorStop(0, color('shade.ink')); g.addColorStop(0.55, color('shade.ink')); g.addColorStop(1, alpha('shade.ink', 0));
    s.fillStyle = g; s.fillRect(0, 0, R * 2, R * 2);
    this.size = key;
    this.cv = { bg, sub, vis, tex: [null, null, null], sprite, R };
    this.cvFresh = true;
  }

  /* what has to be (re)made, a little at a time: the sky behind, then the layers' textures (one a frame, the top one first), then the
     rubbing out of what's already worn */
  _bake(W, H){
    const cv = this.cv, [gx, gy] = GRID;
    if (this.cvFresh){
      this.cvFresh = false; this.refit = false;
      this.bgOk = false; this.subOk = false; this.texOk = [false, false, false]; this.visOk = [false, false, false];
      this.drawn = [0, 1, 2].map(() => new Uint8Array(gx * gy));
    }
    if (this.refit){ this.refit = false; this.subOk = false; this.visOk = [false, false, false]; }
    if (!this.bgOk){ const b = cv.bg.getContext('2d'); b.clearRect(0, 0, W, H); background(b, W, H, this._pic()); this.bgOk = true; }
    const k = this.texOk.indexOf(false);
    if (k >= 0 && this.frames >= k){
      const t = cv.tex[k] || (cv.tex[k] = canvas(W, H));
      if (t){ const c = t.getContext('2d'); c.clearRect(0, 0, W, H); c.save(); this.cover.bake[k](c, W, H, dice(this.pics * 7919 + k * 131 + this.coverIx * 17)); c.restore(); }
      this.texOk[k] = true;
    }
    for (let j = 0; j < 3; j++){
      if (!this.texOk[j] || this.visOk[j] || !cv.tex[j]) continue;
      const c = cv.vis[j].getContext('2d'); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1; c.clearRect(0, 0, W, H); c.drawImage(cv.tex[j], 0, 0);
      this.visOk[j] = true; this.drawn[j].fill(0);
      for (let n = 0; n < this.cells.length; n++) this.dirty.add(n);        /* (everything worn so far is rubbed out of it again) */
    }
    if (!this.subOk && this.painted > 0 && !this.alive){
      const c = cv.sub.getContext('2d'); c.clearRect(0, 0, W, H);
      subject(c, W, H, this._pic(), this.t, 0, this.fit || { s: H / 900, x: W * 0.5, y: H * 0.45 }); this.subOk = true;
    }
  }

  /* rub out the cells whose wear has moved on: a soft round, as much as it has moved since it was last drawn */
  _sync(W, H){
    if (!this.dirty.size) return;
    const cv = this.cv, [gx, gy] = GRID, cw = W / gx, ch = H / gy, R = cv.R;
    for (let j = 0; j < 3; j++){
      if (!this.visOk[j]) continue;
      const c = cv.vis[j].getContext('2d'), dr = this.drawn[j]; c.globalCompositeOperation = 'destination-out';
      for (const n of this.dirty){
        const p = this.prog(this.wear[n], j), q = p >= 1 ? 7 : Math.floor(p * 6), d = dr[n];
        if (q <= d) continue;
        const h = (n * 2654435761 >>> 0) / 4294967296, jx = (h - 0.5) * cw * 0.3, jy = (((h * 977) % 1) - 0.5) * ch * 0.3;
        c.globalAlpha = q === 7 ? 1 : (q - d) / (6 - d);
        c.drawImage(cv.sprite, ((n % gx) + 0.5) * cw + jx - R, (((n / gx) | 0) + 0.5) * ch + jy - R);
        dr[n] = q;
      }
      c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    }
    this.dirty.clear();
  }

  draw(c, W, H){
    this._make(W, H);
    const pic = this._pic(), k = this.alive ? Math.min(1, this.alive / 0.8) : 0, fit = this.fit || { s: H / 900, x: W * 0.5, y: H * 0.45 };
    if (this._noCanvas){
      c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
      if (this.alive) subject(c, W, H, pic, this.t, this.alive, fit);
    } else {
      const cv = this.cv; this._bake(W, H); this._sync(W, H); this.frames++;
      c.drawImage(cv.bg, 0, 0);
      /* the picture: nothing of it is drawn until some of it is uncovered (and then it only shows through the holes) */
      if (this.alive) subject(c, W, H, pic, this.t, this.alive, fit);
      else if (this.painted > 0 && this.subOk){ c.drawImage(cv.sub, 0, 0); this.shown++; }
      /* the covers, the deepest layer first (a layer only matters once the one above has begun to wear; when it's alive they melt away) */
      c.globalAlpha = 1 - k;
      for (let j = 2; j >= 0; j--) if (this.visOk[j] && (j === 0 || this.started[j - 1] > 0) && k < 1) c.drawImage(cv.vis[j], 0, 0);
      c.globalAlpha = 1;
    }
    if (!fxState.hidden) for (const b of this.bits) drawBit(c, b, W, H);
    c.globalAlpha = 1;
    this.avatars.drawMitts(c, W, H, this.players);
  }

  /* the words: what to do with this cover, then what the picture is */
  _words(){
    const text = this.alive ? ['Look - a whale!', 'Look - a hot-air balloon!', 'Look - a butterfly!'][this.which] : this.cover.hint;
    if (text !== this.sayText){ this.sayText = text; this.sayAt = this.t; }      /* (the words ease in when they change) */
    return { icon: this.alive ? ['whale', 'sailboat', 'bee'][this.which] : this.cover.icon, text, t: this.t - this.sayAt };
  }

  /* the move card: which move the card in the corner shows right now, or null for none (show it for the first few seconds) */
  card(){ return this.t < 8 ? 'wave' : null; }
  /* no goal bar (a picture is a surprise: nothing says how far there is to go); the badge is the pictures finished (stars) so far */
  hud(){ return { score: this.score, showLives: false, hideScore: true, words: this._words(),
    badge: this.done ? { icon: 'star', value: this.done } : undefined }; }
  /* big arm sweeps go everywhere; Back on the remote still pauses */
  pausable(){ return false; }
  /* a player's number is their stars: the pictures they helped uncover (not how much they scrubbed: a tall arm reaches more) */
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
    return this.done ? `${w} ${this.done} ${this.done === 1 ? 'picture' : 'pictures'}!` : 'Lovely scrubbing!';
  }
  value(){ return this.done; }
}

/* ---------- the pictures ---------- */

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

/* the subject: drawn in the middle; `alive` seconds into coming alive it moves off (0: still) */
function subject(c, W, H, pic, t, alive, fit = { s: H / 900, x: W * 0.5, y: H * 0.45 }){
  const s = fit.s, X = fit.x, Y = fit.y;
  c.save();
  if (pic === 'whale'){
    const x = X + W * 0.02 + alive * W * 0.18, y = Y - Math.sin(alive * 2) * H * 0.03;
    whale(c, x, y, s, false, t);
  } else if (pic === 'balloon'){
    const x = X + Math.sin(t * 0.8) * W * 0.005 + alive * W * 0.04, y = Y - alive * alive * H * 0.03;
    hotAir(c, x, y, s, false);
  } else {
    const x = X + alive * W * 0.12 + Math.sin(alive * 3) * W * 0.03, y = Y - alive * H * 0.07 + Math.sin(alive * 5) * H * 0.02;
    butterfly(c, x, y, s, alive ? t : 0);
  }
  c.restore();
}

function cel(c, path, col, shade = alpha('shade.shadow', 0.2), ox = 0.6, oy = 0.5, r = 1){ /* fill a shape, then its shadow side */
  c.fillStyle = col; path(); c.fill();
  c.save(); path(); c.clip(); c.fillStyle = shade; c.beginPath(); c.ellipse(ox, oy, r, r, 0, 0, 6.2832); c.fill(); c.restore();
}

/* (the fifth thing, once an outline, is kept so the menu's cover can still call this: it is never used) */
export function whale(c, x, y, s, _unused, t){
  const body = () => { c.beginPath(); c.ellipse(x, y, 260 * s, 120 * s, -0.08, 0, 6.2832); };
  const tail = () => { c.beginPath(); c.moveTo(x - 240 * s, y - 10 * s); c.lineTo(x - 380 * s, y - 110 * s); c.lineTo(x - 350 * s, y + 20 * s); c.lineTo(x - 390 * s, y + 110 * s); c.closePath(); };
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

export function hotAir(c, x, y, s, _unused){
  const env = () => { c.beginPath(); c.moveTo(x, y + 180 * s); c.bezierCurveTo(x - 260 * s, y + 20 * s, x - 200 * s, y - 230 * s, x, y - 230 * s); c.bezierCurveTo(x + 200 * s, y - 230 * s, x + 260 * s, y + 20 * s, x, y + 180 * s); c.closePath(); };
  const basket = () => { c.beginPath(); c.roundRect(x - 50 * s, y + 250 * s, 100 * s, 70 * s, 10 * s); };
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

function butterfly(c, x, y, s, t){
  const flap = 0.55 + 0.45 * Math.abs(Math.cos(t * 9));
  const wing = (d, big) => () => { c.beginPath(); c.ellipse(x + d * (big ? 120 : 95) * s * flap, y + (big ? -60 : 70) * s, (big ? 135 : 95) * s * flap, (big ? 110 : 80) * s, d * (big ? -0.5 : 0.4), 0, 6.2832); };
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

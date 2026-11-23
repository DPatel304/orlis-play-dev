/* Peekaboo Garden (plan package K4): one phone is the hider, the camera players are the seekers whose hands are lanterns.
   This file is the host: it runs the rules (peekaboo/rules.js), turns the seekers' hands into lanterns on the floor (peekaboo/camera.js),
   talks to the hider's tablet (the pads API: input in, state and events out) and draws the TV (peekaboo/view.js for the 3D garden; this file for
   the words, the sun and the seekers' portraits on top). Spec: docs/specs/peekaboo-views.md. */
import { createWorld } from './peekaboo/world.js';
import { createRound, LEN, REVEAL_TIME, LIGHT_RADIUS } from './peekaboo/rules.js';
import { floorPoint } from './peekaboo/camera.js';
import { GardenView, loadThree, glLayer } from './peekaboo/view.js';
import { assets } from './assets/index.js';
import { color, alpha } from './assets/palette.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../tracking/pose.js';
import { portrait } from '../ui/avatar-art.js';
import { cubo } from '../ui/look.js';

export const SECS = 90;                       /* more than hide + seek + reveal, so the shell's clock never ends a round first */
const HAND_MEMORY = 0.5;                      /* the busiest hand is the one that moved most over the last half second */
const RUSTLE_SHOW = 1;                        /* the tablet is told which bushes rustled in the last second */
const SEND_GAP = 1 / 20;
let lastView = null;                          /* the previous round's garden, freed when the next one is built */

export default {
  id: 'peekaboo', unit: 'rounds', name: 'Peekaboo Garden', stars: 2, accent: color('meadow.fresh'), secs: SECS, endless: true,
  moves: ['arms'],
  seats: { tracked: [1, 2], pads: [1, 1] },
  pads: { program: '/pads/peekaboo/', need: 'view3d' },
  requiredPads: 1,
  create(n, env = {}) { return new Peekaboo(n, env.pads || null); }
};

const clamp1 = (v) => Math.max(-1, Math.min(1, Number(v) || 0));
export const clock = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

class Peekaboo {
  constructor(players, pads) {
    this.players = players; this.pads = pads;
    this.world = createWorld();
    const seats = (pads && pads.seats) || [];
    const tracked = seats.filter(s => s.kind === 'tracked').map(s => s.n);
    this.seekers = tracked.length ? tracked : Array.from({ length: Math.max(1, Math.min(2, players)) }, (_, i) => i);
    const pad = seats.find(s => s.kind === 'pad');
    this.hiderSeat = pad ? pad.n : null;
    this.round = createRound(this.world, { hider: this.hiderSeat == null ? 0 : this.hiderSeat, seekers: this.seekers });
    this.t = 0; this.over = false; this.result = null; this.seekT = 0; this.foundBy = null;
    this.stick = { x: 0, y: 0 }; this.act = null;
    this.lanterns = []; this.hand = {};            /* seat -> { l, r } the running speed of each hand */
    this.aim = {};                                 /* seat -> the lantern's smoothed floor point */
    this.rustles = [];                             /* [{ placeId, at }] */
    this.fx = [];                                  /* events the view has not seen yet */
    this.dim = 0.5; this.sendIn = 0; this.mood = 0.05;
    this.offs = [];
    this.view = null; this.viewState = ''; this.err = ''; this.told = false;
    if (pads) {
      this.offs.push(pads.on('input', ({ seat, m }) => this._input(seat, m)));
      this.offs.push(pads.on('join', ({ seat }) => { if (this.hiderSeat == null || seat === this.hiderSeat) { this.hiderSeat = seat; this._tell({ e: 'phase', name: this.round.state.phase }); } }));
      this.offs.push(pads.on('leave', () => { this.stick = { x: 0, y: 0 }; }));
      this.offs.push(pads.on('resume', () => this._tell({ e: 'phase', name: this.round.state.phase })));
    }
  }

  /* ----- the hider's tablet ----- */
  _input(seat, m) {
    if (!m || (this.hiderSeat != null && seat !== this.hiderSeat)) return;
    if (this.hiderSeat == null) this.hiderSeat = seat;
    if (m.stick) this.stick = { x: clamp1(m.stick.x), y: clamp1(m.stick.y) };
    if (m.act === 'out') this.act = 'out';
  }
  _tell(m) { if (this.pads) this.pads.send(this.hiderSeat == null ? '*' : this.hiderSeat, m); }

  /* ----- the lanterns: each seeker's busiest hand, as a point on the floor ----- */
  _lanterns(dt, W, H) {
    const out = [], aspect = W > 0 && H > 0 ? W / H : 16 / 9, k = Math.min(1, dt / HAND_MEMORY);
    for (const seat of this.seekers) {
      const p = pose.players[seat];
      if (!p || !p.present || !p.hands) { delete this.aim[seat]; continue; }
      const m = this.hand[seat] || (this.hand[seat] = { l: 0, r: 0 });
      m.l += ((p.hands.left.speed || 0) - m.l) * k; m.r += ((p.hands.right.speed || 0) - m.r) * k;
      const hand = m.l > m.r ? p.hands.left : p.hands.right;
      const f = floorPoint(hand.x, hand.y, aspect); if (!f) { delete this.aim[seat]; continue; }
      const a = this.aim[seat];
      if (!a) this.aim[seat] = { x: f.x, z: f.z };
      else { const e = Math.min(1, dt * 12); a.x += (f.x - a.x) * e; a.z += (f.z - a.z) * e; }
      out.push({ seat, x: this.aim[seat].x, z: this.aim[seat].z });
    }
    return out;
  }

  step(dt, W, H) {
    if (this.over) return;
    dt = Math.min(dt, 0.1);
    const r = this.round, st = r.state;
    /* the round ends after the reveal (play again starts a fresh one with the same hider) */
    if (st.phase === 'reveal' && st.t + dt >= REVEAL_TIME - 1e-6) { this.over = true; this.mood = 0.2; return; }
    this.t += dt;
    const wasSeek = st.phase === 'seek', seekBefore = st.t;
    this.lanterns = st.phase === 'seek' ? this._lanterns(dt, W, H) : [];
    if (!this.told) { this.told = true; this._tell({ e: 'phase', name: st.phase }); }
    const events = r.step(dt, { stick: this.stick, act: this.act, lanterns: this.lanterns });
    this.act = null;
    for (const ev of events) {
      const { type, ...rest } = ev;
      this._tell({ e: type, ...rest }); this.fx.push(ev);
      if (type === 'rustle') this.rustles.push({ placeId: ev.placeId, at: this.t });
      if (type === 'found') { this.foundBy = ev.by; this.seekT = wasSeek ? seekBefore + dt : 0; this.result = 'found'; }
      if (type === 'hidden') { this.result = 'hidden'; this.seekT = LEN.seek; }
    }
    this.rustles = this.rustles.filter(q => this.t - q.at < RUSTLE_SHOW);
    this.mood = st.phase === 'hide' ? 0.05 : st.phase === 'seek' ? 0.3 : 0.55;
    /* the dim in the hide phase eases in and out */
    this.dim += ((st.phase === 'hide' ? 0.5 : 0) - this.dim) * Math.min(1, dt * 5);
    this.sendIn -= dt;
    if (this.pads && this.sendIn <= 0) { this.sendIn = SEND_GAP; this.pads.state(this.snapshot()); }
  }

  /* what the tablet gets: the rules' snapshot plus the lanterns (so it can show the light sweep) and the recent rustles */
  snapshot() {
    return { ...this.round.snapshot(), lanterns: this.lanterns.map(l => ({ x: l.x, z: l.z, seat: l.seat })), rustles: [...new Set(this.rustles.map(q => q.placeId))] };
  }

  /* ----- names and looks (from the seats the session gave us) ----- */
  _seat(n) { return this.pads && this.pads.seats ? this.pads.seats.find(s => s.n === n) : null; }
  nameOf(seat) { const s = this._seat(seat); return (s && s.name) || `Player ${seat + 1}`; }
  lookOf(seat) { const s = this._seat(seat); return (s && s.avatar) || null; }
  colourOf(seat) { return PLAYER_COLORS[seat] || PLAYER_COLORS[0]; }

  /* the line on the TV and on the results */
  line() {
    if (this.result === 'found') return `Found by ${this.nameOf(this.foundBy == null ? this.seekers[0] : this.foundBy)} in ${clock(this.seekT)}!`;
    if (this.result === 'hidden') return 'You stayed hidden!';
    return '';
  }
  summary() { return this.line() || null; }

  /* ----- drawing ----- */
  _model() {
    const st = this.round.state, lit = this.lanterns.some(l => Math.hypot(l.x - st.x, l.z - st.z) <= LIGHT_RADIUS);
    return {
      phase: st.phase, t: st.t, hider: { x: st.x, z: st.z, place: st.place }, meter: st.meter, lit, result: this.result,
      lanterns: this.lanterns.map(l => ({ x: l.x, z: l.z, color: this.colourOf(l.seat) }))
    };
  }
  _startView() {
    if (this.viewState) return;
    this.viewState = 'loading';
    const seat = this.hiderSeat != null ? this._seat(this.hiderSeat) : null;
    loadThree().then((T) => {
      if (this.gone) return;
      if (!T) { this.err = 'no 3D here'; this.viewState = 'failed'; return; }
      try { glLayer(T); if (lastView) lastView.dispose(); this.view = lastView = new GardenView(T, this.world, seat && seat.avatar ? seat.avatar : null); this.viewState = 'ready'; }
      catch (e) { this.err = String((e && e.message) || e); this.viewState = 'failed'; }
    }).catch((e) => { this.err = String((e && e.message) || e); this.viewState = 'failed'; });
  }

  draw(c, W, H) {
    this._startView();
    c.clearRect(0, 0, W, H);                       /* the 2D canvas goes clear: the 3D garden underneath shows */
    if (!this.view) {
      c.fillStyle = color('night.shade'); c.fillRect(0, 0, W, H);
      assets.text(c, this.err || 'Planting the garden…', W / 2, H / 2, H * 0.05, { color: color('shade.paper') });
      return;
    }
    const v = this.view, dt = Math.max(0, this.t - (this._vt || 0)); this._vt = this.t;
    for (const ev of this.fx.splice(0)) if (ev.type === 'rustle') v.rustle(ev.placeId);
    v.update(this._model(), dt);
    v.render();
    this._overlay(c, W, H);
  }

  _overlay(c, W, H) {
    const st = this.round.state, ph = st.phase;
    if (this.dim > 0.01) { c.fillStyle = alpha('shade.shadow', this.dim); c.fillRect(0, 0, W, H); }
    const ink = color('shade.ink');
    if (ph === 'hide') {
      assets.text(c, 'Seekers, close your eyes!', W / 2, H * 0.3, H * 0.075, { outline: ink });
      this._ring(c, W / 2, H * 0.14, H * 0.058, st.t / LEN.hide);
    } else if (ph === 'seek') {
      this._arc(c, W, H, st.t / LEN.seek);
      if (st.t < 2.5) { c.save(); c.globalAlpha = Math.min(1, (2.5 - st.t) * 1.5); assets.text(c, 'Find the hider!', W / 2, H * 0.3, H * 0.07, { outline: ink }); c.restore(); }
    } else if (ph === 'reveal') {
      const k = Math.min(1, st.t / 0.35), pop = 0.7 + 0.3 * (1 - Math.pow(1 - k, 3));
      c.save(); c.translate(W / 2, H * 0.17); c.scale(pop, pop); c.globalAlpha = k;
      assets.text(c, this.line(), 0, 0, H * 0.085, { outline: ink, color: color('ui.gold') }); c.restore();
    }
    this._portraits(c, W, H);
  }

  /* the sun ring fills while the seekers have their eyes closed */
  _ring(c, x, y, r, k) {
    c.save(); c.lineCap = 'round';
    c.lineWidth = r * 0.3; c.strokeStyle = alpha('shade.paper', 0.35); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.stroke();
    c.strokeStyle = color('ui.gold'); c.beginPath(); c.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, k)); c.stroke();
    this._sun(c, x, y, r * 0.55);
    c.restore();
  }
  /* then the sun slides down an arc while they look (no numbers) */
  _arc(c, W, H, k) {
    const at = (u) => ({ x: W * (0.34 + 0.32 * u), y: H * (0.05 + 0.15 * Math.pow(u, 1.6)) });
    c.save(); c.setLineDash([H * 0.012, H * 0.016]); c.lineWidth = H * 0.006; c.lineCap = 'round'; c.strokeStyle = alpha('shade.paper', 0.55);
    c.beginPath(); for (let i = 0; i <= 24; i++) { const p = at(i / 24); if (i) c.lineTo(p.x, p.y); else c.moveTo(p.x, p.y); } c.stroke(); c.restore();
    const p = at(Math.min(1, k)); this._sun(c, p.x, p.y, H * 0.036);
  }
  _sun(c, x, y, r) {
    c.save(); const g = c.createRadialGradient(x, y, r * 0.4, x, y, r * 1.9); g.addColorStop(0, alpha('sky.sunGlow', 0.85)); g.addColorStop(1, alpha('sky.sunGlow', 0));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 1.9, 0, Math.PI * 2); c.fill();
    c.fillStyle = color('sky.sun'); c.strokeStyle = color('shade.ink'); c.lineWidth = Math.max(2, r * 0.12); c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
  }
  /* the seekers, small at the bottom edge, each in their lantern's colour */
  _portraits(c, W, H) {
    const s = H * 0.085, gap = s * 0.35, n = this.seekers.length, x0 = W / 2 - (n * s + (n - 1) * gap) / 2;
    this.seekers.forEach((seat, i) => {
      const x = x0 + i * (s + gap) + s / 2, y = H - s * 0.75, on = this.lanterns.some(l => l.seat === seat) || this.round.state.phase !== 'seek';
      c.save(); c.globalAlpha = on ? 1 : 0.55;
      c.fillStyle = color('shade.card'); c.beginPath(); c.roundRect(x - s * 0.58, y - s * 0.58, s * 1.16, s * 1.16, s * 0.3); c.fill();
      c.lineWidth = Math.max(3, s * 0.09); c.strokeStyle = this.colourOf(seat); c.stroke();
      portrait(c, x, y, s, this.lookOf(seat) || cubo(), this.t);
      c.restore();
    });
  }

  /* ----- the shell's side ----- */
  card() { return null; }
  hud() { return { score: Array.from({ length: Math.max(2, this.players) }, () => 0), showLives: false, hideScore: true, hideClock: true }; }
  pausable() { return true; }
  tally() {
    return Array.from({ length: Math.max(1, Math.min(this.players, MAX_PLAYERS)) }, (_, i) => ({ label: this.nameOf(this.seekers[i] == null ? i : this.seekers[i]), value: this.result === 'found' && this.foundBy === this.seekers[i] ? 1 : 0, color: this.colourOf(this.seekers[i] == null ? i : this.seekers[i]) }));
  }
  winner() { return this.players > 1 ? 0 : null; }
  value() { return this.result ? 1 : 0; }
  destroy() { this.gone = true; this.offs.forEach(f => f()); this.offs = []; if (this.view) { this.view.dispose(); this.view = null; } }
}

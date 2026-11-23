/* The pad lab (owner only; plan package S1): the smallest game that uses a phone. The phone's stick moves a dot on the TV.
   It exists to prove the game API for pads end to end (docs/specs/session.md, "The game API for pads"): the manifest says what it needs
   (`seats`, `pads`, `requiredPads`), the shell hands `create(players, { pads })` the pads object, and the pad program is
   `app/pads/pad-lab/pad.js`, served by the hub at /pads/pad-lab/pad.js. */
import { assets } from '../assets/index.js';
import { color, alpha } from '../assets/palette.js';

export const ROUND = 60;
const SPEED = 0.45;          /* screen widths a second at full stick */

export default {
  id: 'pad-lab', unit: 'dots', name: 'Phone stick (pad test)', stars: 1, accent: color('fav.sky'), secs: ROUND,
  moves: ['phone'], lab: true,
  seats: { tracked: [0, 2], pads: [1, 2] },
  pads: { program: '/pads/pad-lab/', need: 'controller' },
  requiredPads: 1,
  create(n, env = {}){ return new PadLab(n, env.pads || null); }
};

class PadLab {
  constructor(players, pads){
    this.players = players; this.pads = pads; this.t = 0; this.over = false;
    this.dots = {};                       /* seat -> { x, y (0..1), vx, vy } */
    this.heard = 0;                       /* how many inputs came in (the test reads it) */
    this.offs = [];
    if (pads){
      this.offs.push(pads.on('input', ({ seat, m }) => {
        const d = this._dot(seat);
        d.vx = clamp(Number(m.x) || 0); d.vy = clamp(Number(m.y) || 0); this.heard++;
      }));
      this.offs.push(pads.on('join', ({ seat }) => this._dot(seat)));
      this.offs.push(pads.on('leave', ({ seat }) => { const d = this.dots[seat]; if (d){ d.vx = d.vy = 0; } }));
    }
  }
  _dot(seat){ return this.dots[seat] || (this.dots[seat] = { x: 0.5, y: 0.5, vx: 0, vy: 0 }); }
  step(dt){
    this.t += dt;
    for (const d of Object.values(this.dots)){ d.x = Math.max(0.05, Math.min(0.95, d.x + d.vx * SPEED * dt)); d.y = Math.max(0.12, Math.min(0.92, d.y + d.vy * SPEED * dt)); }
    if (this.pads) this.pads.state({ dots: Object.entries(this.dots).map(([seat, d]) => ({ seat: +seat, x: d.x, y: d.y })) });
  }
  colourOf(seat){
    const s = this.pads && this.pads.seats.find(q => q.n === +seat);
    return s && s.colour ? color('fav.' + s.colour) : color('fav.sky');
  }
  draw(c, W, H){
    assets.scene(c, W, H, 'meadow', { t: this.t });
    for (const [seat, d] of Object.entries(this.dots)){
      const r = H * 0.045, x = d.x * W, y = d.y * H;
      c.fillStyle = alpha('shade.shadow', 0.2); c.beginPath(); c.ellipse(x, y + r * 1.05, r * 0.95, r * 0.3, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = this.colourOf(seat); c.strokeStyle = color('shade.ink'); c.lineWidth = Math.max(2, H * 0.006);
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
    }
  }
  hud(){ return { score: [], hideScore: true, hideClock: true, words: { icon: 'hand', text: 'Move the dots', t: 1 } }; }
  pausable(){ return true; }
  tally(){ return []; }
  winner(){ return null; }
  value(){ return 0; }
  destroy(){ this.offs.forEach(f => f()); this.offs = []; }
}
const clamp = (v) => Math.max(-1, Math.min(1, v));

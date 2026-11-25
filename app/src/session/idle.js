/* "Still there?": has anybody been in view and moving lately? A game that never ends on its own (Tower Defense, Last Known Position)
   asks main.js to watch for a quiet minute and then wait behind a calm card (nothing is lost: the game just stops stepping).

   Moving means a body part (head, shoulders, wrists, hips, ankles) has travelled more than MOVE (a share of the picture's width) from where
   it was last counted as still - far more than the tracker's jitter or a breath - or somebody stepped in, or the mouse moved or clicked.
   Standing in view without moving does not count, which is how a child who wandered off but is still "seen" (a sofa, a doorway) is caught. */
export const IDLE_AFTER = 60;     /* seconds of nobody in view or moving */
export const MOVE = 0.04;         /* how far something has to travel to count as moving (share of the picture's width) */
const KEYS = [0, 11, 12, 15, 16, 23, 24, 27, 28];

export class IdleWatch {
  constructor(after = IDLE_AFTER){ this.after = after; this.still = 0; this.anchor = new Map(); this.seen = new Set(); this.mouse = null; }
  reset(){ this.still = 0; this.anchor.clear(); this.seen.clear(); this.mouse = null; }
  /* once a frame: players are pose.players (only the first `n` count), mouse is pose.mouse. Returns true when somebody moved or came in. */
  step(dt, players, n, mouse = null){
    let moved = false;
    const now = new Set();
    for (let i = 0; i < Math.min(n, players.length); i++){
      const p = players[i];
      if (!p || !p.present || !p.lm){ this.anchor.delete(i); continue; }
      now.add(i);
      if (!this.seen.has(i)){ moved = true; this.anchor.delete(i); }       /* somebody stepped in */
      let a = this.anchor.get(i);
      if (!a){ a = {}; this.anchor.set(i, a); }
      for (const k of KEYS){
        const l = p.lm[k]; if (!l || (l.v ?? l.visibility ?? 1) < 0.5) continue;
        if (!a[k]) a[k] = { x: l.x, y: l.y };
        else if (Math.hypot(l.x - a[k].x, l.y - a[k].y) > MOVE){ moved = true; a[k] = { x: l.x, y: l.y }; }
      }
    }
    this.seen = now;
    if (mouse && mouse.active){
      const m = this.mouse;
      if (m && (Math.hypot(mouse.x - m.x, mouse.y - m.y) > 0.01 || mouse.clicks !== m.clicks)) moved = true;
      this.mouse = { x: mouse.x, y: mouse.y, clicks: mouse.clicks };
    }
    if (moved) this.still = 0; else this.still += dt;
    return moved;
  }
  get idle(){ return this.still >= this.after; }
}

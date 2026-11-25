/* The magnet (decision 0061): a hand marker near a target is gently pulled toward the target's centre, so holding on it is easy for a shaky hand.
   Only what is drawn moves: what the hand touches is still worked out from the hand itself. Cubo's Create sets the targets each frame
   (centres and radii as shares of the picture: x of its width, y of its height, r of its height) and clears them when it goes.
   (Its own file: the cursor draws the marker and Cubo's Create sets the pull; neither needs the other.) */
export const MAGNET_REACH = 1.0;     /* the pull starts this far from a target's centre, in its radius (a target's radius is about half its smaller side, plus a little) */
export const MAGNET_PULL = 0.6;      /* how much of the way to the centre a marker is drawn when it is right on the centre's doorstep */

export const magnet = {
  targets: [],
  set(list){ this.targets = list || []; },
  clear(){ this.targets = []; },
  /* where a marker at (x, y) is drawn */
  pull(x, y, aspect = 16 / 9){
    let best = null, bd = Infinity;
    for (const t of this.targets){
      const d = Math.hypot((t.x - x) * aspect, t.y - y);
      if (d < t.r * MAGNET_REACH && d < bd){ best = t; bd = d; }
    }
    if (!best) return { x, y };
    const f = 1 - bd / (best.r * MAGNET_REACH), m = MAGNET_PULL * f * f * (3 - 2 * f);       /* (smooth: none at the edge, most near the middle) */
    return { x: x + (best.x - x) * m, y: y + (best.y - y) * m };
  }
};

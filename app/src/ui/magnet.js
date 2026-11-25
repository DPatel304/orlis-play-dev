/* The magnet (decision 0061): a hand marker near a target is gently pulled toward the target's centre, so holding on it is easy for a shaky hand.
   Only what is drawn moves: what the hand touches is still worked out from the hand itself. Cubo's Create sets the targets each frame
   (centres and radii as shares of the picture: x of its width, y of its height, r of its height) and clears them when it goes.
   (Its own file: the cursor draws the marker and Cubo's Create sets the pull; neither needs the other. The pull itself is handfeel.js's.) */
import { pull } from './handfeel.js';
export const MAGNET_REACH = 1.0;     /* the pull starts this far from a target's centre, in its radius (a target's radius is about half its smaller side, plus a little) */
export const MAGNET_PULL = 0.6;      /* how much of the way to the centre a marker is drawn when it is right on the centre's doorstep */

export const magnet = {
  targets: [],
  set(list){ this.targets = list || []; },
  clear(){ this.targets = []; },
  /* where a marker at (x, y) is drawn (the one pull in the app, handfeel.js, with the magnet's own numbers) */
  pull(x, y, aspect = 16 / 9){
    return pull(x, y, this.targets, aspect, { reachMul: MAGNET_REACH, reachAdd: 0, k: MAGNET_PULL });
  }
};

/* Cubo for the screens that aren't the game: a little canvas where he moves, stop-motion, on his own (no card). One call puts
   him in an element; he stops by himself when the element leaves the page. */
import { drawFigure, frameAt } from '../games/figure.js';

/* pose: one of the move cards' names (the cover marches, the results dance, the pause freezes). face: force one face
   (otherwise the pose's own faces, one for each drawing). Returns the canvas. */
export function cubo(parent, { pose = 'dance', face = null, className = 'cubo' } = {}){
  const cv = document.createElement('canvas'); cv.className = className; parent.appendChild(cv);
  const ctx = cv.getContext('2d'), t0 = performance.now();
  let raf = 0;
  const tick = () => {
    if (!cv.isConnected){ return; }                                   /* (gone: stop) */
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.max(2, Math.round(r.width * dpr)), h = Math.max(2, Math.round(r.height * dpr));
    if (cv.width !== w || cv.height !== h){ cv.width = w; cv.height = h; }
    ctx.clearRect(0, 0, w, h);
    drawFigure(ctx, pose, w / 2, h * 0.62, Math.min(w, h) * 0.3, (performance.now() - t0) / 1000, face, false);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return cv;
}
export { frameAt };

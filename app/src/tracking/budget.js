/* How much work the camera is allowed to cost. Small decisions, kept apart
   from the tracker so they can be tested and tuned in one place.

   - CAM / HD: what the camera is asked for. The body tracker shrinks every
     picture to a small square anyway, so a big one costs capture and upload
     time for nothing; 640 wide is plenty (Settings can ask for the sharp one).
   - posesWanted: how many people to look for - the players, plus one
     watcher's worth of room - not always the most it can.
   - nextSkip: when one look takes longer than a frame, look at every 2nd
     (or 3rd) frame instead of stuttering; back to every frame when it's easy.
   - idle: nobody in view for a few seconds - look only now and then until
     someone steps in.
   - renderScale: the game's picture isn't drawn at more pixels than a TV can
     use (a 4K screen would be four times the drawing for little to see).      */
export const CAM = { width: 640, height: 360, frameRate: 30 };
export const HD = { width: 1280, height: 720, frameRate: 30 };

export const posesWanted = (players, max = 4) => Math.max(1, Math.min(max, Math.round(players || 1) + 1));

export const SLOW_MS = 32, EASY_MS = 12, MAX_SKIP = 3;
export function nextSkip(skip, inferMs){
  if (inferMs > SLOW_MS && skip < MAX_SKIP) return skip + 1;
  if (inferMs < EASY_MS && skip > 1) return skip - 1;
  return skip;
}

export const IDLE_AFTER = 3;        /* seconds with nobody in view before slowing down */
export const IDLE_EVERY_MS = 250;   /* ...to a look this often */
export const isIdle = (emptyForSeconds) => emptyForSeconds > IDLE_AFTER;

export const MAX_PIXELS = 2.6e6;    /* about a 1080p screen and a bit */
export function renderScale(cssW, cssH, dpr = 1, maxDpr = 2, maxPixels = MAX_PIXELS){
  let d = Math.min(maxDpr, dpr || 1);
  const px = cssW * cssH * d * d;
  if (px > maxPixels) d *= Math.sqrt(maxPixels / px);
  return Math.max(0.5, d);
}

/* Sharper camera (Settings > Testing > "Sharper camera"; off unless the owner turns it on). Two asks of the camera, both only asks:

   1. 60 FRAMES A SECOND where the camera can. getUserMedia is asked for frameRate ideal 60 (an ideal never makes it fail: a camera that
      cannot just gives what it has), and afterwards, if the track says its range reaches 60 but it is running slower, one more
      applyConstraints asks again. The tracker still takes at most about one look every MIN_LOOK_GAP_MS (pose.js): more frames mean a
      fresher picture for each look, not more work.
   2. A SHORTER EXPOSURE where the room is bright enough. Motion blur is exposure time: a hand moving across the frame at 33 ms of
      exposure is a smear. Where the track reports exposureMode 'manual' and an exposureTime range (Chrome: MediaStreamTrack.getCapabilities,
      units of 100 microseconds), and the picture is bright (mean luminance, lighting.js), exposure is halved. If the picture then gets too
      dark it goes back to the camera's own automatic exposure. Never more than one change in COOLDOWN_MS.

   What Chrome (and so the Windows app's WebView2) exposes is up to the camera's driver: most laptop cameras report only width, height and
   frameRate; many USB cameras add exposureMode / exposureTime / exposureCompensation, brightness, contrast, zoom, focus. Everything here
   asks first (`caps`), uses try/catch around each call, and does nothing when the camera does not offer it.

   The planners are pure (a track's caps and settings in, constraints out) so tests use plain objects.                                    */
export const FPS_WANT = 60;
export const MIN_LOOK_GAP_MS = 26;            /* at most about 38 looks a second, whatever the camera sends */
export const BRIGHT_ON = 0.55, DARK_BACK = 0.28, COOLDOWN_MS = 5000, EXPOSURE_FACTOR = 0.5, UNIT_MS = 0.1, AUTO_MS_GUESS = 33;

/* the frame rate to ask getUserMedia for (the `ideal` makes it a wish, not a demand) */
export const frameRateIdeal = (sharper) => sharper ? { ideal: FPS_WANT } : null;

const range = (c) => c && typeof c === 'object' && 'max' in c ? { min: c.min ?? 0, max: c.max, step: c.step ?? 0 } : null;

/* What the track offers, as plain data (for the tracking details and the report): never throws. */
export function describeTrack(track){
  const out = { fps: null, fpsNow: null, size: null, exposureModes: null, exposureTime: null, exposureNow: null, exposureComp: false, other: [] };
  try {
    const caps = track && track.getCapabilities ? track.getCapabilities() : {}, set = track && track.getSettings ? track.getSettings() : {};
    out.fps = range(caps.frameRate); out.fpsNow = set.frameRate ?? null; out.size = set.width ? `${set.width}x${set.height}` : null;
    out.exposureModes = Array.isArray(caps.exposureMode) ? caps.exposureMode : null;
    out.exposureTime = range(caps.exposureTime); out.exposureNow = set.exposureTime ?? null; out.exposureComp = !!caps.exposureCompensation;
    for (const k of ['brightness', 'contrast', 'iso', 'zoom', 'focusMode', 'whiteBalanceMode']) if (k in caps) out.other.push(k);
  } catch (e){ /* (nothing known) */ }
  return out;
}

/* One more ask for the frame rate, or null: the camera can do it and is not. */
export function fpsPlan(d){
  if (!d || !d.fps || d.fps.max < FPS_WANT - 1) return null;
  if (d.fpsNow != null && d.fpsNow >= FPS_WANT - 5) return null;
  return { frameRate: { ideal: FPS_WANT } };
}

/* Exposure: given what the track offers (describeTrack), the smoothed mean luminance (0..1) and the state ({ mode: 'auto' | 'short', at }),
   gives { constraints | null, state }. `now` in ms. */
export function exposurePlan(d, lum, state, now){
  const st = state || { mode: 'auto', at: -1e9 };
  if (!d || !d.exposureTime || !d.exposureModes || !d.exposureModes.includes('manual') || lum == null) return { constraints: null, state: st };
  if (now - st.at < COOLDOWN_MS) return { constraints: null, state: st };
  if (st.mode === 'auto' && lum >= BRIGHT_ON){
    const cur = d.exposureNow != null ? d.exposureNow : AUTO_MS_GUESS / UNIT_MS;
    const t = Math.max(d.exposureTime.min, Math.min(d.exposureTime.max, Math.round(cur * EXPOSURE_FACTOR)));
    if (t >= cur) return { constraints: null, state: { ...st, at: now } };       /* (nothing shorter to give) */
    return { constraints: { advanced: [{ exposureMode: 'manual', exposureTime: t }] }, state: { mode: 'short', at: now, time: t } };
  }
  if (st.mode === 'short' && lum < DARK_BACK && d.exposureModes.includes('continuous'))
    return { constraints: { advanced: [{ exposureMode: 'continuous' }] }, state: { mode: 'auto', at: now } };
  return { constraints: null, state: st };
}

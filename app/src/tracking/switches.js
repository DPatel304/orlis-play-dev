/* The owner's tracking switches (Settings > Testing), kept on this PC like the other Testing switches (see ui/testing.js). All are off
   unless turned on. They live here, not in ui/, so the camera engine can read them without reaching into the screens.
     appearance  Recognise players by clothes (appearance.js)        zoom   Look closer at small players (zoom.js)
     info        Show tracking details                                record Record tracking (points only) (recorder.js)
     steady      Steadier hands (steady.js)                           camera Sharper camera (camera.js)
     light       Lighting tips (lighting.js)                          apart  Tell players apart better (shape.js)
     screenlight Brighten the screen in dark rooms (lighting.js Lift, ui/screenlight.js)
     bands       Track coloured wristbands (bands.js)                 hands  Exact hands (hands.js) */
export const SWITCH_KEYS = { appearance: 'orlis_appearance', zoom: 'orlis_zoomin', info: 'orlis_trackinfo', record: 'orlis_trackrecord',
  steady: 'orlis_steadier', camera: 'orlis_sharpercam', light: 'orlis_lighttips', screenlight: 'orlis_screenlight', apart: 'orlis_tellapart',
  bands: 'orlis_wristbands', hands: 'orlis_exacthands' };
/* In-memory settings that win over storage: for the replay tool and tests, which run without a browser's storage. null: storage decides. */
let forced = null;
export function forceSwitches(map){ forced = map ? { ...map } : null; }
export function switchOn(name){
  if (forced && name in forced) return !!forced[name];
  try { return localStorage.getItem(SWITCH_KEYS[name]) === '1'; } catch (e){ return false; }
}
export function setSwitch(name, on){
  try { localStorage.setItem(SWITCH_KEYS[name], on ? '1' : '0'); } catch (e){ /* (kept for this visit only: nothing to do) */ }
}
/* every switch's state, for a recording's header */
export function switchStates(){ const o = {}; for (const k of Object.keys(SWITCH_KEYS)) o[k] = switchOn(k); return o; }

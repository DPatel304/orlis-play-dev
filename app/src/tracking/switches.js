/* The owner's tracking switches (Settings > Testing), kept on this PC like the other Testing switches (see ui/testing.js). All three are off
   unless turned on. They live here, not in ui/, so the camera engine can read them without reaching into the screens. */
export const SWITCH_KEYS = { appearance: 'orlis_appearance', zoom: 'orlis_zoomin', info: 'orlis_trackinfo' };
export function switchOn(name){ try { return localStorage.getItem(SWITCH_KEYS[name]) === '1'; } catch (e){ return false; } }
export function setSwitch(name, on){
  try { localStorage.setItem(SWITCH_KEYS[name], on ? '1' : '0'); } catch (e){ /* (kept for this visit only: nothing to do) */ }
}

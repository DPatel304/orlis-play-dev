/* Which way hands are shown on screen (see handshow.js), kept in memory - with no storage of its own, so a game running
   in the sandbox can carry it: the app tells it the choice in its messages. The app's handshow.js adds the remembering. */
export const HANDS = [['rings', 'Rings'], ['body', 'Body outline'], ['glow', 'Glow']];
let now = null, store = null;

/* the app plugs in where the choice is kept: { read(), write(v) } */
export function useHandsStore(s){ store = s; now = null; }
export function handsMode(){
  if (now) return now;
  let v = null;
  try { v = store ? store.read() : null; } catch (e){ /* (no storage: the usual way) */ }
  now = HANDS.some(([k]) => k === v) ? v : 'rings';
  return now;
}
export function setHandsMode(m){
  if (!HANDS.some(([k]) => k === m)) return handsMode();
  now = m;
  try { if (store) store.write(m); } catch (e){ /* (kept for this visit only) */ }
  return m;
}

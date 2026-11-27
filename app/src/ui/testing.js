/* The owner's switch for test games (Settings > Testing > Test games): off unless it was turned on, kept on this PC.
   Off, My library shows only real games; on, it adds the lab games (Peekaboo Garden's 3D test, the phone stick's pad test). */
const KEY = 'orlis_testing';
export function testGamesOn(){ try { return localStorage.getItem(KEY) === '1'; } catch (e){ return false; } }
/* The tracking switches (recognise players by clothes, look closer at small players, show tracking details): off unless turned on;
   the store is tracking/switches.js, which pose.js reads. */
export { switchOn as trackingSwitchOn, setSwitch as setTrackingSwitch } from '../tracking/switches.js';
export function setTestGames(on){
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e){ /* (kept for this visit only: nothing to do) */ }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new CustomEvent('orlistesting', { detail: !!on }));
}

/* The owner's switch for test games (Settings > Testing > Test games): off unless it was turned on, kept on this PC.
   Off, My library shows only real games; on, it adds the lab games (Peekaboo Garden's 3D test, the phone stick's pad test). */
const KEY = 'orlis_testing';
export function testGamesOn(){ try { return localStorage.getItem(KEY) === '1'; } catch (e){ return false; } }
export function setTestGames(on){
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e){ /* (kept for this visit only: nothing to do) */ }
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') window.dispatchEvent(new CustomEvent('orlistesting', { detail: !!on }));
}

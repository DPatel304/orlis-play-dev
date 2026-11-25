/* How the players' hands are shown on screen (an owner's choice, for trying; Settings > Testing, and H while playing).
   Only the drawing changes: what a hand points at, a wave, and picking work the same in every way.
   - orb: a glow orb for each hand in games and the ring cursor on menus (the way it is)
   - body: a faint, see-through outline of each player, with a soft glow at each hand; no ring cursor
   - glow: no ring and no body, just a soft glow at each hand, and a short sparkle trail when it moves fast
   The choice itself lives in handsmode.js (which games in the sandbox carry too); this is the app's side, which remembers it. */
import { HANDS, handsMode, setHandsMode, useHandsStore } from './handsmode.js';
export { HANDS, handsMode, setHandsMode };
const KEY = 'orlis_handsmode';
useHandsStore({ read: () => localStorage.getItem(KEY), write: (m) => localStorage.setItem(KEY, m) });

/* the next way, for the H key; gives its name */
export function cycleHands(){
  const i = HANDS.findIndex(([k]) => k === handsMode());
  const [k, name] = HANDS[(i + 1) % HANDS.length];
  setHandsMode(k);
  return name;
}
export const handsName = () => HANDS.find(([k]) => k === handsMode())[1];

/* U8: your avatar's colour is your player colour (0040, 0042). Pills, hands, lanterns and score pops read PLAYER_COLORS[i]; this is the one
   place that decides what that is, knowing who is playing.

     resolveColours(wanted)       wanted[i]: the favourite name player i asked for (their avatar's colour), or null for a guest.
                                  Returns a favourite name per player, all different: whoever comes first keeps theirs; a second child
                                  with the same colour gets the nearest free favourite; a guest gets the next free one.
     setPlayerColours(wanted)     resolves, then re-fills PLAYER_COLORS in place (every importer sees it) and returns the names. */
import { color } from '../games/assets/palette.js';
import { PLAYER_COLORS, MAX_PLAYERS, DEFAULT_PLAYER_FAVS } from './pose-shared.js';
import { FAVS, nearestFav } from '../ui/look.js';

export function resolveColours(wanted = [], n = MAX_PLAYERS){
  const out = Array(n).fill(null), taken = new Set();
  const asked = Array.from({ length: n }, (_, i) => (FAVS.includes(wanted[i]) ? wanted[i] : null));
  /* first come, first kept */
  asked.forEach((w, i) => { if (w && !taken.has(w)){ out[i] = w; taken.add(w); } });
  /* a clash: the nearest favourite that is free */
  asked.forEach((w, i) => {
    if (!w || out[i]) return;
    const free = FAVS.filter(f => !taken.has(f));
    out[i] = nearestFav(color('fav.' + w), free); taken.add(out[i]);
  });
  /* a guest: the next free one, from their own place's colour on */
  out.forEach((v, i) => {
    if (v) return;
    const order = [...DEFAULT_PLAYER_FAVS.slice(i % DEFAULT_PLAYER_FAVS.length), ...FAVS];
    out[i] = order.find(f => !taken.has(f)); taken.add(out[i]);
  });
  return out;
}

export function setPlayerColours(wanted){
  const names = resolveColours(wanted);
  names.forEach((nm, i) => { PLAYER_COLORS[i] = color('fav.' + nm); });
  return names;
}

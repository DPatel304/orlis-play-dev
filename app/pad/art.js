/* Painting for the pad page: the painted asset library (pictures, Cubo) and the app's avatars, drawn on small canvases.
   A picture id the library does not have is drawn as a calm blank card, never a "?" box on a child's phone. */
import { assets } from '../src/games/assets/index.js';
import { body, head } from '../src/ui/avatar-art.js';
import { normalizeLook } from '../src/ui/look.js';
import { color } from '../src/games/assets/palette.js';
import { DEFAULT_PLAYER_FAVS } from '../src/tracking/pose-shared.js';

const DPR = () => Math.min(2, window.devicePixelRatio || 1);

function ready(cv, px) {
  /* canvases are sized in device pixels from their CSS box when they have one, else from `px` */
  const r = cv.getBoundingClientRect(), side = Math.round((r.width || px) * DPR());
  const s = Math.max(48, Math.min(480, side || px));
  if (cv.width !== s || cv.height !== s) { cv.width = s; cv.height = s; }
  const c = cv.getContext('2d'); c.clearRect(0, 0, s, s);
  return { c, s };
}

/* a picture from the library, centred and filling the canvas */
export function paintPicture(cv, id, px = 160) {
  const { c, s } = ready(cv, px);
  if (!assets.has(id)) { assets.missing.delete(String(id).slice(0, 40)); return false; }
  try { assets.draw(c, id, s / 2, s / 2, s * 0.8); } catch { return false; }
  return true;
}

/* Cubo (the Guest, and the face we are waiting with) */
export function paintCubo(cv, { pose = 'freeze', px = 160, t = 0 } = {}) {
  const { c, s } = ready(cv, px);
  try { assets.draw(c, 'cubo', s / 2, s / 2, s * 0.82, { pose, t }); } catch { /* blank */ }
}

/* a person: their avatar if they have a look, else a plain friendly head on their colour. look: the avatar maker's object or null. */
export function paintPerson(cv, person, px = 200) {
  /* (Guest has no look: Cubo, the blue one, drawn as the same character as everyone) */
  const { c, s } = ready(cv, px);
  const look = normalizeLook(person && person.avatar);       /* (looks saved before the one character are carried over; none is Cubo) */
  try { body(c, s / 2, s * 0.97, s * 0.9, look, 0, 'stand', { still: true }); } catch { try { head(c, s / 2, s / 2, s * 0.32, look, 0); } catch { /* blank */ } }
}

/* the colour a person is shown on: their avatar's favourite colour, else one from the palette by position (a guest is calm grey) */
export function personColour(person, i = 0) {
  if (person && person.id === 'guest') return color('shade.light');
  const a = person && person.avatar;
  if (a && typeof a === 'object') return color('fav.' + normalizeLook(a).colour);
  return color('fav.' + DEFAULT_PLAYER_FAVS[i % DEFAULT_PLAYER_FAVS.length]);
}

/* WebGL2 works? (sent in hello) */
export function hasGL() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

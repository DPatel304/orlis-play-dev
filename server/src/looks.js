/* A profile's look: how their avatar is drawn - what the avatar maker saves (decision 0042: one cube character).
   { colour, face: { eyes, mouth }, top, outfit, outfitColour, extra } - names, never raw colours (0040): colour is one of the eight
   favourites, outfitColour a palette name ('ui.gold'). The choices are the app's (app/src/ui/look.js PARTS; a test keeps the two lists equal).

   Looks saved before 0042 (skin, hair, hairColor, eyes, mouth, color, outfit, extra) stay as they are in the database; the app carries
   them over to the new character when it reads them (look.js normalizeLook). They are still accepted here, so an old client or an old
   backup restores; anything saved from now on is the new shape. */
import { Fail } from './http.js';

export const PARTS = {
  colour: ['sky', 'orange', 'green', 'purple', 'pink', 'yellow', 'teal', 'red'],
  eyes: ['dot', 'happy', 'wide', 'wink', 'sleepy', 'star'],
  mouth: ['smile', 'grin', 'o', 'cat', 'tongue'],
  top: ['none', 'tuft', 'bob', 'cap', 'beanie', 'bow', 'crown', 'phones', 'ears', 'flower'],
  outfit: ['plain', 'stripes', 'stars', 'dots', 'overalls', 'hoodie'],
  outfitColour: ['shade.card', 'shade.ink', 'ui.gold', 'ui.go', 'touch.skyBlue', 'touch.mint', 'earth.path', 'earth.plumRoof'],
  extra: ['none', 'glasses', 'scarf', 'cape', 'freckles', 'cheeks']
};
/* what was saved before 0042 */
const OLD = {
  skin: ['#ffdfc4', '#f3c393', '#dda46d', '#b97c4b', '#8d5524', '#5e3a20'],
  hair: ['short', 'curly', 'ponytail', 'buns', 'long', 'spiky', 'bob', 'none'],
  hairColor: ['#2a1d18', '#5a3825', '#9a4a26', '#e2b65a', '#f08c3a', '#4f7cff', '#ff6fae', '#9b6bff'],
  eyes: ['dots', 'happy', 'sparkle', 'wink'],
  mouth: ['smile', 'grin', 'oh', 'tongue'],
  color: ['#3da9ff', '#ff8a3d', '#22c55e', '#a855f7', '#ff5d8f', '#facc15', '#14b8a6', '#ef4444'],
  outfit: ['plain', 'stripes', 'stars', 'dots', 'hoodie'],
  extra: ['none', 'cap', 'bow', 'glasses', 'headphones', 'crown', 'flower']
};
const OLD_COLOURS = new Set(['skin', 'hairColor', 'color']);
const bad = (what) => new Fail(400, 'bad_look', `That avatar's ${what} isn't one of the choices.`);

/* A look as given, checked: every part one of its choices; nothing else. */
export function look(v){
  if (v === null) return null;
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Fail(400, 'bad_look', 'That avatar isn\'t one Orlis Play can draw.');
  if (v.colour === undefined && ['color', 'skin', 'hair', 'hairColor'].some(k => v[k] !== undefined)){
    const out = {};
    for (const [k, choices] of Object.entries(OLD)){
      const x = v[k];
      if (x === undefined) continue;
      if (typeof x !== 'string' || !(choices.includes(x) || (OLD_COLOURS.has(k) && /^#[0-9a-f]{6}$/i.test(x)))) throw bad(k);
      out[k] = x;
    }
    return out;
  }
  const out = {};
  for (const k of ['colour', 'top', 'outfit', 'outfitColour', 'extra']){
    const x = v[k];
    if (x === undefined) continue;
    if (typeof x !== 'string' || !PARTS[k].includes(x)) throw bad(k);
    out[k] = x;
  }
  if (v.face !== undefined){
    if (!v.face || typeof v.face !== 'object' || Array.isArray(v.face)) throw bad('face');
    out.face = {};
    for (const k of ['eyes', 'mouth']){
      const x = v.face[k];
      if (x === undefined) continue;
      if (typeof x !== 'string' || !PARTS[k].includes(x)) throw bad(k);
      out.face[k] = x;
    }
  }
  return out;
}

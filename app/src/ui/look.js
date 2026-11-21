/* A look: what the avatar maker saves on a profile (decision 0042: every avatar is the same cube character).

     { colour, face: { eyes, mouth }, top, outfit, outfitColour, extra }

   Names, never raw colours (0040): colour is a favourite ('sky'); outfitColour is a palette name ('ui.gold'). A missing or unknown part
   falls back to Cubo's. Looks saved before 0042 (skin, hair, hairColor, eyes, mouth, color, outfit, extra) are carried over on read by
   normalizeLook(): their favourite colour, the nearest face, a hair piece for their hair. Nothing here draws, so the server's tests and
   the phone page can use it. */
import { PALETTE } from '../games/assets/palette.js';

export const PARTS = {
  colour: ['sky', 'orange', 'green', 'purple', 'pink', 'yellow', 'teal', 'red'],
  eyes: ['dot', 'happy', 'wide', 'wink', 'sleepy', 'star'],
  mouth: ['smile', 'grin', 'o', 'cat', 'tongue'],
  top: ['none', 'tuft', 'bob', 'cap', 'beanie', 'bow', 'crown', 'phones', 'ears', 'flower'],
  outfit: ['plain', 'stripes', 'stars', 'dots', 'overalls', 'hoodie'],
  outfitColour: ['shade.card', 'shade.ink', 'ui.gold', 'ui.go', 'touch.skyBlue', 'touch.mint', 'earth.path', 'earth.plumRoof'],
  extra: ['none', 'glasses', 'scarf', 'cape', 'freckles', 'cheeks']
};
/* the favourites, in the order a guest picks the next free one */
export const FAVS = Object.keys(PALETTE.fav);

/* Cubo is the blue one with the default face */
export const CUBO = Object.freeze({ colour: 'sky', face: Object.freeze({ eyes: 'dot', mouth: 'smile' }), top: 'none', outfit: 'plain', outfitColour: 'shade.card', extra: 'none' });
export const cubo = () => ({ ...CUBO, face: { ...CUBO.face } });

/* 'group.name' that the palette has */
export function isPaletteName(v){
  if (typeof v !== 'string') return false;
  const [g, k, rest] = v.split('.');
  return rest === undefined && !!(PALETTE[g] && Object.prototype.hasOwnProperty.call(PALETTE[g], k));
}
const one = (list, v, fallback) => (list.includes(v) ? v : fallback);

/* #rrggbb -> the nearest favourite's name (distance in linear light, so a darker or lighter shade of a colour still lands on it) */
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const linRgb = (h) => [1, 3, 5].map(i => lin(parseInt(h.slice(i, i + 2), 16)));
export function nearestFav(hex, among = FAVS){
  if (typeof hex !== 'string' || !/^#[0-9a-f]{6}$/i.test(hex)) return among[0];
  const a = linRgb(hex);
  let best = among[0], bd = Infinity;
  for (const n of among){
    const b = linRgb(PALETTE.fav[n]), d = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
    if (d < bd - 1e-12){ bd = d; best = n; }
  }
  return best;
}
/* a favourite from whatever was stored: its name, or a colour code (the nearest one) */
const favOf = (v) => (PARTS.colour.includes(v) ? v : nearestFav(v));

/* ---- carrying old looks over (0042) ---- */
const OLD_EYES = { dots: 'dot', happy: 'happy', sparkle: 'star', wink: 'wink' };
const OLD_MOUTH = { smile: 'smile', grin: 'grin', oh: 'o', tongue: 'tongue' };
/* the old hair styles, as the hair pieces the new character can wear (a tuft or a bob) */
const OLD_HAIR = { short: 'tuft', curly: 'tuft', spiky: 'tuft', ponytail: 'tuft', buns: 'tuft', long: 'bob', bob: 'bob' };
/* with no hair to carry, a hat that was the old "extra" stays as the topper */
const OLD_HAT = { cap: 'cap', bow: 'bow', crown: 'crown', headphones: 'phones', flower: 'flower' };

export function fromOld(o){
  return {
    colour: favOf(o.color),
    face: { eyes: OLD_EYES[o.eyes] || CUBO.face.eyes, mouth: OLD_MOUTH[o.mouth] || CUBO.face.mouth },
    top: OLD_HAIR[o.hair] || OLD_HAT[o.extra] || 'none',
    /* (an old hoodie was all in their colour; with a white second colour it would lose it, so it is plain) */
    outfit: o.outfit === 'hoodie' ? 'plain' : one(PARTS.outfit, o.outfit, 'plain'),
    outfitColour: 'shade.card',
    extra: o.extra === 'glasses' ? 'glasses' : 'none'
  };
}
const isOld = (v) => v.colour === undefined && ['color', 'skin', 'hair', 'hairColor', 'eyes', 'mouth', 'outfit'].some(k => v[k] !== undefined);

/* Any look that was ever stored (or none: a guest) as the one current look; always complete and valid. */
const cache = new WeakMap();
export function normalizeLook(v){
  if (!v || typeof v !== 'object' || Array.isArray(v)) return cubo();
  const hit = cache.get(v); if (hit) return hit;
  let out;
  if (isOld(v)) out = fromOld(v);
  else {
    const f = v.face && typeof v.face === 'object' ? v.face : {};
    out = {
      colour: favOf(v.colour),
      face: { eyes: one(PARTS.eyes, f.eyes, CUBO.face.eyes), mouth: one(PARTS.mouth, f.mouth, CUBO.face.mouth) },
      top: one(PARTS.top, v.top, 'none'),
      outfit: one(PARTS.outfit, v.outfit, 'plain'),
      outfitColour: isPaletteName(v.outfitColour) ? v.outfitColour : CUBO.outfitColour,
      extra: one(PARTS.extra, v.extra, 'none')
    };
  }
  cache.set(v, out);
  return out;
}
/* a look as the server stores it: a plain, current one */
export const storable = (v) => JSON.parse(JSON.stringify(normalizeLook(v)));

/* A random look ("Surprise me") */
export function surprise(rand = Math.random){
  const pick = (l) => l[Math.floor(rand() * l.length) % l.length];
  return { colour: pick(PARTS.colour), face: { eyes: pick(PARTS.eyes), mouth: pick(PARTS.mouth) }, top: pick(PARTS.top), outfit: pick(PARTS.outfit), outfitColour: pick(PARTS.outfitColour), extra: pick(PARTS.extra) };
}

/* The Orlis master palette (decision 0040; the page is docs/palette.html). One list of named colours for both looks, 2D and 2.5D.
   Games ask for a colour by name - assets.color('touch.mint'), assets.color('night.sky') - never by a raw code, so a colour can be
   tuned later in this one file and every game, built-in, store or Create, picks it up. Names never change once published: colours may
   be tuned, new ones added, old ones retired gently. Add a colour here first, then use it. */

export const PALETTE = {
  /* touchables: the brightest objects on screen (balloons, stars, things to catch). Scenery never uses these. */
  touch: { cherry: '#ea5353', tangerine: '#ea9953', sunflower: '#eacb53', mint: '#4dcb77', lagoon: '#29b2c7', skyBlue: '#5392ea', grape: '#9e53ea', bubblegum: '#ea53ab' },
  /* favourites: what a child picks in the avatar maker, and their player colour (pills, hands, lanterns) */
  fav: { sky: '#3da9ff', orange: '#ff8a3d', green: '#22c55e', purple: '#a855f7', pink: '#ff5d8f', yellow: '#facc15', teal: '#14b8a6', red: '#ef4444' },
  /* the painted sky and light */
  sky: { high: '#8fc0e2', mid: '#9fc8e6', low: '#cfe0e6', horizon: '#e9eee6', mist: '#e4ebe6', sun: '#fff4cf', sunGlow: '#ffe2a0' },
  /* the evening sky: the three colours Pop Party's sunset needs beyond the sky and earth groups (high blue, deep blue-violet, rose) */
  dusk: { high: '#8aa8d6', deep: '#6a6fae', rose: '#e3a3a8' },
  /* one green ladder, darkest (near, shaded) to lightest (far, hazy) */
  meadow: { deep: '#5f8a4c', leaf: '#6f9a5e', fresh: '#58b068', grass: '#80ae6a', lawn: '#93bb7c', soft: '#a9c98f', far: '#c9dbb0', haze: '#e3f0cf' },
  /* warm earth and calm accents */
  earth: { bark: '#7a6550', path: '#f6d9a8', sand: '#e9c7a8', clay: '#d9895b', brick: '#e07a5f', peach: '#ffc48a', plumRoof: '#8a6f8f', snow: '#ffffff' },
  /* animal coats that the earth colours lack (the raven; browns and greys join here when a painted animal needs them) */
  fur: { charcoal: '#3b3a52' },
  /* shade (purple-grey, never black), the thin ink edge, and the interface paper */
  shade: { light: '#c4bce0', mid: '#8a80b0', shadow: '#342860', ink: '#2f2b45', inkSoft: '#6b6680', paper: '#faf6ec', card: '#fffdf8', line: '#e6dcc7' },
  /* interface accents */
  ui: { go: '#e85d8a', gold: '#f5c542' },
  /* the Phase 1 world sets: the colours each world adds (the rest comes from the groups above) */
  night: { sky: '#241c5c', dusk: '#6c4a96', farHills: '#4a3f94', hills: '#3d3480', grass: '#322a6e', shade: '#1d1430', moon: '#fff4cf', star: '#ffffff' },
  space: { deep: '#14123a', glow: '#3b2f7a', nebula: '#e3a3c8', rock: '#a49fc2', dust: '#cfd5e2', shade: '#77729a', planet: '#d9895b', star: '#ffffff' },
  sea: { sunlit: '#8fd8e6', deep: '#2a6f9e', far: '#4f9cc0', shade: '#2f5f86', seaweed: '#6f9a5e', sand: '#f6d9a8', coral: '#ffc48a', bubble: '#ffffff' }
};

/* Which groups make up each world (a world picks its sky and colours from these). */
export const WORLDS = {
  meadow: ['sky', 'meadow', 'earth', 'shade'],
  night: ['night', 'meadow', 'earth', 'shade'],
  space: ['space', 'earth', 'shade'],
  sea: ['sea', 'meadow', 'earth', 'shade']
};

/* Shade and highlight by rule (decision 0041): a creator names ONE colour and the other two come from it. Shade is the base mixed toward
   the palette's shadow purple-grey (shade.shadow); light is the base mixed toward white. The mixing is in linear-light RGB, with two fixed
   amounts, tuned against Pop Party's balloons (its shade is the shadow colour at 20% and its highlight white at 80%, as painted on
   screen): the average difference is about 1.7 (shade) and 2.2 (light) in CIE delta E. */
export const TONES = { shade: 0.32, light: 0.68 };
const toLin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const toSrgb = (v) => Math.round(255 * Math.max(0, Math.min(1, v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055)));
const rgb = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
function mix(hex, toward, k){
  const a = rgb(hex), b = rgb(toward);
  return '#' + a.map((v, i) => toSrgb(toLin(v) * (1 - k) + toLin(b[i]) * k).toString(16).padStart(2, '0')).join('');
}
/* a colour's tone: 'shade' or 'light' (anything else gives the base) */
export function tone(hex, t){
  if (t === 'shade') return mix(hex, PALETTE.shade.shadow, TONES.shade);
  if (t === 'light') return mix(hex, '#ffffff', TONES.light);
  return hex;
}

const FALLBACK = '#8a80b0';
export const unknownColors = new Set();
/* A colour by name ('touch.mint'), with its tone if asked: color('touch.mint', 'shade'), color('touch.mint', 'light'); the tone may also
   be the end of the name ('touch.mint.shade'). An unknown name gives the calm shade colour (never a bright one) and is noted, so a typo is
   visible in the asset viewer and Create's check without breaking the game. */
export function color(name, t){
  const [g, k, t2] = String(name || '').split('.');
  const v = PALETTE[g] && PALETTE[g][k];
  if (!v){ unknownColors.add(String(name).slice(0, 40)); return FALLBACK; }
  return tone(v, t || t2);
}

/* A palette colour with transparency, for the few places that need it as a string (gradient stops, canvas shadows): alpha('shade.shadow', 0.4)
   gives '#342860' plus an alpha byte. Elsewhere draw flat and set c.globalAlpha. */
export function alpha(name, a, t){
  return color(name, t) + Math.round(255 * Math.max(0, Math.min(1, a))).toString(16).padStart(2, '0');
}

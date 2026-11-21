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
  /* one green ladder, darkest (near, shaded) to lightest (far, hazy) */
  meadow: { deep: '#5f8a4c', leaf: '#6f9a5e', grass: '#80ae6a', lawn: '#93bb7c', soft: '#a9c98f', far: '#c9dbb0', haze: '#e3f0cf' },
  /* warm earth and calm accents */
  earth: { bark: '#7a6550', path: '#f6d9a8', sand: '#e9c7a8', clay: '#d9895b', brick: '#e07a5f', peach: '#ffc48a', plumRoof: '#8a6f8f', snow: '#ffffff' },
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

const FALLBACK = '#8a80b0';
export const unknownColors = new Set();
/* A colour by name ('touch.mint'). An unknown name gives the calm shade colour (never a bright one) and is noted, so a typo is visible
   in the asset viewer and Create's check without breaking the game. */
export function color(name){
  const [g, k] = String(name || '').split('.');
  const v = PALETTE[g] && PALETTE[g][k];
  if (!v){ unknownColors.add(String(name).slice(0, 40)); return FALLBACK; }
  return v;
}

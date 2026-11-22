/* Peekaboo Garden's world: one fixed garden, 30 by 30 steps.
   Origin is the front-left corner (nearest the TV); +x is right, +z is away from the TV.
   This file is data plus a few small helpers. No drawing here (K4 draws it, K5 reads it). */

export const SIZE = 30;
export const HEDGE = { min: 0.5, max: 29.5 };       /* the hider stays inside this on both axes */
export const HIDER_RADIUS = 0.3;                      /* how fat the hider is when bumping into things */

/* How each kind of place works. T = seconds a lantern needs to find the hider there. */
export const KINDS = {
  open:  { T: 0.4, leaves: 1 },
  grass: { T: 0.8, leaves: 2, r: 1.6 },
  bush:  { T: 1.2, leaves: 3, r: 1.2 },
  pot:   { T: 2.0, leaves: 3, r: 0.7 },
};

/* The default layout. Nothing is within 4 steps of another place, and nothing sits behind the
   shed (the shed spans x 12..18 at the back; no place is in that strip). */
export const LAYOUT = {
  shed: { x0: 12, x1: 18, z0: 22, z1: 27 },
  trees: [
    { x: 8, z: 19, r: 0.8 },
    { x: 22, z: 14, r: 0.8 },
    { x: 15, z: 9, r: 0.8 },
    { x: 27, z: 26, r: 0.8 },
  ],
  start: { x: 15, z: 3 },                             /* where the hider begins each round */
  places: [
    { id: 'grass1', kind: 'grass', x: 4, z: 6 },
    { id: 'grass2', kind: 'grass', x: 26, z: 7 },
    { id: 'grass3', kind: 'grass', x: 20, z: 18 },
    { id: 'bush1', kind: 'bush', x: 6, z: 25 },
    { id: 'bush2', kind: 'bush', x: 25, z: 21 },
    { id: 'bush3', kind: 'bush', x: 21, z: 4 },
    { id: 'pot1', kind: 'pot', x: 9, z: 11 },
    { id: 'pot2', kind: 'pot', x: 27, z: 14 },
    { id: 'pot3', kind: 'pot', x: 3, z: 16 },
  ],
};

/* createWorld({ rng, layout }): the garden the rules and the views share.
   `rng` (a function giving 0..1) is kept for views that want small random touches; the layout itself is fixed. */
export function createWorld({ rng = Math.random, layout = LAYOUT } = {}) {
  const places = layout.places.map(p => ({ ...p, r: KINDS[p.kind].r }));
  return {
    size: SIZE, hedge: HEDGE, rng,
    shed: layout.shed, trees: layout.trees, start: layout.start, places,
    place: id => places.find(p => p.id === id) || null,
    /* the place the point is inside (nearest centre if two overlap), or null for open ground */
    placeAt(x, z) {
      let best = null, bd = Infinity;
      for (const p of places) {
        const d = Math.hypot(x - p.x, z - p.z);
        if (d <= p.r && d < bd) { best = p; bd = d; }
      }
      return best;
    },
    /* walk a point to (x, z), kept inside the hedge and pushed out of the shed and tree trunks */
    clamp(x, z) {
      x = Math.min(HEDGE.max, Math.max(HEDGE.min, x));
      z = Math.min(HEDGE.max, Math.max(HEDGE.min, z));
      const s = layout.shed, h = HIDER_RADIUS;
      if (x > s.x0 - h && x < s.x1 + h && z > s.z0 - h && z < s.z1 + h) {
        /* out through the nearest side of the (grown) box */
        const out = [[x - (s.x0 - h), 'x0'], [(s.x1 + h) - x, 'x1'], [z - (s.z0 - h), 'z0'], [(s.z1 + h) - z, 'z1']]
          .sort((a, b) => a[0] - b[0])[0][1];
        if (out === 'x0') x = s.x0 - h; else if (out === 'x1') x = s.x1 + h;
        else if (out === 'z0') z = s.z0 - h; else z = s.z1 + h;
      }
      for (const t of layout.trees) {
        const dx = x - t.x, dz = z - t.z, d = Math.hypot(dx, dz), min = t.r + h;
        if (d < min) {
          if (d === 0) { x = t.x + min; } else { x = t.x + dx / d * min; z = t.z + dz / d * min; }
        }
      }
      x = Math.min(HEDGE.max, Math.max(HEDGE.min, x));
      z = Math.min(HEDGE.max, Math.max(HEDGE.min, z));
      return { x, z };
    },
  };
}

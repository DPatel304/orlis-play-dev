/* The little painted pictures on Create's Rules cards (the moves are the real move cards, games/figure.js): flat shapes in the master palette with an ink outline,
   as in docs/create-mockup.html. Each is an SVG string for innerHTML. (The pieces in "What" and the worlds are drawn by the asset library.) */
import { color } from '../games/assets/palette.js';

const INK = color('shade.ink'), SKY = color('fav.sky'), VIOLET = color('fav.purple'), GOLD = color('ui.gold'), PINK = color('fav.pink'), RED = color('touch.cherry'),
  MINT = color('touch.mint'), CLAY = color('earth.clay'), GREY = color('shade.mid'), COAL = color('fur.charcoal'), WHITE = color('earth.snow');
const svg = (inner) => `<svg viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;
const sw = (w = 3) => `stroke="${INK}" stroke-width="${w}"`;

export const PICTURES = {
  /* the rules */
  snail: svg(`<circle cx="34" cy="32" r="14" fill="${CLAY}" ${sw()}/><path d="M8 48h46" ${sw(4)} stroke-linecap="round"/><path d="M14 48c0-6 2-10 6-12M16 36l-4-8M20 36l2-8" ${sw()} fill="none" stroke-linecap="round"/>`),
  rocket: svg(`<path d="M32 6c10 8 12 22 8 34H24C20 28 22 14 32 6z" fill="${RED}" ${sw()} stroke-linejoin="round"/><circle cx="32" cy="22" r="5" fill="${WHITE}" ${sw()}/><path d="M26 40l-2 14 8-6 8 6-2-14" fill="${GOLD}" ${sw()} stroke-linejoin="round"/>`),
  few: svg(`<circle cx="32" cy="32" r="8" fill="${GOLD}" ${sw()}/>`),
  lots: svg([[16, 16], [40, 14], [28, 32], [50, 36], [14, 46], [36, 52]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="${GOLD}" ${sw()}/>`).join('')),
  together: svg(`<circle cx="22" cy="20" r="7" fill="${SKY}" ${sw()}/><circle cx="42" cy="20" r="7" fill="${PINK}" ${sw()}/><path d="M8 54c2-12 8-18 14-18s10 4 12 8c2-4 6-8 10-8 6 0 12 6 14 18z" fill="${VIOLET}" ${sw()} stroke-linejoin="round"/>`),
  versus: svg(`<circle cx="14" cy="24" r="7" fill="${SKY}" ${sw()}/><circle cx="50" cy="24" r="7" fill="${PINK}" ${sw()}/><path d="M26 42l12-16M38 42L26 26" ${sw(4)} stroke-linecap="round"/>`),
  golden: svg(`<circle cx="32" cy="32" r="18" fill="${GOLD}" ${sw()}/><path d="M32 22l3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z" fill="${WHITE}"/>`),
  bomb: svg(`<circle cx="30" cy="38" r="18" fill="${COAL}" ${sw()}/><path d="M42 24l8-8" ${sw(4)} stroke-linecap="round"/><path d="M52 10l4-4M56 16h4" stroke="${GOLD}" stroke-width="3" stroke-linecap="round"/><ellipse cx="23" cy="31" rx="4" ry="6" fill="${WHITE}" opacity=".35"/>`)
};

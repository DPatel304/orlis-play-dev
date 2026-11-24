/* The little painted pictures on Create's cards (how it plays, your move, the rules): flat shapes in the master palette with an ink outline,
   as in docs/create-mockup.html. Each is an SVG string for innerHTML. (The pieces in "What" and the worlds are drawn by the asset library.) */
import { color } from '../games/assets/palette.js';

const INK = color('shade.ink'), SKY = color('fav.sky'), VIOLET = color('fav.purple'), GOLD = color('ui.gold'), PINK = color('fav.pink'), RED = color('touch.cherry'),
  MINT = color('touch.mint'), CLAY = color('earth.clay'), GREY = color('shade.mid'), COAL = color('fur.charcoal'), WHITE = color('earth.snow');
const svg = (inner) => `<svg viewBox="0 0 64 64" aria-hidden="true">${inner}</svg>`;
const sw = (w = 3) => `stroke="${INK}" stroke-width="${w}"`;
const limb = `stroke="${INK}" stroke-width="4" stroke-linecap="round" fill="none"`;
const person = (cx, cy, r = 6) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${SKY}" ${sw()}/>`;

export const PICTURES = {
  /* how it plays */
  catch: svg(`<path d="M14 36h36l-5 20H19z" fill="${CLAY}" ${sw()} stroke-linejoin="round"/><circle cx="32" cy="14" r="8" fill="${RED}" ${sw()}/><path d="M32 26v6" ${sw()} stroke-dasharray="3 3"/>`),
  pop: svg(`<ellipse cx="30" cy="30" rx="15" ry="18" fill="${RED}" ${sw()}/><g stroke="${GOLD}" stroke-width="4" stroke-linecap="round"><path d="M50 12l4-4M54 24h6M46 6l2-4"/></g>`),
  dodge: svg(`<circle cx="20" cy="40" r="10" fill="${SKY}" ${sw()}/><path d="M38 14l16 4-8 14z" fill="${GREY}" ${sw()} stroke-linejoin="round"/><path d="M8 24c4-6 10-8 14-6" ${sw()} fill="none" stroke-linecap="round"/>`),
  collect: svg(`<path d="M32 8l5 10 11 1.5-8 7.6 2 11L32 33l-10 5 2-11-8-7.6L27 18z" fill="${GOLD}" ${sw()} stroke-linejoin="round"/><circle cx="14" cy="50" r="5" fill="${GOLD}" ${sw()}/><circle cx="50" cy="50" r="5" fill="${GOLD}" ${sw()}/>`),
  keepup: svg(`<circle cx="32" cy="18" r="12" fill="${PINK}" ${sw()}/><path d="M14 56c4-10 10-14 18-14s14 4 18 14" fill="${VIOLET}" ${sw()}/><path d="M32 34v4" ${sw()}/>`),
  /* your move */
  reach: svg(`${person(32, 12)}<path d="M32 20v20M32 40l-8 16M32 40l8 16M32 24L20 6M32 24l12-18" ${limb}/>`),
  wave: svg(`${person(28, 14)}<path d="M28 22v20M28 42l-8 14M28 42l8 14M28 26l-10 10M28 26l14-12" ${limb}/><path d="M48 6c4 2 6 6 6 10M52 4c5 3 8 8 8 14" stroke="${VIOLET}" stroke-width="3" fill="none" stroke-linecap="round"/>`),
  squat: svg(`${person(32, 18)}<path d="M32 26v14M32 40l-12 2-2 14M32 40l12 2 2 14M32 30l-14 4M32 30l14 4" ${limb}/>`),
  jump: svg(`${person(32, 10)}<path d="M32 18v18M32 36l-10 10M32 36l10 10M32 22l-14-6M32 22l14-6" ${limb}/><path d="M16 58h32" stroke="${VIOLET}" stroke-width="3" stroke-linecap="round" stroke-dasharray="4 4"/>`),
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

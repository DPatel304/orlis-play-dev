/* The clean look's brand pieces (decision 0045), each made in one place:
   - the two squares: a blue square lower left and a violet one upper right, tilted a little (no face, no cube);
   - the wordmark "Orlis Play", "Play" in the blue to violet gradient;
   - the big Home button that takes the logo's place on every screen but Home;
   - the one wait pattern: the two squares hopping (with the game's name card when a game is starting);
   - the small icon set the menus share (line and fill icons in currentColor, no emoji).
   Colours live in style.css (--blue, --violet, --grad); nothing here carries a colour code. */
import { button, onPick } from './cursor.js';
import { h } from './screens.js';
import { sfx } from '../audio/sound.js';

/* the two squares as an inline SVG (fills come from the .sq-b and .sq-v classes) */
export const twoSquares = (cls = 'lm') =>
  `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true"><rect class="sq-b" x="4" y="40" width="56" height="56" rx="15"/>` +
  `<g transform="rotate(10 66 34)"><rect class="sq-v" x="40" y="8" width="52" height="52" rx="14"/></g></svg>`;

/* the two squares, mid-hop (the loading mark): the violet one lands on the blue one, which squashes a little */
export const hopSquares = () =>
  `<svg class="hop" viewBox="0 0 100 100" aria-hidden="true"><rect class="b sq-b" x="14" y="42" width="56" height="56" rx="15"/>` +
  `<rect class="v sq-v" x="44" y="10" width="46" height="46" rx="13"/></svg>`;

/* the mark and the wordmark, as one element: a span you can size with font-size */
export function logo({ size = null, light = false } = {}){
  const el = h('span', 'lg' + (light ? ' light' : ''), `${twoSquares()}<b>Orlis <i>Play</i></b>`);
  if (size) el.style.fontSize = size;
  return el;
}

const ICONS = {
  house: '<path d="M3.4 11.6 12 4l8.6 7.6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 10.4V19a1 1 0 0 0 1 1h3.4v-5h3.2v5H17a1 1 0 0 0 1-1v-8.6" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  play: '<path d="M7.2 4.6v14.8L19 12z" fill="currentColor" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"/>',
  again: '<path d="M19 12a7 7 0 1 1-2.1-5" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round"/><path d="M19.6 3.6v4.8h-4.8" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  down: '<path d="M4 8.5l8 8 8-8" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>',
  up: '<path d="M4 15.5l8-8 8 8" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>',
  gear: '<circle cx="12" cy="12" r="5.6" fill="none" stroke="currentColor" stroke-width="2.6"/><g stroke="currentColor" stroke-width="3" stroke-linecap="round"><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.5 1.5M17.1 17.1l1.5 1.5M5.4 18.6l1.5-1.5M17.1 6.9l1.5-1.5"/></g>',
  person: '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M4 20c1-4.4 4-6 8-6s7 1.6 8 6" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  out: '<path d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M15 8l4 4-4 4M19 12H9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  get: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>',
  back: '<path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>',
  close: '<path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  /* painted-look line icons for Create Pro's cards and the no-slots screen (no emoji) */
  link: '<path d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.2 4.2 0 0 0-6-6l-1 1M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.2 4.2 0 0 0 6 6l1-1" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  hammer: '<path d="M14 6l4 4M5 19l8.5-8.5M11 4l4-1 6 6-1 4-4 1-5-5z" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  tv: '<rect x="3" y="5" width="18" height="12.5" rx="2.4" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M8 21h8M12 17.5V21" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  slot: '<rect x="4" y="4" width="16" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-dasharray="3.4 3.4"/><path d="M12 8.6v6.8M8.6 12h6.8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/>',
  clock: '<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 7.4V12l3.2 2" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>',
  plus: '<path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>',
  pencil: '<path d="M14.5 4.5l5 5L9 20H4v-5z" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
  star: '<path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.7-5.1-2.7-5.1 2.7 1-5.7-4.1-4 5.7-.8z" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>'
};
export const icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
export const ICON_NAMES = Object.keys(ICONS);

/* A colour token from style.css (--paper, --blue, ...) for canvas drawing; a plain fallback where there is no page (the tests). */
export function tok(name, fallback = 'white'){
  try { const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim(); return v || fallback; } catch { return fallback; }
}

/* A big Home button, in the logo's place (top left) on every screen but Home. */
export function homeButton(fn, label = 'Home'){
  const b = onPick(button(`${icon('house')}<span>${label}</span>`, 'homebtn'), () => { sfx.select?.(); fn(); });
  b.setAttribute('aria-label', label);
  return b;
}

/* The one loading pattern: the two squares hopping, and (when a game is starting) its name card under them.
   card: { name, line, cover } - cover is an image URL, optional. */
export function loader({ name = '', line = '', cover = '' } = {}){
  const el = h('div', 'loadhop', hopSquares());
  if (name){
    const card = h('div', 'loadcard');
    const pic = h('div', 'lcv'); if (cover) pic.style.backgroundImage = `url(${cover})`;
    const words = h('div', 'lwords'); const b = h('b'); b.textContent = name; words.append(b);
    if (line){ const s = h('span'); s.textContent = line; words.append(s); }
    card.append(pic, words); el.append(card);
  }
  return el;
}

/* Games on their way: the "Under construction" row - on Play, at the end, and in the Creator app, under
   the questions. Each is the card it'll be (its name, its colours) under construction stripes, with how
   it's going. Nothing to pick, except that a declined one says why. */
import { button, onPick } from './cursor.js';
import { h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { toast } from './toast.js';
import { buildingCoverUrl } from './covers.js';
import { looksOf } from './request.js';

const STATE = { waiting: ['In line', 15], making: ['Building…', 55], made: ['Waiting for OK', 90], ready: ['Waiting for OK', 90], declined: ['Not this time', 0] };

/* one request as a tile */
export function buildingTile(x){
  const [label, pct] = STATE[x.state] || ['Building…', 50];
  const recipe = x.recipe || {};
  const name = (recipe.name || '').trim() || (x.game && x.game.name) || 'Your game';
  const t = button('', 'slock pictile covered buildingtile ' + x.state);
  const th = h('div', 'sthumb');
  const pic = buildingCoverUrl({ name, cols: looksOf(recipe).cols, label, pct }); if (pic) th.style.backgroundImage = `url(${pic})`;
  t.insertBefore(th, t.firstChild);
  t.querySelector('.lbl').replaceWith(h('div', 'smeta', ''));
  t.setAttribute('aria-label', `${name}: ${label}`);
  if (x.state === 'declined' && x.note) onPick(t, () => { sfx.select(); toast(`${name}: “${x.note}”`, { ms: 6000 }); });
  t.tabIndex = -1;
  return t;
}

/* Testing: the games a creator in the family has put on this TV to try - a tap plays one, and nothing is kept */
export function testingRow(drafts, onTry){
  if (!drafts.length) return null;
  const sec = h('section', 'shelf building testing');
  const row = h('div', 'shelfrow');
  sec.append(h('h3', '', 'Testing'), row);
  for (const d of drafts){
    const t = button('', 'slock pictile covered buildingtile testtile');
    const th = h('div', 'sthumb');
    const pic = buildingCoverUrl({ name: d.name, cols: (d.icon && d.icon.cols) || ['#7c3aed', '#06b6d4'], label: 'Testing', pct: 100 }); if (pic) th.style.backgroundImage = `url(${pic})`;
    t.insertBefore(th, t.firstChild);
    t.querySelector('.lbl').replaceWith(h('div', 'smeta', ''));
    t.setAttribute('aria-label', `${d.name}: testing. Play it.`);
    onPick(t, () => { sfx.select(); onTry(d); });
    row.appendChild(t);
  }
  return sec;
}

/* the whole row, or null when there's nothing under construction */
export function buildingRow(requests){
  if (!requests.length) return null;
  const sec = h('section', 'shelf building');
  const row = h('div', 'shelfrow');
  sec.append(h('h3', '', 'Under construction'), row);
  for (const x of requests) row.appendChild(buildingTile(x));
  return sec;
}

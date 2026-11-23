/* Games on their way: the "Under construction" row - on Play, at the end, and in the Creator app, under
   the questions. Each is the card it'll be (its name, its colours) under construction stripes, with how
   it's going. Tap one to see how it's going, or to take it back. */
import { button, onPick } from './cursor.js';
import { h, screen } from './screens.js';
import { account } from './account.js';
import { week } from './week.js';
import { sfx } from '../audio/sound.js';
import { toast } from './toast.js';
import { buildingCoverUrl } from './covers.js';
import { looksOf, requestName } from './request.js';

const STATE = { waiting: ['In line', 15], making: ['Building…', 55], made: ['Waiting for OK', 90], ready: ['Waiting for OK', 90], declined: ['Not this time', 0] };

/* Tapping one: how it's going, and a way to take it back (the server says if it can't be, and why) */
function askRemove(x, name, onChange){
  const wrap = screen('dim fpopwrap'); wrap.style.zIndex = 6;
  const card = h('div', 'fpop'), close = () => wrap.remove();
  const [label] = STATE[x.state] || ['Building…'];
  const line = x.state === 'declined' ? (x.note ? `Not this time: \u201C${x.note}\u201D` : 'Not this time.') : `${label}.`;
  card.append(h('h2', ''), h('p', '', ''), h('div', 'fbtns'));
  card.querySelector('h2').textContent = name; card.querySelector('p').textContent = line;
  const b = (text, fn, cls = '') => onPick(button(text, 'setbtn ' + cls), fn);
  card.querySelector('.fbtns').append(b('Keep it', () => { sfx.back?.(); close(); }),
    b('Remove it', async () => {
      try { await account.call('DELETE', `/api/requests/${encodeURIComponent(x.id)}`); }
      catch (e){ toast(e.message || 'That didn\u2019t work.', { bad: true }); return; }
      sfx.select(); close(); toast(`${name} is removed`);
      await week.refresh({ force: true }).catch(() => {}); onChange();
    }, 'danger'));
  wrap.appendChild(card); wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) close(); });
}

/* one request as a tile */
export function buildingTile(x, onChange = () => {}){
  const [label, pct] = STATE[x.state] || ['Building…', 50];
  const recipe = x.recipe || {};
  const name = requestName(x);
  const t = button('', 'slock pictile covered buildingtile ' + x.state);
  const th = h('div', 'sthumb');
  const pic = buildingCoverUrl({ name, cols: looksOf(recipe).cols, label, pct }); if (pic) th.style.backgroundImage = `url(${pic})`;
  t.insertBefore(th, t.firstChild);
  t.querySelector('.lbl').replaceWith(h('div', 'smeta', ''));
  t.setAttribute('aria-label', `${name}: ${label}`);
  onPick(t, () => { sfx.select(); askRemove(x, name, onChange); });
  t.tabIndex = -1;
  return t;
}

/* the whole row, or null when there's nothing under construction */
export function buildingRow(requests, onChange = () => {}){
  if (!requests.length) return null;
  const sec = h('section', 'shelf building');
  const row = h('div', 'shelfrow');
  sec.append(h('h3', '', 'Under construction'), row);
  for (const x of requests) row.appendChild(buildingTile(x, onChange));
  return sec;
}

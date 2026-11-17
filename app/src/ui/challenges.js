/* This week's family challenges: three big cards, and a small pill in the top
   bar that they settle into.

   On arriving at Play (once each time the app starts) the cards come up over
   the page for a few seconds - any key, a tap, or Escape skips - then fly up
   to the pill by the family's name. Picking the pill shows them again, any
   time. The pill says how many are done. (?splash=0 in the address turns the
   arrival off, for the rehearsals.)

     challengePill(data)                    the pill, for the top bar
     showChallenges(data, { auto, from })   the cards; from: the pill they fly to
     splashWanted()                         true until they've been shown once      */
import { screen, h } from './screens.js';
import { button, onPick } from './cursor.js';
import { sfx } from '../audio/sound.js';

const ICON = { rounds: '\u{1F3AE}', different: '\u{1F9ED}', minutes: '⏱️' };
const COLS = [['#6d5efc', '#a78bfa'], ['#0ea5e9', '#38bdf8'], ['#f59e0b', '#fbbf24']];
const SHOW_SECS = 4.5;
let splashed = false;

export const splashWanted = () => !splashed && !/[?&]splash=0\b/.test(typeof location === 'undefined' ? '' : location.search);
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* "1 of 3" - and "All done!" when they are */
const sayPill = (data) => {
  const list = data.challenges || [], done = list.filter(c => c.done).length;
  return done === list.length && list.length ? ['All done!', ''] : [`${done} of ${list.length}`, 'this week'];
};

export function challengePill(data){
  const [a, b] = sayPill(data);
  const pill = button(`<span class="trophy">\u{1F3C6}</span><b>${esc(a)}</b>${b ? `<i>${esc(b)}</i>` : ''}`, 'chpill' + (!b ? ' alldone' : ''));
  pill.title = 'This week’s challenges'; pill.setAttribute('aria-label', 'This week’s challenges');
  onPick(pill, () => { sfx.select(); showChallenges(data, { auto: false, from: pill }); });
  return pill;
}

export function showChallenges(data, { auto = false, from = null, onClosed = () => {} } = {}){
  const list = (data && data.challenges) || [];
  if (!list.length) return null;
  if (auto) splashed = true;
  const layer = screen('dim chsplash'); layer.style.zIndex = 8;
  const row = h('div', 'chbigrow');
  list.forEach((c, i) => {
    const pct = Math.round(100 * c.have / c.need);
    const card = h('div', 'chbig' + (c.done ? ' done' : ''),
      `<div class="chic" style="background:linear-gradient(135deg,${COLS[i % 3][0]},${COLS[i % 3][1]})">${ICON[c.kind] || '⭐'}</div>
       <div class="chtt">${esc(c.title)}</div>
       <div class="chbarbig"><i style="width:${pct}%"></i></div>
       <div class="chft"><span>${c.have} / ${c.need}</span>${c.done ? '<span class="chtr got">\u{1F3C6} Done!</span>' : '<span class="chtr">\u{1F3C6} Trophy</span>'}</div>`);
    card.style.setProperty('--i', i);
    row.appendChild(card);
  });
  const trophies = data.trophies ? `<span class="chtrophies">\u{1F3C6} ${data.trophies} earned</span>` : '';
  const go = button('Continue', 'link close chgo');
  layer.append(h('h2', '', 'This week’s challenges'), h('p', 'chsub', `New every Monday${trophies}`), row,
    h('p', 'chhint', auto ? 'Press any key to play' : 'Press any key to close'), go);

  let closed = false, timer = null;
  const close = () => {
    if (closed) return; closed = true;
    clearTimeout(timer);
    removeEventListener('keydown', key, true);
    sfx.select?.();
    layer.classList.add('leaving');
    const cards = [...row.children];
    if (reduced()){ setTimeout(finish, 220); return; }
    /* fly up to the pill (or, with none, the top right) */
    const r = from && from.isConnected ? from.getBoundingClientRect() : { left: innerWidth - 220, top: 40, width: 160, height: 50 };
    const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    cards.forEach((card, i) => {
      const b = card.getBoundingClientRect();
      card.style.transition = `transform .7s cubic-bezier(.55,0,.25,1) ${i * 70}ms, opacity .5s ease ${i * 70 + 260}ms`;
      card.style.transform = `translate(${tx - (b.left + b.width / 2)}px, ${ty - (b.top + b.height / 2)}px) scale(.16) rotate(0deg)`;
      card.style.opacity = 0;
    });
    setTimeout(finish, 1000);
  };
  const finish = () => {
    layer.remove();
    if (from && from.isConnected){ from.classList.remove('pop'); void from.offsetWidth; from.classList.add('pop'); }
    onClosed();
  };
  const key = (e) => { if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return; e.preventDefault?.(); e.stopPropagation?.(); close(); };
  addEventListener('keydown', key, true);
  layer.addEventListener('pointerdown', close);
  if (from) from.classList.remove('pop');
  if (auto) timer = setTimeout(close, SHOW_SECS * 1000);
  return { close };
}

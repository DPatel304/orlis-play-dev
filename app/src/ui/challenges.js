/* This week's family challenges (decisions 0045-era, 0051): three big game-tile cards, and a small star pill in the top bar that they
   settle into.

   The cards come up by themselves only the first time the app is opened in a new challenge week; any key, a tap, or Escape then
   skips on, and they fly to the pill by the family's name. Otherwise the pill is the way in, any time, and it glows softly when
   there is news (a new week not opened yet, or a challenge finished since). Opening clears the glow. (?splash=0 in the address
   turns the arrival off, for the rehearsals.)

   Each card: its own colour on top with a big icon, chunky blocks to count (at most ten), "12 / 30" under them; a finished card
   turns gold with a stamped star. Under them, the week's seven dots. The cards are dealt in with a bounce, the blocks fill and
   the numbers count up, a finished star stamps with sparkles; all of it still when the person prefers less motion.

     challengePill(data)                    the pill, for the top bar (glowing if there is news)
     showChallenges(data, { auto, from })   the cards; from: the pill they fly to
     splashWanted(data)                     true the first time in a new week                          */
import { screen, h } from './screens.js';
import { button, onPick } from './cursor.js';
import { sfx } from '../audio/sound.js';
import { account } from './account.js';
import { keeper, STAR, esc, reduced, iconFor, idOf, hasNews, markOpened, markSplash, splashWanted, blocksEl, fillBlocks, setBlocks, weekEl, stampEl } from './chkit.js';

keeper.who = () => { const s = account.state || {}; return `${(s.household && s.household.id) || ''}.${s.current || ''}`; };
export { STAR, splashWanted };
const SHOW_SECS = 7.5;
const DEAL_GAP = 280, DEAL_FROM = 200, LAND = 560;   /* ms: between cards, before the first, and how long a card takes to land */

/* "1 of 3" - and "All done!" when they are */
const sayPill = (data) => {
  const list = data.challenges || [], done = list.filter(c => c.done).length;
  return done === list.length && list.length ? ['All done!', ''] : [`${done} of ${list.length}`, 'this week'];
};

export function challengePill(data){
  const [a, b] = sayPill(data);
  const pill = button(`<span class="starico">${STAR('3.4vh')}</span><b>${esc(a)}</b>${b ? `<i>${esc(b)}</i>` : ''}`, 'chpill' + (!b ? ' alldone' : '') + (hasNews(data) ? ' news' : ''));
  pill.title = 'This week’s challenges'; pill.setAttribute('aria-label', 'This week’s challenges');
  onPick(pill, () => { sfx.select(); showChallenges(data, { auto: false, from: pill }); });
  return pill;
}

/* one card: colour and a big icon on top; the title, the blocks and "have / need" below; gold and starred when done */
export function cardEl(c, i){
  const card = h('div', `chbig c${i % 3}` + (c.done ? ' done' : ''));
  const top = h('div', 'chtop'); top.innerHTML = `<span class="chic">${iconFor(c, 256)}</span>`;
  const body = h('div', 'chbody');
  const blocks = blocksEl(c.need);
  const num = h('div', 'chnum'); num.innerHTML = `<b>0</b> / ${esc(c.need)}`;
  body.append(h('div', 'chtt', esc(c.title)), blocks, num);
  card.append(top, body);
  card.style.setProperty('--i', i);
  return { card, top, blocks, num };
}

export function showChallenges(data, { auto = false, first = false, from = null, onLeave = () => {}, onClosed = () => {} } = {}){
  const list = (data && data.challenges) || [];
  if (!list.length) return null;
  if (auto) markSplash(data);
  markOpened(data);                                   /* (looked at: the glow clears) */
  if (from && from.classList) from.classList.remove('news');
  const layer = screen('dim chsplash' + (first ? ' first' : '')); layer.style.zIndex = 8;
  const row = h('div', 'chbigrow');
  const timers = [], still = reduced();
  const later = (ms, fn) => { if (still) fn(); else timers.push(setTimeout(fn, ms)); };
  let anyDone = false;
  list.forEach((c, i) => {
    const { card, top, blocks, num } = cardEl(c, i);
    row.appendChild(card);
    const at = DEAL_FROM + i * DEAL_GAP, landed = at + LAND;
    const say = (v) => { num.innerHTML = `<b>${v}</b> / ${esc(c.need)}`; };
    /* dealt in one by one; a soft whoosh as it lands; then its blocks fill and the number counts up */
    if (!still){ card.style.animationDelay = at + 'ms'; setBlocks(blocks, 0, c.need); say(0); }
    later(landed - 120, () => sfx.cardLand());
    fillBlocks(blocks, 0, c.have, c.need, { delay: landed, gap: 110, onValue: say, timers });
    if (c.done){
      anyDone = true;
      const stamp = stampEl('13vh'); top.appendChild(stamp);
      const when = landed + 110 * Math.min(8, Math.max(1, c.have)) + 250;
      later(when, () => { stamp.classList.add('on'); sfx.sparkles(); });
    }
  });
  if (anyDone) later(DEAL_FROM + LAND, () => sfx.happy());   /* a small happy chime on opening when one is done */
  const stars = data.stars ?? data.trophies ?? 0;
  const total = stars ? `<span class="chtrophies">${STAR('2.4vh')} ${stars} earned</span>` : '';
  const go = button('Continue', 'link close chgo');
  layer.append(h('h2', '', 'This week’s challenges'), h('p', 'chsub', `New every Monday${total}`), row, weekEl(data),
    h('p', 'chhint', auto ? 'Press any key to play' : 'Press any key to close'), go);

  let closed = false, timer = null;
  const close = () => {
    if (closed) return; closed = true;
    clearTimeout(timer); timers.forEach(clearTimeout);
    removeEventListener('keydown', key, true);
    sfx.select?.();
    layer.classList.add('leaving');
    onLeave();
    const cards = [...row.children];
    if (reduced()){ setTimeout(finish, 220); return; }
    /* fly up to the pill (or, with none, the top right) */
    const r = from && from.isConnected ? from.getBoundingClientRect() : { left: innerWidth - 220, top: 40, width: 160, height: 50 };
    const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    cards.forEach((card, i) => {
      const b = card.getBoundingClientRect();
      card.style.animation = 'none';        /* (the dealing animation would hold the card where it is) */
      card.style.transition = `transform .7s cubic-bezier(.55,0,.25,1) ${i * 70}ms, opacity .5s ease ${i * 70 + 260}ms`;
      card.style.transform = `translate(${tx - (b.left + b.width / 2)}px, ${ty - (b.top + b.height / 2)}px) scale(.16) rotate(0deg)`;
      card.style.opacity = 0;
    });
    setTimeout(finish, 1000);
  };
  /* the pill bumps, and its number ticks */
  const finish = () => {
    layer.remove();
    if (from && from.isConnected){
      from.classList.remove('pop'); void from.offsetWidth; from.classList.add('pop');
      const n = from.querySelector && from.querySelector('b');
      if (n && n.classList){ n.classList.remove('tick'); void n.offsetWidth; n.classList.add('tick'); }
    }
    onClosed();
  };
  const key = (e) => { if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(e.key)) return; e.preventDefault?.(); e.stopPropagation?.(); close(); };
  addEventListener('keydown', key, true);
  layer.addEventListener('pointerdown', close);
  if (from) from.classList.remove('pop');
  if (auto) timer = setTimeout(close, SHOW_SECS * 1000);
  return { close, layer };
}

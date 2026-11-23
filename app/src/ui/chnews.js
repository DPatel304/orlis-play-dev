/* The weekly challenges on the results screen (decision 0051): after a round that moved a challenge, one compact line for it - its icon,
   its title, its blocks ticking up from before to after. When the round finished it, the gold star stamps down with a sparkle burst and
   the two sparkles of the intro. (Replaces the "Star earned" toast.) It lands after the round is told to the server, so it is added to
   the results screen when the answer comes, and only if that screen is still up. Quiet: it never moves the buttons or takes a key.

     moves: [{ id, kind, title, need, before, after, finished, slot }]   (ui/week.js played() says them) */
import { sfx } from '../audio/sound.js';
import { blocksEl, fillBlocks, stampEl, iconFor, reduced } from './chkit.js';

const MAX_LINES = 2;
const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

/* the line for one challenge; timers collects what it started, so the screen can stop it */
export function moveEl(m, timers = []){
  const el = mk('div', 'chmove' + (m.finished ? ' finished' : '') + ` c${(m.slot || 0) % 3}`);
  const ic = mk('span', 'chmic'); ic.innerHTML = iconFor(m, 96);
  const title = mk('span', 'chmtt', m.title);
  const blocks = blocksEl(m.need); blocks.classList.add('mini');
  const num = mk('b', 'chmnum', `${m.before} / ${m.need}`);
  el.append(ic, title, blocks, num);
  const count = (v) => { num.textContent = `${v} / ${m.need}`; };
  /* the blocks tick up from before to after (reduced motion: straight to after) */
  fillBlocks(blocks, m.before, m.after, m.need, { delay: 350, gap: 130, onValue: count, timers });
  if (m.finished){
    const stamp = stampEl('7vh'); el.appendChild(stamp);
    const at = reduced() ? 0 : 350 + 130 * Math.min(8, Math.max(1, m.after - m.before)) + 120;
    const show = () => { stamp.classList.add('on'); sfx.sparkles(); };
    if (at) timers.push(setTimeout(show, at)); else show();
  }
  return el;
}

/* put the lines in the host (an element on the results screen); returns a stop function */
export function showNews(host, moves){
  const timers = [];
  const list = (moves || []).filter(m => m && (m.after > m.before || m.finished))
    .sort((a, b) => (b.finished ? 1 : 0) - (a.finished ? 1 : 0)).slice(0, MAX_LINES);
  list.forEach(m => host.appendChild(moveEl(m, timers)));
  if (list.length) host.classList.add('has');
  return () => timers.forEach(clearTimeout);
}

/* Whatever the server's answer is, add it to the results screen if that is still the screen showing.
   played: the promise from week.played(); scene: () => the current page (with .news if it is the results screen). */
export function deliverRoundNews(played, scene){
  return Promise.resolve(played).then(moves => {
    const s = scene();
    if (Array.isArray(moves) && moves.length && s && typeof s.news === 'function') s.news(moves);
  }, () => {});
}

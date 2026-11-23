/* The small parts the weekly challenges are made of (decision 0051), shared by the cards screen (challenges.js) and the results
   screen's progress line (chnews.js): the rules for when there is news, the blocks, the week's dots, the star that stamps down.
   No page in here, so the tests can read the rules without one. */
import { iconHTML } from './icons.js';
import { sfx } from '../audio/sound.js';

export const ICON = { rounds: 'gamepad', different: 'compass', minutes: 'clock' };
/* the star: gold, rounded - the same one everywhere (an SVG, so it looks the same on every PC) */
export const STAR = (size = '1em') => `<svg class="star" viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true"><polygon class="s1" points="12 2.6 14.9 8.8 21.7 9.6 16.7 14.2 18 21 12 17.6 6 21 7.3 14.2 2.3 9.6 9.1 8.8" stroke-width="2" stroke-linejoin="round"/><polygon class="s2" points="12 5.8 13.7 9.6 17.8 10.1 14.8 12.9 15.6 17 12 15 8.4 17 9.2 12.9 6.2 10.1 10.3 9.6"/></svg>`;
export const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const iconFor = (c, px = 192) => iconHTML(ICON[c.kind] || 'glowstar', px);
export const idOf = (c) => String(c.id ?? c.title);

/* ---------- what has been seen (per household and profile, in localStorage) ----------
   { splash: the week whose arrival splash was shown, opened: the week whose cards were last opened, done: ids finished when last opened } */
/* (who is looking: challenges.js says, from the signed-in profile; kept out of here so the results screen can use this file) */
export const keeper = { who: () => '.' };
const who = () => { try { return keeper.who(); } catch { return '.'; } };
const KEY = () => 'orlis.challenges.' + who();
let memory = {};                              /* (when storage is closed to us: still never twice in one run) */
export function seen(){
  try { const o = JSON.parse(localStorage.getItem(KEY()) || 'null'); if (o && typeof o === 'object') return { ...memory, ...o }; } catch {}
  return { ...memory };
}
function remember(patch){
  const next = { ...seen(), ...patch };
  memory = { ...memory, ...patch };
  try { localStorage.setItem(KEY(), JSON.stringify(next)); } catch {}
}
export const forgetMemory = () => { memory = {}; };
const weekOf = (data) => String((data && data.week) || '');
const doneIds = (data) => ((data && data.challenges) || []).filter(c => c.done).map(idOf);

/* The cards come up by themselves only the first time the app is opened in a new challenge week (?splash=0 turns even that off). */
export function splashWanted(data){
  if (!data || !(data.challenges || []).length) return false;
  if (typeof location !== 'undefined' && /[?&]splash=0\b/.test(location.search || '')) return false;
  return seen().splash !== weekOf(data);
}
export const markSplash = (data) => remember({ splash: weekOf(data) });

/* News for the pill: a new week not opened yet, or a challenge finished since the cards were last opened. */
export function hasNews(data){
  if (!data || !(data.challenges || []).length) return false;
  const s = seen();
  if (s.opened !== weekOf(data)) return true;
  const had = new Set(s.done || []);
  return doneIds(data).some(id => !had.has(id));
}
export const markOpened = (data) => remember({ opened: weekOf(data), done: doneIds(data) });

/* ---------- blocks: one per step, at most ten (a bigger target counts several steps in each) ---------- */
export function blocksFor(need){
  need = Math.max(1, Math.round(Number(need)) || 1);
  const per = Math.ceil(need / 10);
  return { per, n: Math.ceil(need / per), need };
}
/* how many blocks are whole, and is the next one part-filled */
export function litBlocks(have, need){
  const { per, n } = blocksFor(need);
  have = Math.max(0, Math.round(Number(have)) || 0);
  if (have >= need) return { full: n, part: false };
  return { full: Math.floor(have / per), part: have % per > 0 };
}
export function blocksEl(need){
  const { n } = blocksFor(need);
  const el = document.createElement('div'); el.className = 'chblocks';
  for (let k = 0; k < n; k++){ const b = document.createElement('i'); b.style.setProperty('--k', k); el.appendChild(b); }
  return el;
}
export function setBlocks(el, have, need){
  const { full, part } = litBlocks(have, need);
  [...el.children].forEach((b, k) => { b.className = k < full ? 'on' : k === full && part ? 'half' : ''; });
}
/* Fill from one count to another a few steps at a time, ticking higher the further on (at most 8 ticks), and counting the number up.
   Returns a stop function. With reduced motion: the end state at once. */
export function fillBlocks(el, from, to, need, { delay = 0, gap = 120, onValue = () => {}, timers = null, sound = true } = {}){
  setBlocks(el, from, need); onValue(from);
  if (to <= from) return () => {};
  if (reduced()){ setBlocks(el, to, need); onValue(to); return () => {}; }
  const steps = Math.min(8, Math.max(1, to - from)), ids = [];
  for (let s = 1; s <= steps; s++){
    const v = s === steps ? to : Math.round(from + (to - from) * s / steps);
    ids.push(setTimeout(() => { setBlocks(el, v, need); onValue(v); if (sound) sfx.blockTick(v / need); }, delay + s * gap));
  }
  if (timers) timers.push(...ids);
  return () => ids.forEach(clearTimeout);
}

/* ---------- the week's seven dots: Mon..Sun, past days filled, today marked ---------- */
const DAYMS = 864e5;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
export function weekDays(data, now = new Date()){
  let start = null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(weekOf(data));
  if (m) start = new Date(+m[1], +m[2] - 1, +m[3]);
  if (!start){ start = startOfDay(now); start.setDate(start.getDate() - ((start.getDay() + 6) % 7)); }
  const today = Math.max(0, Math.min(6, Math.round((startOfDay(now) - start) / DAYMS)));
  return { today, left: 7 - today, days: ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((l, i) => ({ l, state: i < today ? 'past' : i === today ? 'today' : 'next' })) };
}
export const leftText = (n) => n === 1 ? '1 day left' : `${n} days left`;
export function weekEl(data, now = new Date()){
  const w = weekDays(data, now);
  const el = document.createElement('div'); el.className = 'chweek';
  const dots = document.createElement('div'); dots.className = 'chdays';
  w.days.forEach(d => { const e = document.createElement('span'); e.className = 'chday ' + d.state; e.textContent = d.l; dots.appendChild(e); });
  const left = document.createElement('b'); left.textContent = leftText(w.left);
  el.append(dots, left);
  return el;
}

/* ---------- the gold star that stamps down, with a sparkle burst ---------- */
export function stampEl(size = '10vh'){
  const el = document.createElement('div'); el.className = 'chstamp';
  const star = document.createElement('div'); star.className = 'chstar'; star.innerHTML = STAR(size);
  el.appendChild(star);
  for (let k = 0; k < 8; k++){ const s = document.createElement('i'); s.className = 'spk'; s.style.setProperty('--a', `${k * 45}deg`); el.appendChild(s); }
  return el;
}

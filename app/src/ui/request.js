/* Make a game (once "Request a game"): a grown-up describes a game by tapping pictures and
   saying it in their own words; it goes to the owner, who makes it with
   their own Claude Code (server: requests.js). Nothing to install, no
   Claude account needed.

   Two choices are needed - how it's seen, and what you do (or, for "like
   a game I know", which game) - everything else is optional, with sensible
   defaults. A sentence at the top writes itself as they pick, so they can
   see what they'll get. It keeps a draft as they go.

     gameBuilder({ host, store, send, onDone })  the builder, on the Create page
     changePop({ game, send, onDone })        Ask for a change to one of theirs
     sentence(recipe, { likeName })           the sum-up (the server's, too) */
import { button, onPick } from './cursor.js';
import { screen, h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { previewCover } from './covers.js';

export const ACTIONS = {
  pop:   { label: 'Pop',            short: 'Pop',   icon: '\u{1F388}', line: 'like Pop Party',              does: (t) => `pop ${t} by touching them`, things: ['soap bubbles', 'balloons', 'fireworks', 'popcorn', 'lollipops', 'jellybeans', 'confetti', 'party poppers', 'pumpkins', 'snowballs', 'stars', 'cupcakes'] },
  steer: { label: 'Fly or steer',   short: 'Fly',   icon: '\u{1F681}', line: 'lean to steer something',     does: (t) => `lean to steer ${t}`, things: ['a plane', 'a sailboat', 'a dragon', 'a hot-air balloon', 'a fish', 'a rocket', 'a UFO', 'a kite', 'a helicopter', 'a whale', 'a bumblebee', 'a cloud'] },
  copy:  { label: 'Copy the moves', short: 'Copy',  icon: '\u{1F483}', line: 'dance and follow the leader', does: (t) => `copy the moves of ${t}`, things: ['a dancing monkey', 'a robot', 'a penguin', 'a superhero', 'a frog', 'a dinosaur', 'a cat', 'a bear', 'a unicorn', 'a pirate', 'a ninja', 'an astronaut'] },
  paint: { label: 'Paint',          short: 'Paint', icon: '\u{1F3A8}', line: 'like Sky Painter',            does: (t) => `paint the sky with ${t}`, things: ['rainbows', 'stars', 'colours', 'glitter', 'clouds', 'flowers', 'fireworks', 'raindrops', 'butterflies', 'sunsets', 'waves', 'snowflakes'] }
};
/* a picture for each thing on offer (an emoji: it's big on its card) */
const EMOJI = {
  'soap bubbles': '\u{1F9FC}', balloons: '\u{1F388}', fireworks: '\u{1F386}', popcorn: '\u{1F37F}', lollipops: '\u{1F36D}', jellybeans: '\u{1F36C}', confetti: '\u{1F38A}', 'party poppers': '\u{1F389}', pumpkins: '\u{1F383}', snowballs: '☃️', stars: '⭐', cupcakes: '\u{1F9C1}',
  'a plane': '✈️', 'a sailboat': '⛵', 'a dragon': '\u{1F409}', 'a hot-air balloon': '\u{1F388}', 'a fish': '\u{1F41F}', 'a rocket': '\u{1F680}', 'a UFO': '\u{1F6F8}', 'a kite': '\u{1FA81}', 'a helicopter': '\u{1F681}', 'a whale': '\u{1F40B}', 'a bumblebee': '\u{1F41D}', 'a cloud': '☁️',
  'a dancing monkey': '\u{1F412}', 'a robot': '\u{1F916}', 'a penguin': '\u{1F427}', 'a superhero': '\u{1F9B8}', 'a frog': '\u{1F438}', 'a dinosaur': '\u{1F996}', 'a cat': '\u{1F431}', 'a bear': '\u{1F43B}', 'a unicorn': '\u{1F984}', 'a pirate': '\u{1F3F4}‍☠️', 'a ninja': '\u{1F977}', 'an astronaut': '\u{1F468}‍\u{1F680}',
  rainbows: '\u{1F308}', colours: '\u{1F3A8}', glitter: '✨', clouds: '☁️', flowers: '\u{1F338}', raindrops: '\u{1F4A7}', butterflies: '\u{1F98B}', sunsets: '\u{1F305}', waves: '\u{1F30A}', snowflakes: '❄️',
  fireflies: '✨', fish: '\u{1F41F}'
};
/* a game is short (about 3 minutes) or long (about 10); a name fits on its card */
export const SHORT = 3, LONG = 10, NAME_MAX = 24;
/* the look and feel: a word for the sentence, and the card's colours */
export const LOOKS = { sunny: 'sunny and bright', cozy: 'warm and cozy', night: 'a starry night', candy: 'sweet candy colours', ocean: 'cool ocean blues',
  forest: 'a green forest', space: 'outer space', rainbow: 'rainbow colours', snow: 'a snowy world', jungle: 'a jungle', sunset: 'a golden sunset', garden: 'a flower garden', party: 'a party' };
const LOOK_COLS = { sunny: ['#ffd86b', '#ff9f6b'], cozy: ['#e8a36a', '#a45a3b'], night: ['#2a2a6b', '#7a5ad6'], candy: ['#ff8fc8', '#7fc8ff'], ocean: ['#3fc1d9', '#2f6fd8'],
  forest: ['#7be0a0', '#2f8f6a'], space: ['#1b1f5e', '#7a5ad6'], rainbow: ['#ff8fc8', '#6bc8ff'], snow: ['#cfe8ff', '#8fb6ff'], jungle: ['#6be0a0', '#3b8f4a'], sunset: ['#ff9f6b', '#c46bff'], garden: ['#ffb3d1', '#8fd6a0'], party: ['#ffd86b', '#ff6b8f'], none: ['#8b7cff', '#4cc3e8'] };
const LOOK_ICON = { sunny: '\u2600\ufe0f', cozy: '\u{1F3E1}', night: '\u{1F319}', candy: '\u{1F36D}', ocean: '\u{1F30A}',
  forest: '\u{1F332}', space: '\u{1F680}', rainbow: '\u{1F308}', snow: '❄️', jungle: '\u{1F99C}', sunset: '\u{1F305}', garden: '\u{1F338}', party: '\u{1F389}' };
/* the colours and symbol a request's card has (Create's Your games uses it too) */
export const looksOf = (recipe = {}) => ({
  cols: LOOK_COLS[recipe.look] || LOOK_COLS.none,
  glyph: recipe.action && ACTIONS[recipe.action] ? ACTIONS[recipe.action].icon : (recipe.look ? LOOK_ICON[recipe.look] : '\u2728')
});
export const CHIPS = { easier: 'Easier', harder: 'Harder', slower: 'Slower', faster: 'Faster', sillier: 'Sillier', longer: 'Longer', two: 'Add a second player', colours: 'Different colours' };
const CHIP_SAYS = { easier: 'make it easier', harder: 'make it harder', slower: 'make it slower', faster: 'make it faster', sillier: 'make it sillier', longer: 'make it last longer', two: 'add a second player', colours: 'use different colours' };
export const WORDS = 500;

const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const count = (s) => ((s || '').match(/\S+/g) || []).length;
const blank = () => ({ at: null, start: 'new', like: null, name: '', view: 'hands', action: null, thing: '', place: '', twists: [], ages: '4-6', energy: 'bouncy', minutes: SHORT, players: 2, look: null, lookText: '', words: '' });

/* The one-sentence sum-up - the same words the server keeps. */
export function sentence(r, { likeName = null } = {}){
  const thing = (r.thing || '').trim() || 'things', place = (r.place || '').trim() ? ` in ${r.place.trim()}` : '';
  const extra = [];
  const head = r.start === 'like' && likeName
    ? `Like ${likeName}${r.action ? `, but you ${ACTIONS[r.action].does(thing)}` : (r.thing || '').trim() ? `, but with ${thing}` : ''}${place}.`
    : `A ${r.view === 'character' ? 'third-person' : 'first-person'} ${r.action ? ACTIONS[r.action].label.toLowerCase() : ''} game: you ${r.action ? ACTIONS[r.action].does(thing) : 'play'}${place}.`;
  return [head.replace('  ', ' '), extra.length ? `${extra.join('; ').replace(/^./, c => c.toUpperCase())}.` : '',
    (LOOKS[r.look] || (r.lookText || '').trim()) ? `The look: ${LOOKS[r.look] || r.lookText.trim()}.` : ''].filter(Boolean).join(' ');
}
export const changeSentence = (name, chips, words) => {
  const asks = chips.map(c => CHIP_SAYS[c]);
  return `A change to ${name}${asks.length ? ': ' + asks.join(', ') : ''}${words ? (asks.length ? ', and more in your words.' : ', in your words.') : '.'}`;
};

/* a big card on its own layer (Back closes it, as with Create's cards) */
function layer(cls){
  const wrap = screen('dim fpopwrap reqwrap'); wrap.style.zIndex = 7;
  const card = h('div', 'fpop ' + cls);
  wrap.appendChild(card);
  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap) wrap.dispatchEvent(new CustomEvent('closeme')); });
  return { wrap, card };
}
const tile = (html, cls, fn) => { const b = button(html, cls); onPick(b, fn); return b; };
const chip = (label, on, fn) => { const b = button(esc(label), 'reqchip' + (on ? ' on' : '')); b.type = 'button'; onPick(b, fn); return b; };

/* ---------- the builder ---------- */

/* Suggestions come three at a time, and a refresh brings three more: the pool
   is shuffled once, then walked through, wrapping round at the end. */
export const ideas = (pool, round = 0, n = 3) => {
  if (!pool.length) return [];
  const out = [];
  for (let k = 0; k < Math.min(n, pool.length); k++) out.push(pool[(round * n + k) % pool.length]);
  return out;
};
const shuffled = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const titled = (t) => String(t || '').replace(/^(a|an|the)\s+/i, '').trim().replace(/\b\w/g, c => c.toUpperCase());
/* Names to suggest, from what the game is about; none longer than NAME_MAX. */
export function nameIdeas(r){
  const T = titled(r.thing) || (r.action && ACTIONS[r.action] ? titled(ACTIONS[r.action].things[0]) : 'Fun');
  const by = {
    pop:   [`Pop the ${T}`, `${T} Pop`, `${T} Party`, `Pop! Pop! ${T}`],
    steer: [`${T} Flight`, `Fly the ${T}`, `${T} Adventure`, `Up with the ${T}`],
    copy:  [`Follow the ${T}`, `Dance Like ${T}`, `${T} Says`, `Move Like ${T}`],
    paint: [`${T} Painter`, `Paint the ${T}`, `Sky of ${T}`, `${T} Colours`]
  }[r.action] || [];
  const all = [...by, `Super ${T}`, `Happy ${T}`, `${T} Time`, `The Great ${T}`, `${T} Day`, `Magic ${T}`];
  return [...new Set(all)].filter(n => n.length <= NAME_MAX);
}

/* A picture for a thing (a big emoji on the card); what you do's own icon for one they typed. */
export const artOf = (thing, action) => EMOJI[thing] || (action && ACTIONS[action] ? ACTIONS[action].icon : '✨');
/* the colours behind a card, one pair per place in the row */
const HUES = [['#7be0a0', '#2fa8d8'], ['#6bc8ff', '#3b6fe0'], ['#ffb86b', '#ff6b8f'], ['#c79bff', '#6b7bff'], ['#ffd86b', '#ff9f6b'], ['#6be0d0', '#3b8fe0']];
/* a short word for each look, for the little chips at the top */
const LOOK_WORD = { sunny: 'Sunny', cozy: 'Cozy', night: 'Night', candy: 'Candy', ocean: 'Ocean', forest: 'Forest', space: 'Space', rainbow: 'Rainbow', snow: 'Snow', jungle: 'Jungle', sunset: 'Sunset', garden: 'Garden', party: 'Party' };

/* The builder: Make a game, one big picture question at a time, on the Create
   page itself. A row of little chips at the top shows the answers so far (tap
   one to go back to it); the round arrow top-left goes up one question. host
   is where it goes; it keeps a draft; onDone() when they're finished with it
   (after sending), onPlay() to go and see it on Play. */
export function gameBuilder({ host, store = async () => [], send, onDone = () => {}, onOpen = () => {}, onPlay = null }){
  let r = blank(), step = 'action', reach = 0, round = { thing: 0, name: 0, look: 0 };
  let lookPoolMade = null;
  const lookPool = () => lookPoolMade || (lookPoolMade = shuffled(Object.keys(LOOKS)));
  const root = h('section', 'builder'); host.prepend(root);
  const close = () => { root.remove(); onDone(); };
  const set = (patch) => { r = { ...r, ...patch }; };
  let pools = {};   /* the shuffled suggestions, per action */
  const poolFor = (a) => pools[a] || (pools[a] = shuffled(ACTIONS[a].things));

  /* the order of the steps, for how they started */
  const order = () => ['action', 'thing', 'look', 'name', 'words', 'review'];
  const ready = (s) => s === 'action' ? !!r.action : true;
  /* the ones that can be skipped, and whether they've been answered (else the pill says Skip) */
  const optional = (s) => ['thing', 'look', 'name', 'words'].includes(s);
  const answered = (s) => s === 'thing' ? !!r.thing.trim() : s === 'look' ? !!(r.look || (r.lookText || '').trim()) : s === 'name' ? !!r.name.trim() : s === 'words' ? !!r.words.trim() : s === 'action' ? !!r.action : true;
  const go = (s, quiet) => { step = s; reach = Math.max(reach, order().indexOf(s)); if (!quiet) sfx.select?.(); draw(); };
  const next = () => { const o = order(); go(o[Math.min(o.length - 1, o.indexOf(step) + 1)]); };
  const up = () => { const o = order(), i = o.indexOf(step); if (i > 0) go(o[i - 1]); };

  /* the question each step asks, and the picture and word its chip shows */
  const question = (s) => s === 'action' ? 'What do you do?'
    : s === 'thing' ? ({ pop: 'What do you pop?', steer: 'What do you fly?', copy: 'Who do you copy?', paint: 'What do you paint with?' }[r.action] || 'What’s in it?')
    : s === 'look' ? 'What does it look like?'
    : s === 'name' ? 'What’s it called?'
    : s === 'words' ? 'Anything else?'
    : 'Ready?';
  const chipOf = (s) => ({
    action: [r.action ? ACTIONS[r.action].icon : '\u{1F3AF}', r.action ? ACTIONS[r.action].short : 'Same'],
    thing: [r.thing.trim() ? artOf(r.thing, r.action) : '✏️', r.thing.trim() ? titled(r.thing).slice(0, 14) : 'Anything'],
    look: [r.look ? LOOK_ICON[r.look] : '\u{1F3A8}', r.look ? LOOK_WORD[r.look] : (r.lookText || '').trim() ? r.lookText.trim().slice(0, 14) : 'Surprise'],
    name: ['\u{1F3F7}️', r.name.trim() ? r.name.trim().slice(0, 14) : 'Any name'],
    words: ['\u{1F4AC}', r.words.trim() ? 'Notes' : 'No notes'],
    review: ['\u{1F680}', 'Ready']
  }[s]);

  const lookCols = () => LOOK_COLS[r.look] || (r.action ? HUES[Object.keys(ACTIONS).indexOf(r.action) % HUES.length] : LOOK_COLS.none);
  /* a picture card: art on a colour, one or two words */
  const card = (cls, art, label, cols, fn) => {
    const t = tile(`<span class="bart">${art}</span><span class="blb">${esc(label)}</span>`, 'bcard ' + cls, (e) => fn(e && e.currentTarget ? e.currentTarget : t));
    t.style.setProperty('--c1', cols[0]); t.style.setProperty('--c2', cols[1]);
    return t;
  };
  /* a game's cover, drawn big, for the name ideas and the review */
  const coverCanvas = (name, cls = '') => {
    const cv = document.createElement('canvas'); cv.width = 720; cv.height = 720; cv.className = 'bcover ' + cls;
    const cols = lookCols();
    try { previewCover(cv, { name: name || 'Your game', cols, glyph: r.action ? artOf(r.thing, r.action) : '✨' }); } catch (e){}
    return cv;
  };

  /* the little steps down the right: a brick for each, in the order they're built */
  const BRICK = ['#ff8fc8', '#3fc1d9', '#7be0a0', '#ffd86b', '#c79bff', '#ffb86b', '#6bc8ff', '#ff6b8f'];
  const STEP_TITLE = (s) => s === 'action' ? 'What you do'
    : s === 'thing' ? ({ pop: 'What you pop', steer: 'What you fly', copy: 'Who you copy', paint: 'What you paint with' }[r.action] || 'What’s in it')
    : s === 'look' ? 'The look' : s === 'name' ? 'Its name' : s === 'words' ? 'Anything else' : 'Ready';
  const ANSWER = (s) => ({
    action: r.action ? ACTIONS[r.action].label : '',
    thing: r.thing.trim() ? titled(r.thing) : 'Anything',
    look: r.look ? LOOKS[r.look].replace(/^./, c => c.toUpperCase()) : (r.lookText || '').trim() || 'A surprise',
    name: r.name.trim() || 'Claude picks',
    words: r.words.trim() ? 'Notes added' : 'No notes',
    review: ''
  }[s]);
  /* the blueprint: a dashed sketch on a grid, filling in as the game does */
  const blueprint = () => {
    const o = order();
    const wrap = h('div', 'bblue' + (r.action ? ' made' : ''));
    if (r.action){
      const cv = document.createElement('canvas'); cv.width = 640; cv.height = 400; cv.className = 'bcv' + (blueMade ? '' : ' pop');
      blueMade = true;
      const cols = lookCols();
      try { previewCover(cv, { name: r.name.trim() || 'Your game', cols, glyph: artOf(r.thing, r.action) }); } catch (e){}
      wrap.appendChild(cv);
    } else wrap.append(h('div', 'bgridbg'), h('span', 'bcrane', '\u{1F3D7}️'));
    wrap.appendChild(h('span', 'bbadge', step === 'review' ? 'Ready!' : `Step ${o.indexOf(step) + 1} of ${o.length}`));
    return wrap;
  };
  const panel = () => {
    const o = order(), i = o.indexOf(step);
    const side = h('div', 'bside');
    const head = h('div', 'bsidetop');
    const arrows = h('div', 'barrows');
    const arrow = (cls, text, label, fn, off) => { const b = button(text, 'barrow ' + cls); b.title = label; b.setAttribute('aria-label', label); onPick(b, () => { if (!b.disabled) fn(); }); if (off) b.disabled = true; arrows.appendChild(b); return b; };
    arrow('bup', '↑', 'Up one question', () => { if (!busy){ sfx.back?.(); up(); } }, i <= 0);
    arrow('bdown', '↓', 'Down one question', () => { if (!busy && ready(step) && step !== 'review') next(); }, !ready(step) || step === 'review');
    head.append(h('h2', 'bsidehead', 'Your game'), arrows);
    side.append(head, blueprint());
    const list = h('div', 'bsteps');
    o.forEach((s, k) => {
      const state = s === step ? 'now' : k <= reach && k < i ? 'ok' : k <= reach ? 'ok' : 'todo';
      const [ico] = chipOf(s);
      const done = state === 'ok';
      const row = button(`<span class="bdot" style="${done ? `background:${BRICK[k % BRICK.length]}` : ''}">${ico}</span><span class="bt">${esc(STEP_TITLE(s))}<small>${s === step ? 'building…' : done ? esc(ANSWER(s)) : ''}</small></span>`, 'bst ' + state + (landed === s ? ' land' : ''));
      if (done) onPick(row, () => { if (!busy) go(s); });
      else row.tabIndex = -1;
      list.appendChild(row);
    });
    side.appendChild(list);
    return side;
  };
  let landed = null, busy = false, blueMade = false;
  /* an answer is built into the list: its card lifts off, flies across and lands as a brick; then the next question rises */
  function fly(el){
    const to = root.querySelector('.bst.now .bdot');
    if (!el || !to || !el.animate || !document.body.animate) return Promise.resolve();
    const a = el.getBoundingClientRect(), b = to.getBoundingClientRect();
    if (!a.width || !b.width) return Promise.resolve();
    const g = el.cloneNode(true);
    el.querySelectorAll('canvas').forEach((cv, k) => { try { const c2 = g.querySelectorAll('canvas')[k]; c2.getContext('2d').drawImage(cv, 0, 0); } catch (e){} });
    Object.assign(g.style, { position: 'fixed', left: a.left + 'px', top: a.top + 'px', width: a.width + 'px', height: a.height + 'px', margin: 0, zIndex: 60, pointerEvents: 'none', transition: 'none' });
    document.body.appendChild(g);
    el.style.visibility = 'hidden';
    const dx = b.left + b.width / 2 - (a.left + a.width / 2), dy = b.top + b.height / 2 - (a.top + a.height / 2), sx = b.width / a.width, sy = b.height / a.height;
    const anim = g.animate([
      { transform: 'none', offset: 0 },
      { transform: `translate(${dx * 0.12}px, ${dy * 0.12 - 30}px) scale(1.06) rotate(-4deg)`, offset: 0.18 },
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy}) rotate(-6deg)`, offset: 0.85, borderRadius: '14px' },
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, offset: 1, opacity: 0.0, borderRadius: '14px' }
    ], { duration: 560, easing: 'cubic-bezier(.45,0,.2,1)' });
    sfx.whoosh?.();
    return anim.finished.then(() => g.remove(), () => g.remove());
  }
  const advance = (el) => {
    if (busy) return;
    busy = true;
    fly(el).then(() => { busy = false; landed = step; sfx.select?.(); next(); });
  };

  async function draw({ keepSide = false } = {}){
    const was = root.querySelector('.bq');
    const side = keepSide ? root.querySelector('.bside') : null;
    root.innerHTML = '';
    const o = order();
    const main = h('div', 'bmain');
    /* (a refresh redraws just the ideas: no rising, and the game on the right stays as it is) */
    const body = h('div', 'bq' + (was && !keepSide ? ' in' : ''));
    main.appendChild(body);
    const pic = step === 'action' ? '\u{1F938}' : step === 'thing' ? (ACTIONS[r.action] ? ACTIONS[r.action].icon : '❔') : step === 'look' ? '\u{1F3A8}' : null;
    const head = h('h1', 'bh' + (pic ? ' bicon' : ''), pic ? `<span class="bpic">${pic}</span><span class="bq-mark">?</span>` : esc(question(step)));
    head.dataset.q = question(step); if (pic) head.setAttribute('aria-label', question(step));
    body.append(head);
    root.append(main, side || panel());
    landed = null;
    await fill(step, body);
    /* a button to go on, for the questions you type in: Next once there's something typed, and Done for the notes */
    if (step === 'thing' || step === 'name' || step === 'words'){
      const p = button(step === 'words' ? 'Done' : 'Next', 'bpill go');
      onPick(p, () => { if (!busy) next(); });
      (step === 'words' ? main : body.querySelector('.btyped') || main).appendChild(p);
      root._pill = p; pillNow(step);
    }
    onOpen();
  }

  /* three ideas (picture cards, or title plaques for names), a refresh that swaps just those three, and a place to type your own */
  function suggest(body, getThree, pick, bump, { cover = false, current = '', input, build = null }){
    const re = button('↻', 'bmore'); re.title = 'Three more ideas'; re.setAttribute('aria-label', 'Three more ideas');
    const cols = lookCols();
    let stack, grid;
    const make = (t, k) => {
      if (build) return build(t, k, (el) => pick(t, el));
      if (cover){
        const b = tile(`<span class="bpt">${esc(t)}</span>`, 'bplaque' + (current === t ? ' on' : ''), (e) => pick(t, e && e.currentTarget ? e.currentTarget : b));
        b.style.setProperty('--c1', cols[0]); b.style.setProperty('--c2', cols[1] || cols[0]); b.setAttribute('aria-label', t);
        return b;
      }
      return card(current === t ? 'on' : '', artOf(t, r.action), titled(t) ? t.replace(/^./, c => c.toUpperCase()) : t, HUES[(k + round.thing * 3) % HUES.length], (el) => pick(t, el));
    };
    /* the three are replaced in place and pop in one after another; the refresh button, the box and the rest don't move */
    const show = (animate) => {
      const items = getThree().map((t, k) => { const e = make(t, k); if (animate){ e.classList.add('swapin'); e.style.animationDelay = `${k * 70}ms`; } return e; });
      (cover ? stack : grid.firstChild).replaceChildren(...items);
    };
    onPick(re, () => { if (busy) return; sfx.select?.(); bump(); show(true); });
    if (cover){
      stack = h('div', 'bplaques');
      body.appendChild(h('div', 'bplakrow')).append(stack, re);
    } else {
      grid = h('div', 'bgrid n3'); grid.append(h('div', 'bitems'), re);
      body.appendChild(grid);
    }
    show(false);
    const typed = h('div', 'btyped'); typed.appendChild(input); body.appendChild(typed);
  }
  const typer = (value, placeholder, max, onType, onEnter) => {
    const input = Object.assign(document.createElement('input'), { className: 'btype', maxLength: max, value, placeholder });
    input.addEventListener('input', () => onType(input.value));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter'){ e.preventDefault(); onEnter(); } });
    return input;
  };
  /* (typing: the Skip pill turns into Next without drawing it all again) */
  const pillNow = (s) => { const d = root.querySelector('.bdown'); if (d) d.disabled = !ready(s) || s === 'review';
    const pl = root._pill; if (pl) pl.style.display = (s === 'words' || answered(s)) ? '' : 'none';
  };

  /* what's inside the open question */
  async function fill(s, body){
    if (s === 'action'){
      const grid = h('div', 'bgrid n4');
      Object.entries(ACTIONS).forEach(([id, a], k) => grid.appendChild(card(r.action === id ? 'on' : '', a.icon, a.label, HUES[[2, 1, 3, 4][k % 4]], (el) => { set({ action: id, thing: r.action === id ? r.thing : '' }); advance(el); })));
      body.appendChild(grid);
    }
    if (s === 'thing'){
      const pool = r.action ? poolFor(r.action) : ['fireflies', 'balloons', 'fish', 'a dragon', 'snowflakes', 'stars'];
      const input = typer(r.thing, 'Or type your own…', 60, (v) => { set({ thing: v }); pillNow('thing'); refreshSide(); }, next);
      suggest(body, () => ideas(pool, round.thing), (t, el) => { set({ thing: t }); advance(el); }, () => { round.thing++; }, { current: r.thing, input });
    }
    if (s === 'look'){
      const input = typer(r.lookText || '', 'Or describe it…', 30, (v) => { set({ lookText: v, look: null }); pillNow('look'); refreshSide(); }, next);
      suggest(body, () => ideas(lookPool(), round.look), (t, el) => { set({ look: t, lookText: LOOKS[t] }); advance(el); }, () => { round.look++; },
        { current: r.look, input, build: (t, k, pickIt) => card(r.look === t ? 'on' : '', LOOK_ICON[t], LOOK_WORD[t], LOOK_COLS[t], pickIt) });
    }
    if (s === 'name'){
      const left = h('p', 'bcount', '');
      const tally = (n) => { left.textContent = `${n} of ${NAME_MAX} letters`; };
      const input = typer(r.name, 'Or type your own…', NAME_MAX, (v) => { set({ name: v }); tally(v.length); pillNow('name'); refreshSide(); }, next);
      tally(r.name.length);
      suggest(body, () => ideas(nameIdeas(r), round.name), (t, el) => { set({ name: t }); advance(el); }, () => { round.name++; }, { cover: true, current: r.name, input });
      body.appendChild(left);
    }
    if (s === 'words'){
      const words = Object.assign(document.createElement('textarea'), { className: 'btype bwords', value: r.words, placeholder: 'How it starts, what’s funny, how you win…' });
      const left = h('p', 'bcount', '');
      const tally = () => { const n = count(words.value); left.textContent = `${n} of ${WORDS} words`; left.classList.toggle('over', n > WORDS); };
      words.addEventListener('input', () => { set({ words: words.value }); tally(); pillNow('words'); });
      tally();
      body.append(words, left, h('p', 'bnote', 'Tip: Windows key + H to speak instead.'));
    }
    if (s === 'review'){
      const stage = h('div', 'breview');
      const side = h('div', 'bsum');
      side.append(h('p', 'bnote', esc(sentence(r))));
      if (r.words) side.append(h('blockquote', 'reqquote', esc(r.words)));
      const err = h('p', 'ferr', '');
      const go_ = button('Send it', 'bpill go big');
      onPick(go_, async () => {
        if (go_.classList.contains('busy')) return;
        go_.classList.add('busy'); err.textContent = '';
        try {
          await send({ start: 'new', like: null, name: r.name, view: 'hands', action: r.action, thing: r.thing, place: '', twists: [], ages: '4-6', energy: 'bouncy', minutes: r.minutes, players: 2, look: r.look, lookText: (r.lookText || '').trim(), words: r.words });
          sfx.gold?.(); sent();
        } catch (e){ go_.classList.remove('busy'); err.textContent = e.message || 'That didn’t send.'; }
      });
      side.append(err, go_);
      stage.appendChild(side);
      body.appendChild(stage);
    }
  }
  /* (typing the name: the cards' own lettering is the typed one on the review, nothing to redraw here) */
  const refreshSide = () => { const old = root.querySelector('.bblue'); if (old) old.replaceWith(blueprint()); };

  function sent(){
    root.innerHTML = '';
    const done = h('div', 'bq bsent');
    done.append(h('div', 'bigemoji', '\u{1F6A7}'), h('h1', 'bh', 'On its way!'), h('p', 'bnote', onPlay ? 'You’ll find it under construction on Play.' : 'You’ll find it under construction, below.'));
    const row = h('div', 'bbtns');
    const again = button('Make another', 'bpill go'); onPick(again, () => { sfx.select?.(); close(); });
    row.appendChild(again);
    if (onPlay){ const see = button('See it on Play', 'bpill skip'); onPick(see, () => { sfx.select?.(); onPlay(); }); row.appendChild(see); }
    done.appendChild(row);
    root.appendChild(done);
  }
  onOpen();
  draw();
  return { close };
}

/* ---------- Ask for a change ---------- */

export function changePop({ game, send, onDone = () => {} }){
  const { wrap, card } = layer('reqpop small');
  const close = () => { wrap.remove(); onDone(); };
  wrap.addEventListener('closeme', () => { sfx.back?.(); close(); });
  let chips = [], words = '';
  const draw = () => {
    card.innerHTML = '';
    card.append(h('h2', '', `Change ${esc(game.name)}`), h('p', 'reqsum', esc(changeSentence(game.name, chips, words))));
    const c = h('div', 'reqchips big');
    for (const [id, label] of Object.entries(CHIPS)){
      const on = chips.includes(id);
      c.appendChild(chip(label, on, () => { chips = on ? chips.filter(x => x !== id) : [...chips, id].slice(-4); draw(); }));
    }
    const t = Object.assign(document.createElement('textarea'), { className: 'finput reqwords short', value: words, placeholder: 'Anything else?' });
    t.addEventListener('input', () => { words = t.value; card.querySelector('.reqsum').textContent = changeSentence(game.name, chips, words); });
    const err = h('p', 'ferr', '');
    const f = h('div', 'reqfoot');
    const cancel = button('Cancel', 'link'); onPick(cancel, () => { sfx.back?.(); close(); });
    const go = button('Send request', 'go');
    onPick(go, async () => {
      if (!chips.length && !words.trim()){ err.textContent = 'Tap one of the ideas, or say what to change.'; return; }
      go.classList.add('busy'); err.textContent = '';
      try { await send({ change: game.id, chips, words }); sfx.gold?.(); close(); }
      catch (e){ go.classList.remove('busy'); err.textContent = e.message || 'That didn’t send.'; }
    });
    f.append(cancel, go);
    card.append(c, t, err, f);
  };
  draw();
  return { close };
}

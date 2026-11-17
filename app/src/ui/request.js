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
  pop:   { label: 'Pop',            icon: '\u{1F388}', line: 'like Pop Party',              does: (t) => `pop ${t} by touching them`, things: ['bubbles', 'balloons', 'fireworks', 'soap bubbles', 'popcorn', 'lollipops', 'jellybeans', 'confetti', 'party poppers', 'pumpkins', 'snowballs', 'stars'] },
  steer: { label: 'Fly or steer',   icon: '\u{1F681}', line: 'lean to steer something',     does: (t) => `lean to steer ${t}`, things: ['a little plane', 'a sailboat', 'a dragon', 'a hot-air balloon', 'a fish', 'a rocket', 'a magic carpet', 'a kite', 'a submarine', 'a whale', 'a bumblebee', 'a cloud'] },
  copy:  { label: 'Copy the moves', icon: '\u{1F483}', line: 'dance and follow the leader', does: (t) => `copy the moves of ${t}`, things: ['a dancing monkey', 'a robot', 'a penguin', 'a superhero', 'a frog', 'a dinosaur', 'a cat', 'a bear', 'a unicorn', 'a pirate', 'a ninja', 'an astronaut'] },
  paint: { label: 'Paint',          icon: '\u{1F3A8}', line: 'like Sky Painter',            does: (t) => `paint the sky with ${t}`, things: ['rainbows', 'stars', 'colours', 'glitter', 'clouds', 'flowers', 'fireworks', 'bubbles', 'butterflies', 'sunsets', 'waves', 'snowflakes'] }
};
/* a game is short (about 3 minutes) or long (about 10); a name fits on its card */
export const SHORT = 3, LONG = 10, NAME_MAX = 24;
/* the look and feel: a word for the sentence, and the card's colours */
export const LOOKS = { sunny: 'sunny and bright', cozy: 'warm and cozy', night: 'a starry night', candy: 'sweet candy colours', ocean: 'cool ocean blues' };
const LOOK_COLS = { sunny: ['#ffd86b', '#ff9f6b'], cozy: ['#e8a36a', '#a45a3b'], night: ['#2a2a6b', '#7a5ad6'], candy: ['#ff8fc8', '#7fc8ff'], ocean: ['#3fc1d9', '#2f6fd8'], none: ['#8b7cff', '#4cc3e8'] };
const LOOK_ICON = { sunny: '\u2600\ufe0f', cozy: '\u{1F3E1}', night: '\u{1F319}', candy: '\u{1F36D}', ocean: '\u{1F30A}' };
/* the colours and symbol a request's card has (Create's Your games uses it too) */
export const looksOf = (recipe = {}) => ({
  cols: LOOK_COLS[recipe.look] || LOOK_COLS.none,
  glyph: recipe.action && ACTIONS[recipe.action] ? ACTIONS[recipe.action].icon : (recipe.look ? LOOK_ICON[recipe.look] : '\u2728')
});
export const CHIPS = { easier: 'Easier', harder: 'Harder', slower: 'Slower', faster: 'Faster', sillier: 'Sillier', longer: 'Longer', two: 'Add a second player', colours: 'Different colours' };
const CHIP_SAYS = { easier: 'make it easier', harder: 'make it harder', slower: 'make it slower', faster: 'make it faster', sillier: 'make it sillier', longer: 'make it last longer', two: 'add a second player', colours: 'use different colours' };
export const WORDS = 500;
const DRAFT = 'orlis.requestDraft';

const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const count = (s) => ((s || '').match(/\S+/g) || []).length;
const blank = () => ({ at: null, start: null, like: null, name: '', view: 'hands', action: null, thing: '', place: '', twists: [], ages: '4-6', energy: 'bouncy', minutes: SHORT, players: 2, look: null, words: '' });
const load = () => { try { return { ...blank(), ...(JSON.parse(localStorage.getItem(DRAFT)) || {}) }; } catch { return blank(); } };
const keep = (r) => { try { localStorage.setItem(DRAFT, JSON.stringify(r)); } catch {} };
const drop = () => { try { localStorage.removeItem(DRAFT); } catch {} };

/* The one-sentence sum-up - the same words the server keeps. */
export function sentence(r, { likeName = null } = {}){
  const thing = (r.thing || '').trim() || 'things', place = (r.place || '').trim() ? ` in ${r.place.trim()}` : '';
  const ages = { '2-3': '2 to 3', '4-6': '4 to 6', '7+': '7 and up' }[r.ages];
  const extra = [];
  const head = r.start === 'like' && likeName
    ? `Like ${likeName}${r.action ? `, but you ${ACTIONS[r.action].does(thing)}` : (r.thing || '').trim() ? `, but with ${thing}` : ''}${place}.`
    : `A ${r.view === 'character' ? 'third-person' : 'first-person'} ${r.action ? ACTIONS[r.action].label.toLowerCase() : ''} game: you ${r.action ? ACTIONS[r.action].does(thing) : 'play'}${place}.`;
  return [head.replace('  ', ' '), extra.length ? `${extra.join('; ').replace(/^./, c => c.toUpperCase())}.` : '',
    `For ages ${ages}, ${r.energy}, about ${r.minutes} minutes, ${Number(r.players) === 1 ? 'one player' : 'one or two players'}.`,
    r.look && LOOKS[r.look] ? `The look: ${LOOKS[r.look]}.` : ''].filter(Boolean).join(' ');
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
const tile = (html, cls, fn) => { const b = button(html, 'reqtile ' + cls); onPick(b, fn); return b; };
const chip = (label, on, fn) => { const b = button(esc(label), 'reqchip' + (on ? ' on' : '')); b.type = 'button'; onPick(b, fn); return b; };

/* ---------- the builder ---------- */

/* the steps, and what each is called where it's listed */
const STEP_NAME = { start: 'How to start', like: 'Which game', action: 'What you do', thing: 'What’s in it', look: 'The look', length: 'How long', name: 'Its name', words: 'In your words', review: 'Ready?' };

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

/* The builder: Make a game, piece by piece, on the Create page itself. The
   page keeps moving down: each answer stays above, small, and the next
   question comes in underneath. The arrows at the top right go up and down
   a question, and the x closes it. host is where it goes; it keeps a draft;
   onDone() when it's closed or sent. */
export function gameBuilder({ host, store = async () => [], send, onDone = () => {}, onOpen = () => {} }){
  let r = load(), games = null, step = 'start', reach = 0, round = { thing: 0, name: 0 };
  const root = h('section', 'builder'); host.prepend(root);
  const close = () => { root.remove(); onDone(); };
  const likeName = () => (games || []).find(g => g.id === r.like)?.name || null;
  const set = (patch) => { r = { ...r, ...patch }; keep(r); };
  let pools = {};   /* the shuffled suggestions, per action */
  const poolFor = (a) => pools[a] || (pools[a] = shuffled(ACTIONS[a].things));

  /* the order of the steps, for how they started */
  const order = () => ['start', r.start === 'like' ? 'like' : null, 'action', 'thing', 'look', 'length', 'name', 'words', 'review'].filter(Boolean);
  const ready = (s) => s === 'start' ? !!r.start : s === 'like' ? !!r.like : s === 'action' ? (r.start === 'like' || !!r.action) : s === 'length' ? !!r.minutes : true;
  if (r.start){ const o = order(); step = o.includes(r.at) && r.at !== 'start' ? r.at : o[1]; reach = o.indexOf(step); }
  let seen = reach;   /* (how far the stack went the last time it was drawn: only a new card slides in) */
  const go = (s) => { step = s; reach = Math.max(reach, order().indexOf(s)); set({ at: s }); sfx.select?.(); draw(); };
  const next = () => { const o = order(); go(o[Math.min(o.length - 1, o.indexOf(step) + 1)]); };
  const up = () => { const o = order(), i = o.indexOf(step); if (i > 0) go(o[i - 1]); };

  function surprise(){
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const action = pick(Object.keys(ACTIONS));
    set({ start: 'surprise', like: null, view: 'hands', action, thing: pick(ACTIONS[action].things), look: pick(Object.keys(LOOKS)), minutes: pick([SHORT, LONG]) });
    reach = order().length - 1;
    go('review');
  }

  /* what each step's answer says, for the cards above and the list at the end */
  const says = (s) => ({
    start: { new: 'Something new', like: 'Like a game I know', surprise: 'A surprise' }[r.start] || '',
    like: likeName() || '',
    action: r.action ? ACTIONS[r.action].label : (r.start === 'like' ? 'Same as it is' : ''),
    thing: r.thing || 'Nothing in particular',
    look: r.look ? LOOKS[r.look] : 'Let it be a surprise',
    length: r.minutes >= LONG ? 'Long · about 10 minutes' : 'Short · about 3 minutes',
    name: r.name.trim() || 'Claude picks one',
    words: r.words.trim() ? (r.words.trim().length > 90 ? r.words.trim().slice(0, 90) + '…' : r.words.trim()) : 'Nothing more'
  }[s]);
  /* the question each step asks */
  const question = (s) => s === 'start' ? 'How do you want to start?'
    : s === 'like' ? 'Which game is it like?'
    : s === 'action' ? (r.start === 'like' ? 'Anything different? (optional)' : 'What do you do?')
    : s === 'thing' ? ({ pop: 'What do you pop?', steer: 'What do you fly or steer?', copy: 'Who do you copy?', paint: 'What do you paint with?' }[r.action] || 'What’s in it?')
    : s === 'look' ? 'What does it look like? (optional)'
    : s === 'length' ? 'How long is it?'
    : s === 'name' ? 'What is it called? (optional)'
    : s === 'words' ? 'Anything else? (optional)'
    : 'Ready?';

  /* the card on the side: it fills in as they choose */
  function sideCard(){
    const side = h('div', 'bside');
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 400; cv.className = 'bcard';
    const cols = LOOK_COLS[r.look] || LOOK_COLS.none;
    try { previewCover(cv, { name: r.name.trim() || 'Your game', cols, glyph: r.action ? ACTIONS[r.action].icon : (r.look ? LOOK_ICON[r.look] : '✨') }); } catch (e){}
    side.appendChild(cv);
    const facts = h('div', 'bfacts');
    for (const t of [r.action && ACTIONS[r.action].label, r.look && LOOKS[r.look]].filter(Boolean))
      facts.appendChild(h('span', 'bfact', esc(t)));
    side.appendChild(facts);
    if (step !== 'start') side.appendChild(h('p', 'reqsum', esc(sentence(r, { likeName: likeName() }))));
    return side;
  }

  async function draw(){
    root.innerHTML = '';
    const o = order(), i = o.indexOf(step);
    /* the top: where they are, and the way up, down and out */
    const head = h('div', 'bhead');
    head.append(h('div', 'bwhere', esc(STEP_NAME[step] || '')),
      h('div', 'reqsteps', o.slice(1).map((s, k) => `<span class="${k + 1 <= reach ? 'on' : ''}"></span>`).join('')));
    const ctl = h('div', 'bctl');
    const arrow = (label, text, fn, off) => { const b = button(text, 'barrow'); b.title = label; b.setAttribute('aria-label', label); onPick(b, fn); if (off) b.disabled = true; ctl.appendChild(b); return b; };
    arrow('Up one question', '↑', up, i <= 0);
    const down = arrow('Down one question', '↓', () => { if (ready(step) && i < o.length - 1) next(); }, !ready(step) || i >= o.length - 1);
    const x = arrow('Close', '✕', () => { sfx.back?.(); close(); });
    x.classList.add('bx');
    head.appendChild(ctl);
    root.appendChild(head);
    const main = h('div', 'bmain');
    const stack = h('div', 'bstack');
    main.appendChild(stack);
    root.appendChild(main);
    main.appendChild(sideCard());

    /* one card per question so far: the ones above are small, the one they're on is open */
    o.slice(0, reach + 1).forEach((s, k) => {
      const card = h('div', 'bq' + (s === step ? ' cur' : ' done') + (k > seen ? ' fresh' : ''));
      if (s !== step){
        const head = h('div', 'bqhead');
        head.append(h('h3', '', esc(question(s).replace(' (optional)', ''))), h('span', 'bans', esc(says(s) || '')));
        card.appendChild(head);
        onPick(card, () => go(s));
        stack.appendChild(card);
        return;
      }
      stack.appendChild(card);
      const body = h('div', 'reqbody bstep');
      card.appendChild(body);
      body.append(h('h2', '', esc(question(s))));
      fill(s, body, down);
    });
    seen = reach;
    /* the page keeps moving down: the open question comes to the middle, the last one still above it */
    const cur = stack.querySelector('.cur');
    if (cur) setTimeout(() => { try { cur.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e){} }, 30);
  }

  /* what's inside the open question */
  async function fill(s, body, down){
    const refreshDown = () => { down.disabled = !ready(s) || order().indexOf(s) >= order().length - 1; };
    if (s === 'start'){
      const grid = h('div', 'reqgrid three');
      grid.append(
        tile('<span class="ri">✨</span><b>Make something new</b><small>From scratch</small>', r.start === 'new' ? 'on' : '', () => { set({ start: 'new', like: null }); next(); }),
        tile('<span class="ri">\u{1F3AE}</span><b>Like a game I know</b><small>Then change it</small>', r.start === 'like' ? 'on' : '', () => { set({ start: 'like' }); next(); }),
        tile('<span class="ri">\u{1F3B2}</span><b>Surprise me</b><small>We pick it all</small>', '', surprise));
      body.appendChild(grid);
      if (r.action || r.words){ const b = button('Start over', 'link'); onPick(b, () => { drop(); r = blank(); reach = 0; seen = 0; round = { thing: 0, name: 0 }; draw(); }); body.appendChild(b); }
    }
    if (s === 'like'){
      if (games === null){ body.append(h('p', 'reqlede', 'Looking in Discover…')); games = await store(); return draw(); }
      if (!games.length) body.append(h('p', 'reqlede', 'Discover’s out of reach right now.'));
      const grid = h('div', 'reqgrid');
      for (const g of games) grid.appendChild(tile(`<b>${esc(g.name)}</b><small>${esc(g.blurb || '')}</small>`, r.like === g.id ? 'on' : '', () => { set({ like: g.id }); next(); }));
      body.appendChild(grid);
    }
    if (s === 'action'){
      const grid = h('div', 'reqgrid four');
      for (const [id, a] of Object.entries(ACTIONS)) grid.appendChild(tile(`<span class="ri">${a.icon}</span><b>${a.label}</b><small>${a.line}</small>`, r.action === id ? 'on' : '', () => { set({ action: r.action === id && r.start === 'like' ? null : id, thing: r.action === id ? r.thing : '' }); if (r.action) next(); else draw(); }));
      body.appendChild(grid);
    }
    if (s === 'thing'){
      const pool = r.action ? poolFor(r.action) : ['fireflies', 'balloons', 'fish', 'a dragon', 'snowflakes', 'stars'];
      const input = Object.assign(document.createElement('input'), { className: 'finput', maxLength: 60, value: r.thing, placeholder: 'Type your own, or tap one' });
      input.addEventListener('input', () => { set({ thing: input.value }); refresh(); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter'){ e.preventDefault(); next(); } });
      suggest(body, ideas(pool, round.thing), (t) => { set({ thing: t }); next(); }, () => { round.thing++; draw(); }, r.thing);
      body.append(input);
    }
    if (s === 'look'){
      const grid = h('div', 'reqgrid five');
      for (const [id, label] of Object.entries(LOOKS)){
        const cols = LOOK_COLS[id];
        const t = tile(`<span class="ri">${LOOK_ICON[id]}</span><b>${esc(label.replace(/^./, c => c.toUpperCase()))}</b>`, r.look === id ? 'on' : '', () => { set({ look: r.look === id ? null : id }); r.look ? next() : draw(); });
        t.style.setProperty('--lk1', cols[0]); t.style.setProperty('--lk2', cols[1]); t.classList.add('lk');
        grid.appendChild(t);
      }
      body.appendChild(grid);
    }
    if (s === 'length'){
      const grid = h('div', 'reqgrid two');
      grid.append(
        tile('<span class="ri">⏱️</span><b>Short</b><small>About 3 minutes</small>', r.minutes === SHORT ? 'on' : '', () => { set({ minutes: SHORT }); next(); }),
        tile('<span class="ri">\u{1F3D4}️</span><b>Long</b><small>About 10 minutes</small>', r.minutes === LONG ? 'on' : '', () => { set({ minutes: LONG }); next(); }));
      body.appendChild(grid);
    }
    if (s === 'name') {
      const input = Object.assign(document.createElement('input'), { className: 'finput reqname', maxLength: NAME_MAX, value: r.name, placeholder: 'Or type your own' });
      const left = h('p', 'reqcount', '');
      const tally = () => { left.textContent = `${input.value.length} of ${NAME_MAX} letters`; };
      input.addEventListener('input', () => { set({ name: input.value }); tally(); refresh(); });
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter'){ e.preventDefault(); next(); } });
      tally();
      suggest(body, ideas(nameIdeas(r), round.name), (t) => { set({ name: t }); next(); }, () => { round.name++; draw(); }, r.name);
      body.append(input, left);
      setTimeout(() => input.focus({ preventScroll: true }), 400);
    }
    if (s === 'words'){
      const words = Object.assign(document.createElement('textarea'), { className: 'finput reqwords', value: r.words, placeholder: 'How it starts, what’s funny, how you win…' });
      const left = h('p', 'reqcount', '');
      const tally = () => { const n = count(words.value); left.textContent = `${n} of ${WORDS} words`; left.classList.toggle('over', n > WORDS); };
      words.addEventListener('input', () => { set({ words: words.value }); tally(); refresh(); });
      tally();
      body.append(words, left, h('p', 'reqtip', 'Tip: Windows key + H to speak instead.'));
    }
    if (s === 'review'){
      body.append(h('p', 'reqlede', 'This is your game. Tap any question above to change it, then send it.'));
      body.append(h('p', 'reqsum', esc(sentence(r, { likeName: likeName() }))));
      if (r.words) body.append(h('blockquote', 'reqquote', esc(r.words)));
      const err = h('p', 'ferr', '');
      body.appendChild(err);
      const go_ = button('Send request', 'go');
      onPick(go_, async () => {
        if (go_.classList.contains('busy')) return;
        go_.classList.add('busy'); err.textContent = '';
        try {
          await send({ start: r.start === 'surprise' ? 'new' : r.start, like: r.like, name: r.name, view: 'hands', action: r.action, thing: r.thing, place: '', twists: [], ages: '4-6', energy: 'bouncy', minutes: r.minutes, players: 2, look: r.look, words: r.words });
          drop(); sfx.gold?.(); sent();
        } catch (e){ go_.classList.remove('busy'); err.textContent = e.message || 'That didn’t send.'; }
      });
      const f = h('div', 'reqfoot'); f.appendChild(go_); body.appendChild(f);
    }
    /* (typing changes the side card without drawing it all again) */
    function refresh(){ const was = root.querySelector('.bside'); if (was) was.replaceWith(sideCard()); refreshDown(); }
  }

  /* three suggestions and a little refresh for three more */
  function suggest(body, three, pick, again, current){
    const row = h('div', 'reqchips big bideas');
    for (const t of three) row.appendChild(chip(t, current === t, () => pick(t)));
    const re = button('↻', 'barrow brefresh'); re.title = 'Three more ideas'; re.setAttribute('aria-label', 'Three more ideas');
    onPick(re, () => { sfx.select?.(); again(); });
    row.appendChild(re);
    body.appendChild(row);
  }
  function sent(){
    root.innerHTML = '';
    root.append(h('h2', '', 'Sent!'), h('p', 'reqlede', 'You’ll see it below when it’s ready.'));
    const ok = button('OK', 'go'); onPick(ok, () => { sfx.select?.(); close(); });
    const f = h('div', 'reqfoot'); f.appendChild(ok); root.appendChild(f);
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

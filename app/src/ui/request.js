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
  catch:   { label: 'Catch',             icon: '\u{1F932}', line: 'things that fall or fly by',  does: (t) => `catch ${t} as they fall or fly by`, things: ['fireflies', 'snowflakes', 'falling stars', 'raindrops', 'apples'] },
  pop:     { label: 'Pop or tap',        icon: '\u{1F388}', line: 'like Pop Party',              does: (t) => `pop ${t} by touching them`, things: ['bubbles', 'balloons', 'fireworks', 'soap bubbles', 'popcorn'] },
  dodge:   { label: 'Dodge',             icon: '\u{1F3C3}', line: 'lean and jump past things',   does: (t) => `lean and jump past ${t}`, things: ['rolling snowballs', 'bouncing boulders', 'sleepy sheep', 'tumbleweeds', 'puddles'] },
  collect: { label: 'Collect and carry', icon: '\u{1F9FA}', line: 'take them to a place',        does: (t) => `collect ${t} and carry them to a place`, things: ['eggs', 'shells', 'lost puppies', 'gems', 'acorns'] },
  sweep:   { label: 'Sweep or push',     icon: '\u{1F342}', line: 'like Leaf Pile',              does: (t) => `sweep ${t} into a big pile`, things: ['leaves', 'snow', 'sand', 'toys', 'clouds'] },
  stack:   { label: 'Stack and build',   icon: '\u{1F9F1}', line: 'like Stack It High',          does: (t) => `stack ${t} into a tall tower`, things: ['blocks', 'pancakes', 'cups', 'boxes', 'cheese wheels'] },
  paint:   { label: 'Paint and draw',    icon: '\u{1F3A8}', line: 'like Sky Painter',            does: (t) => `paint the sky with ${t}`, things: ['rainbows', 'stars', 'colours', 'glitter', 'clouds'] },
  freeze:  { label: 'Freeze',            icon: '\u{1F9CA}', line: 'like Sleepy Bear',            does: (t) => `dance, then freeze when ${t} looks`, things: ['a sleepy bear', 'a curious cat', 'a grumpy troll', 'an owl', 'a robot'] },
  copy:    { label: 'Copy the moves',    icon: '\u{1F483}', line: 'dance and follow the leader', does: (t) => `copy the moves of ${t}`, things: ['a dancing monkey', 'a robot', 'a penguin', 'a superhero', 'a frog'] },
  steer:   { label: 'Fly or steer',      icon: '\u{1F681}', line: 'lean to steer something',     does: (t) => `lean to steer ${t}`, things: ['a little plane', 'a sailboat', 'a dragon', 'a hot-air balloon', 'a fish'] }
};
export const TWISTS = { faster: 'It gets faster', surprise: 'A big surprise at the end', golden: 'A golden one worth extra', together: 'Work together', helper: 'A friendly helper', silly: 'Silly sounds', story: 'A little story' };
const TWIST_SAYS = { faster: 'it gets a little faster as it goes', surprise: 'a big surprise at the end', golden: 'a golden one now and then, worth extra', together: 'the players work together', helper: 'a friendly helper', silly: 'silly sounds', story: 'a little story' };
/* the look and feel: a word for the sentence, and the card's colours */
export const LOOKS = { sunny: 'sunny and bright', cozy: 'warm and cozy', night: 'a starry night', candy: 'sweet candy colours', ocean: 'cool ocean blues' };
const LOOK_COLS = { sunny: ['#ffd86b', '#ff9f6b'], cozy: ['#e8a36a', '#a45a3b'], night: ['#2a2a6b', '#7a5ad6'], candy: ['#ff8fc8', '#7fc8ff'], ocean: ['#3fc1d9', '#2f6fd8'], none: ['#8b7cff', '#4cc3e8'] };
const LOOK_ICON = { sunny: '\u2600\ufe0f', cozy: '\u{1F3E1}', night: '\u{1F319}', candy: '\u{1F36D}', ocean: '\u{1F30A}' };
/* the colours and symbol a request's card has (Create's Your games uses it too) */
export const looksOf = (recipe = {}) => ({
  cols: LOOK_COLS[recipe.look] || LOOK_COLS.none,
  glyph: recipe.action && ACTIONS[recipe.action] ? ACTIONS[recipe.action].icon : (recipe.look ? LOOK_ICON[recipe.look] : '\u2728')
});
const PLACES = ['a meadow', 'outer space', 'under the sea', 'a jungle', 'snowy hills', 'a kitchen', 'a castle', 'a city at night'];
export const CHIPS = { easier: 'Easier', harder: 'Harder', slower: 'Slower', faster: 'Faster', sillier: 'Sillier', longer: 'Longer', two: 'Add a second player', colours: 'Different colours' };
const CHIP_SAYS = { easier: 'make it easier', harder: 'make it harder', slower: 'make it slower', faster: 'make it faster', sillier: 'make it sillier', longer: 'make it last longer', two: 'add a second player', colours: 'use different colours' };
export const WORDS = 500;
const DRAFT = 'orlis.requestDraft';

const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const count = (s) => ((s || '').match(/\S+/g) || []).length;
const blank = () => ({ at: null, start: null, like: null, name: '', view: null, action: null, thing: '', place: '', twists: [], ages: '4-6', energy: 'bouncy', minutes: 5, players: 2, look: null, words: '' });
const load = () => { try { return { ...blank(), ...(JSON.parse(localStorage.getItem(DRAFT)) || {}) }; } catch { return blank(); } };
const keep = (r) => { try { localStorage.setItem(DRAFT, JSON.stringify(r)); } catch {} };
const drop = () => { try { localStorage.removeItem(DRAFT); } catch {} };

/* The one-sentence sum-up - the same words the server keeps. */
export function sentence(r, { likeName = null } = {}){
  const thing = (r.thing || '').trim() || 'things', place = (r.place || '').trim() ? ` in ${r.place.trim()}` : '';
  const ages = { '2-3': '2 to 3', '4-6': '4 to 6', '7+': '7 and up' }[r.ages];
  const extra = (r.twists || []).map(t => TWIST_SAYS[t]).filter(Boolean);
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
const STEP_NAME = { start: 'Start', like: 'Which game', view: 'How it’s seen', action: 'What you do', thing: 'What’s in it', twists: 'Twists', who: 'Who it’s for', look: 'The look', name: 'Its name', words: 'In your words', review: 'Review' };
/* the ones that can be skipped */
const OPTIONAL = new Set(['thing', 'twists', 'look', 'name', 'words']);

/* The builder: Make a game, piece by piece, on the Create page itself - one
   question at a time, a card on the side that fills in as they choose, Back
   to go up one, and at the end every answer listed to change. host is where
   it goes; it keeps a draft; onDone() when it's closed or sent. */
export function gameBuilder({ host, store = async () => [], send, onDone = () => {}, onOpen = () => {} }){
  let r = load(), games = null, step = 'start', editing = false;
  const root = h('section', 'builder'); host.prepend(root);
  const close = () => { root.remove(); onDone(); };
  const likeName = () => (games || []).find(g => g.id === r.like)?.name || null;
  const set = (patch) => { r = { ...r, ...patch }; keep(r); };

  /* the order of the steps, for how they started */
  const order = () => ['start', r.start === 'like' ? 'like' : 'view', 'action', 'thing', 'twists', 'who', 'look', 'name', 'words', 'review'].filter(x => !(x === 'view' && r.start === 'surprise'));
  const ready = (s) => s === 'start' ? !!r.start : s === 'like' ? !!r.like : s === 'view' ? !!r.view : s === 'action' ? (r.start === 'like' || !!r.action) : true;
  /* did they pick anything on this step (else its button says Skip) */
  const chosen = (s) => s === 'thing' ? !!(r.thing || r.place) : s === 'twists' ? r.twists.length > 0 : s === 'look' ? !!r.look : s === 'name' ? !!r.name.trim() : s === 'words' ? !!r.words.trim() : true;
  if (r.start){ const o = order(); step = o.includes(r.at) && r.at !== 'start' ? r.at : o[1]; }
  const go = (s) => { step = s; set({ at: s }); sfx.select?.(); draw(); };
  const next = () => { if (editing) { editing = false; return go('review'); } const o = order(); go(o[Math.min(o.length - 1, o.indexOf(step) + 1)]); };
  const back = () => {
    if (editing){ editing = false; return go('review'); }
    const o = order(), i = o.indexOf(step);
    if (i <= 0){ sfx.back?.(); close(); } else go(o[i - 1]);
  };
  const change = (s) => { editing = true; go(s); };

  function surprise(){
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const action = pick(Object.keys(ACTIONS));
    set({ start: 'surprise', like: null, view: pick(['hands', 'character']), action, thing: pick(ACTIONS[action].things), place: pick(PLACES), twists: [pick(Object.keys(TWISTS))], look: pick(Object.keys(LOOKS)) });
    go('review');
  }

  /* what each step's answer says, for the list at the end */
  const says = (s) => ({
    start: { new: 'Something new', like: 'Like a game I know', surprise: 'A surprise' }[r.start] || '',
    like: likeName() || '',
    view: { hands: 'Your hands', character: 'Your character' }[r.view] || '',
    action: r.action ? ACTIONS[r.action].label : (r.start === 'like' ? 'Same as it is' : ''),
    thing: [r.thing, r.place && `in ${r.place}`].filter(Boolean).join(' ') || 'Nothing in particular',
    twists: r.twists.map(t => TWISTS[t]).join(', ') || 'None',
    who: `Ages ${({ '2-3': '2 to 3', '4-6': '4 to 6', '7+': '7 and up' })[r.ages]} · ${r.energy} · ${r.minutes} minutes · ${Number(r.players) === 1 ? 'one player' : 'one or two players'}`,
    look: r.look ? LOOKS[r.look] : 'Let it be a surprise',
    name: r.name.trim() || 'Claude picks one',
    words: r.words.trim() ? (r.words.trim().length > 90 ? r.words.trim().slice(0, 90) + '…' : r.words.trim()) : 'Nothing more'
  }[s]);

  /* the card on the side: it fills in as they choose */
  function sideCard(){
    const side = h('div', 'bside');
    const cv = document.createElement('canvas'); cv.width = 640; cv.height = 400; cv.className = 'bcard';
    const cols = LOOK_COLS[r.look] || LOOK_COLS.none;
    try { previewCover(cv, { name: r.name.trim() || 'Your game', cols, glyph: r.action ? ACTIONS[r.action].icon : (r.look ? LOOK_ICON[r.look] : '✨') }); } catch (e){}
    side.appendChild(cv);
    const facts = h('div', 'bfacts');
    for (const t of [r.action && ACTIONS[r.action].label, r.view && ({ hands: 'Your hands', character: 'Your character' })[r.view], (r.start && step !== 'start' && step !== 'like' && step !== 'view' && step !== 'action' && step !== 'thing' && step !== 'twists') ? `Ages ${r.ages}` : null, r.look && LOOKS[r.look]].filter(Boolean))
      facts.appendChild(h('span', 'bfact', esc(t)));
    side.appendChild(facts);
    if (step !== 'start') side.appendChild(h('p', 'reqsum', esc(sentence(r, { likeName: likeName() }))));
    return side;
  }

  async function draw(){
    root.innerHTML = '';
    const o = order(), i = o.indexOf(step);
    /* the top: where they are, and a way out */
    const head = h('div', 'bhead');
    head.append(h('div', 'bwhere', step === 'start' ? 'Make a game' : `Step ${i} of ${o.length - 1} · ${esc(STEP_NAME[step])}`),
      h('div', 'reqsteps', o.slice(1).map((s, k) => `<span class="${k + 1 <= i ? 'on' : ''}"></span>`).join('')));
    const x = button('Close', 'link bclose'); onPick(x, () => { sfx.back?.(); close(); });
    head.appendChild(x);
    root.appendChild(head);
    const main = h('div', 'bmain' + (step === 'start' || step === 'review' ? ' wide' : ''));
    const body = h('div', 'reqbody bstep');
    main.appendChild(body);
    if (step !== 'start' && step !== 'review') main.appendChild(sideCard());
    root.appendChild(main);
    const foot = h('div', 'reqfoot');
    root.appendChild(foot);
    const nav = (label, fn, cls = '') => { const b = button(label, cls); onPick(b, fn); foot.appendChild(b); return b; };

    if (step === 'start'){
      body.append(h('h2', '', 'How do you want to start?'));
      const grid = h('div', 'reqgrid three');
      grid.append(
        tile('<span class="ri">✨</span><b>Make something new</b><small>From scratch</small>', '', () => { set({ start: 'new', like: null }); next(); }),
        tile('<span class="ri">\u{1F3AE}</span><b>Like a game I know</b><small>Then change it</small>', '', () => { set({ start: 'like' }); next(); }),
        tile('<span class="ri">\u{1F3B2}</span><b>Surprise me</b><small>We pick it all</small>', '', surprise));
      body.appendChild(grid);
      if (r.view || r.action || r.words) nav('Start over', () => { drop(); r = blank(); draw(); }, 'link');
      return;
    }
    if (step === 'like'){
      body.append(h('h2', '', 'Which game is it like?'));
      const grid = h('div', 'reqgrid');
      if (games === null){ body.append(h('p', 'reqlede', 'Looking in Discover…')); games = await store(); return draw(); }
      if (!games.length) body.append(h('p', 'reqlede', 'Discover’s out of reach right now.'));
      for (const g of games) grid.appendChild(tile(`<b>${esc(g.name)}</b><small>${esc(g.blurb || '')}</small>`, r.like === g.id ? 'on' : '', () => { set({ like: g.id }); next(); }));
      body.appendChild(grid);
    }
    if (step === 'view'){
      body.append(h('h2', '', 'How is it seen?'));
      const grid = h('div', 'reqgrid two');
      grid.append(
        tile('<span class="ri">\u{1F590}️</span><b>Your hands</b><small>Like Pop Party</small>', r.view === 'hands' ? 'on' : '', () => { set({ view: 'hands' }); next(); }),
        tile('<span class="ri">\u{1F9D1}‍\u{1F680}</span><b>Your character</b><small>Like Last Known Position</small>', r.view === 'character' ? 'on' : '', () => { set({ view: 'character' }); next(); }));
      body.appendChild(grid);
    }
    if (step === 'action'){
      body.append(h('h2', '', r.start === 'like' ? 'Anything different? (optional)' : 'What do you do?'));
      const grid = h('div', 'reqgrid five');
      for (const [id, a] of Object.entries(ACTIONS)) grid.appendChild(tile(`<span class="ri">${a.icon}</span><b>${a.label}</b><small>${a.line}</small>`, r.action === id ? 'on' : '', () => { set({ action: r.action === id && r.start === 'like' ? null : id }); if (r.action) next(); else draw(); }));
      body.appendChild(grid);
    }
    if (step === 'thing'){
      const a = r.action ? ACTIONS[r.action] : null;
      body.append(h('h2', '', a ? `What do you ${a.label.split(' ')[0].toLowerCase()}?` : 'What’s in it?'));
      const thing = Object.assign(document.createElement('input'), { className: 'finput', maxLength: 60, value: r.thing, placeholder: 'Type it, or tap one' });
      thing.addEventListener('input', () => { set({ thing: thing.value }); refresh(); });
      const tc = h('div', 'reqchips');
      for (const t of (a ? a.things : ['fireflies', 'balloons', 'fish', 'a dragon', 'snowflakes'])) tc.appendChild(chip(t, r.thing === t, () => { set({ thing: t }); draw(); }));
      body.append(thing, tc, h('h3', 'reqh3', 'Where is it? (optional)'));
      const place = Object.assign(document.createElement('input'), { className: 'finput', maxLength: 60, value: r.place, placeholder: 'Type it, or tap one' });
      place.addEventListener('input', () => { set({ place: place.value }); refresh(); });
      const pc = h('div', 'reqchips');
      for (const p of PLACES) pc.appendChild(chip(p, r.place === p, () => { set({ place: p }); draw(); }));
      body.append(place, pc);
    }
    if (step === 'twists'){
      body.append(h('h2', '', 'Any twists? (up to two)'));
      const tc = h('div', 'reqchips big');
      for (const [id, label] of Object.entries(TWISTS)){
        const on = r.twists.includes(id);
        tc.appendChild(chip(label, on, () => { set({ twists: on ? r.twists.filter(x => x !== id) : [...r.twists, id].slice(-2) }); draw(); }));
      }
      body.appendChild(tc);
    }
    if (step === 'who'){
      body.append(h('h2', '', 'Who’s it for?'));
      const line = (label, key, opts) => {
        const row = h('div', 'reqrow'); row.appendChild(h('span', 'reqlab', label));
        const c = h('div', 'reqchips');
        for (const [v, t] of opts) c.appendChild(chip(t, String(r[key]) === String(v), () => { set({ [key]: v }); draw(); }));
        row.appendChild(c); body.appendChild(row);
      };
      line('Ages', 'ages', [['2-3', '2 to 3'], ['4-6', '4 to 6'], ['7+', '7 and up']]);
      line('Energy', 'energy', [['calm', 'Calm'], ['bouncy', 'Bouncy'], ['wild', 'Wild']]);
      line('Length', 'minutes', [[2, '2 minutes'], [5, '5 minutes'], [10, '10 minutes']]);
      line('Players', 'players', [[1, 'One'], [2, 'One or two']]);
    }
    if (step === 'look'){
      body.append(h('h2', '', 'What does it look like? (optional)'));
      const grid = h('div', 'reqgrid five');
      for (const [id, label] of Object.entries(LOOKS)){
        const cols = LOOK_COLS[id];
        const t = tile(`<span class="ri">${LOOK_ICON[id]}</span><b>${esc(label.replace(/^./, c => c.toUpperCase()))}</b>`, r.look === id ? 'on' : '', () => { set({ look: r.look === id ? null : id }); draw(); });
        t.style.setProperty('--lk1', cols[0]); t.style.setProperty('--lk2', cols[1]); t.classList.add('lk');
        grid.appendChild(t);
      }
      body.appendChild(grid);
    }
    if (step === 'name'){
      body.append(h('h2', '', 'What is it called? (optional)'));
      const name = Object.assign(document.createElement('input'), { className: 'finput reqname', maxLength: 40, value: r.name, placeholder: 'Leave it, and Claude will pick one' });
      name.addEventListener('input', () => { set({ name: name.value }); refresh(); });
      body.append(name, h('p', 'reqtip', 'It shows on the card as you type.'));
      setTimeout(() => name.focus(), 50);
    }
    if (step === 'words'){
      body.append(h('h2', '', 'Anything else? (optional)'));
      const words = Object.assign(document.createElement('textarea'), { className: 'finput reqwords', value: r.words, placeholder: 'How it starts, what’s funny, how you win…' });
      const left = h('p', 'reqcount', '');
      const tally = () => { const n = count(words.value); left.textContent = `${n} of ${WORDS} words`; left.classList.toggle('over', n > WORDS); };
      words.addEventListener('input', () => { set({ words: words.value }); tally(); });
      tally();
      body.append(words, left, h('p', 'reqtip', 'Tip: Windows key + H to speak instead.'));
      setTimeout(() => words.focus(), 50);
    }
    if (step === 'review'){
      body.append(h('h2', '', 'Ready?'), h('p', 'reqlede', 'This is your game. Change anything, then send it.'));
      const list = h('div', 'blist');
      for (const s of o.filter(x => x !== 'start' && x !== 'review')){
        const row = h('div', 'brow');
        row.append(h('span', 'bk', esc(STEP_NAME[s])), h('span', 'bv', esc(says(s))));
        const c = button('Change', 'link'); onPick(c, () => change(s)); row.appendChild(c);
        list.appendChild(row);
      }
      body.append(list, h('p', 'reqsum', esc(sentence(r, { likeName: likeName() }))));
      if (r.words) body.append(h('blockquote', 'reqquote', esc(r.words)));
      const err = h('p', 'ferr', '');
      body.appendChild(err);
      /* the card, here too: the game as it'll be asked for */
      main.classList.remove('wide'); main.appendChild(sideCard());
      nav('Back', back, 'link');
      const go_ = button('Send request', 'go');
      onPick(go_, async () => {
        if (go_.classList.contains('busy')) return;
        go_.classList.add('busy'); err.textContent = '';
        try {
          await send({ start: r.start === 'surprise' ? 'new' : r.start, like: r.like, name: r.name, view: r.view, action: r.action, thing: r.thing, place: r.place, twists: r.twists, ages: r.ages, energy: r.energy, minutes: r.minutes, players: r.players, look: r.look, words: r.words });
          drop(); sfx.gold?.(); sent();
        } catch (e){ go_.classList.remove('busy'); err.textContent = e.message || 'That didn’t send.'; }
      });
      foot.appendChild(go_);
      return;
    }
    nav('Back', back, 'link');
    const last = editing ? 'Back to review' : OPTIONAL.has(step) && !chosen(step) ? 'Skip' : 'Next';
    const n = nav(last, () => { if (ready(step)) next(); }, 'go');
    if (!ready(step)) n.disabled = true;
    /* (typing changes the card without drawing it all again) */
    function refresh(){ const was = root.querySelector('.bside'); if (was){ const fresh = sideCard(); was.replaceWith(fresh); } n.textContent = editing ? 'Back to review' : OPTIONAL.has(step) && !chosen(step) ? 'Skip' : 'Next'; }
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

/* Make a game (once "Request a game"): a grown-up describes a game by tapping pictures and
   saying it in their own words; it goes to the owner, who makes it with
   their own Claude Code (server: requests.js). Nothing to install, no
   Claude account needed.

   Two choices are needed - how it's seen, and what you do (or, for "like
   a game I know", which game) - everything else is optional, with sensible
   defaults. A sentence at the top writes itself as they pick, so they can
   see what they'll get. It keeps a draft as they go.

     requestWizard({ store, send, onDone })   the wizard, over the page
     changePop({ game, send, onDone })        Ask for a change to one of theirs
     sentence(recipe, { likeName })           the sum-up (the server's, too) */
import { button, onPick } from './cursor.js';
import { screen, h } from './screens.js';
import { sfx } from '../audio/sound.js';

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
const PLACES = ['a meadow', 'outer space', 'under the sea', 'a jungle', 'snowy hills', 'a kitchen', 'a castle', 'a city at night'];
export const CHIPS = { easier: 'Easier', harder: 'Harder', slower: 'Slower', faster: 'Faster', sillier: 'Sillier', longer: 'Longer', two: 'Add a second player', colours: 'Different colours' };
const CHIP_SAYS = { easier: 'make it easier', harder: 'make it harder', slower: 'make it slower', faster: 'make it faster', sillier: 'make it sillier', longer: 'make it last longer', two: 'add a second player', colours: 'use different colours' };
export const WORDS = 500;
const DRAFT = 'orlis.requestDraft';

const esc = (t) => String(t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const count = (s) => ((s || '').match(/\S+/g) || []).length;
const blank = () => ({ at: null, start: null, like: null, name: '', view: null, action: null, thing: '', place: '', twists: [], ages: '4-6', energy: 'bouncy', minutes: 5, players: 2, words: '' });
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
    `For ages ${ages}, ${r.energy}, about ${r.minutes} minutes, ${Number(r.players) === 1 ? 'one player' : 'one or two players'}.`].filter(Boolean).join(' ');
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

/* ---------- the wizard ---------- */

export function requestWizard({ store = async () => [], send, onDone = () => {} }){
  let r = load(), games = null, step = 'start';
  const { wrap, card } = layer('reqpop');
  const close = () => { wrap.remove(); onDone(); };
  wrap.addEventListener('closeme', () => { sfx.back?.(); close(); });
  const likeName = () => (games || []).find(g => g.id === r.like)?.name || null;
  const set = (patch) => { r = { ...r, ...patch }; keep(r); };

  /* the order of the steps, for how they started */
  const order = () => r.start === 'like' ? ['start', 'like', 'action', 'thing', 'twists', 'who', 'words', 'review'] : ['start', 'view', 'action', 'thing', 'twists', 'who', 'words', 'review'];
  const ready = (s) => s === 'start' ? !!r.start : s === 'like' ? !!r.like : s === 'view' ? !!r.view : s === 'action' ? (r.start === 'like' || !!r.action) : true;
  if (r.start) step = order().includes(r.at) && r.at !== 'start' ? r.at : order()[1];   /* a draft: carry on where it was */
  const go = (s) => { step = s; set({ at: s }); sfx.select?.(); draw(); };
  const next = () => { const o = order(); go(o[Math.min(o.length - 1, o.indexOf(step) + 1)]); };
  const back = () => { const o = order(), i = o.indexOf(step); if (i <= 0) { sfx.back?.(); close(); } else go(o[i - 1]); };

  function surprise(){
    const pick = (a) => a[Math.floor(Math.random() * a.length)];
    const action = pick(Object.keys(ACTIONS));
    set({ start: 'surprise', like: null, view: pick(['hands', 'character']), action, thing: pick(ACTIONS[action].things), place: pick(PLACES), twists: [pick(Object.keys(TWISTS))] });
    go('review');
  }

  async function draw(){
    card.innerHTML = '';
    const o = order(), i = o.indexOf(step);
    /* the sentence, building as they go (not on the first step: nothing yet) */
    const top = h('div', 'reqtop');
    top.append(h('div', 'reqsteps', o.slice(1).map((s, k) => `<span class="${k + 1 <= i ? 'on' : ''}"></span>`).join('')));
    if (step !== 'start') top.append(h('p', 'reqsum', esc(sentence(r, { likeName: likeName() }))));
    card.appendChild(top);
    const body = h('div', 'reqbody');
    card.appendChild(body);
    const foot = h('div', 'reqfoot');
    card.appendChild(foot);
    const nav = (label, fn, cls = '') => { const b = button(label, cls); onPick(b, fn); foot.appendChild(b); return b; };

    if (step === 'start'){
      body.append(h('h2', '', 'Make a game'));
      const grid = h('div', 'reqgrid three');
      grid.append(
        tile('<span class="ri">✨</span><b>Make something new</b><small>From scratch</small>', '', () => { set({ start: 'new', like: null }); next(); }),
        tile('<span class="ri">\u{1F3AE}</span><b>Like a game I know</b><small>Then change it</small>', '', () => { set({ start: 'like' }); next(); }),
        tile('<span class="ri">\u{1F3B2}</span><b>Surprise me</b><small>We pick it all</small>', '', surprise));
      body.appendChild(grid);
      nav('Cancel', () => { sfx.back?.(); close(); }, 'link');
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
      for (const [id, a] of Object.entries(ACTIONS)) grid.appendChild(tile(`<span class="ri">${a.icon}</span><b>${a.label}</b><small>${a.line}</small>`, r.action === id ? 'on' : '', () => { set({ action: r.action === id && r.start === 'like' ? null : id }); next(); }));
      body.appendChild(grid);
    }
    if (step === 'thing'){
      const a = r.action ? ACTIONS[r.action] : null;
      body.append(h('h2', '', a ? `What do you ${a.label.split(' ')[0].toLowerCase()}?` : 'What’s in it?'));
      const thing = Object.assign(document.createElement('input'), { className: 'finput', maxLength: 60, value: r.thing, placeholder: 'Type it, or tap one' });
      thing.addEventListener('input', () => set({ thing: thing.value }));
      const tc = h('div', 'reqchips');
      for (const t of (a ? a.things : ['fireflies', 'balloons', 'fish', 'a dragon', 'snowflakes'])) tc.appendChild(chip(t, r.thing === t, () => { set({ thing: t }); draw(); }));
      body.append(thing, tc, h('h3', 'reqh3', 'Where is it? (optional)'));
      const place = Object.assign(document.createElement('input'), { className: 'finput', maxLength: 60, value: r.place, placeholder: 'Type it, or tap one' });
      place.addEventListener('input', () => set({ place: place.value }));
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
    if (step === 'words'){
      body.append(h('h2', '', 'Anything else? (optional)'));
      const words = Object.assign(document.createElement('textarea'), { className: 'finput reqwords', value: r.words, placeholder: 'How it starts, what’s funny, how you win…' });
      const left = h('p', 'reqcount', '');
      const tally = () => { const n = count(words.value); left.textContent = `${n} of ${WORDS} words`; left.classList.toggle('over', n > WORDS); };
      words.addEventListener('input', () => { set({ words: words.value }); tally(); });
      tally();
      const name = Object.assign(document.createElement('input'), { className: 'finput', maxLength: 40, value: r.name, placeholder: 'Name (optional)' });
      name.addEventListener('input', () => set({ name: name.value }));
      body.append(words, left, h('p', 'reqtip', 'Tip: Windows key + H to speak instead.'), name);
      setTimeout(() => words.focus(), 50);
    }
    if (step === 'review'){
      body.append(h('h2', '', 'Ready?'));
      if (r.words) body.append(h('blockquote', 'reqquote', esc(r.words)));
      const err = h('p', 'ferr', '');
      body.appendChild(err);
      const go_ = button('Send request', 'go');
      onPick(go_, async () => {
        if (go_.classList.contains('busy')) return;
        go_.classList.add('busy'); err.textContent = '';
        try {
          await send({ start: r.start === 'surprise' ? 'new' : r.start, like: r.like, name: r.name, view: r.view, action: r.action, thing: r.thing, place: r.place, twists: r.twists, ages: r.ages, energy: r.energy, minutes: r.minutes, players: r.players, words: r.words });
          drop(); sfx.gold?.(); sent();
        } catch (e){ go_.classList.remove('busy'); err.textContent = e.message || 'That didn’t send.'; }
      });
      nav('Back', back, 'link');
      foot.appendChild(go_);
      return;
    }
    nav('Back', back, 'link');
    const n = nav('Next', () => { if (ready(step)) next(); }, 'go');
    if (!ready(step)) n.disabled = true;
  }
  function sent(){
    card.innerHTML = '';
    card.append(h('h2', '', 'Sent!'), h('p', 'reqlede', 'You’ll see it in Create when it’s ready.'));
    const ok = button('OK', 'go'); onPick(ok, () => { sfx.select?.(); close(); });
    const f = h('div', 'reqfoot'); f.appendChild(ok); card.appendChild(f);
  }
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

/* The Create tab (decision 0057; the look is docs/create-mockup.html): a big "Make a game" card with Cubo, a three-picture reminder (Pick, Play,
   Change a step), and the family's three slots. A filled slot shows the game's cover (its world and piece) with the maker's face and opens
   Play / Change / Remove (Remove asks "Sure?"); an empty one is dashed. With all three used, "Make a game" says so and starts nothing.

   createHome({ items, onMake(), onPlay(c), onChange(c), onRemove(c), message }) gives the element to put on the page; list changes call
   its update(items). The remote's arrows and OK, and the mouse, work on every button here. */
import { button, onPick } from './cursor.js';
import { h, screen } from './screens.js';
import { sfx } from '../audio/sound.js';
import { icon } from './brand.js';
import { faceOf } from './avatar-maker.js';
import { PICTURES } from '../create/pictures.js';
import { madeCover } from '../create/made-game.js';
import { makerFace, makerName } from '../create/maker.js';
import { slotsOf, slotsLine, makeCard, FULL_LINE } from '../create/slots.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function createHome({ items = [], onMake = () => {}, onPlay = () => {}, onChange = () => {}, onRemove = async () => {}, say = () => {} } = {}){
  const root = h('div', 'chome');
  let list = items, pop = null;

  /* ---------- the big card ---------- */
  function make(){
    const card = makeCard(list);
    if (!card.starts){ sfx.back?.(); hero.classList.add('shake'); setTimeout(() => hero.classList.remove('shake'), 500); say(FULL_LINE); return; }
    sfx.select(); onMake();
  }
  const hero = onPick(button('', 'chero'), make);
  hero.classList.add('focus');
  const heroLbl = hero.querySelector('.lbl');
  const cubo = h('span', 'chcubo'); cubo.appendChild(faceOf({}, 256, { tile: false, bare: true }));
  heroLbl.append(cubo, h('span', 'chtext'));
  const heroText = heroLbl.querySelector('.chtext');

  /* ---------- how it works ---------- */
  const how = h('div', 'chow');
  how.innerHTML = '<div class="chowtxt"><b>How it works</b><span>Choose how it plays, what is in it and where. Then play, and change a step any time.</span></div>';
  const mini = h('div', 'cmini');
  const step = (pic, label) => { const s = h('span', 'cministep'); s.innerHTML = `${pic}<em>${label}</em>`; return s; };
  mini.append(step(PICTURES.catch, 'Pick'), step(PICTURES.reach, 'Play'), step(icon('pencil'), 'Change a step'));
  how.appendChild(mini);

  /* ---------- our games: the three slots ---------- */
  const lab = h('div', 'crowlab'); lab.innerHTML = '<b>Our games</b><small></small>';
  const slots = h('div', 'cslots');

  function slotButton(s){
    if (s.kind === 'empty'){
      const b = onPick(button(`<span class="cplus">${icon('plus')}</span><span>Make a game</span>`, 'cslot empty'), make);
      b.setAttribute('aria-label', 'Make a game');
      return b;
    }
    const c = s.c, b = onPick(button('', 'cslot full'), () => { sfx.select(); open(c); });
    b.setAttribute('aria-label', `${c.name}: play, change or remove`);
    const url = madeCover(c);
    if (url) b.style.backgroundImage = `url(${url})`;
    b.querySelector('.lbl').replaceWith(h('span', 'cslotname'));
    b.querySelector('.cslotname').textContent = c.name;
    const by = h('span', 'cby'); by.appendChild(makerFace(c.makerId, 96)); b.appendChild(by);
    if (c.pending) b.appendChild(h('span', 'cwait', 'Saving…'));
    return b;
  }

  /* ---------- a game opened: Play / Change / Remove ---------- */
  function closePop(){ if (pop){ pop.remove(); pop = null; } }
  function open(c){
    closePop();
    pop = screen('dim fpopwrap'); pop.style.zIndex = 6;
    const card = h('div', 'fpop cgamepop');
    const head = h('div', 'cgphead');
    const pic = h('div', 'cgpcover'); const url = madeCover(c); if (url) pic.style.backgroundImage = `url(${url})`;
    const names = h('div', 'cgpnames'); names.append(h('h2', ''), h('p', 'cgpby'));
    names.querySelector('h2').textContent = c.name;
    const by = names.querySelector('.cgpby'); by.append(makerFace(c.makerId, 64)); by.append(`Made by ${makerName(c.makerId) || 'us'}`);
    head.append(pic, names);
    const btns = h('div', 'cgpbtns');
    const rm = onPick(button('Remove', 'setbtn danger'), async () => {
      if (!rm.classList.contains('sure')){ sfx.select(); rm.classList.add('sure'); rm.querySelector('.lbl').textContent = 'Sure? Remove'; return; }
      try { await onRemove(c); } catch (e){ say(e.message || 'That didn’t work.', true); return; }
      sfx.back?.(); closePop();
    });
    btns.append(
      onPick(button(`${icon('play')}<span>Play</span>`, 'setbtn go focus'), () => { closePop(); onPlay(c); }),
      onPick(button(`${icon('pencil')}<span>Change</span>`, 'setbtn'), () => { closePop(); onChange(c); }),
      rm);
    card.append(head, btns);
    pop.appendChild(card);
    pop.addEventListener('pointerdown', (e) => { if (e.target === pop){ sfx.back?.(); closePop(); } });
  }

  function draw(){
    const card = makeCard(list);
    hero.classList.toggle('full', card.full);
    heroText.innerHTML = `<b>${esc(card.title)}</b><span>${esc(card.line)}</span>`;
    hero.setAttribute('aria-label', card.full ? `Make a game. ${card.line}` : 'Make a game');
    lab.querySelector('small').textContent = slotsLine(list);
    slots.innerHTML = '';
    for (const s of slotsOf(list)) slots.appendChild(slotButton(s));
  }
  draw();

  root.append(hero, how, lab, slots);
  Object.defineProperty(root, 'open', { get: () => !!pop });
  return Object.assign(root, { update(next){ list = next; draw(); }, closePop });
}

/* Cubo's Create (decisions 0060, 0061; the first design is docs/cubo-create-mockup.html): making a game with your body, with Cubo as your guide.

   The steps and what each gesture does are create/cubo-flow.js (a state machine, tested); the gestures are create/gestures.js; where things go is
   create/comfort.js. This file reads the first player's body, turns it into events, and draws: the painted world, the carousel and Cubo on the main
   canvas (draw), the big things to hold a hand on as buttons over it. Only the first player builds. Each step's line is said once by Cubo (and written
   in his bubble, with a small "hear it again"); the first time a gesture is needed he shows it.

     cuboCreate({ creation, full, onPlay(saved), onExit(), onStep(step), onFull(), onStart(), say(text, bad) }) -> the element, with
       tick(dt), draw(c, W, H), dispose(), event(ev), state, step, zone, clock

   Two gestures: a hand held on a target (a ring fills round the hand, a tone climbs, the target grows and glows as the hand nears and the hand's marker
   is pulled toward its centre; HOLD seconds picks it, with a pop) and both arms up for "done, next". Targets sit in the first player's comfort zone: between
   chest and just above head, around where they stand, never below the hips. Back and Arms up are in the same corners on every step. The mouse clicks the
   same targets. The remote works on every step (arrows, OK, Back), with one visible focus. Stepping sideways still slides Where's carousel; a jump
   (Name only) spins the names. */
import { button, onPick } from './cursor.js';
import { h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { voice } from '../audio/voice.js';
import { icon } from './brand.js';
import { iconHTML } from './icons.js';
import { cuboFigure } from './avatar-art.js';
import { reduced } from './chkit.js';
import { magnet } from './magnet.js';
import { assets } from '../games/assets/index.js';
import { alpha as paletteAlpha } from '../games/assets/palette.js';
import { pose } from '../tracking/pose.js';
import { JumpWatch } from '../tracking/jump.js';
import { choices, pieceInfo } from '../create/recipe.js';
import { PICTURES } from '../create/pictures.js';
import { creations } from '../create/creations.js';
import { currentMaker } from '../create/maker.js';
import { BodyReader, Dwell, worldAt, meterStop, jumped, HOLD, METER_HOLD } from '../create/gestures.js';
import { Comfort, rowOf, cardsBand, meterBand, near as nearK, TOP_LIMIT } from '../create/comfort.js';
import * as F from '../create/cubo-flow.js';

const col = (n, tone) => assets.color(n, tone);
const al = paletteAlpha;
const REMOTE_KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
const OK_KEYS = new Set(['Enter', 'NumpadEnter', ' ', 'Select', 'Accept']);
export const BACK_KEYS = ['Escape', 'Backspace', 'BrowserBack', 'GoBack', 'Back'];
const GROUP_COLOUR = { food: 'touch.tangerine', animals: 'touch.mint', sky: 'touch.skyBlue', toys: 'touch.bubblegum', nature: 'touch.lagoon' };
const ARMS_TEXT = { where: 'Arms up to choose', what: 'Arms up when done', rules: 'Arms up to accept', name: 'Arms up to keep it' };
const CUBO_X = { where: 0.105, game: 0.105, what: 0.105, rules: 0.105, name: 0.105, play: 0.5 };
const WALKED = 0.04;               /* screen widths the hips must move to count as walking (tracker jitter and swaying are far less) */
const LOCK = 0.9;                  /* seconds after a step opens before a hand can touch anything (it is probably still where the last pick was) */
const COUNT_EVERY = 0.75;          /* seconds a number of the 3-2-1 stays */
const SLIDE = 0.6;                 /* seconds the carousel takes to slide one world over */
const RISE_EVERY = 0.12;           /* seconds between the notes of the rising tone while a hand holds */
const PARADE_SPEED = 0.028;        /* screen widths a second the parade floats */
const SPEED_MULT = [0.3, 0.5, 0.75, 1, 1.5, 2.2, 3];          /* the Rules background: how fast things move at each speed stop */
const MANY_SHOWN = [1, 2, 4, 7, 12, 18, 26];                   /* ... and how many are showing at each stop */
const GROUP_PARADE_PAUSE = 6;      /* reduced motion: seconds a page of the parade stays */
const DEMO_LATE = 1.6;             /* seconds after a step's line before Cubo shows a gesture (plus a little for each letter) */

/* Cubo has shown these this session (a page opened again, Change it, a second game: he does not show them again) */
const SESSION = { hold: false, arms: false };
export const resetDemos = () => { SESSION.hold = false; SESSION.arms = false; };

/* the little picture on a game card: Cubo doing it (or standing, till a hand comes near) */
function cardArt(c, W, Hc, job, t, still, live){
  const T = still || !live ? 0 : t;
  c.clearRect(0, 0, W, Hc);
  const x = W * 0.46, base = Hc * 0.97, hh = Hc * 0.66, top = base - hh * 1.12;
  const bob = T ? Math.sin(T * 3) : 0;
  cuboFigure(c, x, base, hh, live ? { collect: 'reach', dodge: 'duck', keepup: 'jump', stack: 'stand' }[job] : 'stand', T, null);
  if (job === 'collect') assets.draw(c, 'apple', W * 0.8, top + W * (0.2 + 0.03 * bob), W * 0.24);
  if (job === 'dodge'){ const k = T ? (T * 0.5) % 1 : 0.3; assets.draw(c, 'bee', W * (1.05 - 1.1 * k), top + W * 0.28, W * 0.22, { flip: true }); }
  if (job === 'keepup') assets.draw(c, 'beachball', W * 0.5, top - W * 0.02 + W * 0.05 * Math.abs(bob) * -1, W * 0.22, { rotate: T * 2 });
  if (job === 'stack') for (let i = 0; i < 3; i++) assets.draw(c, 'block', W * (0.46 + 0.012 * bob * (i + 1)), top - W * 0.08 - i * W * 0.13, W * 0.18);
}

/* what lives in each world, drifting: leaves, waves, snow, stars (decision 0061: the carousel's world is alive). Drawn inside the card's own box. */
function ambient(c, id, x, y, w, hh, t, still){
  const T = still ? 0 : t, u = w / 100;
  const frac = (v) => v - Math.floor(v);
  const drift = (n, f) => { for (let i = 0; i < n; i++){ const a = frac(i * 0.6180339 + 0.13), b = frac(i * 0.4142 + 0.31); f(i, a, b); } };
  c.save();
  if (id === 'night'){
    drift(26, (i, a, b) => { const tw = 0.45 + 0.55 * Math.sin(T * (1.2 + a * 2) + i * 2); c.globalAlpha = Math.max(0.1, tw) * 0.9; c.fillStyle = col('earth.snow');
      const s = u * (0.5 + b * 0.7); c.beginPath(); c.arc(x + a * w, y + b * hh * 0.55, s, 0, 7); c.fill(); });
    const k = frac(T * 0.12); c.globalAlpha = k < 0.25 ? 1 - k * 4 : 0; c.strokeStyle = col('earth.snow'); c.lineWidth = u * 0.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x + w * (0.2 + k * 1.4), y + hh * (0.05 + k * 0.5)); c.lineTo(x + w * (0.2 + k * 1.4) - u * 6, y + hh * (0.05 + k * 0.5) - u * 3); c.stroke();
  } else if (id === 'snow'){
    drift(34, (i, a, b) => { const k = frac(b + T * (0.05 + a * 0.05)); c.globalAlpha = 0.9; c.fillStyle = col('earth.snow');
      c.beginPath(); c.arc(x + frac(a + Math.sin(T * 0.7 + i) * 0.02) * w, y + k * hh, u * (0.45 + a * 0.5), 0, 7); c.fill(); });
  } else if (id === 'beach'){
    for (let r = 0; r < 4; r++){
      c.globalAlpha = 0.5 - r * 0.08; c.strokeStyle = col('earth.snow'); c.lineWidth = u * 0.7; c.lineCap = 'round';
      c.beginPath();
      const yy = y + hh * (0.52 + r * 0.075);
      for (let i = 0; i <= 40; i++){ const px = x + w * i / 40, py = yy + Math.sin(i * 0.55 + T * (1.1 + r * 0.2) + r) * u * 0.9; i ? c.lineTo(px, py) : c.moveTo(px, py); }
      c.stroke();
    }
    drift(3, (i, a, b) => { c.globalAlpha = 0.9; c.strokeStyle = col('shade.ink'); c.lineWidth = u * 0.4;
      const px = x + frac(a + T * 0.025) * w, py = y + hh * (0.12 + b * 0.18) + Math.sin(T * 1.6 + i) * u; c.beginPath(); c.moveTo(px - u * 1.6, py); c.quadraticCurveTo(px - u * 0.8, py - u * 1.2, px, py); c.quadraticCurveTo(px + u * 0.8, py - u * 1.2, px + u * 1.6, py); c.stroke(); });
  } else {
    const pal = id === 'autumn' ? ['autumn.amber', 'autumn.rust', 'touch.sunflower'] : id === 'sunset' ? ['earth.peach', 'touch.bubblegum', 'earth.snow'] : ['touch.bubblegum', 'earth.snow', 'touch.sunflower'];
    drift(id === 'autumn' ? 16 : 12, (i, a, b) => {
      const k = frac(b + T * (0.045 + a * 0.04)), px = x + frac(a + Math.sin(T * 0.8 + i * 1.7) * 0.03 + k * 0.1) * w, py = y + k * hh;
      c.globalAlpha = 0.95; c.fillStyle = col(pal[i % pal.length]);
      c.save(); c.translate(px, py); c.rotate(T * (0.8 + a) + i); c.beginPath(); c.ellipse(0, 0, u * (id === 'autumn' ? 1.4 : 0.9), u * (id === 'autumn' ? 0.8 : 0.5), 0, 0, 7); c.fill(); c.restore();
    });
    if (id === 'meadow' || id === 'sunset'){      /* a butterfly or two */
      drift(2, (i, a, b) => { const px = x + frac(a + T * 0.02 * (i ? -1 : 1)) * w, py = y + hh * (0.45 + b * 0.2) + Math.sin(T * 1.4 + i * 3) * u * 2, f = 0.5 + 0.5 * Math.sin(T * 14 + i);
        c.globalAlpha = 1; c.fillStyle = col(i ? 'touch.skyBlue' : 'touch.tangerine'); c.beginPath(); c.ellipse(px - u * 0.9 * f, py, u * 0.9 * f + 0.3, u * 0.8, 0, 0, 7); c.ellipse(px + u * 0.9 * f, py, u * 0.9 * f + 0.3, u * 0.8, 0, 0, 7); c.fill(); });
    }
  }
  c.restore();
}

const wrapN = (v, n) => ((v % n) + n) % n;
const wrapDelta = (d, n) => { d = wrapN(d, n); return d > n / 2 ? d - n : d; };
const ease = (k) => k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rrect = (c, x, y, w, hh, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, hh, r); else c.rect(x, y, w, hh); };

export function cuboCreate({ creation = null, full = false, onPlay = () => {}, onExit = () => {}, onStep = () => {}, onFull = () => {}, onStart = null, say = () => {} } = {}){
  const root = h('div', 'cc');
  const still = reduced();
  let st = F.newFlow({ creation, full, demoed: SESSION }), clock = 0, gone = false, lock = 0, busy = false;
  const reader = new BodyReader(), jumps = new JumpWatch(), dwell = new Dwell(HOLD), meterDwell = new Dwell(METER_HOLD), comfort = new Comfort();
  let touch = [], layer = null, ui = {}, pops = [], lastHip = null, moving = 0, flying = [];
  let nameShow = 0, nameGoal = 0, nameIxSeen = 0, toldLine = '', zone = comfort.z, holding = null, riseAt = 0, count = null, namedCards = new Set();
  let handsNow = [], meterY = null, lastMeterStop = null;
  const car = { pos: 0, from: 0, goal: 0, t: 1 };
  const par = { ph: 0, goal: null, page: 0, pageT: 0 };
  /* Cubo: where he stands (a share of the box's width), and what he is doing */
  const cubo = { x: 0.1, tx: 0.1, act: null, later: null };

  /* ---------- Cubo's words: written in a bubble, said once, "hear it again" ---------- */
  const bubble = h('div', 'ccbubble');
  const bubbleText = h('span', 'cctext');
  const again = onPick(button(icon('play'), 'ccagain'), () => { sfx.tick(); speak(toldLine, true); });
  again.setAttribute('aria-label', 'Hear it again');
  bubble.append(bubbleText, again);
  const back = onPick(button(`${icon('back')}<span>Back</span>`, 'ccback'), () => { sfx.back?.(); dispatch({ t: 'back' }); });
  back.setAttribute('aria-label', 'Back'); back.setAttribute('data-t', 'back');
  const arms = onPick(button('', 'ccarms'), () => dispatch({ t: 'arms' }));
  const armsText = h('span', 'ccarmstext');
  arms.querySelector('.lbl').append(h('span', 'ccarmsicon', '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="12" r="5" fill="currentColor"/><path d="M24 18v14M24 22L12 8M24 22L36 8M24 32l-7 12M24 32l7 12" fill="none" stroke="currentColor" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'), armsText);
  arms.setAttribute('aria-label', 'Arms up'); arms.setAttribute('data-t', 'arms');
  const steps = h('div', 'ccsteps');
  const stepDots = F.DOTS.map((id) => { const d = h('span', 'ccsd'); d.append(h('i'), h('b', '', id[0].toUpperCase() + id.slice(1))); steps.appendChild(d); return d; });
  root.append(bubble, back, arms, steps);

  function speak(line, force = false){
    toldLine = line; bubbleText.textContent = line; bubble.classList.toggle('on', !!line);
    if (!line) return;
    try { voice.say(line, 'nova'); } catch {}
    cubo.talkUntil = clock + 2.4 + line.length * 0.05;
  }
  /* Cubo shows a gesture the first time it is needed: he does it and says so (a little after the step's own line) */
  function demo(g){
    if (SESSION[g]) return;
    SESSION[g] = true;
    const line = F.DEMO_LINES[g];
    cubo.later = { at: clock + DEMO_LATE + toldLine.length * 0.05, line, g };
  }
  function runLater(){
    const l = cubo.later;
    if (!l || clock < l.at) return;
    cubo.later = null;
    speak(l.line);
    cubo.act = { kind: l.g === 'hold' ? 'demoHold' : 'demoArms', until: clock + (still ? 1 : 3.2), from: clock };
  }

  /* ---------- the flow ---------- */
  function dispatch(ev){
    if (gone) return;
    /* leaving the start screen is the page's to allow first (the camera check): it sends the event back with `force` */
    if (st.step === 'start' && onStart && !ev.force && (ev.t === 'arms' || ev.t === 'ok')){ onStart(); return; }
        const was = st.step, wasWorld = st.worldIx, r = F.reduce(st, ev);
    if (r.state === st && !r.fx.length) return;                 /* (nothing changed: the clock ticking in Rules) */
    if (r.state.step !== st.step) cubo.later = null;
    st = r.state;
    for (const f of r.fx) run(f);
    if (st.step !== was) opened(was);
    else {
      if (st.step === 'where' && st.worldIx !== wasWorld) slide(wasWorld, st.worldIx);
      paint();
    }
  }
  function run(f){
    if (f.say) speak(f.say);
    else if (f.demo) demo(f.demo);
    else if (f.cheer){ react(f.cheer); if (f.cheer === 'pick') sfx.select(); else sfx.hooray?.(); }
    else if (f.pop){ popAt(f.pop); }
    else if (f.full) onFull();
    else if (f.msg) say(f.msg);
    else if (f.play) save(f.play);
    else if (f.exit) onExit();
  }
  function react(kind){
    const still_ = still ? 0.6 : 1.6;
    cubo.act = { kind, until: clock + still_, from: clock };
  }
  /* a pick pops: the burst (and the thing flies to the tray) */
  function popAt(id){
    const el = ui.items && ui.items.get(id), r = el && el.getBoundingClientRect();
    const x = r && r.width ? r.left + r.width / 2 : innerWidth / 2, y = r && r.width ? r.top + r.height / 2 : innerHeight / 2;
    pops.push({ x, y, t: 0 });
    sfx.pop?.();
    if (r && r.width && !still){
      const fly = h('div', 'ccfly'); fly.innerHTML = iconHTML(id, 160);
      const b = box();
      fly.style.left = `${r.left - b.x}px`; fly.style.top = `${r.top - b.y}px`; fly.style.width = `${r.width}px`; fly.style.height = `${r.height}px`;
      layer && layer.appendChild(fly);
      flying.push({ el: fly, id, t: 0, from: { x: r.left - b.x, y: r.top - b.y, s: r.width } });
    }
  }
  async function save(play){
    if (busy) return;
    busy = true;
    const who = currentMaker();
    count = { n: 3, t: 0, saved: null, failed: false };
    try {
      const saved = await creations.save({ id: play.id, name: play.name, picks: play.picks, makerId: who ? who.id : null });
      busy = false;
      if (count) count.saved = saved;
      finishCount();
    } catch (e){ busy = false; count = null; say(e.message || 'That didn’t save. Try again.', true); dispatch({ t: 'saved-failed' }); }
  }
  /* "3, 2, 1" with Cubo, then the game (both the numbers and the save must be done) */
  function finishCount(){ if (count && count.saved && count.n <= 0 && !gone){ const s = count.saved; count = null; onPlay(s); } }
  const groupIds = () => F.idsOf(st.group);

  /* ---------- the layers: what each step shows ---------- */
  function addTouch(el, fn){ touch.push({ el, fn }); return el; }

  function opened(was){
    if (layer){ layer.remove(); layer = null; }
    touch = []; ui = {}; dwell.reset(); dwell.block(); meterDwell.reset(); meterDwell.block(); lock = LOCK; lastHip = null; moving = 0; flying = []; holding = null;
    namedCards = new Set(); meterY = null; lastMeterStop = null; par.goal = null; par.ph = 0; par.page = 0; par.pageT = 0;
    root.setAttribute('data-locked', '');
    root.setAttribute('data-step', st.step);
    onStep(st.step, was);
    root.classList.toggle('hide', st.step === 'start');
    layer = h('div', 'cclayer cc-' + st.step);
    root.appendChild(layer);
    BUILD[st.step] && BUILD[st.step]();
    if (st.step !== 'start' && st.step !== 'play') addTouch(back, () => { sfx.back?.(); dispatch({ t: 'back' }); });
    if (ARMS_TEXT[st.step]) addTouch(arms, () => dispatch({ t: 'arms' }));
    /* Cubo walks in from the left to where he stands for this step */
    cubo.tx = CUBO_X[st.step] ?? 0.1;
    cubo.x = still ? cubo.tx : (st.step === 'play' ? cubo.x : cubo.tx - 0.13);
    if (st.step === 'name') react('jump');
    if (st.step === 'where'){ car.pos = car.goal = car.from = st.worldIx; car.t = 1; }
    paint();
  }
  /* a game being changed opens at Where with Cubo showing "arms up" (a flow that starts there has no earlier step to do it) */
  function demoAtOpen(){ const g = st.demo; if (g && !SESSION[g]){ demo(g); } }

  const BUILD = {
    where(){
      const mk = (cls, label, ic, step) => {
        const b = onPick(button(`<span class="ccpeekin">${icon(ic)}</span>`, `ccpeek ${cls}`), () => dispatch({ t: 'world', ix: wrapN(st.worldIx + step, F.WORLDS.length) }));
        b.setAttribute('aria-label', label); b.setAttribute('data-t', 'peek-' + cls);
        addTouch(b, () => { sfx.whoosh?.(); dispatch({ t: 'world', ix: wrapN(st.worldIx + step, F.WORLDS.length) }); });
        return b;
      };
      ui.world = h('div', 'ccworld');
      ui.peekL = mk('left', 'Previous world', 'back', -1); ui.peekR = mk('right', 'Next world', 'play', 1);
      layer.append(ui.world, ui.peekL, ui.peekR);
    },
    game(){
      ui.cards = [];
      F.JOBS.forEach((id, i) => {
        const info = choices.jobs[i];
        const b = onPick(button('', 'cccard'), () => dispatch({ t: 'job', id }));
        b.setAttribute('aria-label', info.label); b.setAttribute('data-t', 'card-' + i);
        const lbl = b.querySelector('.lbl'); lbl.className = 'lbl cccardin';
        const cv = document.createElement('canvas'); cv.width = 300; cv.height = 420; cv.setAttribute('aria-hidden', 'true');
        lbl.append(cv, h('span', 'cccardtext', `<b>${info.label}</b>`));
        layer.appendChild(b); ui.cards.push({ b, cv, id, near: 0 });
        addTouch(b, () => dispatch({ t: 'job', id }));
      });
    },
    what(){
      /* the five group tiles, then (once one is open) the parade and the tray */
      ui.tiles = choices.what.map((g, i) => {
        const b = onPick(button('', 'cctile'), () => dispatch({ t: 'group', id: g.id }));
        b.style.setProperty('--chip', col(GROUP_COLOUR[g.id])); b.setAttribute('data-t', 'tile-' + i);
        const lbl = b.querySelector('.lbl'); lbl.className = 'lbl cctilein';
        const pic = h('span', 'cctilepic'); pic.innerHTML = iconHTML(g.pieces[0].id, 160);
        lbl.append(pic, h('span', 'cctileword', g.label));
        b.setAttribute('aria-label', g.label);
        layer.appendChild(b); addTouch(b, () => dispatch({ t: 'group', id: g.id }));
        return b;
      });
      ui.tray = h('div', 'cctray');
      ui.groupsBtn = onPick(button('<span>Groups</span>', 'ccgroups'), () => dispatch({ t: 'ungroup' }));
      ui.groupsBtn.setAttribute('aria-label', 'Back to the groups'); ui.groupsBtn.setAttribute('data-t', 'groups');
      ui.trayCount = h('small', '');
      ui.trayKey = ''; ui.slots = []; ui.items = new Map(); ui.paradeFor = null; ui.parade = [];
      layer.append(ui.tray, ui.groupsBtn);
      addTouch(ui.groupsBtn, () => dispatch({ t: 'ungroup' }));
    },
    rules(){
      ui.q = h('div', 'ccq'); ui.qword = h('em'); ui.qtip = h('small', '', 'Hold still to set it');
      ui.q.append(h('b'), ui.qword, ui.qtip);
      ui.mpill = h('div', 'ccmpill'); ui.mfill = h('i'); ui.mpill.appendChild(ui.mfill);
      ui.stops = [];
      const r = choices.rules.speed;
      for (let i = 0; i < r.steps; i++){
        const s = onPick(button('', 'ccmstop'), () => { sfx.tick(); dispatch({ t: 'meter', i }); dispatch({ t: 'set' }); });
        s.setAttribute('aria-label', `Stop ${i + 1}`); s.setAttribute('data-t', 'stop-' + i); s.setAttribute('data-hold', 'height');
        ui.stops.push(s);
      }
      ui.endA = h('div', 'ccmend'); ui.endB = h('div', 'ccmend');
      layer.append(ui.q, ui.mpill, ui.endA, ui.endB, ...ui.stops);
      ui.meterQ = null;
    },
    name(){
      ui.wheel = onPick(button('<span class="ccwheeltip">Hold to spin</span>', 'ccwheel'), () => dispatch({ t: 'spin', by: 1 + Math.floor(Math.random() * 4) }));
      ui.wheel.setAttribute('aria-label', 'Spin the names'); ui.wheel.setAttribute('data-t', 'wheel');
      layer.appendChild(ui.wheel);
      addTouch(ui.wheel, () => { sfx.whoosh?.(); dispatch({ t: 'spin', by: 1 + Math.floor(Math.random() * 4) }); });
      nameShow = nameGoal = st.nameIx; nameIxSeen = st.nameIx;
    },
    play(){ ui.go = h('div', 'ccgo', ''); layer.appendChild(ui.go); }
  };

  /* what changes with the state, not the step */
  function paint(){
    const showArms = !!ARMS_TEXT[st.step] && !(st.step === 'what' && (!st.group || !st.tray.length));
    arms.classList.toggle('hide', !showArms);
    armsText.textContent = st.step === 'rules' && st.q === 'many' ? 'Arms up to play' : (ARMS_TEXT[st.step] || '');
    back.classList.toggle('hide', st.step === 'play' || st.step === 'start');
    steps.classList.toggle('hide', !F.DOTS.includes(st.step));
    const at = F.DOTS.indexOf(st.step);
    stepDots.forEach((d, i) => { d.classList.toggle('on', i === at); d.classList.toggle('done', i < at); });
    if (st.step === 'where'){
      ui.world.textContent = choices.where[st.worldIx].label;
    }
    if (st.step === 'game'){ ui.cards.forEach((c, i) => c.b.classList.toggle('want', i === st.gameIx)); }
    if (st.step === 'what'){
      const open = !!st.group;
      ui.tiles.forEach((b, i) => { b.classList.toggle('hide', open); b.classList.toggle('on', F.GROUPS[i] === st.group); });
      ui.tray.classList.toggle('hide', !open); ui.groupsBtn.classList.toggle('hide', !open);
      if (ui.paradeFor !== st.group){ buildParade(); }
      drawTray();
    }
    if (st.step === 'rules'){
      const r = choices.rules[st.q];
      ui.q.querySelector('b').textContent = st.q === 'speed' ? 'How fast?' : 'How many?';
      ui.qword.textContent = r.labels[st.picks[st.q]];
      ui.qtip.textContent = st.q === 'many' && st.manySet ? 'Arms up to play!' : 'Hold still to set it';
      if (ui.meterQ !== st.q){
        ui.meterQ = st.q;
        ui.endA.innerHTML = PICTURES[r.icons[0]]; ui.endB.innerHTML = PICTURES[r.icons[1]];
        ui.stops.forEach((s, i) => s.setAttribute('aria-label', `${st.q === 'speed' ? 'How fast' : 'How many'}: ${r.labels[i]}`));
      }
      const v = st.picks[st.q];
      ui.stops.forEach((b, i) => { b.classList.toggle('lit', i <= v); b.classList.toggle('on', i === v); });
    }
    paintFocus();
  }
  /* the remote's focus: exactly one element wears .sel (shown under body.remote), and says which zone and item it is (data-zone, data-item) */
  let lit = null, litKey = '';
  function paintFocus(){
    const f = F.focusOf(st);
    if (lit) lit.classList.remove('sel');
    lit = null;
    if (!f) return;
    let el = null;
    if (f.zone === 'world') el = ui.world;
    else if (f.zone === 'card') el = ui.cards[f.item].b;
    else if (f.zone === 'tiles') el = ui.tiles[f.item];
    else if (f.zone === 'parade') el = ui.parade[f.item] && ui.parade[f.item].el;
    else if (f.zone === 'groups') el = ui.groupsBtn;
    else if (f.zone === 'tray') el = ui.tray.querySelector(`[data-i="${f.item}"]`);
    else if (f.zone === 'meter') el = ui.mpill;
    else if (f.zone === 'keep') el = ui.wheel;
    else el = arms;                                        /* done */
    if (!el) return;
    lit = el; el.classList.add('sel'); el.setAttribute('data-zone', f.zone); el.setAttribute('data-item', String(f.item));
    /* the parade comes round to a thing the remote has lit */
    const key = f.zone + f.item + st.group;
    if (f.zone === 'parade' && key !== litKey && ui.lane) par.goal = phaseFor(f.item);
    litKey = key;
  }
  /* the tray: what has been picked so far (hold a hand on one to put it back) */
  function drawTray(){
    const key = st.tray.join(',') + '|' + st.group;
    if (key === ui.trayKey) return;
    ui.trayKey = key;
    touch = touch.filter(t => !t.tray);
    ui.tray.innerHTML = ''; ui.slots = [];
    ui.trayCount.textContent = `${st.tray.length} of ${choices.maxThings}`;
    ui.tray.appendChild(ui.trayCount);
    const grid = h('div', 'cctraygrid'); ui.tray.appendChild(grid);
    for (let i = 0; i < choices.maxThings; i++){
      const id = st.tray[i];
      if (!id){ const e = h('span', 'cctrayslot empty'); grid.appendChild(e); ui.slots.push(e); continue; }
      const info = pieceInfo(id), b = onPick(button('', 'cctrayslot'), () => dispatch({ t: 'take', id }));
      b.querySelector('.lbl').className = 'lbl cctrayin'; b.querySelector('.lbl').innerHTML = iconHTML(id, 160);
      b.setAttribute('aria-label', `Put back the ${info.label.toLowerCase()}`); b.setAttribute('data-i', String(i)); b.setAttribute('data-t', 'tray-' + i);
      grid.appendChild(b); ui.slots.push(b); touch.push({ el: b, fn: () => dispatch({ t: 'take', id }), tray: true });
    }
    ui.trayLast = ui.slots[st.tray.length - 1];
    if (lit && !lit.isConnected) paintFocus();
  }
  /* the parade: this group's things, floating across (a thing held on is grabbed) */
  function buildParade(){
    touch = touch.filter(t => !t.item);
    (ui.parade || []).forEach(p => p.el.remove());
    ui.parade = []; ui.items = new Map(); ui.paradeFor = st.group;
    if (!st.group) return;
    groupIds().forEach((id, i) => {
      const info = pieceInfo(id);
      const b = onPick(button('', 'ccfloat'), () => dispatch({ t: 'grab', id, explicit: true }));
      b.querySelector('.lbl').className = 'lbl ccfloatin'; b.querySelector('.lbl').innerHTML = iconHTML(id, 160);
      b.setAttribute('aria-label', info.label); b.setAttribute('data-t', 'item-' + id); b.setAttribute('data-i', String(i));
      layer.appendChild(b); ui.parade.push({ el: b, id }); ui.items.set(id, b);
      touch.push({ el: b, fn: () => dispatch({ t: 'grab', id, explicit: true }), item: true });
    });
    par.ph = 0; par.goal = null;
  }
  /* the parade's phase that brings thing i to the middle of the lane */
  function phaseFor(i){
    const L = ui.lane; if (!L) return null;
    const C = L.cycle, S = L.step;
    return wrapN(L.w / 2 - L.size / 2 + S - i * S, C);
  }

  /* ---------- the box this lives in, in screen pixels ---------- */
  function box(){
    const r = root.getBoundingClientRect ? root.getBoundingClientRect() : null;
    if (r && r.width > 0) return { x: r.left, y: r.top, w: r.width, h: r.height };
    const W = typeof innerWidth === 'number' ? innerWidth : 1920, H = typeof innerHeight === 'number' ? innerHeight : 1080;
    return { x: 0, y: 0, w: W, h: H };
  }
  const VW = () => (typeof innerWidth === 'number' ? innerWidth : 1920), VH = () => (typeof innerHeight === 'number' ? innerHeight : 1080);
  /* an element placed at x, y, w, h (pixels in the box); only written when it moved */
  function place(el, x, y, w, hh){
    const k = `${Math.round(x)},${Math.round(y)},${Math.round(w)},${Math.round(hh)}`;
    if (el._k === k) return;
    el._k = k;
    const s = el.style;
    s.left = `${Math.round(x)}px`; s.top = `${Math.round(y)}px`; s.width = `${Math.round(w)}px`; s.height = `${Math.round(hh)}px`;
    s.setProperty('--s', `${Math.round(Math.min(w, hh))}px`);
  }

  /* ---------- where each step's things go: in the first player's comfort zone ---------- */
  function layout(b, z){
    const sw = VW(), sh = VH();
    const X = (s) => s * sw - b.x, Y = (s) => s * sh - b.y;
    const step = st.step;
    if (step === 'where'){
      /* the peeks: the edge slices of the next and previous worlds, reaching in toward the player so a hand can get there */
      const band = cardsBand(z, 'cards'), reachIn = clamp(z.x - z.half * 0.6, 0.1, 0.42), inL = reachIn, inR = 1 - clamp((1 - z.x) - z.half * 0.6, 0.1, 0.42);
      place(ui.peekL, X(0), Y(band.y), inL * sw, band.h * sh);
      place(ui.peekR, X(inR), Y(band.y), (1 - inR) * sw, band.h * sh);
      const cardB = carouselBox(b);
      place(ui.world, cardB.x + cardB.w / 2 - cardB.w * 0.2, cardB.y + cardB.h + b.h * 0.018, cardB.w * 0.4, b.h * 0.085);
    } else if (step === 'game'){
      const row = rowOf(z, 4, { minW: 0.1, maxW: 0.17, gap: 0.015 }), band = cardsBand(z, 'cards');
      ui.cards.forEach((c, i) => place(c.b, X(row[i].x), Y(band.y), row[i].w * sw, band.h * sh));
    } else if (step === 'what'){
      if (!st.group){
        const row = rowOf(z, 5, { minW: 0.07, maxW: 0.13, gap: 0.006 }), band = cardsBand(z, 'tiles');
        ui.tiles.forEach((t, i) => place(t, X(row[i].x), Y(band.y), row[i].w * sw, band.h * sh));
      } else layoutParade(b, z, X, Y, sw, sh);
    } else if (step === 'rules'){
      layoutMeter(b, z, X, Y, sw, sh);
    } else if (step === 'name'){
      const wb = wheelBox(z, sw, sh);
      place(ui.wheel, wb.x - b.x, wb.y - b.y, wb.w, wb.h);
    }
  }
  function carouselBox(b){ return { x: b.w * 0.1, y: b.h * 0.14, w: b.w * 0.8, h: b.h * 0.56 }; }
  function wheelBox(z, sw, sh){
    const w = sw * 0.5, hh = sh * 0.3, cx = clamp(z.x, 0.3, 0.7) * sw, mid = (z.top + z.bottom) / 2 * sh;
    const y = clamp(mid - hh / 2, Math.max(TOP_LIMIT, 0.17) * sh, Math.max(0.17 * sh, z.floor * sh - hh));   /* (below the corner targets) */
    return { x: cx - w / 2, y, w, h: hh };
  }
  function layoutParade(b, z, X, Y, sw, sh){
    const zoneH = (z.bottom - z.top) * sh, size = clamp(zoneH * 0.85, sw * 0.07, sw * 0.105);
    /* the tray, at the side of the player's reach (the other side if there is no room) */
    const pad = sh * 0.012, head = sh * 0.075;
    const top = Math.max(sh * 0.17, z.top * sh), avail = z.floor * sh - top - head - pad * 6;
    const cell = clamp(avail / 2, 28, sw * 0.07), gap = pad, pw = cell * 3 + gap * 2 + pad * 2;
    let tx = (z.x + z.half * 0.85) * sw;
    if (tx + pw > sw * 0.985) tx = (z.x - z.half * 0.85) * sw - pw;
    tx = clamp(tx, sw * 0.012, sw * 0.988 - pw);
    const th = head + pad * 6 + cell * 2;      /* (a clear gap between Groups and the first slots: a hand reaching for one must not touch the other) */
    place(ui.tray, tx - b.x, top - b.y, pw, th);
    ui.tray.style.setProperty('--cell', `${Math.round(cell)}px`); ui.tray.style.setProperty('--gap', `${Math.round(gap)}px`);
    place(ui.groupsBtn, tx - b.x + pad, top - b.y + pad, pw - pad * 2, head);
    /* the lane the things float along: the rest of the width, away from the tray */
    const side = tx > z.x * sw ? 'left' : 'right';
    const x0 = side === 'left' ? sw * 0.03 : tx + pw + sw * 0.02, x1 = side === 'left' ? tx - sw * 0.02 : sw * 0.97;
    const S = size * 1.35, n = ui.parade.length, laneW = Math.max(size, x1 - x0), C = Math.max(n * S, laneW + S);
    const yc = (z.top + z.bottom) / 2 * sh;
    ui.lane = { x0: x0 - b.x, w: laneW, size, step: S, cycle: C, y: yc - b.y - size / 2 };
  }
  function layoutMeter(b, z, X, Y, sw, sh){
    const mb = meterBand(z), top = mb.top * sh, bot = mb.bottom * sh, wm = clamp(sw * 0.06, 54, 110);
    let mx = (z.x + Math.max(0.15, z.half * 0.9 + 0.05)) * sw;
    if (mx + wm > sw * 0.96) mx = (z.x - Math.max(0.15, z.half * 0.9 + 0.05)) * sw - wm;
    mx = clamp(mx, sw * 0.04, sw * 0.96 - wm);
    ui.meter = { x: mx, w: wm, top, bottom: bot };
    const stopS = Math.min(wm * 0.7, (bot - top) / 7);
    place(ui.mpill, mx - b.x, top - b.y - stopS * 0.8, wm, bot - top + stopS * 1.6);
    const n = ui.stops.length;
    ui.stops.forEach((s, i) => {
      const y = bot - (bot - top) * i / (n - 1), big = i === st.picks[st.q] ? 1.35 : 1;
      place(s, mx + wm / 2 - stopS * big / 2 - b.x, y - stopS * big / 2 - b.y, stopS * big, stopS * big);
    });
    const v = st.picks[st.q];
    ui.mfill.style.height = `${Math.round(100 * (v / (n - 1)))}%`;
    const iconS = Math.min(sw * 0.075, 120);
    const toward = mx > z.x * sw ? mx - iconS * 1.1 : mx + wm + iconS * 0.1;           /* (the icons are on the side toward the player) */
    place(ui.endA, toward - b.x, bot - iconS * 0.5 - b.y, iconS, iconS);
    place(ui.endB, toward - b.x, top - iconS * 0.5 - b.y, iconS, iconS);
    /* the question and its word: on the player's other side from the meter */
    const qw = sw * 0.22, qh = sh * 0.24, meterRight = mx > z.x * sw;
    let qx = meterRight ? (z.x - z.half) * sw - qw - sw * 0.02 : (z.x + z.half) * sw + sw * 0.02;
    qx = clamp(qx, sw * 0.02, sw * 0.98 - qw);
    place(ui.q, qx - b.x, Math.max(sh * 0.17, mb.top * sh) - b.y, qw, qh);
  }

  /* ---------- every frame ---------- */
  function tick(dt){
    if (gone) return;
    dt = Math.min(dt, 0.25);
    clock += dt; lock = Math.max(0, lock - dt);
    if (st.step === 'start'){ readStart(dt); return; }
    runLater();
    /* (a mouse standing in for the camera is clicks only: hovering over a target must not touch it) */
    const seen = pose.mouse.active ? [] : pose.players;
    if (lock > 0) root.setAttribute('data-locked', ''); else if (root.removeAttribute) root.removeAttribute('data-locked');
    const body = reader.step(dt, seen);
    const player = body.index != null ? seen[body.index] : null;
    zone = comfort.step(dt, player, !player);
    const b = box(), sw = VW(), sh = VH();
    handsNow = body.hands.filter(p => p.active).map(p => ({ x: p.x * sw, y: p.y * sh, sx: p.x, sy: p.y }));

    /* both arms up goes on from here (only for the steps that use it) */
    if (body.arms && lock <= 0 && ARMS_TEXT[st.step] && !arms.classList.contains('hide') && st.step !== 'play'){ dispatch({ t: 'arms' }); return; }
    arms.style.setProperty('--k', `${Math.round(body.armsProgress * 100)}%`);
    arms.classList.toggle('rising', body.armsProgress > 0 && lock <= 0);

    if (st.step !== 'play') layout(b, zone);
    stepExtras(dt, b, zone, body, seen);
    touching(dt, b, body);

    /* the pops fade, things fly to the tray, Cubo walks */
    for (const p of pops) p.t += dt;
    pops = pops.filter(p => p.t < 0.7);
    flyThings(dt);
    runCount(dt);
    const sp = still ? 1 : dt * 2.2;
    cubo.walking = Math.abs(cubo.tx - cubo.x) > 0.004;
    cubo.x += (cubo.tx - cubo.x) * Math.min(1, sp);
    if (!still && cubo.walking){ const dir = Math.sign(cubo.tx - cubo.x); cubo.x += dir * Math.min(Math.abs(cubo.tx - cubo.x), dt * 0.12); }
    if (cubo.act && clock > cubo.act.until) cubo.act = null;
  }

  /* touching: a hand held on a big target (each target also grows and glows as a hand comes near, and the marker is pulled in) */
  function touching(dt, b, body){
    const sw = VW(), sh = VH();
    let hit = null, hitHand = null, hitD = Infinity;
    const mags = [];
    for (const t of touch){
      const el = t.el;
      if (!el.isConnected || el.classList.contains('hide')){ if (t.near) { t.near = 0; el.style.setProperty('--near', '0'); } continue; }
      const r = el.getBoundingClientRect();
      if (r.width <= 0) continue;
      const small = Math.min(r.width, r.height), pad = small * 0.1;
      let best = Infinity, bestHand = null;
      for (const p of handsNow){
        const dx = Math.max(r.left - p.x, 0, p.x - r.right), dy = Math.max(r.top - p.y, 0, p.y - r.bottom), d = Math.hypot(dx, dy);
        if (d < best){ best = d; bestHand = p; }
      }
      const k = lock > 0 ? 0 : nearK(best, small);
      if (Math.abs((t.near || 0) - k) > 0.02){ t.near = k; el.style.setProperty('--near', k.toFixed(2)); }
      if (best <= pad && lock <= 0){
        const cd = Math.hypot(bestHand.x - (r.left + r.right) / 2, bestHand.y - (r.top + r.bottom) / 2);
        if (cd < hitD){ hit = t; hitD = cd; hitHand = bestHand; }
      }
      if (handsNow.length && el.dataset.hold !== 'height') mags.push({ x: (r.left + r.width / 2) / sw, y: (r.top + r.height / 2) / sh, r: (small / 2 + sh * 0.02) / sh });
    }
    magnet.set(pose.mouse.active ? [] : mags);
    /* (game cards: a hand near a card, and its Cubo does the move - and says its name, once) */
    if (st.step === 'game') nearCards();
    if (lock > 0 || !touch.length){ holding = null; return; }          /* (a hand resting where the last pick was is waited out: the dwell stays blocked) */
    if (body && body.armsProgress > 0) hit = null;                     /* (both arms going up is the arms-up gesture, not a touch: a raised hand passing a target does not pick it) */
    const d = dwell.step(dt, hit);
    touch.forEach(t => t.el.style.setProperty('--dw', t === hit ? `${Math.round(d.progress * 100)}%` : '0%'));
    holding = hit && d.progress > 0 && !d.fired ? { x: hitHand.sx, y: hitHand.sy, k: d.progress } : null;
    if (holding && clock >= riseAt){ riseAt = clock + RISE_EVERY; sfx.rise?.(d.progress); }
    if (d.fired && hit){
      holding = null; sfx.select();
      const r = hit.el.getBoundingClientRect();
      pops.push({ x: r.left + r.width / 2, y: r.top + r.height / 2, t: 0 }); sfx.pop?.();
      hit.fn();
    }
  }
  function nearCards(){
    ui.cards.forEach((c, i) => {
      const nk = parseFloat(c.b.style.getPropertyValue('--near') || '0') || 0;
      c.near = nk; c.live = nk > 0.45 || (document.body.classList.contains('remote') && i === st.gameIx && handsNow.length === 0);
      if (nk > 0.5 && !namedCards.has(c.id)){ namedCards.add(c.id); try { voice.say(choices.jobs[i].label, 'nova'); } catch {} }
    });
  }

  /* what each step does with the body besides touching */
  function stepExtras(dt, b, z, body, seen){
    if (st.step === 'where'){
      /* the carousel slides on its own clock */
      if (car.t < 1){ car.t = Math.min(1, car.t + dt / SLIDE); car.pos = car.from + (car.goal - car.from) * (still ? 1 : ease(car.t)); if (still) car.t = 1; }
      /* walk across the picture and the world follows (a body that has been still leaves the world where it is: the remote's choice stays) */
      if (body.hipX != null){
        if (lastHip == null) lastHip = body.hipX;
        if (Math.abs(body.hipX - lastHip) > WALKED){ moving = 1.2; lastHip = body.hipX; }
        else { moving = Math.max(0, moving - dt); lastHip += (body.hipX - lastHip) * Math.min(1, dt * 2); }
        if (moving > 0 && lock <= 0){ const ix = worldAt(body.hipX, F.WORLDS.length, st.worldIx); if (ix !== st.worldIx){ sfx.tick(); dispatch({ t: 'world', ix }); } }
      }
    }
    if (st.step === 'what' && st.group && ui.lane) moveParade(dt);
    if (st.step === 'rules'){
      dispatch({ t: 'tick', dt });
      if (st.step !== 'rules') return;
      /* a raised hand's height is the stop, live; held still it sets it. The highest hand counts. */
      const mb = ui.meter;
      const hand = handsNow.length ? handsNow.reduce((a, c) => (c.y < a.y ? c : a)) : null;
      if (hand && mb && lock <= 0){
        const cur = lastMeterStop ?? st.picks[st.q];
        const i = meterStop(hand.y, mb.top, mb.bottom, ui.stops.length, cur);
        meterY = hand.y;
        if (i !== lastMeterStop || i !== st.picks[st.q]){ lastMeterStop = i; if (i !== st.picks[st.q]){ sfx.tick(); dispatch({ t: 'meter', i }); } }
        const d = meterDwell.step(dt, i);
        ui.mpill.style.setProperty('--dw', `${Math.round(d.progress * 100)}%`);
        holding = d.progress > 0 && !d.fired ? { x: hand.sx, y: hand.sy, k: d.progress } : null;
        if (holding && clock >= riseAt){ riseAt = clock + RISE_EVERY; sfx.rise?.(d.progress); }
        if (d.fired){ holding = null; sfx.select(); pops.push({ x: hand.x, y: hand.y, t: 0 }); sfx.pop?.(); dispatch({ t: 'set' }); meterDwell.block(); }
      } else if (!hand){ meterY = null; lastMeterStop = null; meterDwell.step(dt, null); ui.mpill.style.setProperty('--dw', '0%'); }
    }
    if (st.step === 'name'){
      if (st.nameIx !== nameIxSeen){
        const n = st.names.length; let d = (st.nameIx - nameIxSeen + n) % n; if (d > n / 2) d -= n;
        nameGoal += d; nameIxSeen = st.nameIx;
      }
      nameShow = still ? nameGoal : nameShow + (nameGoal - nameShow) * Math.min(1, dt * 4.5);
      if (lock <= 0 && jumped(jumps.step(dt, seen, seen.length), body.index)){ sfx.whoosh?.(); dispatch({ t: 'spin', by: 1 + Math.floor(Math.random() * 4) }); }
    } else jumps.step(dt, seen, seen.length);
  }

  /* the parade floats along its lane, looping; a remote with a thing lit holds it still */
  function moveParade(dt){
    const L = ui.lane, n = ui.parade.length, vw = VW();
    const parked = document.body.classList.contains('remote') && !handsNow.length;
    if (par.goal != null){
      const d = wrapDelta(par.goal - par.ph, L.cycle);
      par.ph = still ? par.goal : wrapN(par.ph + d * Math.min(1, dt * 7), L.cycle);
      if (Math.abs(d) < 1.5){ par.ph = par.goal; par.goal = null; }
    } else if (!parked && !still) par.ph = wrapN(par.ph + PARADE_SPEED * vw * dt, L.cycle);
    if (still){ par.pageT += dt; if (par.pageT > GROUP_PARADE_PAUSE){ par.pageT = 0; par.page++; } }
    const per = Math.max(1, Math.floor(L.w / L.step));
    ui.parade.forEach((p, i) => {
      let x, vis;
      if (still && par.goal == null){
        const k = wrapN(i - par.page * per, n);
        vis = k < per; x = L.x0 + k * L.step;
        if (lit === p.el) vis = true;
      } else {
        const off = wrapN(i * L.step + par.ph, L.cycle) - L.step;
        x = L.x0 + off; vis = off >= -1 && off + L.size <= L.w + 1;
      }
      const wasHidden = p.el.classList.contains('hide');
      p.el.classList.toggle('hide', !vis);
      if (!vis){ return; }
      const bob = still ? 0 : Math.sin(clock * 1.3 + i * 1.7) * L.size * 0.05;
      if (p.el._sz !== L.size){ p.el._sz = L.size; p.el.style.width = `${Math.round(L.size)}px`; p.el.style.height = `${Math.round(L.size)}px`; p.el.style.setProperty('--s', `${Math.round(L.size)}px`); p.el.style.left = '0px'; p.el.style.top = '0px'; }
      p.el.style.translate = `${Math.round(x)}px ${Math.round(L.y + bob)}px`;
      const edge = Math.min(x - L.x0, L.x0 + L.w - (x + L.size)) / (L.size * 0.6);
      p.el.style.opacity = String(clamp(edge, 0, 1) * (st.tray.includes(p.id) ? 0.45 : 1) + (st.tray.includes(p.id) && edge > 0 ? 0 : 0));
      if (wasHidden) p.el._near = 0;
    });
  }
  /* things that were picked fly to their place in the tray */
  function flyThings(dt){
    for (const f of flying){
      f.t += dt;
      const k = ease(Math.min(1, f.t / 0.45)), to = ui.trayLast && ui.trayLast.getBoundingClientRect(), b = box();
      if (to && to.width){
        const x = f.from.x + (to.left - b.x - f.from.x) * k, y = f.from.y + (to.top - b.y - f.from.y) * k, s = f.from.s + (to.width - f.from.s) * k;
        f.el.style.left = `${x}px`; f.el.style.top = `${y}px`; f.el.style.width = `${s}px`; f.el.style.height = `${s}px`;
      }
      if (f.t > 0.5){ f.el.remove(); f.done = true; }
    }
    flying = flying.filter(f => !f.done);
  }
  /* the carousel slides (an easing animation and a whoosh) */
  function slide(from, to){
    const d = wrapDelta(to - from, F.WORLDS.length);
    car.from = car.pos; car.goal = car.goal + d; car.t = still ? 1 : 0;
    if (still) car.pos = car.goal;
    sfx.whoosh?.();
  }
  /* the 3-2-1 before the game */
  function runCount(dt){
    if (!count || st.step !== 'play') return;
    count.t += dt;
    const n = 3 - Math.floor(count.t / COUNT_EVERY);
    if (n !== count.shown){
      count.shown = n;
      if (n >= 1){ if (ui.go) ui.go.textContent = String(n); sfx.count?.(n === 1); cubo.act = { kind: 'jump', until: clock + COUNT_EVERY, from: clock }; }
    }
    if (n <= 0 && count.n > 0){ count.n = 0; finishCount(); }
  }

  /* the start screen: the page shows the home; this reads both arms (or a hand held on Cubo on the banner) and fills the ring round him */
  const startWatch = new BodyReader(), startDwell = new Dwell(HOLD);
  let startHome = null;
  function readStart(dt){
    const players = pose.mouse.active ? [] : pose.players;
    const body = startWatch.step(dt, players);
    let k = body.armsProgress;
    const r = startHome && startHome.cuboRect && startHome.cuboRect();
    if (r && r.width > 0 && body.hands.length){
      const sw = VW(), sh = VH(), pad = Math.min(r.width, r.height) * 0.1;
      const on = body.hands.some(p => p.active && p.x * sw >= r.left - pad && p.x * sw <= r.right + pad && p.y * sh >= r.top - pad && p.y * sh <= r.bottom + pad);
      const d = startDwell.step(dt, on ? 'cubo' : null);
      k = Math.max(k, d.progress);
      if (d.fired && lock <= 0){ if (startHome) startHome.arms(0); dispatch({ t: 'arms' }); return; }
    } else startDwell.step(dt, null);
    if (startHome) startHome.arms(k);
    if (body.arms && lock <= 0){ if (startHome) startHome.arms(0); dispatch({ t: 'arms' }); }
  }

  /* ---------- drawing on the main canvas: the painted world, the carousel, Cubo ---------- */
  function draw(c, W, H){
    if (gone || st.step === 'start') return;
    const b = box(), u = b.w / 177.78;
    if (st.step === 'where') drawCarousel(c, W, H, b, u);
    else {
      const world = st.picks.where;
      assets.scene(c, W, H, world, { t: clock, p: 0.3 });
      if (st.step === 'rules') drawRulesBackdrop(c, b, u);
    }
    if (st.step === 'name') drawNames(c, b, u);
    for (const p of pops) drawPop(c, b, u, p);
    drawCubo(c, b, u);
    if (holding) drawHold(c, b);
  }
  /* the ring that fills round the hand while it holds */
  function drawHold(c, b){
    const m = magnet.targets.length ? magnet.pull(holding.x, holding.y, VW() / VH()) : holding;
    const x = m.x * VW() , y = m.y * VH(), rad = Math.max(24, VH() * 0.058);
    c.save();
    c.lineWidth = Math.max(5, VH() * 0.012); c.lineCap = 'round';
    c.strokeStyle = al('earth.snow', 0.55); c.beginPath(); c.arc(x, y, rad, 0, 6.2832); c.stroke();
    c.strokeStyle = col('ui.gold'); c.beginPath(); c.arc(x, y, rad, -Math.PI / 2, -Math.PI / 2 + holding.k * 6.2832); c.stroke();
    c.restore();
  }
  function drawCarousel(c, W, H, b, u){
    const n = F.WORLDS.length, cb = carouselBox(b), gap = cb.w * 0.025, stride = cb.w + gap;
    const base = Math.floor(car.pos);
    const k = cb.w / b.w;
    c.fillStyle = col('shade.paper'); c.fillRect(0, 0, W, H);
    /* a soft backdrop of the world being chosen */
    c.save(); c.globalAlpha = 0.5; assets.scene(c, W, H, F.WORLDS[wrapN(Math.round(car.pos), n)], { t: clock, p: 0.3 }); c.restore();
    c.save(); c.globalAlpha = 0.55; c.fillStyle = col('earth.snow'); c.fillRect(0, 0, W, H); c.restore();
    for (let off = -2; off <= 3; off++){
      const idx = base + off, cx = b.x + b.w / 2 + (idx - car.pos) * stride, x0 = cx - cb.w / 2, y0 = b.y + cb.y;
      if (x0 > b.x + b.w || x0 + cb.w < b.x) continue;
      const id = F.WORLDS[wrapN(idx, n)], cur = Math.abs(idx - car.pos) < 0.5;
      c.save();
      rrect(c, x0, y0, cb.w, cb.h, u * 3.4); c.clip();
      /* the world, scaled to the card's width and cropped to its height */
      c.save(); c.translate(x0, y0 - 0.1 * b.h * k); c.scale(k, k);
      assets.scene(c, b.w, b.h, id, { t: clock, p: 0.3 });
      c.restore();
      ambient(c, id, x0, y0, cb.w, cb.h, clock, still);
      if (!cur){ c.fillStyle = al('shade.ink', 0.28); c.fillRect(x0, y0, cb.w, cb.h); }
      c.restore();
      c.save(); rrect(c, x0, y0, cb.w, cb.h, u * 3.4); c.lineWidth = u * (cur ? 1.1 : 0.6); c.strokeStyle = cur ? col('earth.snow') : al('earth.snow', 0.7); c.stroke(); c.restore();
    }
  }
  function drawCubo(c, b, u){
    const hh = 36 * u, base = b.y + b.h * 0.975, x = b.x + b.w * cubo.x;
    let poseName = still ? 'stand' : cubo.walking ? 'march' : 'stand', face = null, extra = null;
    const act = cubo.act;
    if (act){
      const k = act.kind;
      poseName = k === 'dodge' ? 'duck' : k === 'keepup' || k === 'jump' ? 'jump' : k === 'collect' || k === 'demoHold' ? 'reach' : k === 'demoArms' ? 'cheer' : k === 'stack' ? 'stand' : 'flap';
      if (still) poseName = 'stand';
      face = k === 'dodge' ? 'wink' : 'joy';
      extra = k;
    } else if (st.step === 'where' && !cubo.walking && !still) poseName = 'lean';
    else if (st.step === 'game' && !cubo.walking && !still) poseName = 'wave';
    cuboFigure(c, x, base, hh, poseName, still ? 0 : clock, face, { talk: !!(cubo.talkUntil && clock < cubo.talkUntil && !still) });
    if (extra === 'stack') for (let i = 0; i < 3; i++) assets.draw(c, 'block', x + Math.sin(clock * 5 + i) * u * 0.8 * (i + 1) * (still ? 0 : 1), base - hh - u * (3.6 + i * 6.4), u * 8);
    if (extra === 'keepup') assets.draw(c, 'beachball', x + u * 6, base - hh - u * (6 + 5 * Math.abs(Math.sin(clock * 6))), u * 9, { rotate: clock * 4 });
    if (extra === 'collect') assets.draw(c, 'glowstar', x + u * 11, base - hh * 0.95, u * 7);
    if (extra === 'demoHold'){
      /* his hand reaches out and rests on a glowing spot while a ring fills */
      const k = clamp((clock - act.from) / 2.2, 0, 1), sx = x + u * 15, sy = base - hh * 0.62;
      c.save(); c.fillStyle = al('touch.sunflower', 0.55); c.beginPath(); c.arc(sx, sy, u * 5, 0, 7); c.fill();
      c.lineWidth = u * 1.1; c.lineCap = 'round'; c.strokeStyle = col('ui.gold'); c.beginPath(); c.arc(sx, sy, u * 5.6, -Math.PI / 2, -Math.PI / 2 + k * 6.2832); c.stroke(); c.restore();
    }
    if (extra === 'demoArms'){
      c.save(); c.fillStyle = col('ui.gold');
      for (let i = 0; i < 6; i++){ const a = i * 1.05 + clock * 3; c.globalAlpha = 0.5 + 0.5 * Math.sin(clock * 6 + i); c.beginPath(); c.arc(x + Math.cos(a) * u * 9, base - hh * 1.15 + Math.sin(a) * u * 4, u * 0.9, 0, 7); c.fill(); }
      c.restore();
    }
  }
  /* what the Rules question looks like, live: things moving at the speed the hand is at, or piling up as many as it is at */
  function drawRulesBackdrop(c, b, u){
    const ids = (st.picks.things || []).map(t => t.id), mult = SPEED_MULT[st.picks.speed] ?? 1, T = still ? 0 : clock;
    if (!ids.length) return;
    const many = st.q === 'many' ? MANY_SHOWN[st.picks.many] ?? 4 : 6;
    const size = u * 9, left = b.x + b.w * 0.2, right = b.x + b.w * 0.97;
    for (let i = 0; i < many; i++){
      const lane = i % 5, a = (i * 0.618) % 1, id = ids[i % ids.length];
      const run = st.q === 'many' ? 0.03 + a * 0.01 : 0.05;
      const k = (a + T * run * mult * 1.5) % 1;
      const x = left + (right - left) * (1 - k);
      /* many: they pile up from the ground, row on row; speed: they sail across at their rows */
      const y = st.q === 'many' ? b.y + b.h * 0.88 - Math.floor(i / 5) * size * 0.62 - (lane % 2) * size * 0.1 : b.y + b.h * (0.27 + lane * 0.11) + Math.sin(T * 2 + i) * u * 0.7;
      const px = st.q === 'many' ? left + (right - left) * (0.05 + ((i * 0.37 + lane * 0.19) % 0.9)) + Math.sin(T * 1.5 + i) * u * 0.8 : x;
      assets.draw(c, id, px, y, size, { rotate: still ? 0 : Math.sin(T * 1.6 + i) * 0.12 });
    }
  }
  function drawPop(c, b, u, p){
    const k = p.t / 0.7;
    c.save(); c.globalAlpha = 1 - k;
    const r = u * 6;
    c.strokeStyle = col('ui.gold'); c.lineWidth = u * 1.2 * (1 - k);
    c.beginPath(); c.arc(p.x, p.y, r * (0.8 + k * 1.4), 0, 7); c.stroke();
    for (let i = 0; i < 8; i++){ const a = i * Math.PI / 4 + 0.3; c.fillStyle = col(i % 2 ? 'touch.sunflower' : 'touch.bubblegum'); c.beginPath(); c.arc(p.x + Math.cos(a) * r * (0.8 + k * 1.8), p.y + Math.sin(a) * r * (0.8 + k * 1.8), u * 1.1 * (1 - k * 0.6), 0, 7); c.fill(); }
    c.restore();
  }
  /* the wheel of names: the one you would keep is big in the middle (it sits where the hand can hold it) */
  function drawNames(c, b, u){
    const names = st.names; if (!names.length) return;
    const wb = wheelBox(zone, VW(), VH()), cx = wb.x + wb.w / 2, cy = wb.y + wb.h / 2, row = wb.h / 4.4, ww = wb.w;
    const at = Math.round(nameShow), off = nameShow - at, n = names.length;
    c.save();
    rrect(c, cx - ww / 2, cy - row * 2.2, ww, row * 4.4, u * 4); c.fillStyle = col('earth.snow'); c.globalAlpha = 0.55; c.fill(); c.globalAlpha = 1; c.clip();
    for (let k = -2; k <= 2; k++){
      const name = names[(((at + k) % n) + n) % n], y = cy + (k - off) * row, d = Math.abs(k - off);
      const px = row * (d < 0.5 ? 0.62 : 0.42);
      c.globalAlpha = Math.max(0, 1 - d * 0.42);
      c.font = `700 ${px}px Fredoka, "Outfit", system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      let size = px; while (c.measureText(name).width > ww * 0.92 && size > 10){ size -= 1; c.font = `700 ${size}px Fredoka, "Outfit", system-ui, sans-serif`; }
      c.lineJoin = 'round'; c.lineWidth = size * (d < 0.5 ? 0.2 : 0.12); c.strokeStyle = col('shade.paper'); c.strokeText(name, cx, y);
      c.fillStyle = d < 0.5 ? col('shade.ink') : col('shade.inkSoft'); c.fillText(name, cx, y);
    }
    c.restore();
    /* the pointer: the one in the middle is the one kept */
    c.save(); c.fillStyle = col('ui.go'); const ax = cx - ww / 2 - u * 1.2;
    c.beginPath(); c.moveTo(ax - u * 4, cy - u * 3.4); c.lineTo(ax + u * 2, cy); c.lineTo(ax - u * 4, cy + u * 3.4); c.closePath(); c.fill(); c.restore();
  }

  /* the little Cubos on the game cards (a card's Cubo moves while a hand is near it) */
  function tickCards(){
    if (st.step !== 'game' || !ui.cards) return;
    for (const c of ui.cards){ const g = c.cv.getContext && c.cv.getContext('2d'); if (g) cardArt(g, c.cv.width, c.cv.height, c.id, clock, still, !!c.live); }
  }
  function tickAll(dt){ tick(dt); tickCards(); }

  /* ---------- the remote: arrows, OK, Back ---------- */
  function keys(e){
    if (gone || !root.isConnected || st.step === 'start') return;
    if (document.querySelector('.dim:not(.lost)')) return;
    const k = REMOTE_KEYS[e.key];
    if (!k && !OK_KEYS.has(e.key)) return;
    e.preventDefault && e.preventDefault(); e.stopImmediatePropagation && e.stopImmediatePropagation();
    if (st.step === 'play') return;                 /* (saving: more presses must not reach the page behind - the tab bar, the profile) */
    document.body.classList.add('remote');
    if (k) dispatch({ t: 'key', key: k }); else { sfx.select(); dispatch({ t: 'ok' }); }
  }
  addEventListener('keydown', keys, true);

  Object.defineProperties(root, { state: { get: () => st }, step: { get: () => st.step }, active: { get: () => st.step !== 'start' }, zone: { get: () => ({ ...zone }) }, clock: { get: () => clock },
    holding: { get: () => (holding ? { ...holding } : null) }, carousel: { get: () => ({ pos: car.pos, goal: car.goal, t: car.t }) } });
  return Object.assign(root, {
    tick: tickAll, draw, event: dispatch,
    /* the page gives the start screen it shows, so arms-up can fill its ring */
    useHome(home){ startHome = home; },
    /* the page starts the flow on the start screen (home); a game being changed opens straight at Where */
    start({ quiet = false } = {}){ opened(null); if (st.say && !quiet) speak(st.say); if (st.demo && !quiet) demoAtOpen(); },
    /* the family's slots filled or freed while the start screen waits (a game removed from the row below) */
    setFull(full){ dispatch({ t: 'full', full }); },
    dispose(){ gone = true; magnet.clear(); removeEventListener('keydown', keys, true); try { voice.hush(); } catch {} root.remove(); }
  });
}

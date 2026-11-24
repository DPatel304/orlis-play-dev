/* Cubo's Create (decision 0060; the design is docs/cubo-create-mockup.html): making a game with your body, with Cubo as your guide.

   The steps and what each gesture does are create/cubo-flow.js (a state machine, tested); the gestures are create/gestures.js; the wheel's motion
   is create/wheel.js. This file reads the first player's body, turns it into events, and draws: the painted world and Cubo on the main canvas
   (draw), the big things to touch as buttons over it. Only the first player builds. Each step's line is said once by Cubo (and written in his
   bubble, with a small "hear it again"); then he stays quiet while you choose.

     cuboCreate({ creation, full, onPlay(saved), onExit(), onStep(step), onFull(), onStart(), say(text, bad) }) -> the element, with
       tick(dt), draw(c, W, H), dispose(), event(ev), state, step

   Touching is a hand held in a big target for DWELL seconds (a ring fills), or a wave at it (the app's usual), or the mouse; both arms up held
   for a moment goes on; a quick sideways wrist swipe spins the wheel; a jump spins the names. The remote works on every step (arrows, OK, Back). */
import { button, onPick } from './cursor.js';
import { h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { voice } from '../audio/voice.js';
import { icon } from './brand.js';
import { iconHTML } from './icons.js';
import { cuboFigure } from './avatar-art.js';
import { reduced } from './chkit.js';
import { assets } from '../games/assets/index.js';
import { pose } from '../tracking/pose.js';
import { JumpWatch } from '../tracking/jump.js';
import { choices, pieceInfo } from '../create/recipe.js';
import { PICTURES } from '../create/pictures.js';
import { creations } from '../create/creations.js';
import { currentMaker } from '../create/maker.js';
import { BodyReader, Dwell, Grabber, worldAt, stopAt, jumped } from '../create/gestures.js';
import { Wheel } from '../create/wheel.js';
import * as F from '../create/cubo-flow.js';

const col = (n, tone) => assets.color(n, tone);
const REMOTE_KEYS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
const OK_KEYS = new Set(['Enter', 'NumpadEnter', ' ', 'Select', 'Accept']);
export const BACK_KEYS = ['Escape', 'Backspace', 'BrowserBack', 'GoBack', 'Back'];
const GROUP_COLOUR = { food: 'touch.tangerine', animals: 'touch.mint', sky: 'touch.skyBlue', toys: 'touch.bubblegum', nature: 'touch.lagoon' };
const JOB_BLURB = { collect: 'Reach out and touch', dodge: 'Lean away from it', keepup: 'Bat it up, keep it up', stack: 'Build a tall tower' };
const ARMS_TEXT = { where: 'Arms up to choose', what: 'Arms up when done', rules: 'Arms up to play', name: 'Arms up to keep it' };
const CUBO_X = { where: 0.105, game: 0.105, what: 0.105, rules: 0.105, name: 0.105, play: 0.5 };
const LOCK = 0.9;                  /* seconds after a step opens before a hand can touch anything (it is probably still where the last pick was) */

/* the little picture on a game card: Cubo doing it */
function cardArt(c, W, job, t, still){
  const T = still ? 0 : t;
  c.clearRect(0, 0, W, W);
  const x = W * 0.46, base = W * 0.99, hh = W * 0.8;
  const bob = still ? 0 : Math.sin(T * 3);
  cuboFigure(c, x, base, hh, { collect: 'reach', dodge: 'duck', keepup: 'jump', stack: 'stand' }[job], T, null);
  if (job === 'collect') assets.draw(c, 'apple', W * 0.8, W * (0.26 + 0.03 * bob), W * 0.22);
  if (job === 'dodge'){ const k = still ? 0.3 : (T * 0.5) % 1; assets.draw(c, 'bee', W * (1.05 - 1.1 * k), W * 0.34, W * 0.2, { flip: true }); }
  if (job === 'keepup') assets.draw(c, 'beachball', W * 0.5, W * (0.07 + 0.05 * Math.abs(bob)), W * 0.2, { rotate: T * 2 });
  if (job === 'stack') for (let i = 0; i < 3; i++) assets.draw(c, 'block', W * (0.46 + 0.012 * bob * (i + 1)), W * (0.17 - i * 0.115), W * 0.16);
}

export function cuboCreate({ creation = null, full = false, onPlay = () => {}, onExit = () => {}, onStep = () => {}, onFull = () => {}, onStart = null, say = () => {} } = {}){
  const root = h('div', 'cc');
  const still = reduced();
  let st = F.newFlow({ creation, full }), clock = 0, gone = false, lock = 0, busy = false;
  const reader = new BodyReader(), jumps = new JumpWatch(), dwell = new Dwell(), grabber = new Grabber();
  const wheel = new Wheel(1, still);
  let touch = [], layer = null, ui = {}, pops = [], lastHip = null, moving = 0;
  let nameShow = 0, nameGoal = 0, nameIxSeen = 0, toldLine = '';
  /* Cubo: where he stands (a share of the box's width), and what he is doing */
  const cubo = { x: 0.1, tx: 0.1, act: null, until: 0 };

  /* ---------- Cubo's words: written in a bubble, said once, "hear it again" ---------- */
  const bubble = h('div', 'ccbubble');
  const bubbleText = h('span', 'cctext');
  const again = onPick(button(icon('play'), 'ccagain'), () => { sfx.tick(); speak(toldLine, true); });
  again.setAttribute('aria-label', 'Hear it again');
  bubble.append(bubbleText, again);
  const back = onPick(button(`${icon('back')}<span>Back</span>`, 'ccback'), () => { sfx.back?.(); dispatch({ t: 'back' }); });
  back.setAttribute('aria-label', 'Back');
  const arms = onPick(button('', 'ccarms'), () => dispatch({ t: 'arms' }));
  const armsText = h('span', 'ccarmstext');
  arms.querySelector('.lbl').append(h('span', 'ccarmsicon', '<svg viewBox="0 0 48 48" aria-hidden="true"><circle cx="24" cy="12" r="5" fill="currentColor"/><path d="M24 18v14M24 22L12 8M24 22L36 8M24 32l-7 12M24 32l7 12" fill="none" stroke="currentColor" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'), armsText);
  arms.setAttribute('aria-label', 'Arms up');
  root.append(bubble, back, arms);

  function speak(line, force = false){
    toldLine = line; bubbleText.textContent = line; bubble.classList.toggle('on', !!line);
    if (!line) return;
    try { voice.say(line, 'nova'); } catch {}
    cubo.talkUntil = clock + 2.4 + line.length * 0.05;
  }

  /* ---------- the flow ---------- */
  function dispatch(ev){
    if (gone) return;
    /* leaving the start screen is the page's to allow first (the camera check): it sends the event back with `force` */
    if (st.step === 'start' && onStart && !ev.force && (ev.t === 'arms' || ev.t === 'ok')){ onStart(); return; }
    const was = st.step, r = F.reduce(st, ev);
    st = r.state;
    for (const f of r.fx) run(f);
    if (st.step !== was) opened(was); else paint();
  }
  function run(f){
    if (f.say) speak(f.say);
    else if (f.cheer){ react(f.cheer); if (f.cheer === 'pick') sfx.select(); else sfx.hooray?.(); }
    else if (f.pop){ pops.push({ id: f.pop, t: 0 }); sfx.pop?.(); }
    else if (f.full) onFull();
    else if (f.msg) say(f.msg);
    else if (f.wheel) wheel.nudge(f.wheel);
    else if (f.grabTop){ const id = groupIds()[wheel.top()]; if (id) dispatch({ t: 'grab', id }); }
    else if (f.play) save(f.play);
    else if (f.exit) onExit();
  }
  function react(kind){
    const still_ = still ? 0.6 : 1.6;
    cubo.act = { kind, until: clock + still_ };
  }
  async function save(play){
    if (busy) return;
    busy = true;
    const who = currentMaker();
    try {
      const saved = await creations.save({ id: play.id, name: play.name, picks: play.picks, makerId: who ? who.id : null });
      busy = false;
      if (!gone) onPlay(saved);
    } catch (e){ busy = false; say(e.message || 'That didn’t save. Try again.', true); dispatch({ t: 'saved-failed' }); }
  }
  const groupIds = () => st.group ? choices.what.find(c => c.id === st.group).pieces.map(p => p.id) : [];

  /* ---------- the layers: what each step shows ---------- */
  function addTouch(el, fn, { ring = true } = {}){ touch.push({ el, fn, ring }); return el; }
  const big = (label, cls, fn) => { const b = onPick(button(label, cls), fn); return b; };

  function opened(was){
    if (layer){ layer.remove(); layer = null; }
    touch = []; ui = {}; dwell.reset(); dwell.block(); lock = LOCK;
    root.setAttribute('data-step', st.step);
    onStep(st.step, was);
    root.classList.toggle('hide', st.step === 'start');
    layer = h('div', 'cclayer cc-' + st.step);
    root.appendChild(layer);
    BUILD[st.step] && BUILD[st.step]();
    if (ARMS_TEXT[st.step]) addTouch(arms, () => dispatch({ t: 'arms' }));
    /* Cubo walks in from the left to where he stands for this step */
    cubo.tx = CUBO_X[st.step] ?? 0.1;
    cubo.x = still ? cubo.tx : (st.step === 'play' ? cubo.x : cubo.tx - 0.13);
    if (st.step === 'name') react('jump');
    paint();
  }

  const BUILD = {
    where(){
      ui.world = h('div', 'ccworld');
      ui.dots = h('div', 'ccdots');
      F.WORLDS.forEach((id, i) => {
        const d = onPick(button('', 'ccdot'), () => { sfx.tick(); dispatch({ t: 'world', ix: i }); });
        d.setAttribute('aria-label', choices.where[i].label); ui.dots.appendChild(d);
      });
      const l = onPick(button(icon('back'), 'ccside left'), () => dispatch({ t: 'key', key: 'left' })), r = onPick(button(icon('play'), 'ccside right'), () => dispatch({ t: 'key', key: 'right' }));
      l.setAttribute('aria-label', 'Previous world'); r.setAttribute('aria-label', 'Next world');
      const tip = h('div', 'cctip', 'Step left or right');
      layer.append(ui.world, l, r, ui.dots, tip);
    },
    game(){
      ui.cards = [];
      const grid = h('div', 'ccgrid');
      F.JOBS.forEach((id, i) => {
        const info = choices.jobs[i];
        const b = onPick(button('', 'cccard'), () => dispatch({ t: 'job', id }));
        b.setAttribute('aria-label', `${info.label}: ${JOB_BLURB[id]}`);
        const lbl = b.querySelector('.lbl'); lbl.className = 'lbl cccardin';
        const cv = document.createElement('canvas'); cv.width = 360; cv.height = 360; cv.setAttribute('aria-hidden', 'true');
        const t = h('span', 'cccardtext'); t.append(h('b', '', info.label), h('small', '', JOB_BLURB[id]));
        lbl.append(cv, t);
        grid.appendChild(b); ui.cards.push({ b, cv, id });
        addTouch(b, () => dispatch({ t: 'job', id }));
      });
      layer.appendChild(grid);
    },
    what(){
      ui.groups = h('div', 'ccgroups');
      ui.chips = choices.what.map((g) => {
        const b = onPick(button('', 'ccchip'), () => dispatch({ t: 'group', id: g.id }));
        b.style.setProperty('--chip', col(GROUP_COLOUR[g.id])); b.style.setProperty('--chip-dark', col(GROUP_COLOUR[g.id], 'shade'));
        const lbl = b.querySelector('.lbl'); lbl.className = 'lbl ccchipin';
        const pic = h('span', 'ccchippic'); pic.innerHTML = iconHTML(g.pieces[0].id, 160);
        lbl.append(pic, h('span', 'ccchipword', g.label));
        b.setAttribute('aria-label', g.label);
        ui.groups.appendChild(b); addTouch(b, () => dispatch({ t: 'group', id: g.id }));
        return b;
      });
      ui.spot = onPick(button('', 'ccspot'), () => dispatch({ t: 'ok' }));
      ui.spot.setAttribute('aria-label', 'Grab the one at the top');
      ui.spotTip = h('div', 'cctip ccspottip', 'Grab it here');
      ui.swipeTip = h('div', 'cctip ccswipetip', 'Swipe to spin');
      ui.tray = h('div', 'cctray');
      ui.trayKey = '';
      layer.append(ui.groups, ui.spot, ui.spotTip, ui.swipeTip, ui.tray);
    },
    rules(){
      ui.sliders = {};
      const mk = (key, label, [a, b]) => {
        const box = h('div', 'ccslider'), r = choices.rules[key];
        const top = h('div', 'ccslab'); const word = h('em'); top.append(h('b', '', label), word);
        const left = h('span', 'ccend'); left.innerHTML = PICTURES[a];
        const right = h('span', 'ccend'); right.innerHTML = PICTURES[b];
        const track = h('div', 'cctrack'), fill = h('i');
        track.appendChild(fill);
        const stops = [];
        for (let i = 0; i < r.steps; i++){
          const s = onPick(button('', 'ccstop'), () => { sfx.tick(); dispatch({ t: key, i }); });
          s.setAttribute('aria-label', `${label}: ${r.labels[i]}`); track.appendChild(s); stops.push(s);
        }
        const row = h('div', 'ccsliderrow'); row.append(left, track, right);
        box.append(top, row);
        ui.sliders[key] = { box, track, fill, word, stops, r };
        return box;
      };
      layer.append(mk('speed', 'How fast?', choices.rules.speed.icons), mk('many', 'How many?', choices.rules.many.icons));
    },
    name(){
      const spin = onPick(button(`<span>Spin</span>`, 'ccspin'), () => dispatch({ t: 'spin', by: 1 + Math.floor(Math.random() * 4) }));
      spin.setAttribute('aria-label', 'Spin the names');
      layer.appendChild(spin);
      addTouch(spin, () => dispatch({ t: 'spin', by: 1 + Math.floor(Math.random() * 4) }));
      nameShow = nameGoal = st.nameIx; nameIxSeen = st.nameIx;
    },
    play(){ layer.appendChild(h('div', 'ccgo', 'Here we go!')); }
  };

  /* what changes with the state, not the step */
  function paint(){
    arms.classList.toggle('hide', !ARMS_TEXT[st.step] || (st.step === 'what' && !st.tray.length) || (st.step === 'what' && !st.group));
    armsText.textContent = ARMS_TEXT[st.step] || '';
    arms.classList.toggle('sel', st.step === 'what' && st.zone === 'done');
    back.classList.toggle('hide', st.step === 'play');
    if (st.step === 'where'){
      ui.world.textContent = choices.where[st.worldIx].label;
      [...ui.dots.children].forEach((d, i) => d.classList.toggle('on', i === st.worldIx));
    }
    if (st.step === 'game') ui.cards.forEach((c, i) => c.b.classList.toggle('sel', i === st.gameIx));
    if (st.step === 'what'){
      ui.groups.classList.toggle('big', !st.group);
      ui.chips.forEach((b, i) => { b.classList.toggle('on', F.GROUPS[i] === st.group); b.classList.toggle('sel', !st.group && i === st.groupIx); });
      if (!(st.group && ui.wheelFor === st.group)){
        ui.wheelFor = st.group;
        if (st.group){ wheel.setSize(groupIds().length); wheel.pos = 0; }
      }
      ui.spot.classList.toggle('hide', !st.group); ui.spotTip.classList.toggle('hide', !st.group); ui.swipeTip.classList.toggle('hide', !st.group);
      ui.spot.classList.toggle('sel', !!st.group && st.zone === 'wheel');
      drawTray();
    }
    if (st.step === 'rules'){
      for (const [k, s] of Object.entries(ui.sliders)){
        const v = st.picks[k], n = s.r.steps;
        s.fill.style.width = `${v * 100 / (n - 1)}%`;
        s.word.textContent = s.r.labels[v];
        s.stops.forEach((b, i) => { b.classList.toggle('lit', i <= v); b.classList.toggle('on', i === v); });
        s.box.classList.toggle('sel', (k === 'speed' && st.row === 0) || (k === 'many' && st.row === 1));
      }
      arms.classList.toggle('sel', st.row === 2);
    }
  }
  /* the tray: what has been picked so far (touch one to take it back) */
  function drawTray(){
    const key = st.tray.join(',') + '|' + st.group;
    if (key !== ui.trayKey){
      ui.trayKey = key;
      touch = touch.filter(t => !t.tray);
      ui.tray.innerHTML = '';
      ui.tray.classList.toggle('hide', !st.group);
      ui.tray.appendChild(h('small', '', `${st.tray.length} of ${choices.maxThings}`));
      for (let i = 0; i < choices.maxThings; i++){
        const id = st.tray[i];
        if (!id){ ui.tray.appendChild(h('span', 'cctrayslot empty')); continue; }
        const info = pieceInfo(id), b = onPick(button('', 'cctrayslot'), () => dispatch({ t: 'take', id }));
        b.querySelector('.lbl').className = 'lbl cctrayin'; b.querySelector('.lbl').innerHTML = iconHTML(id, 160);
        b.setAttribute('aria-label', `Take off the ${info.label.toLowerCase()}`); b.setAttribute('data-i', String(i));
        ui.tray.appendChild(b); touch.push({ el: b, fn: () => dispatch({ t: 'take', id }), ring: true, tray: true });
      }
    }
    [...ui.tray.children].filter(e => e.getAttribute && e.getAttribute('data-i') != null).forEach((e) => e.classList.toggle('sel', st.zone === 'tray' && Number(e.getAttribute('data-i')) === st.trayIx));
  }

  /* ---------- the box this lives in, in screen pixels ---------- */
  function box(){
    const r = root.getBoundingClientRect ? root.getBoundingClientRect() : null;
    if (r && r.width > 0) return { x: r.left, y: r.top, w: r.width, h: r.height };
    const W = typeof innerWidth === 'number' ? innerWidth : 1920, H = typeof innerHeight === 'number' ? innerHeight : 1080;
    return { x: 0, y: 0, w: W, h: H };
  }
  const spotAt = (b) => ({ x: b.x + b.w * 0.5, y: b.y + b.h * 0.4, r: b.h * 0.105 });

  /* ---------- every frame ---------- */
  function tick(dt){
    if (gone) return;
    clock += dt; lock = Math.max(0, lock - dt);
    if (st.step === 'start'){ readStart(dt); return; }
    const body = reader.step(dt, pose.players);
    const px = body.hands.filter(p => p.active).map(p => ({ x: p.x * (typeof innerWidth === 'number' ? innerWidth : 1920), y: p.y * (typeof innerHeight === 'number' ? innerHeight : 1080) }));

    /* both arms up goes on from here (only for the steps that use it) */
    if (body.arms && lock <= 0 && ARMS_TEXT[st.step] && !arms.classList.contains('hide')){ dispatch({ t: 'arms' }); return; }
    arms.style.setProperty('--k', `${Math.round(body.armsProgress * 100)}%`);
    arms.classList.toggle('rising', body.armsProgress > 0 && lock <= 0);

    /* touching: a hand held in a big target */
    if (lock > 0){ /* (a step has just opened: wait, with whatever the hand is resting in blocked) */ }
    else if (touch.length){
      let hit = null;
      outer: for (const t of touch){
        if (!t.el.isConnected || t.el.classList.contains('hide')) continue;
        const r = t.el.getBoundingClientRect(), pad = Math.min(r.width, r.height) * 0.1;
        if (r.width <= 0) continue;
        for (const p of px) if (p.x >= r.left - pad && p.x <= r.right + pad && p.y >= r.top - pad && p.y <= r.bottom + pad){ hit = t; break outer; }
      }
      const d = dwell.step(dt, hit);
      touch.forEach(t => t.el.style.setProperty('--dw', t === hit ? `${Math.round(d.progress * 100)}%` : '0%'));
      if (d.fired && hit){ sfx.select(); hit.fn(); return; }
    } else dwell.reset();

    const b = box();
    if (st.step === 'where'){
      /* walk across the picture and the world follows (a body that has been still leaves the world where it is: the remote's choice stays) */
      if (body.hipX != null){
        if (lastHip == null) lastHip = body.hipX;
        if (Math.abs(body.hipX - lastHip) > 0.002){ moving = 1.2; } else moving = Math.max(0, moving - dt);
        lastHip = body.hipX;
        if (moving > 0 && lock <= 0){ const ix = worldAt(body.hipX, F.WORLDS.length, st.worldIx); if (ix !== st.worldIx){ sfx.tick(); dispatch({ t: 'world', ix }); } }
      }
    }
    if (st.step === 'what' && st.group){
      wheel.step(dt);
      const sw = lock <= 0 ? body.swipe : 0;
      if (sw){ wheel.kick(sw); sfx.whoosh?.(); }
      const s = spotAt(b), inSpot = lock <= 0 && px.some(p => Math.hypot(p.x - s.x, p.y - s.y) < s.r * 1.2);
      ui.spot.classList.toggle('near', inSpot);
      const got = grabber.step(dt, inSpot, groupIds()[wheel.top()] ?? null);
      if (got) dispatch({ t: 'grab', id: got });
    }
    if (st.step === 'rules'){
      for (const [k, s] of Object.entries(ui.sliders)){
        const rb = s.box.getBoundingClientRect(), first = s.stops[0].getBoundingClientRect(), last = s.stops[s.stops.length - 1].getBoundingClientRect();
        if (rb.width <= 0) continue;
        const left = first.left + first.width / 2, right = last.left + last.width / 2;
        /* (a hand pushes it once it has come into the slider: one that was resting there when the step opened is waited out) */
        const inside = px.filter(p => p.y >= rb.top - rb.height * 0.2 && p.y <= rb.bottom + rb.height * 0.1 && p.x >= left - first.width && p.x <= right + last.width);
        if (!inside.length) s.armed = true;
        if (lock <= 0 && s.armed) for (const p of inside){
          const i = stopAt(p.x, left, right, s.r.steps, st.picks[k]);
          if (i !== st.picks[k]){ sfx.tick(); dispatch({ t: k, i }); }
        }
      }
      dispatch({ t: 'tick', dt });
    }
    if (st.step === 'name'){
      if (st.nameIx !== nameIxSeen){
        const n = st.names.length; let d = (st.nameIx - nameIxSeen + n) % n; if (d > n / 2) d -= n;
        nameGoal += d; nameIxSeen = st.nameIx;
      }
      nameShow = still ? nameGoal : nameShow + (nameGoal - nameShow) * Math.min(1, dt * 4.5);
      if (lock <= 0 && jumped(jumps.step(dt, pose.players, pose.players.length), body.index)){ sfx.whoosh?.(); dispatch({ t: 'spin', by: 1 + Math.floor(Math.random() * 4) }); }
    } else jumps.step(dt, pose.players, pose.players.length);

    /* the pops fade, Cubo walks */
    for (const p of pops) p.t += dt;
    pops = pops.filter(p => p.t < 0.7);
    const sp = still ? 1 : dt * 2.2;
    cubo.walking = Math.abs(cubo.tx - cubo.x) > 0.004;
    cubo.x += (cubo.tx - cubo.x) * Math.min(1, sp) * (still ? 1 : 1);
    if (!still && cubo.walking){ const dir = Math.sign(cubo.tx - cubo.x); cubo.x += dir * Math.min(Math.abs(cubo.tx - cubo.x), dt * 0.12); }
    if (cubo.act && clock > cubo.act.until) cubo.act = null;
  }

  /* the start screen: the page shows the home; this only reads both arms (and where the player is not seen, nothing happens) */
  const startWatch = new BodyReader();
  let startHome = null;
  function readStart(dt){
    const body = startWatch.step(dt, pose.players);
    if (startHome) startHome.arms(body.armsProgress);
    if (body.arms && lock <= 0){ if (startHome) startHome.arms(0); dispatch({ t: 'arms' }); }
  }

  /* ---------- drawing on the main canvas: the painted world, Cubo, the wheel ---------- */
  function draw(c, W, H){
    if (gone || st.step === 'start') return;
    const b = box(), u = b.w / 177.78;
    const world = st.step === 'where' ? F.WORLDS[st.worldIx] : st.picks.where;
    assets.scene(c, W, H, world, { t: clock, p: 0.3 });
    if (st.step === 'what' && st.group) drawWheel(c, b, u);
    if (st.step === 'name') drawNames(c, b, u);
    for (const p of pops) drawPop(c, b, u, p);
    drawCubo(c, b, u);
  }
  function drawCubo(c, b, u){
    const hh = 36 * u, base = b.y + b.h * 0.975, x = b.x + b.w * cubo.x;
    let poseName = still ? 'stand' : cubo.walking ? 'march' : 'stand', face = null, extra = null;
    const act = cubo.act;
    if (act){
      const k = act.kind;
      poseName = k === 'dodge' ? 'duck' : k === 'keepup' || k === 'jump' ? 'jump' : k === 'collect' ? 'reach' : k === 'stack' ? 'stand' : 'flap';
      if (still) poseName = 'stand';
      face = k === 'dodge' ? 'wink' : 'joy';
      extra = k;
    } else if (st.step === 'where' && !cubo.walking && !still) poseName = 'lean';
    else if (st.step === 'game' && !cubo.walking && !still) poseName = 'wave';
    cuboFigure(c, x, base, hh, poseName, still ? 0 : clock, face, { talk: !!(cubo.talkUntil && clock < cubo.talkUntil && !still) });
    if (extra === 'stack') for (let i = 0; i < 3; i++) assets.draw(c, 'block', x + Math.sin(clock * 5 + i) * u * 0.8 * (i + 1) * (still ? 0 : 1), base - hh - u * (3.6 + i * 6.4), u * 8);
    if (extra === 'keepup') assets.draw(c, 'beachball', x + u * 6, base - hh - u * (6 + 5 * Math.abs(Math.sin(clock * 6))), u * 9, { rotate: clock * 4 });
    if (extra === 'collect') assets.draw(c, 'glowstar', x + u * 11, base - hh * 0.95, u * 7);
  }
  function drawWheel(c, b, u){
    const cx = b.x + b.w / 2, cy = b.y + b.h * 0.98, rx = b.w * 0.295, ry = b.h * 0.58;
    const ids = groupIds(), top = wheel.top();
    const items = wheel.placed().sort((p, q) => Math.abs(q.angle) - Math.abs(p.angle));
    /* the wheel's own rim, a soft ring the things ride on */
    c.save(); c.lineWidth = u * 1.4; c.strokeStyle = col('earth.snow'); c.globalAlpha = 0.5;
    c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, Math.PI * 1.08, Math.PI * 1.92); c.stroke(); c.restore();
    for (const it of items){
      const a = it.angle * Math.PI / 180, x = cx + rx * Math.sin(a), y = cy - ry * Math.cos(a);
      const k = Math.max(0, Math.cos(a)), isTop = it.i === top && Math.abs(it.angle) < 14;
      const size = u * (11 + 8 * k) * (isTop ? 1.18 : 1);
      c.save(); c.globalAlpha = 0.55 + 0.45 * k;
      c.fillStyle = col('earth.snow'); c.globalAlpha *= 0.85; c.beginPath(); c.arc(x, y, size * 0.62, 0, 7); c.fill(); c.globalAlpha = 0.55 + 0.45 * k;
      assets.draw(c, ids[it.i], x, y, size * 0.95, { rotate: still ? 0 : Math.sin(clock * 1.6 + it.i) * 0.08 });
      c.restore();
    }
  }
  function drawPop(c, b, u, p){
    const s = spotAt(b), k = p.t / 0.7;
    c.save(); c.globalAlpha = 1 - k;
    c.strokeStyle = col('ui.gold'); c.lineWidth = u * 1.2 * (1 - k);
    c.beginPath(); c.arc(s.x, s.y, s.r * (1 + k * 1.4), 0, 7); c.stroke();
    for (let i = 0; i < 8; i++){ const a = i * Math.PI / 4 + 0.3; c.fillStyle = col(i % 2 ? 'touch.sunflower' : 'touch.bubblegum'); c.beginPath(); c.arc(s.x + Math.cos(a) * s.r * (1 + k * 1.8), s.y + Math.sin(a) * s.r * (1 + k * 1.8), u * 1.1 * (1 - k * 0.6), 0, 7); c.fill(); }
    c.restore();
  }
  /* the wheel of names: the one you would keep is big in the middle */
  function drawNames(c, b, u){
    const names = st.names; if (!names.length) return;
    const cx = b.x + b.w * 0.57, cy = b.y + b.h * 0.55, row = u * 12.8;
    const at = Math.round(nameShow), off = nameShow - at, n = names.length;
    c.save();
    c.beginPath(); c.roundRect ? c.roundRect(cx - u * 62, cy - row * 2.4, u * 124, row * 4.8, u * 4) : c.rect(cx - u * 62, cy - row * 2.4, u * 124, row * 4.8);
    c.fillStyle = col('earth.snow'); c.globalAlpha = 0.45; c.fill(); c.globalAlpha = 1; c.clip();
    for (let k = -2; k <= 2; k++){
      const name = names[(((at + k) % n) + n) % n], y = cy + (k - off) * row, d = Math.abs(k - off);
      const px = u * (d < 0.5 ? 7.6 : 5.2) * (d < 0.5 ? 1 : 0.9);
      c.globalAlpha = Math.max(0, 1 - d * 0.42);
      c.font = `700 ${px}px Fredoka, "Outfit", system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
      let size = px; while (c.measureText(name).width > u * 116 && size > 10){ size -= 1; c.font = `700 ${size}px Fredoka, "Outfit", system-ui, sans-serif`; }
      c.lineJoin = 'round'; c.lineWidth = size * (d < 0.5 ? 0.2 : 0.12); c.strokeStyle = col('shade.paper'); c.strokeText(name, cx, y);
      c.fillStyle = d < 0.5 ? col('shade.ink') : col('shade.inkSoft'); c.fillText(name, cx, y);
    }
    c.restore();
    /* the pointer: the one in the middle is the one kept */
    c.save(); c.fillStyle = col('ui.go'); const ax = cx - u * 66;
    c.beginPath(); c.moveTo(ax - u * 4, cy - u * 3.4); c.lineTo(ax + u * 2, cy); c.lineTo(ax - u * 4, cy + u * 3.4); c.closePath(); c.fill(); c.restore();
  }

  /* the little Cubos on the game cards, and the ring around a target as a hand dwells (css reads --dw) */
  function tickCards(){
    if (st.step !== 'game' || !ui.cards) return;
    for (const c of ui.cards){ const g = c.cv.getContext && c.cv.getContext('2d'); if (g) cardArt(g, c.cv.width, c.id, clock, still); }
  }
  function tickAll(dt){ tick(dt); tickCards(); }

  /* ---------- the remote: arrows, OK, Back ---------- */
  function keys(e){
    if (gone || !root.isConnected || st.step === 'start' || st.step === 'play') return;
    if (document.querySelector('.dim:not(.lost)')) return;
    const k = REMOTE_KEYS[e.key];
    if (!k && !OK_KEYS.has(e.key)) return;
    e.preventDefault && e.preventDefault(); e.stopImmediatePropagation && e.stopImmediatePropagation();
    document.body.classList.add('remote');
    if (k) dispatch({ t: 'key', key: k }); else { sfx.select(); dispatch({ t: 'ok' }); }
  }
  addEventListener('keydown', keys, true);

  Object.defineProperties(root, { state: { get: () => st }, step: { get: () => st.step }, active: { get: () => st.step !== 'start' } });
  return Object.assign(root, {
    tick: tickAll, draw, event: dispatch,
    /* the page gives the start screen it shows, so arms-up can fill its ring */
    useHome(home){ startHome = home; },
    /* the page starts the flow on the start screen (home); a game being changed opens straight at Where */
    start(){ opened(null); if (st.say) speak(st.say); },
    dispose(){ gone = true; removeEventListener('keydown', keys, true); try { voice.hush(); } catch {} root.remove(); },
    wheel
  });
}

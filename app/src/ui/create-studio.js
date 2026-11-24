/* The builder (decisions 0057, 0059; the look and flow are docs/create-mockup.html): four steps (Where, What, Rules, Name & play) with the
   live game on the left and the step's pictures on the right. A strip of the steps runs along the top (done ticked, the current one lit), the one-line
   sum-up of the game sits under the preview, and Back / Next are bottom right. Picking anything changes the preview at once (the real built description
   on the real engine, a scripted hand standing in for the camera). "What" picks the game's job (Collect, Dodge, Keep up or Stack: it is how you
   play, so there is no move to pick) and up to five things, listed in a tray under the preview. The last step names it (three suggested
   names, no typing) and has one Play it! button.

   createStudio({ creation, onBack(), onPlay(saved), say(text, bad) }) -> the element, with tick(dt) and dispose().
   The state and what each move does are in create/builder-model.js (tested); this is only drawing and wiring. Remote and mouse work on every
   card, chip, slider stop and button (remote.js finds them by their .btn class). */
import { button, onPick } from './cursor.js';
import { h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { icon } from './brand.js';
import { iconHTML } from './icons.js';
import { remote } from './remote.js';
import { assets } from '../games/assets/index.js';
import { choices, pieceInfo } from '../create/recipe.js';
import { PICTURES } from '../create/pictures.js';
import { makePreview, SIZE } from '../create/preview.js';
import { creations } from '../create/creations.js';
import { currentMaker } from '../create/maker.js';
import { faceOf } from './avatar-maker.js';
import * as B from '../create/builder-model.js';

const worldPics = new Map();
/* a world, drawn once from the real scene (a picture for its card) */
function worldPic(id){
  if (worldPics.has(id)) return worldPics.get(id);
  let url = '';
  try {
    const cv = document.createElement('canvas'); cv.width = 480; cv.height = 270;
    const c = cv.getContext && cv.getContext('2d');
    if (c){ assets.scene(c, 480, 270, id, { t: 1.4, p: 0.3 }); url = cv.toDataURL('image/jpeg', 0.8); }
  } catch { url = ''; }
  worldPics.set(id, url);
  return url;
}

/* what the four jobs mean, for the line under the things */
const JOB_LEGEND = [['collect', 'Touch it to score'], ['dodge', 'Keep away - it costs a point'], ['keepup', 'Bat it up - don’t let it drop'], ['stack', 'Build a tower - a full one blasts off']];

export function createStudio({ creation = null, onBack = () => {}, onPlay = () => {}, say = () => {} } = {}){
  let countEl = null, st = B.newBuilder(creation), cat = null, busy = false, controls = [], trayKey = '';
  const root = h('div', 'cstudio');

  /* ---------- the step strip ---------- */
  const strip = h('div', 'cstepper');
  /* ---------- the live game, and the sentence under it ---------- */
  const prev = h('div', 'cprev');
  const canvas = document.createElement('canvas'); canvas.width = SIZE.w; canvas.height = SIZE.h; canvas.setAttribute('aria-label', 'Your game, playing');
  prev.append(canvas, h('span', 'clive', 'LIVE'));
  const say1 = h('p', 'csay');
  const preview = makePreview(canvas);
  /* the things picked and their jobs (What) */
  const tray = h('div', 'ctray');
  /* ---------- the choices ---------- */
  const panel = h('div', 'cpick');
  const navs = h('div', 'cnavs');
  root.append(strip, prev, say1, tray, panel, navs);

  /* a card: a picture (or a canvas) and a word, one pick */
  const opt = (pic, label, small, isOn, set, cls = '') => {
    const b = onPick(button('', 'copt ' + cls), () => { sfx.select(); set(); sync(); });
    const lbl = b.querySelector('.lbl'); lbl.className = 'lbl copt-in';
    if (pic){ const p = h('span', 'cpic'); if (typeof pic === 'string') p.innerHTML = pic; else p.appendChild(pic); lbl.appendChild(p); }
    const t = h('span', 'cword'); t.textContent = label; if (small){ const s = h('small'); s.textContent = small; t.appendChild(s); }
    lbl.appendChild(t);
    b.setAttribute('aria-label', small ? `${label}: ${small}` : label);
    controls.push({ el: b, on: isOn });
    return b;
  };
  const pickKey = (key, val) => () => { st = B.pick(st, key, val); };

  /* ---------- the tray: each thing picked, with its four job chips ---------- */
  function drawTray(){
    const key = st.picks.things.map(t => t.id).join(',');
    if (key !== trayKey){
      trayKey = key;
      controls = controls.filter(c => !c.tray);
      tray.innerHTML = '';
      const head = h('div', 'ctrayhead'); countEl = h('small', '', ''); head.append(h('b', '', 'Your things'), countEl);
      tray.appendChild(head);
      st.picks.things.forEach((t, i) => {
        const info = pieceInfo(t.id), row = h('div', 'ctrow'), pic = h('span', 'cpic'), nm = h('span', 'ctname');
        pic.innerHTML = iconHTML(t.id, 96); nm.textContent = info.label;
        const rm = onPick(button(icon('close'), 'cx'), () => {
          if (!B.canRemove(st)){ sfx.back?.(); say('A game needs at least one thing'); return; }
          sfx.select(); st = B.removePiece(st, t.id); sync();
          if (document.body.classList && document.body.classList.contains('remote')){ const rows = tray.querySelectorAll('.ctrow'); const r = rows[Math.min(i, rows.length - 1)]; const first = r && r.querySelector('.cjob.on, .cjob'); if (first) remote.mark(first); }
        });
        rm.setAttribute('aria-label', `Take off the ${info.label.toLowerCase()}`);
        controls.push({ el: rm, on: () => false, tray: true, chip: true });
        row.append(pic, nm, rm);
        tray.appendChild(row);
      });
    }
    countEl.textContent = `${st.picks.things.length} of ${choices.maxThings}`;
  }

  /* ---------- what each step shows ---------- */
  const builders = {
    where(){
      const g = h('div', 'cgrid two worlds');
      for (const w of choices.where){
        const b = onPick(button('', 'cworld'), () => { sfx.select(); st = B.pick(st, 'where', w.id); sync(); });
        const url = worldPic(w.id); if (url) b.style.backgroundImage = `url(${url})`;
        b.querySelector('.lbl').replaceWith(h('b', 'cworldname', ''));
        b.querySelector('.cworldname').textContent = w.label;
        b.setAttribute('aria-label', w.label);
        controls.push({ el: b, on: () => st.picks.where === w.id });
        g.appendChild(b);
      }
      return [g];
    },
    what(){
      if (!cat) cat = (choices.what.find(c => c.pieces.some(p => p.id === st.picks.things[0].id)) || choices.what[0]).id;
      const tabs = h('div', 'ccats'), grid = h('div', 'cgrid five');
      const toggle = (id) => () => {
        if (B.isPicked(st, id)){
          if (!B.canRemove(st)){ say('A game needs at least one thing'); return; }
          st = B.removePiece(st, id);
        } else if (!B.canAdd(st)){ say(`${choices.maxThings} things is the most - take one off first`); return; }
        else st = B.addPiece(st, id);
      };
      const fillGrid = () => {
        grid.innerHTML = ''; controls = controls.filter(c => !c.grid);
        for (const p of choices.what.find(c => c.id === cat).pieces){
          const b = opt(iconHTML(p.id, 160), p.label, '', () => B.isPicked(st, p.id), toggle(p.id), 'piece');
          controls.find(c => c.el === b).grid = true; grid.appendChild(b);
        }
      };
      for (const c of choices.what){
        const t = onPick(button(c.label, 'ccat'), () => { sfx.select(); cat = c.id; fillGrid(); sync(); });
        t.setAttribute('aria-label', c.label); tabs.appendChild(t); controls.push({ el: t, on: () => cat === c.id, tab: true });
      }
      fillGrid();
      const jobs = h('div', 'cjobs');
      for (const j of choices.jobs){
        const b = onPick(button(j.label, 'cjob'), () => { sfx.select(); st = B.jobAll(st, j.id); sync(); });
        b.setAttribute('aria-label', `Job: ${j.label}`); b.setAttribute('data-job', j.id);
        jobs.appendChild(b); controls.push({ el: b, on: () => B.jobNow(st) === j.id, chip: true });
      }
      const legend = h('div', 'cjoblegend');
      for (const [id, line] of JOB_LEGEND){ const l = h('span', 'cjl'), n = h('b', '', ''), t = h('em', '', ''); n.textContent = choices.jobs.find(j => j.id === id).label; t.textContent = line; l.append(n, t); legend.appendChild(l); }
      return [jobs, tabs, grid, legend];
    },
    rules(){
      const r = choices.rules, out = [];
      /* a picture slider: five stops, from one picture to the other */
      const slider = (key, label, [a, b]) => {
        const box = h('div', 'cslider'), top = h('div', 'cslab'), val = h('em');
        top.append(h('span', '', label), val);
        const left = h('span', 'cend'); left.innerHTML = PICTURES[a];
        const right = h('span', 'cend'); right.innerHTML = PICTURES[b];
        const track = h('div', 'ctrack'), fill = h('i');
        track.appendChild(fill);
        const stops = [];
        for (let i = 0; i < r[key].steps; i++){
          const s = onPick(button('', 'cstop'), () => { sfx.select(); st = B.pick(st, key, i); sync(); });
          s.setAttribute('aria-label', `${label}: ${r[key].labels[i]}`); track.appendChild(s); stops.push(s);
          controls.push({ el: s, on: () => st.picks[key] === i, stop: true });
        }
        controls.push({ el: box, on: () => false, paint(){ const v = st.picks[key]; fill.style.width = `${v * 100 / (r[key].steps - 1)}%`; val.textContent = r[key].labels[v]; stops.forEach((s, i) => s.classList.toggle('lit', i <= v)); } });
        box.append(top, left, track, right);
        return box;
      };
      out.push(slider('speed', 'How fast', r.speed.icons), slider('many', 'How many', r.many.icons));
      /* how long the round is */
      const len = h('div', 'cslider clen'), ltop = h('div', 'cslab'); ltop.append(h('span', '', 'How long'));
      const seg = h('div', 'cseg');
      for (const m of r.minutes.options){
        const b = onPick(button(`${m} min`, 'copt small'), () => { sfx.select(); st = B.pick(st, 'minutes', m); sync(); });
        b.setAttribute('aria-label', `${m} minute${m > 1 ? 's' : ''}`); seg.appendChild(b); controls.push({ el: b, on: () => st.picks.minutes === m });
      }
      len.append(ltop, seg); out.push(len);
      /* together, or who wins */
      const mode = h('div', 'cgrid two ctoggle');
      for (const m of r.mode) mode.appendChild(opt(PICTURES[m.icon], m.label, '', () => st.picks.mode === m.id, pickKey('mode', m.id), 'cwide'));
      out.push(mode);
      /* the specials: a golden one needs something to Collect, a bomb needs things that move about (not only a ball to keep up) */
      const avail = r.specials.filter(s => s.id === 'golden' ? B.hasGolden(st.picks) : B.hasBomb(st.picks));
      if (avail.length){
        const sp = h('div', 'cgrid two ctoggle');
        for (const s of avail) sp.appendChild(opt(PICTURES[s.icon], s.label, s.line, () => !!st.picks[s.id], () => { st = B.flip(st, s.id); }, 'cwide'));
        out.push(sp);
      }
      if (avail.length < r.specials.length) out.push(h('p', 'cnote', avail.length ? 'A golden one needs a thing to Collect.' : 'Golden ones and bombs need things to Collect or Dodge.'));
      return out;
    },
    name(){
      const names = h('div', 'cnames');
      for (const n of B.nameChoices(st)){
        const b = onPick(button(n, 'cname'), () => { sfx.select(); st = B.setName(st, n); sync(); });
        b.setAttribute('aria-label', n); names.appendChild(b); controls.push({ el: b, on: () => B.nameOf(st) === n });
      }
      const who = currentMaker(), by = h('div', 'cmadeby');
      const face = h('span', 'cmbface'); face.appendChild(faceOf(who || {}, 96));
      by.append(face, h('span', 'cmbtxt', ''));
      by.querySelector('.cmbtxt').textContent = `Made by ${who ? who.name : 'us'}`;
      return [names, by];
    }
  };

  /* ---------- drawing the page ---------- */
  function drawStrip(){
    strip.innerHTML = '';
    for (const s of B.stripOf(st)){
      const e = h('span', 'cstep ' + s.status), n = h('i');
      n.textContent = s.status === 'done' ? '✓' : String(s.n);
      e.append(n, h('span', 'cstl', '')); e.querySelector('.cstl').textContent = s.label;
      e.setAttribute('aria-label', `${s.label}${s.status === 'done' ? ', done' : s.status === 'cur' ? ', now' : ''}`);
      strip.appendChild(e);
    }
  }
  function drawNav(info){
    navs.innerHTML = '';
    const back = onPick(button(`${icon('back')}<span>Back</span>`, 'cbtn2 ghost'), () => { sfx.back?.(); if (B.canBack(st)){ st = B.back(st); render(); } else onBack(); });
    back.setAttribute('aria-label', 'Back');
    const last = B.isLast(st);
    const fwd = onPick(button(last ? `${icon('play')}<span>${info.nextLabel}</span>` : `<span>${info.nextLabel}</span>`, 'cbtn2 ' + (last ? 'big' : 'go')), () => { if (last) finish(); else { sfx.select(); st = B.next(st); render(); } });
    fwd.setAttribute('aria-label', info.nextLabel);
    /* Rules can be skipped: the usual speed, number, round, together and specials are used (0057) */
    if (info.id === 'rules'){
      const skip = onPick(button(B.SKIP_LABEL, 'cskip'), () => { sfx.select(); st = B.skipRules(st); render(); });
      skip.setAttribute('aria-label', B.SKIP_LABEL);
      navs.appendChild(skip);
    }
    navs.append(back, fwd);
  }
  /* what changes on a pick: the cards' ticks, the chips, the sentence, the live game */
  function sync(){
    if (STEPS_WITH_TRAY.includes(B.STEPS[st.step].id)) drawTray();
    for (const c of controls){
      if (c.paint){ c.paint(); continue; }
      const on = !!c.on();
      c.el.classList.toggle('on', on);
      if (!c.tab && !c.stop && !c.chip) c.el.classList.toggle('focus', on);      /* (where the remote starts: the card that is lit) */
    }
    say1.textContent = B.sumUp(st);
    preview.set(st.picks);
  }
  const STEPS_WITH_TRAY = ['what'];
  function render(){
    const info = B.stepInfo(st);
    root.setAttribute('data-step', info.id);
    root.className = 'cstudio step-' + info.id;
    drawStrip();
    controls = []; trayKey = '';
    tray.innerHTML = '';
    panel.innerHTML = '';
    panel.append(h('h3', '', ''), h('p', 'csub', ''));
    panel.querySelector('h3').textContent = info.title;
    const sub = panel.querySelector('.csub'); sub.textContent = info.sub; if (!info.sub) sub.className = 'csub none';
    for (const el of builders[info.id]()) panel.appendChild(el);
    drawNav(info);
    sync();
    /* the remote follows to the new step's lit card (it only moves when the remote is in use) */
    if (typeof document !== 'undefined' && document.body.classList && document.body.classList.contains('remote')){
      const on = panel.querySelector('.copt.on') || panel.querySelector('.cworld.on') || panel.querySelector('.cname.on') || panel.querySelector('.cskip');
      if (on) remote.mark(on);
    }
  }

  /* Play it!: kept in the family's slot, then played */
  async function finish(){
    if (busy) return;
    busy = true; sfx.select();
    const picks = B.finalPicks(st), who = currentMaker();
    try {
      const saved = await creations.save({ id: st.editing, name: picks.name, picks, makerId: who ? who.id : null });
      onPlay(saved);
    } catch (e){ busy = false; say(e.message || 'That didn’t save. Try again.', true); }
  }

  render();
  Object.defineProperties(root, { state: { get: () => st }, preview: { get: () => preview } });
  return Object.assign(root, {
    tick(dt){ preview.tick(dt); },
    dispose(){ preview.dispose(); },
    /* (for the tests and the pictures) */
    goto(step){ st = { ...st, step: Math.max(0, Math.min(B.LAST, step)) }; render(); }
  });
}

/* The builder (decision 0057; the look and flow are docs/create-mockup.html): six steps with the live game on the left and the step's
   pictures on the right. A strip of the six steps runs along the top (done ticked, the current one lit), the one-line sum-up of the game sits
   under the preview, and Back / Next are bottom right. Picking anything changes the preview at once (the real built description on the real
   engine, a scripted hand standing in for the camera). The last step names it (three suggested names, no typing) and has one Play it! button.

   createStudio({ creation, onBack(), onPlay(saved), say(text, bad) }) -> the element, with tick(dt) and dispose().
   The state and what each move does are in create/builder-model.js (tested); this is only drawing and wiring. Remote and mouse work on every
   card, slider stop and button (remote.js finds them by their .btn class). */
import { button, onPick } from './cursor.js';
import { h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { icon } from './brand.js';
import { iconHTML } from './icons.js';
import { remote } from './remote.js';
import { assets } from '../games/assets/index.js';
import { choices } from '../create/recipe.js';
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

export function createStudio({ creation = null, onBack = () => {}, onPlay = () => {}, say = () => {} } = {}){
  let st = B.newBuilder(creation), cat = null, busy = false, controls = [];
  const root = h('div', 'cstudio');

  /* ---------- the step strip ---------- */
  const strip = h('div', 'cstepper');
  /* ---------- the live game, and the sentence under it ---------- */
  const prev = h('div', 'cprev');
  const canvas = document.createElement('canvas'); canvas.width = SIZE.w; canvas.height = SIZE.h; canvas.setAttribute('aria-label', 'Your game, playing');
  prev.append(canvas, h('span', 'clive', 'LIVE'));
  const say1 = h('p', 'csay');
  const preview = makePreview(canvas);
  /* ---------- the choices ---------- */
  const panel = h('div', 'cpick');
  const navs = h('div', 'cnavs');
  root.append(strip, prev, say1, panel, navs);

  /* a card: a picture and a word, one pick */
  const opt = (pic, label, small, isOn, set, cls = '') => {
    const b = onPick(button('', 'copt ' + cls), () => { sfx.select(); set(); sync(); });
    const lbl = b.querySelector('.lbl'); lbl.className = 'lbl copt-in';
    if (pic){ const p = h('span', 'cpic'); p.innerHTML = pic; lbl.appendChild(p); }
    const t = h('span', 'cword'); t.textContent = label; if (small){ const s = h('small'); s.textContent = small; t.appendChild(s); }
    lbl.appendChild(t);
    b.setAttribute('aria-label', small ? `${label}: ${small}` : label);
    controls.push({ el: b, on: isOn });
    return b;
  };
  const pickKey = (key, val) => () => { st = B.pick(st, key, val); };

  /* ---------- what each step shows ---------- */
  const builders = {
    how(){
      const g = h('div', 'cgrid two');
      for (const o of choices.how) g.appendChild(opt(PICTURES[o.icon], o.label, o.line, () => st.picks.how === o.id, pickKey('how', o.id)));
      return [g];
    },
    what(){
      const cur = choices.what.find(c => c.pieces.some(p => p.id === st.picks.what));
      if (!cat) cat = (cur || choices.what[0]).id;
      const tabs = h('div', 'ccats'), grid = h('div', 'cgrid three');
      const fillGrid = () => {
        grid.innerHTML = ''; controls = controls.filter(c => !c.grid);
        for (const p of choices.what.find(c => c.id === cat).pieces){
          const b = opt(iconHTML(p.id, 160), p.label, '', () => st.picks.what === p.id, pickKey('what', p.id), 'piece');
          controls.find(c => c.el === b).grid = true; grid.appendChild(b);
        }
      };
      for (const c of choices.what){
        const t = onPick(button(c.label, 'ccat'), () => { sfx.select(); cat = c.id; fillGrid(); sync(); });
        t.setAttribute('aria-label', c.label); tabs.appendChild(t); controls.push({ el: t, on: () => cat === c.id, tab: true });
      }
      fillGrid();
      return [tabs, grid];
    },
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
    move(){
      const g = h('div', 'cgrid two');
      for (const m of choices.move) g.appendChild(opt(PICTURES[m.icon], m.label, '', () => st.picks.move === m.id, pickKey('move', m.id)));
      return [g];
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
        controls.push({ el: box, on: () => false, paint(){ const v = st.picks[key]; fill.style.width = `${v * 25}%`; val.textContent = r[key].labels[v]; stops.forEach((s, i) => s.classList.toggle('lit', i <= v)); } });
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
      /* the specials (a golden one, a bomb): not in Keep it up */
      if (B.hasSpecials(st.picks)){
        const sp = h('div', 'cgrid two ctoggle');
        for (const s of r.specials) sp.appendChild(opt(PICTURES[s.icon], s.label, s.line, () => !!st.picks[s.id], () => { st = B.flip(st, s.id); }, 'cwide'));
        out.push(sp);
      } else out.push(h('p', 'cnote', 'Keep it up has no golden ones or bombs.'));
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
  /* what changes on a pick: the cards' ticks, the sliders, the sentence, the live game */
  function sync(){
    for (const c of controls){
      if (c.paint){ c.paint(); continue; }
      const on = !!c.on();
      c.el.classList.toggle('on', on);
      if (!c.tab && !c.stop) c.el.classList.toggle('focus', on);      /* (where the remote starts: the card that is lit) */
    }
    say1.textContent = B.sumUp(st);
    preview.set(st.picks);
  }
  function render(){
    const info = B.stepInfo(st);
    root.setAttribute('data-step', info.id);
    root.className = 'cstudio step-' + info.id;
    drawStrip();
    controls = [];
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

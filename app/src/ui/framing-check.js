/* The camera check in "get ready" (decision 0045 look; the logic is framing.js).

   Between the line-up and the first move of a round. If everyone is fully in view it is over in half a second and nothing shows. If
   someone is cut off (too close, half out of the picture, feet or head missing) the round waits: a frame showing where to stand,
   each player's figure (from tracking, never the camera picture), the edge that is cut lit up, and a few words. When they are
   framed there is a tick and the round carries on by itself. The first time on this PC it shows for about 2 s even when everyone
   is framed ("Great - Orlis can see you"). "Play anyway" appears after 10 s; Enter or OK on the remote does it at any time.

     const check = framingCheck({ onDone });     // a scene: { tick, draw, leave }; onDone is called once                      */
import { button, onPick } from './cursor.js';
import { screen, h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { pose, PLAYER_COLORS } from '../tracking/pose.js';
import { silhouette } from './avatars.js';
import { crew } from './crew.js';
import { launch } from './launch.js';
import { color } from '../games/assets/palette.js';
import { FRAME, FramingWatch, framingShown, markFramingShown, bodyBox, placeCard } from './framing.js';
import { LightWatch } from '../tracking/lighting.js';
import { switchOn } from '../tracking/switches.js';

export const LIGHT_WAIT = 0.7, TIP_S = 3;       /* (Lighting tips: a moment more to look at the light, and how long a tip alone is shown) */
export const BANDS_MIN = 0.8, BANDS_MAX = 8;     /* (Track coloured wristbands: at least this long on "raise your hands", at most this long) */
export const SETTLE = 0.5, SETTLE_EMPTY = 1.2, GOOD_HOLD = 0.8, HELLO = 2, PLAY_ANYWAY_AFTER = 10, FRAMED_FOR = 0.5;

const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';

/* a standing body in the middle of the frame, for "stand about here" */
function ghost(){
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, v: 1 }));
  const set = (i, dx, y) => { lm[i] = { x: 0.5 + dx, y, z: 0, v: 1 }; };
  set(0, 0, 0.2); set(11, -0.045, 0.31); set(12, 0.045, 0.31); set(13, -0.07, 0.43); set(14, 0.07, 0.43); set(15, -0.075, 0.54); set(16, 0.075, 0.54);
  set(23, -0.03, 0.55); set(24, 0.03, 0.55); set(25, -0.032, 0.72); set(26, 0.032, 0.72); set(27, -0.034, 0.88); set(28, 0.034, 0.88);
  return lm;
}
const GHOST = ghost();

export function framingCheck({ onDone, players = pose.cap }){
  const first = !framingShown();
  const watch = new FramingWatch();
  let phase = 'measure', t = 0, phaseT = 0, framedT = 0, finished = false;
  let s = null, card = null, say = null, who = null, go = null, rep = { nobody: true, present: 0, ok: true, bad: [] };
  const seats = () => pose.players.slice(0, players);
  /* Lighting tips (Settings > Testing; off unless on): too dark or backlit, judged from the tracker's small picture copy (numbers only) */
  const lw = switchOn('light') ? new LightWatch({ sustain: 0.5, clear: 0.5 }) : null;
  let tipEl = null;
  /* Track coloured wristbands (Settings > Testing; off unless on): "Raise your hands for a second" - each player's band colour is learnt in this room's light */
  const bw = switchOn('bands') ? { done: false } : null;
  const after = () => { if (first && !rep.nobody) show('hello'); else if (lw && lw.tip) show('tip'); else finish(); };
  const bandWords = () => {
    const st = pose.bandsState().filter(x => x.present && x.slot < players);
    who.textContent = st.map(x => `${crew.nameOf(x.slot) || 'Player ' + (x.slot + 1)} ${x.state === 'ok' ? '\u2713' : x.state === 'none' ? 'no band' : '...'}`).join('   ');
    return st.length > 0 && st.every(x => x.state === 'ok' || x.state === 'none');
  };

  function finish(){
    if (finished) return;
    finished = true;
    onDone();
  }
  function build(){
    launch.release();                                    /* (the cover goes: there is something to show) */
    s = screen('framing');
    card = h('div', 'frmcard');
    const mark = h('span', 'frmtick'); mark.innerHTML = TICK;
    say = h('div', 'frmsay');
    who = h('div', 'frmwho');
    const words = h('div', 'frmwords'); words.append(who, say);
    card.append(mark, words);
    s.appendChild(card);
    if (lw){ tipEl = h('div', 'frmcard frmtip'); tipEl.style.display = 'none'; s.appendChild(tipEl); }
    go = onPick(button('Play anyway', 'big go framego'), () => { sfx.select?.(); finish(); });
    go.classList.add('hide');
    s.appendChild(go);
  }
  function show(next){
    phase = next; phaseT = 0; framedT = 0;
    if (!s) build();
    s.classList.toggle('good', next === 'good' || next === 'hello');
    card.style.display = next === 'tip' ? 'none' : '';
    if (next === 'good'){ say.textContent = 'Looking good'; who.textContent = ''; sfx.gold?.(); }
    if (next === 'bands'){ say.textContent = 'Raise your hands for a second'; who.textContent = ''; pose.bandsLearn(true); }
    if (next === 'hello'){ say.textContent = 'Great - Orlis can see you'; who.textContent = ''; markFramingShown(); sfx.gold?.(); }
  }
  /* Enter or the remote's OK is "Play anyway" at any time (once the button is up, the remote presses that itself) */
  const key = (e) => { if (phase === 'hint' && (e.key === 'Enter' || e.key === 'NumpadEnter')){ sfx.select?.(); finish(); } };
  if (typeof addEventListener === 'function') addEventListener('keydown', key);

  function words(){
    if (rep.nobody){ say.textContent = 'Step in front of the camera'; who.textContent = ''; return; }
    const b = rep.bad[0];
    say.textContent = b ? b.say : '';
    who.textContent = b && rep.present > 1 ? (crew.nameOf(b.i) || `Player ${b.i + 1}`) : '';
  }

  /* the words card sits where it covers no figure: the top centre when that is clear, else the bottom, a corner or a side */
  function placeWords(W, H){
    if (!card) return;
    const boxes = seats().filter(p => p.present && p.lm).map(p => bodyBox(p.lm, W, H));
    if (phase === 'hint' && rep.nobody) boxes.push(bodyBox(GHOST, W, H));
    const keep = [];
    if (go && !go.classList.contains('hide')){ const g = go.getBoundingClientRect(); keep.push({ x0: g.left, y0: g.top, x1: g.right, y1: g.bottom }); }
    const w = card.offsetWidth, hh = card.offsetHeight;
    let at = { x: 0, y: 0 };
    if (phase !== 'tip'){
      at = placeCard(W, H, w, hh, boxes, keep);
      card.style.left = at.x + 'px'; card.style.top = at.y + 'px';
    }
    /* the light tip is a second, smaller card, kept clear of the figures and the words card */
    if (tipEl && tipEl.style.display !== 'none'){
      const tw = tipEl.offsetWidth, th = tipEl.offsetHeight;
      const other = phase !== 'tip' ? [{ x0: at.x, y0: at.y, x1: at.x + w, y1: at.y + hh }] : [];
      const t = placeCard(W, H, tw, th, boxes, [...keep, ...other]);
      tipEl.style.left = t.x + 'px'; tipEl.style.top = t.y + 'px';
    }
  }

  return {
    tick(dt){
      if (finished) return;
      t += dt; phaseT += dt;
      watch.step(dt, seats());
      rep = watch.report(seats());
      if (lw){ try { lw.step(dt, pose.lightLook()); } catch (e){ /* (no tip) */ } if (tipEl){ const tx = lw.tip; if (tipEl.textContent !== (tx || '')) tipEl.textContent = tx || ''; tipEl.style.display = tx && phase !== 'measure' ? '' : 'none'; } }
      if (phase === 'measure'){
        if (t < SETTLE || (rep.nobody && t < SETTLE_EMPTY) || (rep.pending && t < SETTLE_EMPTY + 1)) return;   /* (someone only just joined: judged in a moment) */
        if (lw && t < SETTLE + LIGHT_WAIT) return;
        if (!rep.ok){ show('hint'); words(); return; }
        if (bw && !bw.done && !rep.nobody){ show('bands'); return; }
        after();
        return;
      }
      if (phase === 'bands'){
        const all = bandWords();
        if ((all && phaseT >= BANDS_MIN) || phaseT >= BANDS_MAX){ bw.done = true; pose.bandsLearn(false); after(); }
        return;
      }
      if (phase === 'tip'){ if (phaseT >= TIP_S || !lw.tip && phaseT >= 1) finish(); return; }
      if (phase === 'hello'){ if (phaseT >= HELLO) finish(); return; }
      if (phase === 'good'){ if (phaseT >= GOOD_HOLD) finish(); return; }
      /* hint: the words follow whoever is cut now; framed for a moment and it is a tick, then on */
      words();
      framedT = rep.ok && !rep.nobody ? framedT + dt : 0;
      if (framedT >= FRAMED_FOR){ show('good'); return; }
      if (phaseT >= PLAY_ANYWAY_AFTER && go) go.classList.remove('hide');
    },
    draw(c, W, H){
      if (phase === 'measure') return;
      placeWords(W, H);
      c.fillStyle = color('shade.paper'); c.fillRect(0, 0, W, H);
      const x0 = FRAME.side * W, x1 = (1 - FRAME.side) * W, y0 = FRAME.top * H, y1 = FRAME.feet * H, r = H * 0.03;
      const ok = phase !== 'hint';
      const frame = () => { if (c.roundRect) c.roundRect(x0, y0, x1 - x0, y1 - y0, r); else c.rect(x0, y0, x1 - x0, y1 - y0); };
      /* the picture's edges, a little shaded: the part where a body is cut off */
      c.save();
      c.fillStyle = color('shade.light'); c.globalAlpha = 0.4;
      c.beginPath(); c.rect(0, 0, W, H); frame(); c.fill('evenodd');
      c.restore();
      /* where to stand */
      if (phase === 'hint' && rep.nobody) silhouette(c, GHOST, W, H, color('shade.light'), 0.55);
      /* each player, in their colour */
      seats().forEach((p, i) => {
        if (!p.present || !p.lm) return;
        silhouette(c, p.lm, W, H, crew.colorOf(i, PLAYER_COLORS[i]), 0.8);
      });
      /* the frame; the cut edges light up */
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.lineWidth = Math.max(4, H * 0.007); c.setLineDash(ok ? [] : [H * 0.022, H * 0.016]);
      c.strokeStyle = ok ? color('touch.mint') : color('shade.mid');
      c.beginPath(); frame(); c.stroke();
      c.setLineDash([]);
      if (phase !== 'hint') return;
      c.strokeStyle = color('touch.tangerine'); c.lineWidth = Math.max(8, H * 0.014);
      const edge = (ax, ay, bx, by) => { c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); };
      const cut = (k) => rep.bad.some(b => b[k]);
      if (cut('top')) edge(x0 + r, y0, x1 - r, y0);
      if (cut('feet')) edge(x0 + r, y1, x1 - r, y1);
      if (cut('left')) edge(x0, y0 + r, x0, y1 - r);
      if (cut('right')) edge(x1, y0 + r, x1, y1 - r);
      /* an arrow towards where to go, for one body off to one side */
      const b = rep.bad.length === 1 ? rep.bad[0] : null;
      const side = b && b.left !== b.right && !b.close ? (b.left ? 1 : -1) : 0;
      if (side){
        const ax = W * (side > 0 ? 0.2 : 0.8), ay = H * 0.5, len = H * 0.12, k = H * 0.05, tip = ax + side * len / 2;
        c.beginPath(); c.moveTo(ax - side * len / 2, ay); c.lineTo(tip, ay);
        c.moveTo(tip - side * k, ay - k); c.lineTo(tip, ay); c.lineTo(tip - side * k, ay + k); c.stroke();
      }
    },
    leave(){ if (bw && phase === 'bands'){ try { pose.bandsLearn(false); } catch (e){ /* (nothing to settle) */ } } if (typeof removeEventListener === 'function') removeEventListener('keydown', key); if (s) s.remove(); }
  };
}

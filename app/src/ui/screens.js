import { pose, BONES } from '../tracking/pose.js';
import { cubo } from './cubo.js';
import { button, onPick } from './cursor.js';
import { sfx } from '../audio/sound.js';
import { icon, propIcon, GAME_PROP } from './brand.js';
import { faceOf } from './avatar-maker.js';
import { looks } from './menu.js';
import { resultWords } from './units.js';
import { showNews } from './chnews.js';

const ui = () => document.getElementById('ui');

export function clearUI(){ ui().innerHTML = ''; }

export function screen(cls = ''){
  const d = document.createElement('div');
  d.className = 'screen ' + cls;
  ui().appendChild(d);
  return d;
}

export function h(tag, cls, html){
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

/* ---------- calibration ----------
   Waits for whole bodies rather than any detection at all: a head and
   shoulders will track, but every game here needs legs, so letting someone
   start too close is a bug that only shows up once they are already playing. */
export function calibration(onDone){
  const s = screen('dim');
  const title = h('h2', '', 'Stand back until we can see all of you');
  const info  = h('p', 'lede', 'Two people can play. Stand side by side, about two metres back.');
  const state = h('p', 'lede', '');
  s.append(title, info, state);

  /* A rolling ratio rather than a stopwatch. Detection flickers frame to frame
     - measured, only about a third of frames clear the gate on a figure the
     camera can plainly see - so any timer that wants an unbroken run never
     finishes. Advance when the body was findable for more than half of a
     couple of seconds, which needs no magic confidence number and survives
     the flicker by construction. */
  let good = 0, total = 0, seenFor = 0;
  const WINDOW = 2.2, NEED = 0.5;
  const skip = onPick(button('Skip'), () => { done(); });
  skip.style.marginTop = '2vh';
  s.appendChild(skip);

  let live = true;
  function done(){ if (!live) return; live = false; sfx.gold(); onDone(); }

  return {
    tick(dt){
      if (!live) return;
      /* With no camera there is no body to find, and waiting for one strands
         the whole app on this screen. Mouse mode passes straight through. */
      if (pose.mouse.active){
        /* Its own counter: the camera path's gate is a ratio of good frames,
           and there are no frames to rate here. */
        seenFor += dt;
        state.style.color = 'var(--dim)';
        const why = {
          denied:   'Camera permission was refused.',
          nocamera: 'No camera was found.',
          nonetwork:'The camera works, but the pose runtime could not be downloaded. ' +
                    'Check the connection, or run `npm run offline` to keep it locally.',
          badassets:'The local pose runtime would not load. Try `npm run offline` again.',
          debug:    'Debug mode.'
        }[pose.reason] || 'No camera.';
        state.textContent = why + ' The mouse will play instead.';
        title.textContent = 'Mouse mode';
        info.textContent = 'Move the pointer; hold it over a button for a second to press it.';
        if (seenFor >= 3) done();
        return;
      }
      const full = pose.players.filter(p => pose.fullBody(p)).length;
      const anybody = pose.personCount > 0 || full > 0;
      seenFor = Math.max(0, seenFor + (anybody ? dt : -dt * 0.5));

      total += dt; if (full >= 1) good += dt;
      if (total > WINDOW){ const k = WINDOW / total; good *= k; total *= k; }
      const ratio = total > 0 ? good / total : 0;

      if (ratio > NEED * 0.6){
        const left = Math.max(0, WINDOW - total) + (ratio > NEED ? 0 : 0.8);
        state.textContent = (full === 2 ? 'Two players' : 'One player') +
                            ` — starting in ${left.toFixed(1)}s`;
        state.style.color = 'var(--good)';
        if (total >= WINDOW * 0.7 && ratio > NEED) done();
      } else {
        /* Decay rather than reset. Detection flickers - a frame where an arm
           crosses the body or the figure blurs drops the landmark confidence -
           and a timer that starts over on every bad frame never finishes even
           though the camera can plainly see someone. */
        state.style.color = 'var(--dim)';
        state.textContent = pose.personCount || ratio > 0.1
          ? 'Almost — step back so your legs are in frame'
          : (pose.mouse.active ? 'No camera. Move the mouse to play.' : 'Looking for you…');
      }
      /* Nobody gets trapped here. If a person has been visible for a while but
         the gate never quite closes, go anyway and say why. */
      if (seenFor > 14){
        state.textContent = 'Close enough — you can always re-calibrate from Settings.';
        done();
      }
    },
    /* The skeleton alone: proof it can see you, which is the only thing this
       screen has to establish. The camera's picture is never shown. */
    draw(c, W, H){
      drawSkeletons(c, W, H, 0.95);
    }
  };
}

export function drawSkeletons(c, W, H, alpha = 0.35){
  for (const p of pose.players){
    if (!p.present || !p.lm) continue;
    c.save();
    c.globalAlpha = alpha;
    c.strokeStyle = p.color; c.fillStyle = p.color;
    c.lineWidth = Math.max(3, H * 0.008); c.lineCap = 'round';
    for (const [a, b] of BONES){
      const A = p.lm[a], B = p.lm[b];
      if ((A.v ?? 1) < 0.35 || (B.v ?? 1) < 0.35) continue;
      c.beginPath(); c.moveTo(A.x * W, A.y * H); c.lineTo(B.x * W, B.y * H); c.stroke();
    }
    for (const i of [15, 16]){
      const k = p.lm[i];
      c.beginPath(); c.arc(k.x * W, k.y * H, Math.max(6, H * 0.016), 0, 6.2832); c.fill();
    }
    c.restore();
  }
}

/* ---------- results and pause: a clean card over the game (decision 0045; the mockup is docs/screens-mockup.html) ---------- */
/* The big buttons carry a picture, so a child who can't read knows which is which: round again, keep playing, home. Each has the hand
   ring (cursor.js fills it, in the colour of whoever waves) and is the one size everywhere. */
const bigButton = (name, label, cls, fn) => onPick(button(`${icon(name)}<span>${label}</span>`, 'cbtn ringed ' + cls), fn);

/* a card, flat white, over the game: the small kicker, then what it has to say */
function card(cls){
  const s = screen(cls + ' gamecard');
  const c = h('div', 'gcard');
  s.appendChild(c);
  return { s, c };
}

/* After the round's own ending: what everyone did together, then the way on. The ending scene stays in view behind - the bouquets, the
   lanterns, the sky full of pictures - with a card on the left: the count big with the game's painted icon, "New best!" if there is
   one, and Play again and Home. Each child's face, name and count sits in seat order along the bottom (never a ranking, no winner).
   back: where the other button goes ('Home', or 'Back to Create' for a game being tried).
   summary: { line, best } (the friendly line, for a game that says it its own way); extra: { total, kids: [{ i, name, look, value, color }] }. */
export function results(game, onAgain, onMenu, back = 'Home', summary = null, extra = null){
  const { s, c } = card('end');
  s.style.setProperty('--accent', game.accent);
  const kick = h('div', 'gk');
  kick.append(game.passive ? 'The end' : 'Well played!');
  if (summary && summary.best){
    const b = h('span', 'newbest'); b.append(propIcon('star', 96, {}, 'bestico'), 'New best!'); kick.appendChild(b);
  }
  c.appendChild(kick);
  const total = extra && Number.isFinite(extra.total) && extra.total > 0 ? Math.round(extra.total) : 0;
  if (total && !game.passive){
    const big = h('div', 'gbig'); big.setAttribute('data-nocursor', '');       /* (a hand's ring or mitt is never drawn over the count) */
    const [prop, opts] = game.prop || GAME_PROP[game.id] || [];
    big.appendChild(prop ? propIcon(prop, 240, opts || {}, 'gico') : looks({ id: game.id, icon: game.store && game.store.icon }).icon('gico sicon'));
    const num = h('b'); num.textContent = String(total);
    const words = h('span'); resultWords(game, total).forEach((w, i) => { if (i) words.appendChild(document.createElement('br')); words.append(w); });
    big.append(num, words); c.appendChild(big);
    if (summary && summary.line && summary.line.length > 0 && !/^(You|Together you) got /.test(summary.line)){ const l = h('p', 'gline'); l.textContent = summary.line; c.appendChild(l); }
  } else if (summary && summary.line){ const l = h('p', 'gline big'); l.textContent = summary.line; c.appendChild(l); }
  const row = h('div', 'btnrow');
  row.append(bigButton('again', game.passive ? 'Read again' : 'Play again', 'go', onAgain));
  /* a game the family made (0057): Change it, between Play again and Home - the builder again on that game */
  if (extra && typeof extra.change === 'function') row.appendChild(bigButton('pencil', 'Change it', 'ghost', extra.change));
  row.appendChild(bigButton('house', back, 'ghost', onMenu));
  c.appendChild(row);
  /* each child: their face, name and count */
  const kids = extra && extra.kids || [];
  if (kids.length){
    const crewEl = h('div', 'gkids'); crewEl.setAttribute('data-n', String(Math.min(4, kids.length)));
    for (const k of kids){
      const pill = h('div', 'gkid'); pill.style.setProperty('--c', k.color);
      const face = h('span', 'gkface'); face.appendChild(faceOf({ look: k.look }, 96));
      const nm = h('span', 'gkname'); nm.textContent = k.name;
      const txt = h('span', 'gktext'); txt.appendChild(nm);
      if (k.value != null){ const n = h('b'); n.textContent = String(Math.round(k.value)); txt.appendChild(n); }
      pill.append(face, txt);
      crewEl.appendChild(pill);
    }
    s.appendChild(crewEl);
  }
  sfx.fanfare();
  /* a weekly challenge this round moved (0051): one compact line under the buttons, added when the server has said (so it never moves them) */
  const chNews = h('div', 'chnews'); c.appendChild(chNews);
  let stopNews = () => {};
  return { tick(){}, draw(){}, news(moves){ stopNews(); chNews.textContent = ''; stopNews = showNews(chNews, moves); }, leave(){ stopNews(); } };
}

/* ---------- pause ---------- */
/* A card on the left, the paused game visible beside it: "Paused", the game's name, the time left, "Who's who?" (main.js puts it in the
   .pwho slot), and the big Keep playing and Home buttons with the hand ring. Cubo holds still on the right.
   left: seconds left in the round (none for an endless game). */
export function pauseOverlay(game, left, onResume, onQuit, back = 'Home'){
  const line = left == null || !isFinite(left) ? '' : `${Math.floor(left / 60)}:${String(Math.max(0, Math.floor(left % 60))).padStart(2, '0')} left`;
  const { s, c } = card('dim pause');
  s.style.setProperty('--accent', game.accent);
  c.append(h('div', 'gk', 'Paused'));
  const title = h('h3'); title.textContent = game.name; c.appendChild(title);
  if (line){ const p = h('p', 'gleft'); p.textContent = line; c.appendChild(p); }
  c.appendChild(h('div', 'pwho'));
  const row = h('div', 'btnrow');
  row.append(bigButton('play', 'Keep playing', 'go', onResume), bigButton('house', back, 'ghost', onQuit));
  c.appendChild(row);
  const hero = h('div', 'gbcubo'); s.appendChild(hero); cubo(hero, { pose: 'freeze' });      /* Cubo holds still */
  return s;
}

/* ---------- lost player ---------- */
/* A picture first - a child stepping into the camera's frame - for the
   ones who can't read, and one short line for the ones who can. */
const STEP_IN = '<svg viewBox="0 0 120 120" aria-hidden="true">' +
  '<rect x="10" y="10" width="100" height="100" rx="18" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="14 10"/>' +
  '<g class="kid"><circle cx="60" cy="38" r="11" fill="currentColor"/>' +
  '<path d="M60 52v26M60 60l-16 10M60 60l16 10M60 78l-11 20M60 78l11 20" stroke="currentColor" stroke-width="7" stroke-linecap="round" fill="none"/></g></svg>';
export function lostOverlay(){
  const s = screen('dim lost');
  s.append(h('div', 'stepin', STEP_IN));
  s.append(h('p', 'lede', 'Step back into view - the game carries on when it can see you.'));
  return s;
}

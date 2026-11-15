/* The line-up: once a session, before the first game, the family's avatars
   in a row and one called at a time - "Ellie - wave!" - and whoever waves
   is Ellie. Each player on camera shows as a soft shape, with a "?" over
   their head until they're someone, then their avatar's face.

   It's over when everyone on camera is someone, or everyone's been called
   ("Not here" skips one; nobody waving for a while skips them too), or on
   "Let's play" at any time. Anyone left over plays as a guest; the pause
   screen's Who's who? can put it right later.

     lineUp({ profiles, onDone })   a scene: { tick, draw, leave }
     whoRow(profiles)               the pause screen's Who's who?: each
                                    player's face; picking one changes who
                                    they are (round the family, then guest)
     namePop(profile)               "Ellie's back!", for a moment */
import { button, onPick } from './cursor.js';
import { screen, h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { pose, MAX_PLAYERS, PLAYER_COLORS } from '../tracking/pose.js';
import { WaveWatch, handsFrom } from '../tracking/wave.js';
import { silhouette } from './avatars.js';
import { portrait } from './avatar-art.js';
import { faceOf } from './avatar-maker.js';
import { crew, clothesOf } from './crew.js';

/* seconds to wait for someone to wave before moving on to the next name */
export const CALL_FOR = 9;

export function lineUp({ profiles, onDone }){
  const s = screen('lineup');
  const head = h('div', 'luhead');
  const title = h('h1', '', 'Who’s who?');
  const say = h('p', 'lusay', '');
  head.append(title, say);
  const row = h('div', 'lurow');
  const foot = h('div', 'lufoot');
  s.append(head, row, foot);

  const cards = profiles.map(p => {
    const card = h('div', 'lucard');
    const nm = h('div', 'lunm'); nm.textContent = p.name;
    card.append(faceOf(p, 120), nm);
    row.appendChild(card);
    return card;
  });
  const skip = onPick(button('Not here', 'setbtn lubtn'), () => { sfx.select?.(); next(); });
  const go = onPick(button('Let’s play', 'setbtn go lubtn'), () => finish());
  foot.append(skip, go);

  const waves = Array.from({ length: MAX_PLAYERS }, () => new WaveWatch());
  let at = -1, waited = 0, t = 0, done = false;
  crew.clear();

  function next(){
    if (at >= 0 && cards[at]) cards[at].classList.remove('on');
    at++; waited = 0;
    waves.forEach((w, i) => { waves[i] = new WaveWatch(); });
    if (at >= profiles.length){ finish(); return; }
    cards[at].classList.add('on');
    say.textContent = `${profiles[at].name} - wave!`;
  }
  function finish(){
    if (done) return;
    done = true; crew.lined = true;
    sfx.gold?.();
    onDone();
  }
  next();

  const present = () => pose.players.map(p => !!p.present);
  const unseated = () => pose.players.map((p, i) => i).filter(i => pose.players[i].present && crew.of(i) == null);

  return {
    tick(dt){
      if (done) return;
      t += dt; waited += dt;
      crew.step(dt, present(), (i) => clothesOf(pose.video, pose.players[i].lm));
      crew.popped();
      const hands = handsFrom(pose);
      for (const i of unseated()){
        waves[i].step(dt, hands.filter(x => x.who === i));
        if (waves[i].done){
          const p = profiles[at];
          crew.set(i, p.id);
          cards[at].classList.add('got'); cards[at].style.setProperty('--who', (p.look && p.look.color) || PLAYER_COLORS[i]);
          sfx.pop?.(1.2); sfx.select?.();
          /* everyone on camera is someone: off we go */
          if (!unseated().length && pose.players.some(q => q.present)){ setTimeout(finish, 700); cards[at].classList.remove('on'); say.textContent = 'Everyone’s here!'; return; }
          next();
          return;
        }
      }
      if (waited > CALL_FOR) next();
    },
    draw(c, W, H){
      c.fillStyle = '#eee9db'; c.fillRect(0, 0, W, H);
      pose.players.forEach((p, i) => {
        if (!p.present || !p.lm) return;
        const id = crew.of(i), prof = id && profiles.find(q => q.id === id);
        const col = (prof && prof.look && prof.look.color) || '#b9b4a6';
        silhouette(c, p.lm, W, H, col, prof ? 0.55 : 0.35);
        const nose = p.lm[0], sz = Math.max(48, H * 0.11);
        const x = nose.x * W, y = nose.y * H - sz * 1.1;
        if (prof && prof.look) portrait(c, x, y, sz, prof.look, t);
        else {
          c.fillStyle = '#ffffff'; c.beginPath(); c.arc(x, y, sz / 2, 0, Math.PI * 2); c.fill();
          c.fillStyle = prof ? '#3b3a36' : '#8a8478'; c.font = `700 ${Math.round(sz * 0.5)}px Inter, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(prof ? prof.name.slice(0, 1) : '?', x, y + 2);
        }
        /* how far into their wave they are */
        const m = waves[i].meter;
        if (!prof && m > 0){ c.strokeStyle = '#6d5efc'; c.lineWidth = 6; c.beginPath(); c.arc(x, y, sz / 2 + 8, -Math.PI / 2, -Math.PI / 2 + m * Math.PI * 2); c.stroke(); }
      });
    },
    leave(){ s.remove(); }
  };
}

export function whoRow(profiles){
  const wrap = h('div', 'whorow');
  const label = h('div', 'whorowlbl', 'Who’s who? Pick a face to change it');
  const row = h('div', 'whochips');
  wrap.append(label, row);
  const draw = () => {
    row.innerHTML = '';
    pose.players.forEach((p, i) => {
      if (!p.present) return;
      const prof = crew.profileOf(i);
      const b = onPick(button(`<span class="av">?</span><span class="nm"></span>`, 'whochip2'), () => {
        /* round the family (not anyone already someone else), then guest */
        const ids = [...profiles.map(q => q.id), null];
        let k = ids.indexOf(crew.of(i));
        for (let n = 0; n < ids.length; n++){
          k = (k + 1) % ids.length;
          const id = ids[k];
          if (id == null || crew.playerOf(id) == null){ crew.set(i, id); break; }
        }
        sfx.select?.(); draw();
      });
      b.querySelector('.nm').textContent = prof ? prof.name : 'Guest';
      b.style.setProperty('--who', crew.colorOf(i, PLAYER_COLORS[i]));
      if (prof && prof.look) b.querySelector('.av').replaceWith(faceOf(prof, 64));
      row.appendChild(b);
    });
    if (!row.children.length) wrap.style.display = 'none';
  };
  draw();
  return wrap;
}

export function namePop(profile){
  const s = screen('namepop');
  const card = h('div', 'namecard');
  const nm = h('span', '', ''); nm.textContent = `${profile.name}’s back!`;
  card.append(faceOf(profile, 72), nm);
  s.appendChild(card);
  sfx.pop?.(1.3);
  setTimeout(() => s.classList.add('out'), 2200);
  setTimeout(() => s.remove(), 2700);
}

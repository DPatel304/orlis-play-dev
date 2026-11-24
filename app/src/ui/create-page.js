/* The Create tab (decisions 0057, 0060): kids and grown-ups alike make games here (no AI, no waiting), with their bodies and Cubo as the guide.
   One page, two views:

     the start  Cubo waves you in ("Raise both arms to start") over the family's three slots (ui/create-home.js)
     the steps  Cubo's Create: Where, the game, What, Rules, Name, with Cubo guiding each (ui/cubo-create.js; the steps are create/cubo-flow.js)

   The last step saves the game into a slot (create/creations.js: the family's server, with a copy kept on this TV) and plays it full screen like
   any game. After its results: Play again, Change it (Cubo's Create again at Where, on that game's picks, saving back into the same slot) and Home.
   Create Pro (grown-up creators, Claude Code) is another page (ui/create.js), still paused for everyone else.

   createMakePage({ nav, onPlay(game), onWho, onRecalibrate, edit: the id of a game to change }) -> the page's scene. */
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { sfx } from '../audio/sound.js';
import { account } from './account.js';
import { topBar } from './tabs.js';
import { icon } from './brand.js';
import { toast } from './toast.js';
import { faceOf } from './avatar-maker.js';
import { openProfileSheet } from './menu.js';
import { launch } from './launch.js';
import { appMode } from './mode.js';
import { tabsFor } from './home-model.js';
import { PAPER } from './boot.js';
import { remote } from './remote.js';
import { createHome } from './create-home.js';
import { cuboCreate, BACK_KEYS } from './cubo-create.js';
import { framingCheck } from './framing-check.js';
import { frameOf } from './framing.js';
import { pose } from '../tracking/pose.js';
import { creations } from '../create/creations.js';
import { FULL_LINE } from '../create/slots.js';
import { madeGame, madeCover } from '../create/made-game.js';

/* a saved game, played now: the loading cover, then the shell takes it like any game */
export function playMade(c, onPlay){
  const g = madeGame(c);
  try { launch.begin({ url: madeCover(c, 960, 600, { title: true }), name: g.name, blurb: g.store.blurb }); } catch {}
  onPlay(g);
}

export function createMakePage({ nav = {}, onPlay = () => {}, onWho, onRecalibrate, edit = null } = {}){
  clearUI();
  const s = screen('tvhome createpage cmake');
  const stage = h('div', 'cstage');
  s.appendChild(stage);
  const bar = topBar('create', nav, { tabs: tabsFor({ waiting: account.waiting, creatorApp: appMode.creator(), modeTabs: appMode.tabs() }) });
  stage.appendChild(bar.el);
  const scene = {
    tick(dt){
      if (check){ check.tick(dt); return; }
      bar.tick(dt);
      if (home) home.tick(dt);
      if (studio) studio.tick(dt);
    },
    draw(c, W, H){
      if (check && check.draw){ check.draw(c, W, H); return; }
      c.fillStyle = PAPER; c.fillRect(0, 0, W, H);
      if (studio && studio.active) studio.draw(c, W, H);
    },
    leave(){ end(); removeEventListener('keydown', keys, true); }
  };

  /* waiting to be let in: Create opens then */
  if (account.waiting){
    const c = h('section', 'cnotice');
    c.append(h('div', 'cnico', icon('clock')), h('h1', '', 'Pending approval'), h('p', '', 'The owner has been told. As soon as they say yes, Create and Discover open up here by themselves.'), h('p', '', 'Meanwhile, the starter games are on Home.'));
    stage.appendChild(c);
    return scene;
  }

  /* the profile face, top right: Profile, Settings, Sign out (as on Home) */
  const me = button('', 'hme');
  me.querySelector('.lbl').replaceWith(h('span', 'hface'));
  me.querySelector('.hface').appendChild(faceOf(account.current || {}, 160, { tile: false, bare: true }));
  me.setAttribute('aria-label', account.current ? `${account.current.name}: profile, settings` : 'Menu');
  let sheet = null;
  onPick(me, () => { if (sheet) return; sfx.select(); sheet = openProfileSheet({ onRecalibrate, onWho, onChanged: () => {}, onClosed: () => { sheet = null; } }); });
  const sys = h('div', 'csys'); sys.appendChild(me);
  stage.appendChild(sys);

  const body = h('div', 'cview');
  stage.appendChild(body);
  let home = null, studio = null, gone = false, check = null;
  const say = (text, bad = false) => toast(text, { bad });

  function end(){ gone = true; if (check){ try { check.leave && check.leave(); } catch {} check = null; } if (studio){ studio.dispose(); studio = null; } if (home) home.closePop(); }
  function showHome(){
    if (studio){ studio.dispose(); studio = null; }
    body.innerHTML = '';
    home = createHome({
      items: creations.items, say,
      onMake: () => begin(),
      onPlay: (c) => playMade(c, onPlay),
      onChange: (c) => showSteps(c),
      onRemove: async (c) => { await creations.remove(c.id); home.update(creations.items); say(`${c.name} is removed`); }
    });
    body.appendChild(home);
    bar.el.classList.remove('hide'); sys.classList.remove('hide');
    /* Cubo's Create waits on the start screen for both arms (or OK on the remote) */
    startSteps(null);
    if (document.body.classList && document.body.classList.contains('remote')) remote.mark(home.querySelector('.chero'));
  }
  /* the steps: on the start screen the flow waits; once it leaves Start the home is hidden and Cubo's Create has the whole screen */
  function startSteps(creation){
    if (studio){ studio.dispose(); studio = null; }
    studio = cuboCreate({
      creation, full: creations.full, say,
      onPlay: (saved) => { if (!gone) playMade(saved, onPlay); },
      onExit: () => { if (creation || !home) showHome(); else studio.event({ t: 'back' }); },
      onFull: () => { if (home) home.nope(); say(FULL_LINE); },
      onStart: () => begin(),
      onStep: (step) => {
        const start = step === 'start';
        if (home) home.classList.toggle('hide', !start);
        bar.el.classList.toggle('hide', !start); sys.classList.toggle('hide', !start);
      }
    });
    if (home) studio.useHome(home);
    stage.appendChild(studio);
    studio.start();
  }
  /* "Make a game" (the banner, or OK): Cubo's Create goes on from Start. The camera check comes first if the player is not framed. */
  function begin(){
    if (!studio || studio.step !== 'start') return;
    const p = pose.players[0], lm = p && p.present && p.lm && !pose.mouse.active ? p.lm : null;
    if (lm && !frameOf(lm).ok && !check){
      check = framingCheck({ onDone: () => { if (check){ try { check.leave && check.leave(); } catch {} check = null; } if (studio) studio.event({ t: 'ok', force: true }); }, players: 1 });
      return;
    }
    studio.event({ t: 'ok', force: true });
  }
  function showSteps(creation){
    if (home) home.closePop();
    if (home) home.classList.add('hide');
    startSteps(creation);
  }

  /* Back (the remote's, Escape, Backspace): a step back in the studio, then the home page */
  function keys(e){
    if (!BACK_KEYS.includes(e.key) || !s.isConnected || sheet || document.querySelector('.dim:not(.lost)')) return;
    e.preventDefault && e.preventDefault(); e.stopImmediatePropagation && e.stopImmediatePropagation();
    document.body.classList.add('remote'); sfx.back?.();
    if (studio && studio.step !== 'start') studio.event({ t: 'back' });
    else if (nav.home) nav.home();
  }
  addEventListener('keydown', keys, true);

  const was = creations.items;
  showHome();
  /* the family's games as the server has them now (shown again if they changed - not while building) */
  creations.refresh().then((changed) => { if (changed && !gone && home && (!studio || studio.step === 'start')) home.update(creations.items); }, () => {});
  /* "Change it" from the scores: the studio, on that game */
  /* a new grown-up who picked "Make a game" on joining: straight into it */
  const first = !edit && account.state && account.state.firstGame === 'make';
  if (first){ account.set({ firstGame: false }); if (!creations.full) begin(); }
  if (edit){ const c = creations.byId(edit) || was.find(x => x.id === edit); if (c) showSteps(c); }
  return scene;
}

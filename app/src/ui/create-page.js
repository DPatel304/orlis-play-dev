/* The Create tab (decision 0057): kids and grown-ups alike make games here from pictures (no AI, no waiting). Two views on one page:

     the home   a big "Make a game" card, how it works in three pictures, and the family's three slots (ui/create-home.js)
     the studio the six-step builder with the live game beside the choices (ui/create-studio.js)

   Play it! saves the game into a slot (create/creations.js: the family's server, with a copy kept on this TV) and plays it full screen like any
   game. After its results: Play again, Change it (the studio again, on that game's picks, saving back into the same slot) and Home.
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
import { createStudio } from './create-studio.js';
import { creations } from '../create/creations.js';
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
  const scene = { tick(dt){ bar.tick(dt); if (studio) studio.tick(dt); }, draw(c, W, H){ c.fillStyle = PAPER; c.fillRect(0, 0, W, H); },
    leave(){ end(); removeEventListener('keydown', keys, true); } };

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
  let home = null, studio = null, gone = false;
  const say = (text, bad = false) => toast(text, { bad });

  function end(){ gone = true; if (studio){ studio.dispose(); studio = null; } if (home) home.closePop(); }
  function showHome(){
    if (studio){ studio.dispose(); studio = null; }
    body.innerHTML = '';
    home = createHome({
      items: creations.items, say,
      onMake: () => showStudio(null),
      onPlay: (c) => playMade(c, onPlay),
      onChange: (c) => showStudio(c),
      onRemove: async (c) => { await creations.remove(c.id); home.update(creations.items); say(`${c.name} is removed`); }
    });
    body.appendChild(home);
    bar.el.classList.remove('hidden'); sys.classList.remove('hidden');
    if (document.body.classList && document.body.classList.contains('remote')) remote.mark(home.querySelector('.chero'));
  }
  function showStudio(creation){
    if (home) home.closePop();
    body.innerHTML = '';
    studio = createStudio({
      creation, say,
      onBack: showHome,
      onPlay: (saved) => { if (!gone) playMade(saved, onPlay); }
    });
    body.appendChild(studio);
    if (document.body.classList && document.body.classList.contains('remote')) remote.mark(studio.querySelector('.copt.on') || studio.querySelector('.cbtn2'));
  }

  /* Back (the remote's, Escape, Backspace): a step back in the studio, then the home page */
  const BACKS = ['Escape', 'Backspace', 'BrowserBack', 'GoBack', 'Back'];
  function keys(e){
    if (!BACKS.includes(e.key) || !s.isConnected || sheet || document.querySelector('.dim:not(.lost)')) return;
    e.preventDefault && e.preventDefault(); e.stopImmediatePropagation && e.stopImmediatePropagation();
    document.body.classList.add('remote'); sfx.back?.();
    if (studio){ const st = studio.state; if (st.step > 0) studio.goto(st.step - 1); else showHome(); }
    else if (nav.home) nav.home();
  }
  addEventListener('keydown', keys, true);

  const was = creations.items;
  showHome();
  /* the family's games as the server has them now (shown again if they changed - not while building) */
  creations.refresh().then((changed) => { if (changed && !gone && home && !studio) home.update(creations.items); }, () => {});
  /* "Change it" from the scores: the studio, on that game */
  /* a new grown-up who picked "Make a game" on joining: straight into it */
  const first = !edit && account.state && account.state.firstGame === 'make';
  if (first){ account.set({ firstGame: false }); if (!creations.full) showStudio(null); }
  if (edit){ const c = creations.byId(edit) || was.find(x => x.id === edit); if (c) showStudio(c); }
  return scene;
}

import { button, onPick } from './cursor.js';
import { screen, h } from './screens.js';
import { audio, sfx } from '../audio/sound.js';
import { account } from './account.js';
import { appMode } from './mode.js';
import { icon, homeButton } from './brand.js';
import { faceOf } from './avatar-maker.js';
import { openTrustedPhones } from './trusted-phones.js';
import { createTrust } from '../session/trust.js';
import { HANDS, handsMode, setHandsMode } from './handshow.js';
import { testGamesOn, setTestGames } from './testing.js';
import { mayManageGames, openGames } from './mygames.js';

/* What the home page (home.js) and the other pages share: a line about each game, each game's icon and look, what was played lately,
   how many can play, Settings, and the profile sheet behind the profile face. */

/* A line about each game. */
export const BLURB = {
  'pop-party': 'Reach up and pop the balloons before they float away',
  'last-known-position': 'Run, jump and explore a strange planet',
  'castle-defense': 'Build towers together and keep the castle safe',
  'sleepy-bear': 'Dance to the music - then freeze before the bear peeks!',
  'leaf-pile': 'Sweep the autumn leaves into a big pile - then jump in!',
  'stack-it-high': 'Lift big blocks with both hands and build anything you like',
  'sky-painter': 'Paint the sky with your arms - what’s hiding there?',
  'animal-gym': 'Move like the animals: stretch, hop, flap, squat and stomp',
  'keep-it-up': 'Keep the big beach ball floating up together',
  'ptero-flight': 'Spread your arms like wings and glide over a world of dinosaurs',
  'save-the-harvest': 'Pick the fruit before the cheeky raven gets it!',
  'peekaboo': 'One hides with the PlayPad, the rest hunt with a lantern!',
  'cubions-long-way-home': 'A funny story about a little cube learning to move.'
};
/* Each game's icon, in the cube's style: a rounded square in two colours,
   a simple white picture on it. */
export const ICONS = {
  'pop-party': { cols: ['#ff7eb3', '#ffa25a'], glyph: 'balloon' },
  'last-known-position': { cols: ['#7fb8c9', '#b4c79a'], glyph: 'rocket' },
  'castle-defense': { cols: ['#10b981', '#a3e635'], glyph: 'tower' },
  'sleepy-bear': { cols: ['#b07a4f', '#f2c48a'], glyph: 'bear' },
  'leaf-pile': { cols: ['#e07b39', '#f2c14e'], glyph: 'leaf' },
  'stack-it-high': { cols: ['#4fb3a8', '#a98bff'], glyph: 'blocks' },
  'sky-painter': { cols: ['#5b8fd6', '#9fd8e6'], glyph: 'brush' },
  'animal-gym': { cols: ['#34b27b', '#ffd35c'], glyph: 'paw' },
  'keep-it-up': { cols: ['#4da3ff', '#ff7eb3'], glyph: 'ball' },
  'ptero-flight': { cols: ['#e0915b', '#6fc3c0'], glyph: 'wing' },
  'save-the-harvest': { cols: ['#e0603a', '#ffd35c'], glyph: 'apple' },
  'cubions-long-way-home': { cols: ['#7b6cf6', '#f2b8ff'], glyph: 'book' }
};
const GLYPHS = {
  balloon: '<path d="M50 14c15 0 25 11 25 26 0 17-14 30-25 33-11-3-25-16-25-33 0-15 10-26 25-26z" fill="#fff"/><path d="M46 73h8l-4 6z" fill="#fff"/><path d="M50 79c-5 6 5 9 0 16" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="41" cy="31" rx="5" ry="8" transform="rotate(-25 41 31)" fill="#000" opacity=".12"/>',
  rocket: '<path d="M50 10c11 9 16 24 16 40 0 9-2 17-5 24H39c-3-7-5-15-5-24 0-16 5-31 16-40z" fill="#fff"/><circle cx="50" cy="40" r="7" fill="#000" opacity=".16"/><path d="M34 56l-11 16 13-3zM66 56l11 16-13-3z" fill="#fff"/><path d="M43 78h14l-7 12z" fill="#fff" opacity=".8"/>',
  boat: '<path d="M18 60h64l-10 16H28z" fill="#fff"/><path d="M50 18v38H24z" fill="#fff"/><path d="M54 26v30h20z" fill="#fff" opacity=".85"/>',
  note: '<ellipse cx="38" cy="72" rx="12" ry="9" transform="rotate(-20 38 72)" fill="#fff"/><path d="M47 70V20l26 8v12l-20-6v36" fill="#fff"/>',
  bear: '<circle cx="30" cy="30" r="11" fill="#fff"/><circle cx="70" cy="30" r="11" fill="#fff"/><ellipse cx="50" cy="55" rx="30" ry="27" fill="#fff"/><ellipse cx="50" cy="66" rx="12" ry="9" fill="#000" opacity=".14"/><path d="M36 50q4-4 8 0M56 50q4-4 8 0" stroke="#000" stroke-opacity=".35" stroke-width="3" fill="none" stroke-linecap="round"/>',
  leaf: '<path d="M22 74C22 40 46 20 80 20c0 34-20 58-54 58z" fill="#fff"/><path d="M24 76L66 34" stroke="#000" stroke-opacity=".18" stroke-width="4" stroke-linecap="round"/>',
  blocks: '<rect x="30" y="58" width="40" height="24" rx="6" fill="#fff"/><rect x="34" y="36" width="32" height="22" rx="6" fill="#fff" opacity=".9"/><rect x="38" y="16" width="24" height="20" rx="5" fill="#fff" opacity=".8"/>',
  brush: '<path d="M70 14l16 16-30 30-16-16z" fill="#fff"/><path d="M38 46l16 16c-4 12-14 20-30 22 2-16 8-30 14-38z" fill="#fff" opacity=".85"/>',
  paw: '<ellipse cx="50" cy="64" rx="20" ry="16" fill="#fff"/><ellipse cx="26" cy="46" rx="8" ry="11" fill="#fff"/><ellipse cx="42" cy="32" rx="8" ry="11" fill="#fff"/><ellipse cx="58" cy="32" rx="8" ry="11" fill="#fff"/><ellipse cx="74" cy="46" rx="8" ry="11" fill="#fff"/>',
  apple: '<path d="M50 30c-14-10-32-2-32 20 0 20 14 36 24 36 4 0 6-2 8-2s4 2 8 2c10 0 24-16 24-36 0-22-18-30-32-20z" fill="#fff"/><path d="M50 30c0-10 4-18 12-22" stroke="#fff" stroke-width="6" fill="none" stroke-linecap="round"/><ellipse cx="36" cy="48" rx="5" ry="9" transform="rotate(20 36 48)" fill="#000" opacity=".12"/>',
  book: '<path d="M50 28c-9-8-22-10-34-7v52c12-3 25-1 34 7 9-8 22-10 34-7V21c-12-3-25-1-34 7z" fill="#fff"/><path d="M50 28v52" stroke="#000" stroke-opacity=".18" stroke-width="3"/>',
  wing: '<path d="M50 52C40 36 22 30 8 34c10 4 16 12 18 22 6-6 14-8 24-4zM50 52c10-16 28-22 42-18-10 4-16 12-18 22-6-6-14-8-24-4z" fill="#fff"/><ellipse cx="50" cy="58" rx="7" ry="14" fill="#fff"/><path d="M46 44l4-16 4 16z" fill="#fff"/>',
  ball: '<circle cx="50" cy="50" r="34" fill="#fff"/><path d="M50 16v68M16 50h68M26 26l48 48M74 26L26 74" stroke="#000" stroke-opacity=".16" stroke-width="4" fill="none"/><circle cx="50" cy="50" r="7" fill="#000" opacity=".14"/>',
  tower: '<path d="M30 30h8v-8h8v8h8v-8h8v8h8v14H30z" fill="#fff"/><path d="M34 44h32v36H34z" fill="#fff"/><path d="M45 80V64a5 5 0 0 1 10 0v16z" fill="#000" opacity=".15"/>'
};
/* A game's icon: its own, or the one its Store entry gave it (a picture
   drawn in simple shapes - anything that could run code is turned away). */
const safeSvg = (svg) => typeof svg === 'string' && svg.length < 4000 && !/<\s*script|\bon\w+\s*=|javascript:|<\s*foreign|href/i.test(svg) ? svg : null;
export const iconOf = (g) => ICONS[g.id]
  || (g.store && g.store.icon && { cols: g.store.icon.cols.length === 2 ? g.store.icon.cols : [g.accent, g.accent], glyph: 'balloon', svg: safeSvg(g.store.icon.glyph) })
  || { cols: [g.accent, g.accent], glyph: 'balloon' };
export { GLYPHS };

/* A game's look - in the Store, and on Home: its icon, and its art - the icon's colours,
   big and soft, with its picture - for anywhere it isn't playing itself. */
export function looks(g){
  const ic = iconOf({ id: g.id, accent: (g.icon && g.icon.cols && g.icon.cols[0]) || '#6d5efc', store: { icon: g.icon || { cols: [] } } });
  const glyph = ic.svg || GLYPHS[ic.glyph] || GLYPHS.balloon;
  const icon = (cls = 'sicon') => {
    const d = h('div', cls, `<svg viewBox="0 0 100 100" aria-hidden="true">${glyph}</svg>`);
    d.style.setProperty('--c1', ic.cols[0]); d.style.setProperty('--c2', ic.cols[1] || ic.cols[0]);
    return d;
  };
  const art = (cls = 'sart') => {
    const d = h('div', cls, `<svg class="g" viewBox="0 0 100 100" aria-hidden="true">${glyph}</svg>`);
    d.style.setProperty('--c1', ic.cols[0]); d.style.setProperty('--c2', ic.cols[1] || ic.cols[0]);
    return d;
  };
  return { icon, art, accent: ic.cols[0] };
}

/* Games kept off the home screen for now (still there, just not shown). */
export const HIDDEN = new Set(['last-known-position', 'castle-defense']);
/* What's been played lately, newest first (Jump back in). */
const RECENT = 'orlis.recent';
export const recent = () => { try { const r = JSON.parse(localStorage.getItem(RECENT)); return Array.isArray(r) ? r : []; } catch { return []; } };
export function played(id){ try { localStorage.setItem(RECENT, JSON.stringify([id, ...recent().filter(x => x !== id)].slice(0, 8))); } catch {} }

/* What Create is, until it's here. */
export const CREATE_SOON = {
  name: 'Create', line: 'Make your own games',
  about: 'Build your own movement games, then play them by moving. Share the ones you like with the family in Discover.'
};

/* The trailer plays at TV shape, TW x TH, and the banner shows the part of
   it the trailer says (anchor: how far down the middle of the view sits). */
const TW = 1440, TH = 810;
let film = null;
export function cover(c, w, h, tr){
  if (!film){ film = document.createElement('canvas'); film.width = TW; film.height = TH; }
  const fc = film.getContext && film.getContext('2d'); if (!fc) return;
  fc.setTransform(1, 0, 0, 1, 0, 0);
  tr.draw(fc, TW, TH);
  const k = w / TW, sh = Math.min(TH, h / k), sy = Math.max(0, Math.min(TH - sh, TH * (tr.anchor ?? 0.5) - sh / 2));
  c.drawImage(film, 0, sy, TW, sh, 0, 0, w, h);
}

/* A picture on its own small canvas, sized to it as laid out. */
export function paint(pic, fn, t, sharp = 2){
  if (!pic.getContext || !pic.getBoundingClientRect) return false;
  const w0 = pic.offsetWidth || pic.getBoundingClientRect().width, h0 = pic.offsetHeight || pic.getBoundingClientRect().height;
  if (!w0) return false;
  const k = Math.min(sharp, devicePixelRatio || 1);
  const w = Math.round(w0 * k), hgt = Math.round(h0 * k);
  if (pic.width !== w || pic.height !== hgt){ pic.width = w; pic.height = hgt; }
  const c = pic.getContext('2d');
  c.setTransform(k, 0, 0, k, 0, 0);
  fn(c, w0, h0, t);
  return true;
}

/* The Windows app's own window, when the game is running inside it. */
const appWindow = () => { const w = typeof window !== 'undefined' && window.__TAURI__ && window.__TAURI__.window; return w && w.getCurrentWindow ? w.getCurrentWindow() : null; };

/* The profile sheet, behind the profile face (top right of Home): who is playing and their family, then Profile ("Who's playing?",
   where a grown-up looks after the family), Settings and Sign out - in the same clean card as the rest. A click outside it closes it
   (or Escape). Returns the layer; onClosed() once it has closed. */
export function openProfileSheet({ onRecalibrate, onWho, onClosed, onChanged } = {}){
  const open = screen('dim hsheetwrap'); open.style.zIndex = 5;
  const card = h('div', 'hsheet');
  const who = account.current, family = account.state && account.state.household && account.state.household.name;
  const head = h('div', 'hshead'), face = h('span', 'hsface'), words = h('div', 'hswords');
  face.appendChild(faceOf(who || {}, 160));
  const nm = h('b'); nm.textContent = who ? who.name : 'Orlis Play'; words.appendChild(nm);
  if (family){ const f = h('span'); f.textContent = family; words.appendChild(f); }
  head.append(face, words); card.appendChild(head);
  const esc = (e) => { if (e.key === 'Escape'){ e.preventDefault(); sfx.back(); shut(); } };
  const shut = () => { if (!open.isConnected) return; open.remove(); removeEventListener('keydown', esc, true); onClosed && onClosed(); };
  addEventListener('keydown', esc, true);
  const item = (name, label, fn, cls = '') => card.appendChild(onPick(button(`${icon(name)}<span>${label}</span>`, 'sheetitem ' + cls), () => { sfx.select(); shut(); fn(); }));
  if (account.signedIn && onWho) item('person', 'Profile', () => onWho());
  item('gear', 'Settings', () => settings(onRecalibrate));
  /* (grown-ups look after the games downloaded to this TV: Remove) */
  if (mayManageGames()) item('tv', 'Games on this TV', () => openGames({ onChanged }));
  if (account.signedIn) item('out', 'Sign out', () => { sfx.back?.(); account.signOut(); location.reload(); });
  /* in the Windows app, a way out */
  const app = appWindow();
  if (app) item('close', 'Exit', () => app.close());
  /* small print: the version, and who's signed in */
  const info = typeof window !== 'undefined' && window.orlisApp;
  const bits = [info ? `Orlis Play ${info.label ? info.label() : info.version}` : '', account.signedIn ? account.state.account.email : ''].filter(Boolean);
  if (bits.length){ const f = h('div', 'hsfoot'); f.textContent = bits.join(' · '); card.appendChild(f); }
  open.appendChild(card);
  open.addEventListener('pointerdown', (e) => { if (e.target === open){ sfx.back(); shut(); } });
  return open;
}

function overlay(){
  const s = screen('dim');
  s.style.zIndex = 5;
  return s;
}


function settings(onRecalibrate){
  /* a full-screen sheet (TV size), the big Home button where the logo sits */
  const s = overlay(); s.classList.add('setscreen', 'setsheet');
  const card = h('div', 'setcard');
  const close = () => { sfx.back?.(); s.remove(); };
  const home = homeButton(close); home.classList.add('close');          /* (the remote's Back presses it) */
  s.appendChild(home);
  const head = h('div', 'sethead');
  head.append(h('h2', '', 'Settings'));
  card.appendChild(head);
  /* one setting a row: its name on the left, its control on the right */
  /* (the Creator app can't play: no volume to set) */
  const NOPLAY = appMode.creator() ? new Set(['Volume', 'Trusted phones']) : new Set();
  const row = (name, ...ctl) => {
    if (NOPLAY.has(name)){ const none = h('div', 'setctl'); return none; }
    if (pending){ card.appendChild(h('div', 'setgroup', pending)); pending = null; }
    const r = h('div', 'setrow');
    const c = h('div', 'setctl'); c.append(...ctl);
    const nm = h('span', 'setname', name);
    if (hint){ nm.appendChild(h('span', 'sethint', hint)); hint = null; }        /* (one plain line under the name, set just before the row) */
    r.append(nm, c);
    card.appendChild(r);
    return c;
  };
  const small = (label, fn, cls = '') => onPick(button(label, 'setbtn ' + cls), fn);
  /* a small heading over a few rows (not in the Creator app, where there's nothing to group yet) */
  let pending = null, hint = null;
  const group = (title) => { pending = title; };   /* (its heading comes with its first row: none for a group with nothing in it) */

  /* sound */
  const sl = document.createElement('input');
  sl.type = 'range'; sl.min = 0; sl.max = 1; sl.step = 0.05; sl.value = audio.volume; sl.className = 'setslider';
  /* what it is set to, in words beside it (for the remote, which moves it in steps: remote.js) */
  const val = h('span', 'setval');
  const shown = () => { val.textContent = audio.muted ? 'Off' : Math.round(audio.volume * 100) + '%'; };
  sl.addEventListener('input', () => { audio.setVolume(+sl.value); shown(); });
  sl.setAttribute('aria-label', 'Volume');
  /* the speaker beside the bar is the mute: crossed out when it's off */
  const SPEAKER = '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9H4z"/>';
  const speakerIcon = (muted) => SPEAKER + (muted ? '<path d="M17 9l5 6M22 9l-5 6"/>' : '<path d="M16.5 9a4 4 0 0 1 0 6"/><path d="M19 6.5a8 8 0 0 1 0 11"/>') + '</svg>';
  const mute = small(speakerIcon(audio.muted), () => {
    const m = audio.toggleMute();
    mute.querySelector('.lbl').innerHTML = speakerIcon(m);
    mute.setAttribute('aria-label', m ? 'Unmute' : 'Mute'); sl.classList.toggle('off', m); shown();
  }, 'spk');
  mute.title = 'Mute'; mute.setAttribute('aria-label', audio.muted ? 'Unmute' : 'Mute'); sl.classList.toggle('off', audio.muted);
  group('Sound');
  shown();
  row('Volume', mute, sl, val);

  group('Screen');
  /* the screen: in the Windows app, a window or Big Picture (full screen,
     for the TV), kept for next time; in a browser, its own full screen */
  const display = typeof window !== 'undefined' && window.orlisDisplay;
  if (display){
    const seg = h('div', 'seg');
    const modes = [['window', 'Window'], ['bigpicture', 'Big Picture']];
    const mark = () => modes.forEach(([m], i) => seg.children[i].classList.toggle('chosen', display.mode === m));
    for (const [m, name] of modes){
      seg.appendChild(small(name, async () => {
        if (display.mode === m) return;
        sfx.select();
        try { await display.set(m); } catch (e) {}
        mark();
      }, 'mode'));
    }
    mark();
    row('Display', seg, h('span', 'keyhint', 'F11'));
  } else row('Display', small('Full screen', () => toggleFullscreen()));

  /* the app: its version and updates */
  group('App');
  /* a newer version (the Windows app): picked once it checks, picked again it installs and restarts on it */
  const appInfo = typeof window !== 'undefined' && window.orlisApp;
  if (appInfo){
    let next = null, busy = false;
    const up = small('Check for updates', async () => {
      if (busy) return;
      const say = (t) => { up.querySelector('.lbl').textContent = t; };
      busy = true; sfx.select();
      try {
        if (next){ say('Updating…'); await appInfo.installUpdate(); }
        else {
          say('Checking…');
          const r = await appInfo.checkUpdate();
          if (r.available){ next = r.version; say(`Update to ${appInfo.nameOf ? appInfo.nameOf(next) : next}`); }
          else say('Up to date');
        }
      } catch (e){ next = null; say('Couldn\'t check - try later'); }
      busy = false;
    });
    row('Updates', up, h('span', 'keyhint', `Orlis Play ${appInfo.label ? appInfo.label() : appInfo.version}`));
  }

  /* phones that joined a game before (grown-ups: the list, and Remove) */
  group('Phones');
  const phones = createTrust().list().length;
  row('Trusted phones', h('span', 'keyhint', phones ? `${phones} phone${phones === 1 ? '' : 's'}` : 'none yet'), small('See the list', () => { sfx.select?.(); openTrustedPhones(); }));

  /* testing only */
  group('Testing');
  /* the mode, for testing (a build that was told its mode has no switch) */
  if (appMode.canSwitch()){
    const seg = h('div', 'seg');
    const modes = [['player', 'Player'], ['creator', 'Creator']];
    const mark = () => modes.forEach(([m], i) => seg.children[i].classList.toggle('chosen', appMode.get() === m));
    for (const [m, name] of modes){
      seg.appendChild(small(name, () => {
        if (appMode.get() === m) return;
        sfx.select(); appMode.set(m); s.remove();
      }, 'mode'));
    }
    mark();
    row('Mode', seg);
  }

  /* how hands show on screen, for trying (H while playing does the same) */
  if (account.role === 'owner'){
    const seg = h('div', 'seg');
    const mark = () => HANDS.forEach(([m], i) => seg.children[i].classList.toggle('chosen', handsMode() === m));
    for (const [m, name] of HANDS) seg.appendChild(small(name, () => { sfx.select?.(); setHandsMode(m); mark(); }, 'hands'));
    mark();
    row('Hands on screen', seg);
    /* the test games (Peekaboo Garden's 3D test, the phone stick's pad test) stay out of My library unless this is on */
    const tseg = h('div', 'seg'), TG = [[false, 'Hidden'], [true, 'Shown']];
    const tmark = () => TG.forEach(([v], i) => tseg.children[i].classList.toggle('chosen', testGamesOn() === v));
    for (const [v, name] of TG) tseg.appendChild(small(name, () => { if (testGamesOn() === v) return; sfx.select?.(); setTestGames(v); s.remove(); }, 'hands'));
    tmark();
    hint = 'Adds the 3D and phone-stick test games to My library.';
    row('Test games', tseg);
  }

  s.appendChild(card);
  /* a click outside the card closes it */
  s.addEventListener('pointerdown', (e) => { if (e.target === s) close(); });
}

export function toggleFullscreen(){
  /* the Windows app: Big Picture (the whole window full screen, no title
     bar) and back to a window - never the page alone, which left the window
     and its title bar as they were */
  if (typeof window !== 'undefined' && window.orlisDisplay){
    window.orlisDisplay.set(window.ORLIS_DISPLAY === 'bigpicture' ? 'window' : 'bigpicture').catch?.(() => {});
    return;
  }
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.().catch(() => {});
}

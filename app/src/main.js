import './old-names.js';   /* (first: the old Astra Park settings, moved to their Orlis names) */
import { week } from './ui/week.js';
import { launch } from './ui/launch.js';
import { toast } from './ui/toast.js';
import { pose } from './tracking/pose.js';
import { appMode } from './ui/mode.js';
import { renderScale } from './tracking/budget.js';
import { cursor, inFront } from './ui/cursor.js';
import { menu, toggleFullscreen, openSettings, played as playedLately } from './ui/menu.js';
import { remote, typing } from './ui/remote.js';
import { account, welcome } from './ui/account.js';
import { installTitlebar, titlebarPlaying } from './ui/titlebar.js';
import { library } from './ui/library.js';
import { storePage } from './ui/store.js';
import { createPage } from './ui/create.js';
import { outbox } from './ui/outbox.js';
import { boot as bootShow } from './ui/boot.js';
import { calibration, results, pauseOverlay, lostOverlay,
         clearUI, drawSkeletons, screen, h } from './ui/screens.js';
import { audio, music, sfx, ambience } from './audio/sound.js';
import { voice } from './audio/voice.js';
import { scores } from './games/common.js';
import { byId } from './games/index.js';
import { PLAYER_COLORS, MAX_PLAYERS } from './tracking/pose.js';
import { crew } from './ui/crew.js';
import { lineUp, whoRow, namePop } from './ui/lineup.js';
import { MAKING } from './ui/avatar-maker.js';

const stage = document.getElementById('stage');
const c = stage.getContext('2d');
const video = document.getElementById('cam');
const over = document.getElementById('over');
const oc = over.getContext('2d');

let W = 0, H = 0, dpr = 1;
function resize(){
  W = innerWidth; H = innerHeight;
  dpr = renderScale(W, H, devicePixelRatio || 1);
  stage.width = Math.round(W * dpr); stage.height = Math.round(H * dpr);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  over.width = stage.width; over.height = stage.height;
  oc.setTransform(dpr, 0, 0, dpr, 0, 0);
}
addEventListener('resize', resize); resize();

/* ---------- router ---------- */
let scene = null, mode = 'boot';
let game = null, inst = null, players = 1, roundLeft = 0, played = 0;
let paused = null, lost = null, handsUp = 0, empty = 0, joined = new Set();

/* The camera's on only where it's used: a game, its scores (a wave picks
   "again"), and the camera check. Everywhere else - the intro, signing in,
   the home screen - it's off: no light, and no work for the laptop. */
const CAMERA = new Set(['starting', 'lineup', 'play', 'outro', 'results', 'calibrate']);
/* The pages that are the mouse's and the keyboard's: Home, the Store,
   Create, and signing in. */
const HOMEY = new Set(['menu', 'store', 'create', 'pro', 'who']);

/* The pages that crossfade into each other (the tabs have their own slide) */
const FADEY = new Set(['menu', 'store', 'create', 'pro', 'who', 'results']);
const TABBY = new Set(['menu', 'store', 'create', 'pro']);
const INTO_GAME = new Set(['starting', 'lineup', 'play']);
/* (?fx=0 turns the page fades off - the rehearsals read the page, and two pages at once would confuse them) */
const NOFX = /[?&]fx=0\b/.test(location.search);
function go(next, build){
  /* (looking for everyone again, except in a round, which looks for its players) */
  if (next !== 'play') pose.look();
  /* (a page with something to tidy away first - the Store's previews) */
  if (scene && scene.leave) scene.leave();
  const was = mode;
  /* the old page stays a moment, fading out under the new one fading in */
  const ui = document.getElementById('ui');
  const ghosts = ui && !NOFX && FADEY.has(was) && FADEY.has(next) && !(TABBY.has(was) && TABBY.has(next)) ? [...ui.children] : [];
  if (!INTO_GAME.has(next)) launch.release(true);
  mode = next;
  if (CAMERA.has(next)) pose.wake(); else pose.sleep();
  if (HOMEY.has(next)) updateIfWaiting();
  clearUI();
  cursor.reset();
  /* For now the home screen (and signing in) is the mouse's and the
     keyboard's: hands don't point there. The games still play by moving. */
  cursor.enabled = !HOMEY.has(next);
  titlebarPlaying(next === 'play' || next === 'outro');
  /* (a page can move straight on while it's being made - "Who's playing?"
     with one profile goes on to Home - and then the newer page is the one) */
  const made = build ? build() : null;
  if (mode === next) scene = made;
  if (ghosts.length && ui){
    ghosts.forEach(g => g.classList.add('ghost'));
    ui.prepend(...ghosts);
    ui.classList.add('paging');
    setTimeout(() => { ghosts.forEach(g => g.remove()); ui.classList.remove('paging'); }, 380);
  }
}

/* The menus are quiet: music belongs to playing, so it starts when a game is
   picked and fades away on the way back out. */
function toMenu(arrive = false){
  /* (the Creator app has no Play: its first page is Create) */
  if (appMode.creator()) return toCreate();
  music.stop();
  /* and anything still being said - Nova mid-sentence, lines waiting their
     turn - stops too: the game's over, its voice goes with it */
  voice.hush();
  if (mode === 'results' || mode === 'play' || mode === 'outro') sfx.back();
  pose.keepSitters = false;
  go('menu', () => menu({ onPlay: toGame, onRecalibrate: toCalibration, onWho: () => toWho(false), nav: tabs(), arrive,
    /* (this week's featured games and challenges came in, or changed: shown) */
    onFresh: () => { if (mode === 'menu') toMenu(false); } }));
}
/* The tabs along the top: Home, the Store, Create. */
function tabs(){ return { home: () => toMenu(false), store: toStore, create: toCreate, pro: toPro }; }
function toStore(){
  if (appMode.creator()) return toCreate();
  music.stop(); voice.hush();
  go('store', () => storePage({ nav: tabs(), onPlay: toGame, onChange: () => {}, onWho: () => toWho(false), onRecalibrate: toCalibration }));
}
/* Waiting to be let in (playing the starter games meanwhile): every so
   often, are they in yet? Once they are, it says so, and on a page with
   tabs, that page comes back with everything open. (Mid-game, it waits for
   the next page.) */
setInterval(() => { if (account.waiting) account.refresh(); }, 15000);
addEventListener('orlisletin', () => {
  sfx.gold?.();
  toast('You’re in! Discover and Create are open.', { ms: 5000 });
  if (mode === 'menu') toMenu(false); else if (mode === 'store') toStore(); else if (mode === 'create') toCreate(); else if (mode === 'pro') toPro();
});

function toCreate(){
  go('create', () => createPage({ nav: tabs(), onPlay: toGame, onWho: () => toWho(false), onRecalibrate: toCalibration }));
}
/* the mode was switched (Settings, in a testing build): that mode's first page */
addEventListener('orlismode', (e) => {
  if (e.detail === 'creator') toCreate(); else toMenu(false);
  toast(e.detail === 'creator' ? 'Creator app' : 'Player app', { ms: 2500 });
});
/* Create Pro: making games with Claude Code */
function toPro(){
  go('pro', () => createPage({ pro: true, nav: tabs(), onPlay: toGame, onWho: () => toWho(false), onRecalibrate: toCalibration }));
}

/* The Windows app's way in: find the server and sign in (once), then pick
   who's playing (each time). The profiles are brought up to date quietly,
   if the server's in reach. */
function toWho(arrive, glide = false){
  account.refresh();
  /* (asked for from a page: Back, or Escape, goes to that page again) */
  const PAGES = { menu: () => toMenu(false), store: toStore, create: toCreate, pro: toPro };
  const back = !arrive && PAGES[mode] ? PAGES[mode] : null;
  /* (a new creator who picked "Make my first game": straight to Create, where it's made) */
  go('who', () => welcome(() => (account.state && account.state.firstGame ? toCreate() : toMenu(arrive)), { auto: arrive, glide, onBack: back }));
}

function toCalibration(){
  go('calibrate', () => calibration(toMenu));
}

/* Straight into the game, no instructions or countdown: every round opens
   gently enough to be its own introduction, and the games show rather than
   tell. Every game has room for four, and whoever is there plays: another
   child can step in partway through, and anyone can step out, without
   anything stopping. */
function toGame(g){
  /* (the Creator app can't play games) */
  if (appMode.creator()) return;
  game = g;
  playedLately(g.id);
  ambience.stop();
  players = pose.cap;
  /* The cover the tile opened into stays up while the game gets ready - the
     camera starts underneath it (the first time, a few seconds, while the body
     tracker loads) and nothing is said about it. It's up at least a moment, so
     going in is never a blink. */
  const MIN = launch.el ? 1500 : 0;
  const wait = (ms) => new Promise(r => setTimeout(r, ms));
  const settled = () => wait(Math.max(0, MIN - (performance.now() - launch.at)));
  const begin = () => {
    music.start(game.music);
    lineUpThenPlay();
    setTimeout(() => launch.release(), 150);          /* (the game's there; the cover fades away) */
  };
  if (pose.on || pose.mouse.active && pose.reason === 'debug'){
    settled().then(() => { if (game === g && mode !== 'play') begin(); });
    return;
  }
  go('starting', () => null);
  Promise.all([pose.wake().catch(() => {}), settled()]).then(() => {
    if (mode !== 'starting' || game !== g) return;      /* (went somewhere else meanwhile) */
    begin();
  });
}

/* Who's who, once a session, before the first game: a family of two or
   more lines up (the one playing first); one on their own is simply them. */
function family(){
  const list = (account.signedIn && account.state.profiles) || [];
  const me = account.current;
  return me ? [me, ...list.filter(p => p.id !== me.id)] : list;
}
function lineUpThenPlay(){
  crew.profiles = family(); crew.personal = MAKING;
  /* (while everyone plays as the generic avatars, there's nobody to line up) */
  if (!MAKING || crew.lined || crew.profiles.length < 2){ startRound(); return; }
  go('lineup', () => lineUp({ profiles: crew.profiles, onDone: () => { if (mode === 'lineup') startRound(); } }));
}
/* Each frame of a game: the tracking keeps each child on their player, and
   someone coming back gets their name for a moment. */
function crewTick(dt){
  crew.step(dt, pose.players.map(p => !!p.present));
  if (!crew.lined && crew.profiles.length === 1){
    const i = pose.players.findIndex(p => p.present);
    if (i >= 0){ crew.set(i, crew.profiles[0].id); crew.lined = true; }
  }
  for (const { i } of crew.popped()){ const p = crew.profileOf(i); if (p && MAKING) namePop(p); }
}

function startRound(){
  joined = new Set();
  inst = game.create(players);
  /* A game where squatting is a move keeps players who crouch or sit. */
  pose.keepSitters = !!game.keepSitters;
  pose.look(players);
  /* An endless game has no clock: it runs until it says it's over. */
  roundLeft = game.endless ? Infinity : game.secs;
  played = 0;
  /* (a game that sets its own music level from the start) */
  music.intensity(inst.mood != null ? inst.mood : game.loud ? 0.85 : 0.15);
  go('play', null);
}

/* A game can end on a moment of its own before the scores - Pop Party's
   bouquets - and the shell runs it until it says it's done. */
function endRound(){
  if (inst.outro){ music.intensity(0.25); go('outro', null); return; }
  showResults();
}

/* A round's over (or left): a game being tried from Create hears how it
   went - how long, and anything that went wrong. */
function roundDone(){
  if (!game || !game.onDone || !inst) return;
  const f = game.onDone;
  try { f({ secs: Math.round(played), failed: inst.failed || null }); } catch {}
}

function showResults(){
  roundDone();
  music.intensity(0.2);
  /* Bests are still kept - the menu tiles show them - just not announced. */
  scores.record(game.id, Math.max(1, joined.size), inst.value());
  /* told to the family's server, for this week's challenges (not a game
     being tried out - from Create, or waiting for the owner's OK) */
  if (!game.back && !game.trial) week.played({ gameId: game.id, value: inst.value(), secs: Math.round(played), players: Math.max(1, joined.size) })
    .then((done) => done.forEach((c, i) => setTimeout(() => { sfx.gold?.(); toast(`\u2605 Star earned: ${c.title}`, { ms: 6000 }); }, 900 + i * 1200)), () => {});
  /* (a game being tried goes back where it came from: Create) */
  go('results', () => results(game, () => toGame(game), game.back || toMenu, game.back ? 'Back to Create' : 'All games'));
}

/* ---------- pause by gesture ----------
   Both wrists above the head. It has to be a pose nobody strikes by accident
   mid-game, which is why it is held rather than instant. */
function handsAboveHead(p){
  if (!p.present || !p.lm) return false;
  const head = p.lm[0].y;
  return p.lm[15].y < head - 0.04 && p.lm[16].y < head - 0.04;
}

function checkPause(dt){
  /* Pausing is the remote's Back (or everyone stepping away). Holding both
     hands up pauses only a game that asks for it (pauseHold, in seconds) -
     in most, reaching up is part of play - and a game can say it means
     something else right now (copying a giraffe, say). */
  if (mode !== 'play' || paused || !game.pauseHold || (inst && inst.pausable && !inst.pausable())) { handsUp = 0; return; }
  const any = pose.players.slice(0, players).some(handsAboveHead);
  handsUp = any ? handsUp + dt : 0;
  if (handsUp >= game.pauseHold){ handsUp = 0; openPause(); }
}
function openPause(){
  if (paused) return;
  paused = pauseOverlay(game, game.endless ? null : roundLeft,
    () => { paused.remove(); paused = null; cursor.reset(); },
    () => { paused.remove(); paused = null; roundDone(); (game.back || toMenu)(); },
    game.back ? 'Back to Create' : 'All games');
  /* who's who, to put right a mix-up */
  if (MAKING && crew.profiles.length >= 2) paused.querySelector('.gbtext').appendChild(whoRow(crew.profiles));
  sfx.whoosh();
}

/* The remote's Back: in a game, pause it (Back again carries on); from
   the scores or the camera check, home. */
remote.install(() => {
  if (mode === 'play' && !lost){ if (paused){ paused.remove(); paused = null; cursor.reset(); } else openPause(); }
  else if (mode === 'results' || mode === 'calibrate') toMenu();
});

/* The game waits only when the room is empty - everybody gone for a couple
   of seconds - and carries on the moment anyone is back. */
function checkLost(dt){
  if (mode !== 'play'){ empty = 0; if (lost){ lost.remove(); lost = null; } return; }
  pose.players.forEach((p, i) => { if (p.present) joined.add(i); });
  const anyone = pose.mouse.active || pose.players.some(p => p.present);
  empty = anyone ? 0 : empty + dt;
  if (empty > EMPTY_AFTER && !lost) lost = lostOverlay();
  else if (anyone && lost){ lost.remove(); lost = null; }
}
const EMPTY_AFTER = 2;

/* ---------- HUD ---------- */
function drawHUD(){
  if (mode !== 'play' || !inst) return;
  const hud = inst.hud();
  const pad = Math.max(14, H * 0.03);
  c.textBaseline = 'top';
  /* A cooperative game can keep score privately and show only the clock.
     Otherwise a score for each child who has played this round: the first
     two in the top corners, a third and fourth under them. */
  for (const i of hud.hideScore ? [] : [...joined].filter(i => i < players).sort()){
    const left = i % 2 === 0, row = Math.floor(i / 2);
    c.textAlign = left ? 'left' : 'right';
    const x = left ? pad : W - pad, y = pad + row * H * (hud.showLives ? 0.13 : 0.095);
    c.font = `700 ${Math.round(H * 0.075)}px "Segoe UI Variable Display","Segoe UI",-apple-system,Inter,system-ui,sans-serif`;
    pill(c, x, y, c.measureText(String(hud.score[i])).width, H * 0.075, left ? 'left' : 'right', PLAYER_COLORS[i]);
    c.fillStyle = PLAYER_COLORS[i]; c.fillText(String(hud.score[i]), x, y);
    if (hud.showLives){
      c.font = `600 ${Math.round(H * 0.034)}px "Segoe UI Variable Display","Segoe UI",-apple-system,Inter,system-ui,sans-serif`;
      c.fillText('♥'.repeat(hud.lives[i]) || '—', x, y + H * 0.082);
    }
  }
  /* A game that lasts as long as you hold out has no clock to show. */
  if (hud.hideClock){ c.textAlign = 'start'; c.textBaseline = 'alphabetic'; return; }
  c.textAlign = 'center';
  c.font = `600 ${Math.round(H * 0.062)}px "Segoe UI Variable Display","Segoe UI",-apple-system,Inter,system-ui,sans-serif`;
  const t = Math.max(0, Math.ceil(roundLeft));
  /* Minutes and seconds once a round runs past one; plain seconds below. */
  const clock = t >= 60 ? `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}` : String(t);
  pill(c, W / 2, pad, c.measureText(clock).width, H * 0.062, 'center');
  c.fillStyle = t <= 10 ? '#e11d48' : '#16161d';
  c.fillText(clock, W / 2, pad);
  c.textAlign = 'start'; c.textBaseline = 'alphabetic';
}

/* A game can paint any sky it likes; the numbers on top of it must still
   read from the sofa: white frosted pills, edged in the player's colour. */
function pill(c, x, y, w, h, align, edge = null){
  const px = h * 0.36, left = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  c.save();
  c.shadowColor = 'rgba(20,24,50,.22)'; c.shadowBlur = h * 0.35; c.shadowOffsetY = h * 0.06;
  c.fillStyle = 'rgba(255,255,255,.9)';
  c.beginPath(); c.roundRect(left - px, y - h * 0.14, w + px * 2, h * 1.16, h * 0.58); c.fill();
  c.restore();
  if (edge){ c.strokeStyle = edge; c.lineWidth = Math.max(2, h * 0.06); c.stroke(); }
}

/* ---------- loop ---------- */
let last = 0;
/* Keeping the laptop cool. The body tracking is the heaviest thing here,
   so it only runs where hands do something - not on the home screen or
   while signing in, which are the mouse's and keyboard's. Those screens draw
   30 times a second rather than 60. And with another window in front, almost
   nothing runs: a few frames a second, no tracking, no sound - and a game in
   progress pauses, to carry on when someone's back. */
/* Seconds the owner plays a waiting game before it can be approved (the
   server's TRY_SECS). */
const TRY_SECS = 20;
const CALM = new Set(['boot', 'menu', 'store', 'create', 'pro', 'who', 'starting']);
const HOME_GAP = 1000 / 30 - 2, AWAY_GAP = 250;
let lastFrame = 0, wasAway = false;
function tick(now){
  const away = !inFront();
  if (away !== wasAway){
    wasAway = away;
    audio.away(away);
    if (away && mode === 'play' && !lost) openPause();
  }
  const gap = away ? AWAY_GAP : CALM.has(mode) ? HOME_GAP : 0;
  if (gap && now - lastFrame < gap){ requestAnimationFrame(tick); return; }
  lastFrame = now;
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
  last = now;

  pose.paused = !!paused;
  if (!away && !CALM.has(mode)) pose.update(now, dt);

  /* paper, under the menus; dark under a game while it loads */
  c.fillStyle = mode === 'play' || mode === 'outro' || mode === 'results' || mode === 'starting' ? '#0d0b1a' : '#f3f4f7';
  c.fillRect(0, 0, W, H);

  if (mode === 'play' && inst && !paused && !lost){
    crewTick(dt);
    inst.step(dt, W, H);
    roundLeft -= dt; played += dt;
    /* the owner trying a game that's waiting for their OK: once they've
       played it long enough, the server's told (Approve comes on) */
    if (game.trial && !game.trialSent && played >= TRY_SECS){
      game.trialSent = true;
      account.call('POST', `/api/submissions/${encodeURIComponent(game.trial)}/tried`, { secs: Math.round(played) }).catch(() => { game.trialSent = false; });
    }
    /* The band builds with the round: quiet fingerpicking through the
       opening, then strumming, and a new layer about every minute after,
       until everything - up a key - for the last ten seconds. An endless
       game builds over `secs` and stays there. */
    const done = played;
    /* A game can set the music's size itself, moment to moment; a dance
       party wants its music up from the first beat. */
    if (inst.mood != null) music.intensity(inst.mood);
    else music.intensity(game.loud ? (roundLeft <= 10 ? 1 : 0.85)
      : roundLeft <= 10 ? 1
      : done < 30 ? 0.15
      : 0.2 + 0.72 * Math.min(1, (done - 30) / Math.max(1, game.secs - 40)));
    if (roundLeft <= 0 || inst.over) endRound();
  }
  if (mode === 'outro' && inst && inst.outro(dt, W, H)) showResults();
  if ((mode === 'play' || mode === 'outro' || mode === 'results') && inst) inst.draw(c, W, H);

  /* A scene can navigate during its own tick - the title's wave ends by
     opening the menu - which leaves `scene` null before the draw. Hold the
     reference and check it is still the current one. */
  const live = scene;
  if (live){ live.tick(dt); if (scene === live) live.draw(c, W, H); }

  if (mode === 'play' && showSkeleton) drawSkeletons(c, W, H, 0.22);

  checkPause(dt);
  checkLost(dt);
  cursor.update(dt, document.getElementById('ui'));
  remote.sync();
  drawHUD();
  oc.clearRect(0, 0, W, H);
  if ((mode !== 'play' && mode !== 'outro') || paused || lost) cursor.draw(oc, W, H);
  drawPerf(dt);

  requestAnimationFrame(tick);
}

/* ?perf in the address shows the frame-rate readout from the start, for a
   phone or tablet with no P key to press. */
let showSkeleton = false, showPerf = new URLSearchParams(location.search).has('perf');
let rFps = 0, rN = 0, rAcc = 0;

/* A readout rather than a guess. Pose runs only when the camera hands over a
   new frame, and the games run on their own clock and interpolate between, so
   the two numbers are independent - a low pose rate shows up as a laggy
   cursor long before the picture stutters. */
function drawPerf(dt){
  rAcc += dt; rN++;
  if (rAcc > 0.5){ rFps = rN / rAcc; rN = 0; rAcc = 0; }
  if (!showPerf) return;
  const pad = Math.max(12, H * 0.025), lh = Math.max(16, H * 0.028);
  const rows = [
    'render   ' + rFps.toFixed(0) + ' fps',
    'pose     ' + pose.fps.toFixed(0) + ' fps',
    'inference ' + pose.inferMs.toFixed(1) + ' ms',
    'players  ' + pose.personCount + ' of ' + pose.seenCount + ' seen'
  ];
  c.save();
  c.font = `700 ${Math.round(lh * 0.72)}px ui-monospace, monospace`;
  const w = Math.max(...rows.map(r => c.measureText(r).width)) + pad;
  c.fillStyle = 'rgba(9,7,20,.82)';
  c.fillRect(pad / 2, H - pad / 2 - lh * rows.length - pad / 2, w + pad / 2, lh * rows.length + pad / 2);
  c.textBaseline = 'top';
  rows.forEach((r, i) => {
    const slow = (i === 0 && rFps < 40) || (i === 1 && pose.fps < 12);
    c.fillStyle = slow ? '#ff8a3d' : '#9bffd0';
    c.fillText(r, pad, H - pad / 2 - lh * (rows.length - i) - pad / 4);
  });
  c.restore();
}
addEventListener('keydown', (e) => {
  if (typing(e)) return;
  if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  if (e.key === 'k' || e.key === 'K') showSkeleton = !showSkeleton;
  if (e.key === 'p' || e.key === 'P') showPerf = !showPerf;
});

/* ---------- keep the screen alive ----------
   The camera is the controller, so a whole round can pass without a single
   key or mouse event and the machine decides it is idle. Nobody is sitting at
   the laptop to nudge it - that is the entire point - so the TV blanks in the
   middle of a game. The lock is dropped whenever the tab is hidden, so it has
   to be taken again on the way back. */
let wake = null;
async function holdScreen(){
  if (!('wakeLock' in navigator)) return;
  try { wake = await navigator.wakeLock.request('screen'); }
  catch (e) { wake = null; }        /* refused, or not a secure context */
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !wake) holdScreen();
});

/* ---------- an update found after starting ----------
   The app checks for a newer version as it starts; when GitHub is slow to
   answer, the game opens and the check carries on behind it. If it finds
   one, the update happens on the home screen (or Who's playing) - now, if
   that's where everyone is, or as soon as a round's over - with "Updating
   - back in a moment" while it installs. */
let updateWaiting = false;
function updateIfWaiting(){
  if (!updateWaiting || !window.orlisApp) return;
  updateWaiting = false;
  window.orlisApp.installUpdate().catch(() => {});
}
addEventListener('orlisupdate', () => {
  updateWaiting = true;
  if (HOMEY.has(mode)) updateIfWaiting();
});

/* ---------- boot ---------- */
/* Launching goes the usual way in: the boot show, then the home screen.
   While a game's being worked on, ?dev on the address goes straight into
   it instead - no boot show, no home screen - so each try starts at the
   moment being worked on. */
const START_IN = /[?&]dev\b/.test(location.search) ? 'last-known-position' : null;

/* The boot show, then the front door. (The camera waits for a game.) */
(async function boot(){
  document.title = 'Orlis Play';
  /* the games already downloaded (they run in the sandbox) */
  const libraryReady = account.needed ? library.load() : Promise.resolve();
  installTitlebar();
  const params = new URLSearchParams(location.search), debug = params.has('debug');
  const straight = START_IN && !params.has('home') ? byId(START_IN) : null;
  audio.resume();
  let show = null;
  if (straight) show = { done: true };
  /* (signing in comes next: the cube stays, and glides over beside it) */
  const settle = account.needed && !account.signedIn && !straight;
  if (!straight) go('boot', () => (show = bootShow({ settle })));
  requestAnimationFrame(tick);
  pose.setVideo(video, { forceMouse: debug });
  window.__pose = pose; window.__cursor = cursor; window.__music = music;   /* handles for tests; harmless in play */
  window.__round = () => inst; window.__finish = () => { roundLeft = 0; }; window.__library = library; window.__outbox = outbox;
  holdScreen();
  show.camReady = true;
  await new Promise(res => {
    const wait = () => { if (show.done) res(); else setTimeout(wait, 50); };
    wait();
  });
  await libraryReady;
  /* a creator's games waiting to send: sent by themselves, whenever the
     family's server is in reach */
  if (account.needed){ outbox.sync().catch(() => {}); setInterval(() => outbox.sync().catch(() => {}), 2 * 60 * 1000); }
  /* Straight into the game being worked on; or from the intro to the home
     screen, its tiles flying out of the cube. */
  /* (this week's data first - a moment at most - so the first page already knows about the
     challenge cards, and they come up straight after the logo, with no glimpse of Play) */
  if (account.signedIn) await Promise.race([week.refresh({ force: true }).catch(() => {}), new Promise(r => setTimeout(r, 1500))]);
  if (straight) toGame(straight);
  /* In the Windows app: signed in, and who's playing, first. */
  else if (account.needed) toWho(true, settle);
  else toMenu(true);
})();

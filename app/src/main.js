import './old-names.js';   /* (first: the old Astra Park settings, moved to their Orlis names) */
import './ui/paper-cut.js';   /* (the character's paper-cut edge; see avatar-art.js) */
import { week } from './ui/week.js';
import { deliverRoundNews } from './ui/chnews.js';
import { launch } from './ui/launch.js';
import { toast } from './ui/toast.js';
import { pose } from './tracking/pose.js';
import { appMode } from './ui/mode.js';
import { watchTests } from './ui/tvwatch.js';
import { hud, drawShellHud } from './games/hud.js';
import { figureCard, cardTucker } from './games/figure.js';
import { renderScale } from './tracking/budget.js';
import { cursor, inFront } from './ui/cursor.js';
import { cycleHands, handsName } from './ui/handshow.js';
import { toggleFullscreen, played as playedLately, BLURB } from './ui/menu.js';
import { menu, discoverPage } from './ui/home.js';
import { PAPER } from './ui/boot.js';
import { remote, typing } from './ui/remote.js';
import { account, welcome } from './ui/account.js';
import { smoothness, joinLine } from './ui/smoothness.js';
import { buildReport, gpuName } from './ui/perfreport.js';
import { installTitlebar, titlebarPlaying } from './ui/titlebar.js';
import { library } from './ui/library.js';
import { createPage } from './ui/create.js';
import { boot as bootShow } from './ui/boot.js';
import { calibration, results, pauseOverlay, stillOverlay, lostOverlay,
         clearUI, drawSkeletons } from './ui/screens.js';
import { audio, music, sfx, ambience } from './audio/sound.js';
import { voice } from './audio/voice.js';
import { scores, fxState } from './games/common.js';
import { byId } from './games/index.js';
import { PLAYER_COLORS, MAX_PLAYERS } from './tracking/pose.js';
import { crew } from './ui/crew.js';
import { lineUp, whoRow, namePop } from './ui/lineup.js';
import { MAKING } from './ui/avatar-maker.js';
import { countText } from './ui/units.js';
import { usesPads, createPads, padHub, peopleFrom, skipJoinCard } from './session/pads.js';
import { joinCard } from './ui/join-card.js';
import { framingCheck } from './ui/framing-check.js';
import { screenLight } from './ui/screenlight.js';
import { padWaitPill } from './ui/pause-pill.js';
import { IdleWatch } from './session/idle.js';
import { normalizeLook } from './ui/look.js';

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
let stillUp = false;      /* the "Still there?" card is what `lost` holds (it goes when someone moves, not just when someone is seen) */
const idle = new IdleWatch();
/* Phones (S1): the session for a game that uses them, this round's handle on it for the game, and the "Waiting for <name>'s phone" pill */
let padsRt = null, roundPads = null, padWait = null;
const DEV = !!(import.meta.env && import.meta.env.DEV);

/* The camera's on only where it's used: a game, its scores (a wave picks
   "again"), and the camera check. Everywhere else - the intro, signing in,
   the home screen - it's off: no light, and no work for the laptop. */
const CAMERA = new Set(['starting', 'lineup', 'framing', 'join', 'play', 'outro', 'results', 'calibrate', 'create']);
/* Create is Cubo's Create, made with the body (decision 0060): its camera is on and read each frame, though it still draws at the calm pace, and the
   hands point there (the ring that shows where yours is). */
const BODY_PAGES = new Set(['create']);
/* The pages that are the mouse's and the keyboard's: Home, the Store,
   Create, and signing in. */
const HOMEY = new Set(['menu', 'store', 'create', 'pro', 'who']);

/* The pages that crossfade into each other (the tabs have their own slide) */
const FADEY = new Set(['menu', 'store', 'create', 'pro', 'who', 'results']);
const TABBY = new Set(['menu', 'store', 'create', 'pro']);
const INTO_GAME = new Set(['starting', 'lineup', 'framing', 'join', 'play']);
/* (?fx=0 turns the page fades off - the rehearsals read the page, and two pages at once would confuse them) */
const NOFX = /[?&]fx=0\b/.test(location.search);
/* (the rehearsals and rigs, which pass fx=0, put scripted bodies in front of a game: they skip the framing check, as does ?framing=0) */
const NOFRAMING = NOFX || /[?&]framing=0\b/.test(location.search);
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
  /* (phones stay for the rounds of one game - starting, the join card, playing, the scores - and go with anything else) */
  dropWait();
  if (!PADS_KEEP.has(next)) stopPads();
  /* (a passive game - a story - never turns the camera on: nobody has to do anything) */
  if (CAMERA.has(next)) pose.wake(); else pose.sleep();
  if (game && game.passive && (INTO_GAME.has(next) || next === 'results')) pose.sleep();
  if (HOMEY.has(next)) updateIfWaiting();
  clearUI();
  cursor.reset();
  /* For now the home screen (and signing in) is the mouse's and the
     keyboard's: hands don't point there. The games still play by moving. */
  cursor.enabled = !HOMEY.has(next) || BODY_PAGES.has(next);
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
  /* (the Creator app has no Play: it starts on Create Pro) */
  if (appMode.creator()) return toStart();
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
/* Where the Play and Create tabs, the Discover tile and the pages' Home buttons go. */
function tabs(){ return { home: () => toMenu(false), store: toStore, create: () => toCreate(), pro: toPro }; }
function toStore(){
  if (appMode.creator()) return toStart();
  music.stop(); voice.hush();
  /* Discover: the app store, in Home's own look (0055) */
  go('store', () => discoverPage({ onPlay: toGame, onRecalibrate: toCalibration, onWho: () => toWho(false), nav: tabs(), onFresh: () => { if (mode === 'store') toStore(); } }));
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

/* the Creator app's first page: Create Pro (for a grown-up creator), else Create */
function toStart(){
  if (account.signedIn && !account.isKid && ['creator', 'owner'].includes(account.role)) toPro(); else toCreate();
}
/* Create (decision 0057): everyone makes games from pictures here; opts.edit is the id of a game to change (from its results) */
function toCreate(opts = {}){
  go('create', () => createPage({ edit: opts && opts.edit || null, nav: tabs(), onPlay: toGame, onWho: () => toWho(false), onRecalibrate: toCalibration }));
}
/* the mode was switched (Settings, in a testing build): that mode's first page */
addEventListener('orlismode', (e) => {
  if (e.detail === 'creator') toStart(); else toMenu(false);
  toast(e.detail === 'creator' ? 'Creator app' : 'Player app', { ms: 2500 });
});
/* the owner turned test games on or off (Settings > Testing): My library again, without or with them */
addEventListener('orlistesting', (e) => {
  if (mode === 'menu') toMenu(false);
  toast(e.detail ? 'Test games are on' : 'Test games are off', { ms: 2500 });
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
  go('who', () => welcome(() => (account.state && account.state.firstGame === true ? toPro() : account.state && account.state.firstGame ? toCreate() : toMenu(arrive)), { auto: arrive, glide, onBack: back }));
}

function toCalibration(){
  go('calibrate', () => calibration(toMenu));
}

/* Into the game: the tile you picked opens into a cover that says what to do and counts 3, 2, 1
   once the camera is ready, then the game starts as the cover goes. Every game has room for four, and whoever is there plays: another
   child can step in partway through, and anyone can step out, without
   anything stopping. */
function toGame(g){
  /* (the Creator app can't play games) */
  if (appMode.creator()) return;
  game = g;
  if (usesPads(g)) preparePads(g); else stopPads();
  playedLately(g.id);
  ambience.stop();
  players = pose.cap;
  /* The cover says what to do while the game gets ready (a twirling head says it's working); the game starts as it goes. */
  if (launch.el) launch.card({ title: g.name, blurb: BLURB[g.id] || (g.store && g.store.blurb) || '' });
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
  };
  if (g.passive || pose.on || pose.mouse.active && pose.reason === 'debug'){
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
  crew.profiles = family(); crew.personal = MAKING; crew.sync();
  /* (while everyone plays as the generic avatars, there's nobody to line up) */
  if (!MAKING || crew.lined || crew.profiles.length < 2){ afterLineUp(); return; }
  launch.release();                                    /* (the line-up is a screen of its own) */
  go('lineup', () => lineUp({ profiles: crew.profiles, onDone: () => { if (mode === 'lineup') afterLineUp(); } }));
}
/* A game that uses phones shows the join card first (QR, the three pictures, who has joined, Start); any other starts at once. */
function afterLineUp(){
  /* the camera check: nothing shows when everyone is fully in view; someone cut off (or the first time on this PC) gets a moment first */
  if (!NOFRAMING && !game.passive && !pose.mouse.active){
    go('framing', () => framingCheck({ onDone: () => { if (mode === 'framing') afterFraming(); } }));
    return;
  }
  afterFraming();
}
function afterFraming(){
  if (!(usesPads(game) && padsRt)){ startRound(); return; }
  /* play again: the same phones are already in, so a new round starts at once (the join card is for a fresh start from home) */
  if (skipJoinCard(padsRt, padsAgain, trackedSeats)){ startRound(); return; }
  toJoin();
}
function toJoin(){
  launch.release();
  padsRt.setTracked(trackedSeats());
  go('join', () => joinCard({ rt: padsRt, onStart: () => { if (mode === 'join' && padsRt && padsRt.go()) startRound(); } }));
}
/* The camera players as tracked seats (before any phone joins, so the phones' seat numbers come after them). */
function trackedSeats(){
  const [lo, hi] = (game.seats && game.seats.tracked) || [0, 0];
  const here = pose.players.map((p, i) => (p.present ? i : -1)).filter(i => i >= 0).slice(0, hi);
  for (let i = 0; here.length < lo && i < MAX_PLAYERS; i++) if (!here.includes(i)) here.push(i);
  return here.sort((a, b) => a - b).map(i => {
    const p = crew.profileOf(i), look = p && p.look ? normalizeLook(p.look) : null;
    return { who: p ? p.id : 'cam' + i, name: p ? p.name : `Player ${i + 1}`, avatar: look, favourite: crew.wantedOf(i) || undefined };
  });
}
/* ---------- phones (S1) ---------- */
const PADS_KEEP = new Set(['starting', 'lineup', 'join', 'play', 'outro', 'results']);
let padsAgain = false;                                 /* (true when this round is a play again with the phones already joined) */
function preparePads(g){
  if (padsRt && padsRt.game === g){ padsAgain = true; return; }             /* (play again: the same phones, the same session) */
  padsAgain = false;
  stopPads();
  /* the app's hub; in the browser dev build (or for the owner) the Node hub, with ?padhub=<port>:<key> */
  const config = padHub({ search: location.search, allowDev: DEV || account.role === 'owner' });
  padsRt = createPads({ game: g, people: () => peopleFrom(family()), config });
  padsRt.pause.on(onPadPause);
  padsRt.connect();
  window.__pads = padsRt;                              /* (a handle for tests) */
}
function stopPads(){
  if (roundPads){ roundPads.dispose(); roundPads = null; }
  if (padsRt){ padsRt.stop(); padsRt = null; window.__pads = null; }
  dropWait();
}
function dropWait(){ if (padWait){ padWait.remove(); padWait = null; } }
/* a needed phone dropped (or came back, or has been gone 120 s): the pill, and the round waits */
function onPadPause(){
  if (mode !== 'play' || !padsRt) return;
  if (padsRt.pause.waiting){ if (padWait) padWait.refresh(); else padWait = padWaitPill({ rt: padsRt, onEnd: () => { dropWait(); endRound(); } }); }
  else dropWait();
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

let introLeft = 0, introN = 0, veilIntro = false;   /* (veilIntro: the card and the countdown are on the launch cover, not drawn over the game) */
/* The move card: a game says which move to show (inst.card(), or null for none) and the shell draws it, the same way
   for every game: it slides in when the move changes and out when there is none. */
const moveCard = cardTucker();
function drawMoveCard(c, W, H, dt){
  const want = !hud.quiet && inst && inst.card ? inst.card() : null;
  const k = moveCard.step(want, !paused && introLeft <= 0 ? dt : 0);
  if (k) figureCard(c, W, H, k.pose, k.age, { age: k.age, left: k.left });
}
/* How smoothly a round ran: every frame's time, kept for the owner's results line (the real games and the experiments, side by side). */
const frameMs = [];
let lastReport = '';
function makeReport(){
  return buildReport({ build: typeof __BUILD__ === 'string' ? __BUILD__ : 'dev', game: game ? `${game.name} [${game.id}]` : '', mode: inst && inst.stage ? inst.stage.mode : '', frames: frameMs,
    gpu: gpuName(), screen: `${W}x${H} css px, pixel ratio ${dpr.toFixed(2)}, canvas ${stage.width}x${stage.height}, display ${Math.round(1000 / vsync)} Hz, a game draws every ${drawEvery() === 1 ? 'vsync' : drawEvery() + ' vsyncs'}`,
    round: game ? `${Math.round(played)} s of a ${game.endless ? 'no-limit' : game.secs + ' s'} round` : '', pose: { fps: pose.fps, inferMs: pose.inferMs, people: pose.personCount, worker: !!pose.worker }, stagePerf: inst && inst.stage && inst.stage.perfLine ? inst.stage.perfLine() : '' });
}
function startRound(){
  frameMs.length = 0;
  joined = new Set();
  stillUp = false; idle.reset();
  hud.quiet = false;
  veilIntro = !!launch.el && launch.el.classList.contains('hascard') && !game.passive;
  introLeft = 0; introN = 0;      /* (no countdown: the cover goes and the game's on) */ moveCard.reset(); hud.resetPieces(); hud.introText = null; hud.spoken = false;
  if (roundPads){ roundPads.dispose(); roundPads = null; }
  inst = game.create(players, usesPads(game) && padsRt ? { pads: (roundPads = padsRt.forRound()) } : undefined);
  /* A game where squatting is a move keeps players who crouch or sit. */
  pose.keepSitters = !!game.keepSitters;
  pose.look(players);
  launch.release();                                    /* (the cover goes as the game starts) */
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
  if (roundPads){ roundPads.dispose(); roundPads = null; }
  if (padsRt) padsRt.end();
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
  const n = Math.max(1, joined.size), before = scores.best(game.id, n);
  const isBest = !game.passive && scores.record(game.id, n, inst.value()) && before > 0;
  hud.quiet = true;
  /* one friendly line: what everyone got together */
  const total = (() => { try { return inst.tally().reduce((a, r) => a + (Number(r.value) || 0), 0); } catch { return 0; } })();
  const own = inst.summary ? inst.summary(n, (i) => crew.nameOf(i) || `Player ${i + 1}`) : null;      /* (a game can say it its own way) */
  let summary = own ? { line: own, best: isBest } : total > 0 ? { line: `${n > 1 ? 'Together you got' : 'You got'} ${countText(total, game.unit)}`, best: isBest } : null;
  lastReport = makeReport();
  /* the owner also sees how smoothly it ran, to compare games and machines without any tools */
  if (account.role === 'owner' && !game.passive){
    const smooth = joinLine(smoothness(frameMs, inst.stage ? (inst.stage.mode === 'gl' ? '3D stage' : 'stage, painted on the canvas') : ''), inst.stage && inst.stage.perfLine ? inst.stage.perfLine() : '');
    if (smooth) summary = { line: joinLine(summary && summary.line, smooth), best: summary && summary.best };
  }
  /* told to the family's server, for this week's challenges (not a game
     being tried out - from Create, or waiting for the owner's OK) */
  const toldWeek = !game.back && !game.trial && !game.passive && !game.made
    ? week.played({ gameId: game.id, value: inst.value(), secs: Math.round(played), players: Math.max(1, joined.size) }) : null;
  /* (a game being tried goes back where it came from: Create) */
  /* each child's face, name and count (in seat order; the counts only when the game's tally lines up with who played) */
  const seats = [...joined].filter(i => i < players).sort((x, y) => x - y);
  let rows = []; try { rows = inst.tally(); } catch {}
  const kids = seats.map((i, k) => ({ i, name: crew.nameOf(i) || `Player ${i + 1}`, look: crew.lookOf(i), color: crew.colorOf(i, PLAYER_COLORS[i]), value: rows.length === seats.length ? Number(rows[k].value) || 0 : null,
    health: rows.length === seats.length && rows[k].health ? rows[k].health : null }));
  go('results', () => results(game, () => toGame(game), game.back || toMenu, game.back ? 'Back to Create' : 'Home', summary, { total, kids: game.passive ? [] : kids,
    /* a game the family made: its results have a third button, Change it (the builder again, on this game's picks, saving into the same slot) */
    change: game.made ? () => toCreate({ edit: game.made.id }) : null }));
  /* (a challenge this round moved shows on the results screen once the server has answered - if that is still the page up) */
  if (toldWeek) deliverRoundNews(toldWeek, () => (mode === 'results' ? scene : null));
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
    game.back ? 'Back to Create' : 'Home');
  /* who's who, to put right a mix-up */
  if (MAKING && crew.profiles.length >= 2) paused.querySelector('.pwho').appendChild(whoRow(crew.profiles));
  sfx.whoosh();
}

/* The remote's Back: in a game, pause it (Back again carries on); from
   the scores or the camera check, home. */
remote.install(() => {
  if (mode === 'play' && !lost){ if (paused){ paused.remove(); paused = null; cursor.reset(); } else openPause(); }
  else if (mode === 'results' || mode === 'calibrate' || mode === 'join' || mode === 'framing' || mode === 'store') toMenu();
});

/* The game waits only when the room is empty - everybody gone for a couple
   of seconds - and carries on the moment anyone is back. */
function checkLost(dt){
  if (mode !== 'play' || game.passive){ empty = 0; stillUp = false; idle.reset(); if (lost){ lost.remove(); lost = null; } return; }
  pose.players.forEach((p, i) => { if (p.present) joined.add(i); });
  const anyone = pose.mouse.active || pose.players.some(p => p.present);
  empty = anyone ? 0 : empty + dt;
  checkStill(dt);
  if (empty > EMPTY_AFTER && !lost){ lost = lostOverlay(); healed = false; }
  /* nobody seen for a long while in a game: the camera is started over once, in case it's what's wrong */
  if (lost && !healed && empty > EMPTY_HEAL){ healed = true; pose.heal(); }
  else if (anyone && lost && !stillUp){ lost.remove(); lost = null; }
}
/* "Still there?": a game that never ends on its own (it says idleAfter, in seconds) waits behind a calm card once nobody has been in view
   and moving for that long. Nothing is lost - the game just stops stepping - and the card goes when someone moves or steps back in.
   Not during a cutscene (the game says so with cutscene()), a countdown, the pause card or a waiting phone. */
function checkStill(dt){
  if (!game.idleAfter || paused || padWait || introLeft > 0 || (inst && inst.cutscene && inst.cutscene())){ if (!stillUp) idle.reset(); return; }
  idle.after = game.idleAfter;
  const moved = idle.step(dt, pose.players, players, pose.mouse);
  if (stillUp){ if (moved){ closeStill(); } return; }
  if (!idle.idle) return;
  if (lost){ lost.remove(); lost = null; }
  stillUp = true;
  lost = stillOverlay(game, closeStill, () => { closeStill(); roundDone(); (game.back || toMenu)(); }, game.back ? 'Back to Create' : 'Home');
  sfx.whoosh();
}
function closeStill(){ if (lost){ lost.remove(); lost = null; } stillUp = false; idle.reset(); cursor.reset(); }
const EMPTY_AFTER = 2, EMPTY_HEAL = 20;
let healed = false;

/* ---------- HUD ---------- */
/* The card before a round: the game, what to do, then 3, 2, 1. */
function drawIntro(){
  const how = BLURB[game.id] || (game.store && game.store.blurb) || '';
  c.save();
  c.fillStyle = 'rgba(13,11,26,.28)'; c.fillRect(0, 0, W, H);
  const cw = Math.min(W * 0.62, H * 1.3), ch = H * 0.4, x = W / 2, y = H * 0.46;
  c.shadowColor = 'rgba(20,24,50,.3)'; c.shadowBlur = H * 0.04; c.shadowOffsetY = H * 0.01;
  c.fillStyle = 'rgba(255,255,255,.95)'; c.beginPath(); c.roundRect(x - cw / 2, y - ch / 2, cw, ch, H * 0.05); c.fill();
  c.shadowColor = 'transparent';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#16161d'; c.font = `800 ${Math.round(H * 0.06)}px "Segoe UI Variable Display","Segoe UI",-apple-system,Inter,system-ui,sans-serif`;
  c.fillText(game.name, x, y - ch * 0.3);
  let size = Math.round(H * 0.034); c.font = `600 ${size}px "Segoe UI Variable Display","Segoe UI",-apple-system,Inter,system-ui,sans-serif`;
  while (size > 14 && c.measureText(how).width > cw * 0.9){ size -= 2; c.font = `600 ${size}px "Segoe UI Variable Display","Segoe UI",-apple-system,Inter,system-ui,sans-serif`; }
  c.fillStyle = '#4b4f5e'; c.fillText(how, x, y - ch * 0.08);
  /* 3, 2, 1: the number for the second it's in */
  const n = Math.ceil(introLeft), into = introLeft - Math.floor(introLeft);
  if (introLeft <= 3 && n >= 1){
    const pop = 1 + 0.25 * Math.pow(into, 3);
    c.save(); c.translate(x, y + ch * 0.27); c.scale(pop, pop);
    c.fillStyle = game.accent || '#6d5efc'; c.font = `900 ${Math.round(H * 0.13)}px "Segoe UI Variable Display","Segoe UI",-apple-system,Inter,system-ui,sans-serif`;
    c.fillText(String(n), 0, 0); c.restore();
  }
  c.restore();
}
/* the first words of a round are said aloud once (for the ones who can't read yet) */
hud.speak = (text) => voice.say(text);
/* The HUD: the game answers hud() with what it wants in each dock, and drawShellHud (games/hud.js) lays it out on the grid, draws the pieces in the kit's
   look, bounces what changes and dims what has been still for 3 s (UI-STANDARD.md). */
function drawHUD(){
  if (mode !== 'play' || !inst) return;
  if (introLeft > 0 && !paused && !lost){ if (!veilIntro) drawIntro(); return; }
  const spec = inst.hud(), ids = [...joined].filter(i => i < players).sort();
  drawShellHud(c, W, H, spec, { players: ids, colors: PLAYER_COLORS, lookOf: (i) => crew.lookOf(i), present: (i) => !!(pose.players[i] && pose.players[i].present),
    clock: { left: roundLeft, total: game && game.secs || 0 }, now: performance.now() });
  c.textAlign = 'start'; c.textBaseline = 'alphabetic';
}

/* A game can paint any sky it likes; the numbers on top of it must still
   read from the sofa: white frosted pills, edged in the player's colour. */

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
/* In a game, draw on every vsync of a 60 Hz screen (a TV), and on every other vsync of a faster one (a 120 to 165 Hz laptop
   screen): smooth, and it leaves the graphics chip free for the camera tracker, which otherwise waits behind extra frames. */
let vsync = 1000 / 60, lastRaf = 0, vsyncN = 0;
const drawEvery = () => Math.max(1, Math.floor(1000 / vsync / 60 + 0.1));
function tick(now){
  if (lastRaf){ const d = now - lastRaf; if (d > 2 && d < 40) vsync += (d - vsync) * 0.05; }
  lastRaf = now;
  const away = !inFront();
  if (away !== wasAway){
    wasAway = away;
    audio.away(away);
    if (away && mode === 'play' && !lost) openPause();
  }
  const gap = away ? AWAY_GAP : CALM.has(mode) ? HOME_GAP : 0;
  if (gap && now - lastFrame < gap){ requestAnimationFrame(tick); return; }
  if (!gap && (++vsyncN % drawEvery())){ requestAnimationFrame(tick); return; }
  lastFrame = now;
  const rawMs = last ? now - last : 16;
  const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
  last = now;

  pose.paused = !!paused;
  fxState.hidden = !!paused;      /* (frozen bursts and "+1"s would hang over the pause card) */
  if (!away && (!CALM.has(mode) || BODY_PAGES.has(mode))) pose.update(now, dt);
  /* Brighten the screen in dark rooms (Settings > Testing): the room's brightness from the camera, a veil on the screen eased in and out */
  { const li = pose.lightLook(); screenLight.step(dt, mode, li ? li.mean : null); }
  /* Record tracking (Settings > Testing; points only): kept while a round is playing */
  if (account.role === 'owner') pose.recordRound(mode === 'play' && !paused && game ? { game: game.id, lineup: players } : null);

  /* paper, under the menus; dark under a game while it loads */
  c.fillStyle = mode === 'play' || mode === 'outro' || mode === 'results' || mode === 'starting' || mode === 'framing' ? '#0d0b1a' : PAPER;
  c.fillRect(0, 0, W, H);

  if (mode === 'play' && inst && !paused && !lost && !padWait){
    crewTick(dt);
    if (introLeft > 0){
      introLeft -= dt;
      const n = Math.ceil(Math.max(0, introLeft)); if (n !== introN && n >= 1 && n <= 3){ introN = n; sfx.tick?.(); }
      if (introLeft <= 0){ sfx.select?.(); if (veilIntro){ veilIntro = false; launch.release(); } }
    } else {
    inst.step(dt, W, H);
    if (frameMs.length < 40000 && rawMs < 1000) frameMs.push(rawMs);      /* (for the owner's smoothness line on the results) */
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
  }
  if (mode === 'outro' && inst && inst.outro(dt, W, H)) showResults();
  if ((mode === 'play' || mode === 'outro' || mode === 'results') && inst) inst.draw(c, W, H);
  if (mode === 'play' && inst && !paused) drawMoveCard(c, W, H, dt);      /* (not under the pause card) */

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
  if ((mode !== 'play' && mode !== 'outro') || paused || lost || padWait) cursor.draw(oc, W, H);
  drawPerf(dt);
  drawTrackInfo();

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
/* Settings > Testing > Show tracking details (owner): a small box in the top-right corner, a line per player in the game - slot, body
   size (share of the picture's height), Z when the closer look has been at them lately (Z+ if it found them), and how well their clothes
   match what was learned (1.00 is the same) - for trying the camera at home (docs/tracking-trial.md). Nothing is drawn when it is off. */
function drawTrackInfo(){
  if (account.role !== 'owner' || !pose.infoOn()) return;
  let info; try { info = pose.trackInfo(); } catch (e){ return; }
  const pad = Math.max(8, H * 0.015), lh = Math.max(13, H * 0.022);
  const rows = ['zoom ' + info.zoom + (info.cropMs ? ' ' + info.cropMs.toFixed(0) + 'ms' : ''), 'clothes ' + (info.clothes ? 'on' : 'off')];
  for (const r of info.rows) rows.push(`P${r.slot} body ${r.body == null ? '-' : Math.round(r.body * 100) + '%'} ${r.zoom ? (r.found ? 'Z+' : 'Z ') : '  '} ${r.match == null ? ' - ' : r.match.toFixed(2)}`);
  c.save();
  c.font = `700 ${Math.round(lh * 0.8)}px ui-monospace, monospace`;
  const w = Math.max(...rows.map(t => c.measureText(t).width)) + pad * 2;
  c.fillStyle = 'rgba(9,7,20,.78)';
  c.fillRect(W - w - pad / 2, pad / 2, w, lh * rows.length + pad);
  c.textBaseline = 'top'; c.fillStyle = '#9bffd0';
  rows.forEach((t, i) => c.fillText(t, W - w + pad / 2, pad + lh * i));
  c.restore();
}
addEventListener('keydown', (e) => {
  if (typing(e)) return;
  if (e.key === 'f' || e.key === 'F') toggleFullscreen();
  if (e.key === 'k' || e.key === 'K') showSkeleton = !showSkeleton;
  if (e.key === 'p' || e.key === 'P') showPerf = !showPerf;
  /* G runs the 3D check (which graphics chip, how fast a plain 3D scene is) and copies the result - for the owner */
  /* Shift+G switches camera tracking between the main thread and a separate worker, and restarts the page (to compare in the 3D check) */
  if (e.key === 'G' && e.shiftKey && account.role === 'owner' && mode !== 'play'){
    try { const on = localStorage.getItem('orlis_trackworker') === '1'; localStorage.setItem('orlis_trackworker', on ? '0' : '1'); toast(`Camera tracking: ${on ? 'main thread' : 'separate worker'}. Restarting…`, { ms: 2500 }); setTimeout(() => location.reload(), 1200); } catch (err){}
    return;
  }
  if ((e.key === 'g' || e.key === 'G') && account.role === 'owner' && mode !== 'play'){
    toast('3D check: about 20 seconds…', { ms: 3000 });
    import('./stage/gpucheck.js').then((m) => m.gpuCheck()).then((text) => {
      (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject()).catch(() => {});
      toast(text.replace(/\n/g, ' · ') + ' (copied)', { ms: 15000 });
    }, () => toast('The 3D check could not run.', { ms: 4000 }));
  }
  /* H cycles how hands are shown on screen (glow orb, body outline, glow), for trying - the owner's */
  if ((e.key === 'h' || e.key === 'H') && account.role === 'owner' && !e.ctrlKey && !e.metaKey && !e.altKey){ cycleHands(); toast(`Hands on screen: ${handsName()}`, { ms: 1800 }); }
  /* R copies a performance report for the last round (or the one being played) to paste to the assistant - for the owner */
  if ((e.key === 'r' || e.key === 'R') && account.role === 'owner'){
    const text = mode === 'play' || !lastReport ? makeReport() : lastReport;
    (navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => toast('Performance report copied. Paste it to Claude.', { ms: 4000 }), () => toast('Could not copy the report.', { ms: 4000 }));
  }
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
const START_IN = /[?&]dev\b/.test(location.search) ? 'last-known-position' : new URLSearchParams(location.search).get('game');   /* (?game=<id> goes straight into any game) */

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
  window.__crew = crew; window.__scene = () => scene; window.__game = () => (mode === 'play' || mode === 'starting' || mode === 'lineup' ? game : null); window.__mode = () => mode; window.__week = week; window.__home = () => toMenu(false); window.__go = { toMenu, toStore, toCreate, toPro, toWho, toGame, toCalibration, showResults: () => showResults(), openPause: () => openPause() }; window.__round = () => inst; window.__finish = () => { roundLeft = 0; }; window.__library = library;
  holdScreen();
  show.camReady = true;
  await new Promise(res => {
    const wait = () => { if (show.done) res(); else setTimeout(wait, 50); };
    wait();
  });
  await libraryReady;
  /* a creator's Test, at once: the Testing row on Play changes when one comes (and only then) */
  watchTests({ onChange: () => { if (mode === 'menu') toMenu(false); } });
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

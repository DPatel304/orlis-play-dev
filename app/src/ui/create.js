/* Create: making your own games - for grown-ups the owner made creators.

   New game: a name, the idea, and what to start from (a starter game:
   Star Catch, or one of the owner's own in the Store). Orlis Play
   makes the game's folder on this PC and opens Claude Code in it, with the
   idea as the first thing to do - on the creator's own Claude account, with
   Orlis Play's rules and guardrails. Your games: each one, to open in
   Claude Code again (or see its folder).

   Create Pro (Creator app): Test puts a game on the family's TV Orlis (Play's
   Testing row); Publish downloads it there, under Play. All between this PC
   and the family's server - nobody else is in it (ui/tv.js).

   Everyone else sees what's coming. */
import { iconHTML } from './icons.js';
import { toast } from './toast.js';
import { button, onPick } from './cursor.js';
import { screen, h, clearUI } from './screens.js';
import { sfx } from '../audio/sound.js';
import { account } from './account.js';
import { setup, claudeConnected } from './setup.js';
import { claudeChecklist } from './connect-claude.js';
import { tv } from './tv.js';
import { topBar } from './tabs.js';
import { CREATE_SOON, looks } from './menu.js';
import { making } from './making.js';
import { unpack, check, build, pack, nextVersion } from './creator-kit.js';
import { newer } from './store.js';
import { library } from './library.js';
import { PAPER } from './boot.js';
import { week } from './week.js';
import { appMode } from './mode.js';
import { buildingRow } from './building.js';
import { gameBuilder, changePop, looksOf } from './request.js';
import { previewCover } from './covers.js';
import { coverFor } from './shots.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* Create's banner: the same banner as Home's and the Store's, with its own
   picture - a sparkle on purple and teal. */
const SPARKLE = '<path d="M50 8l9 33 33 9-33 9-9 33-9-33-33-9 33-9z" fill="#fff"/><circle cx="80" cy="20" r="6" fill="#fff"/><circle cx="20" cy="80" r="4" fill="#fff"/>';
function banner(kicker, title, line){
  const hero = h('section', 'shero');
  const art = h('div', 'sheroart', `<svg class="g" viewBox="0 0 100 100" aria-hidden="true">${SPARKLE}</svg>`);
  art.style.setProperty('--c1', '#7c3aed'); art.style.setProperty('--c2', '#06b6d4');
  const text = h('div', 'shtext');
  text.append(h('div', 'skicker', esc(kicker)), h('h1', '', esc(title)), h('p', '', esc(line)));
  hero.append(art, h('div', 'shshade'), text);
  return { hero, text };
}

/* How the last Try it went, to say so on coming back to Create. */
let lastTry = null;
/* the first game a new creator made (setup's "Make my first game"), for a friendlier word after trying it */
let firstFolder = null;

export function createPage({ nav = {}, onPlay = () => {}, onWho, onRecalibrate, pro = false }){
  clearUI();
  const s = screen('tvhome createpage onhero');
  const bar = topBar(pro ? 'pro' : 'create', nav, { onWho, onRecalibrate });
  s.appendChild(bar.el);
  const scroll = h('div', 'sscroll');
  s.appendChild(scroll);
  scroll.addEventListener('scroll', () => s.classList.toggle('scrolled', scroll.scrollTop > 40), { passive: true });
  const scene = { tick(dt){ bar.tick(dt); }, draw(c, W, H){ c.fillStyle = PAPER; c.fillRect(0, 0, W, H); } };
  const creator = account.signedIn && (account.role === 'creator' || account.role === 'owner');

  /* every grown-up makes games (Make a game: described, then made for them);
     with the Dev Kit, they can also build them with Claude Code */
  const grown = account.signedIn && !account.isKid;
  /* (the Dev Kit - building games with Claude Code - is Create Pro; Create is the kids' picture flow) */
  const kit = pro && creator && !!(account.state.account && account.state.account.devkit);
  /* waiting to be let in: Create opens then */
  if (grown && account.waiting){
    scroll.appendChild(banner('Create', 'Make a game', 'Pending account approval').hero);
    return scene;
  }
  if (!grown){
    const m = CREATE_SOON;
    scroll.appendChild(banner('Coming soon', m.name, m.line).hero);
    const sec = h('section', 'srow');
    sec.append(h('p', 'cabout', esc(m.about)));
    if (account.signedIn) sec.append(h('p', 'snote', 'Making games is for grown-ups.'));
    scroll.appendChild(sec);
    return scene;
  }

  if (!pro){
    /* the page is the flow: no banner, straight into the first question */
    s.classList.add('flow'); s.classList.remove('onhero');
    /* the tabs, the cube and who's playing slide up and away (the page is the build now); a handle at the top, the top edge, or Escape brings them back */
    let awayT = 0;
    const lift = () => { clearTimeout(awayT); s.classList.add('chromeaway'); };
    const drop = () => { clearTimeout(awayT); s.classList.remove('chromeaway'); };
    setTimeout(() => { if (s.isConnected) lift(); }, 450);
    const handle = onPick(button('▾', 'pullhandle'), () => { sfx.select?.(); s.classList.contains('chromeaway') ? drop() : lift(); });
    handle.title = 'Show the tabs'; handle.setAttribute('aria-label', 'Show the tabs');
    s.appendChild(handle);
    s.addEventListener('pointermove', (e) => {
      if (e.clientY < 36 && s.classList.contains('chromeaway')) drop();
      else if (e.clientY > innerHeight * 0.22 && !s.classList.contains('chromeaway')){ clearTimeout(awayT); awayT = setTimeout(lift, 1800); }
    });
    const escKey = (e) => {
      if (!s.isConnected){ removeEventListener('keydown', escKey, true); return; }
      if (e.key === 'Escape' && !document.querySelector('.fpopwrap')){ e.preventDefault(); sfx.select?.(); s.classList.contains('chromeaway') ? drop() : lift(); }
    };
    addEventListener('keydown', escKey, true);
  }
  /* Create Pro: a banner, with the Dev Kit's buttons */
  if (pro){
    const b = banner('Create Pro', 'Make games with Claude Code', kit ? '' : 'On your own Claude account');
    b.hero.classList.add('prohero');
    scroll.appendChild(b.hero);
  }
  /* where Make a game builds */
  const buildHost = h('div', 'cbuild');
  scroll.appendChild(buildHost);
  const body = h('div', 'cbody');
  scroll.appendChild(body);
  const sbtn = (label, fn, cls) => onPick(button(label, 'sbtn ' + cls), fn);
  const btn = (label, fn, cls = '') => onPick(button(label, 'setbtn ' + cls), fn);
  /* what just happened, or went wrong (bad), said once in a pop-up */
  let said = '', bad = false;
  let autoOpened = false;        /* the flow opened by itself, once */
  let mine = [];                 /* the games being made on this PC */
  let pop = null;

  /* a small card in the middle, over the page (as on Family) */
  function popup(...parts){
    closePop();
    pop = screen('dim fpopwrap'); pop.style.zIndex = 6;
    const card = h('div', 'fpop');
    card.append(...parts);
    pop.appendChild(card);
    pop.addEventListener('pointerdown', (e) => { if (e.target === pop){ sfx.back?.(); closePop(); } });
    return card;
  }
  function closePop(){ if (pop){ pop.remove(); pop = null; } }
  const problem = (card) => (e) => { card.querySelector('.ferr')?.remove(); card.appendChild(h('p', 'ferr', esc(e.message || 'That didn’t work.'))); };

  /* What a new game can start from: starter games only - Star Catch (it
     comes with Orlis Play), and games in the Store the owner made (the
     server marks those, and only those, as starters). Never another
     family's game. Each: a label, a line, and how to get its files. */
  async function starts(){
    const list = [{ label: 'Star Catch', line: 'Catch the falling stars', get: async () => null }];
    try {
      const store = (await account.call('GET', '/api/store')).games || [];
      for (const g of store.filter(x => x.starter === true)){
        list.push({ label: g.name, line: g.blurb || 'A starter game', get: async () => {
          const src = await library.source(g);
          const game = unpack(src.code);
          if (!game) throw new Error(`${g.name} can’t be a starting point.`);
          return { name: g.name, game, manifest: src.manifest };
        } });
      }
    } catch {}
    return list;
  }

  /* New game: a name, the idea, what to start from - then Claude Code. */
  async function newGamePop(){
    sfx.select();
    const name = Object.assign(document.createElement('input'), { className: 'finput', maxLength: 40, placeholder: 'Bird Hoops' });
    const idea = Object.assign(document.createElement('textarea'), { className: 'finput fidea', maxLength: 300, rows: 3, placeholder: 'Flap your arms like wings to fly a bird through hoops' });
    const from = h('div', 'cfrom', '<p class="fnote">Looking…</p>');
    let chosen = 0, list = [];
    const go = btn('Make it', async () => {
      if (!name.value.trim()){ name.focus(); return; }
      go.classList.add('busy');
      try {
        const start = await list[chosen].get();
        const made = await making.make({ name: name.value, idea: idea.value, from: start });
        sfx.gold?.();
        await refreshMine();
        await opened(made.folder, made.name, await making.openClaude(made.folder, { first: made.idea }), true);
      } catch (e){ go.classList.remove('busy'); problem(card)(e); }
    }, 'go');
    const card = popup(h('h2', '', 'New game'),
      h('label', 'ffield', '<span>Its name</span>'), name,
      h('label', 'ffield', '<span>The idea - what do you do, and how do you move?</span>'), idea,
      h('label', 'ffield', '<span>Start from a starter game</span>'), from,
      h('div', 'fbtns'));
    card.querySelector('.fbtns').append(btn('Cancel', () => { sfx.back?.(); closePop(); }), go);
    name.focus();
    list = await starts();
    const mark = () => [...from.children].forEach((b, i) => b.classList.toggle('chosen', i === chosen));
    from.innerHTML = '';
    list.forEach((o, i) => from.appendChild(onPick(button(`<b>${esc(o.label)}</b><small>${esc(o.line)}</small>`, 'setbtn cstart'), () => { chosen = i; mark(); })));
    mark();
  }

  /* After opening Claude Code: what's happening, or how to get it. */
  async function opened(folder, gameName, r, isNew){
    if (r && r.opened){
      popup(h('h2', '', isNew ? `${gameName} is ready` : 'Claude Code is opening'),
        h('p', '', 'Claude Code is opening in a window of its own. The first time, it asks you to sign in with your Claude account, and whether you trust this folder - say yes.'),
        h('p', 'fnote', isNew ? 'Claude starts on your idea straight away. Tell it what to change as you go.' : 'Tell Claude what you’d like to change.'),
        h('div', 'fbtns')).querySelector('.fbtns').append(btn('OK', () => { sfx.select(); closePop(); }, 'go'));
      return;
    }
    const note = h('p', 'fnote', 'It installs in a window of its own and takes a minute or two. When it says it’s done, close that window and press Open in Claude Code again.');
    const card = popup(h('h2', '', 'Claude Code isn’t on this PC yet'),
      h('p', '', `${isNew ? `${esc(gameName)} is made. ` : ''}To make games, Claude Code needs installing once. It uses your own Claude account (a paid Claude plan).`),
      note, h('div', 'fbtns'));
    card.querySelector('.fbtns').append(
      btn('Not now', () => { sfx.back?.(); closePop(); }),
      btn('Install Claude Code', async () => {
        try { await setup.installClaude(); sfx.select(); note.textContent = 'Claude Code is installing in its own window. When it says it’s done, close that window, then press Open in Claude Code on your game.'; }
        catch (e){ problem(card)(e); }
      }, 'go'));
  }

  /* What's wrong, said plainly - and written down for Claude to read. */
  function problemsPop(g, title, problems){
    making.note(g.folder, `${new Date().toLocaleString()} - Orlis Play's check found:\n${problems.map(p => '- ' + p).join('\n')}\n`).catch(() => {});
    const card = popup(h('h2', '', esc(title)), h('ul', 'cprobs', problems.map(p => `<li>${esc(p)}</li>`).join('')),
      h('p', 'fnote', 'Tell Claude: “Fix what Orlis Play’s check found” - it’s written down for Claude to read.'), h('div', 'fbtns'));
    card.querySelector('.fbtns').append(
      btn('Open in Claude Code', async () => { try { await opened(g.folder, g.manifest.name, await making.openClaude(g.folder), false); } catch (e){ problem(card)(e); } }),
      btn('OK', () => { sfx.select(); closePop(); }, 'go'));
  }

  /* Try it: the game as it is now - checked, then played full screen with
     the camera, sealed off like any Store game. Back here after, with a
     note of how it went for Claude. */
  async function tryIt(g, card){
    let now;
    try { now = await making.read(g.folder); } catch (e){ problem(card)(e); return; }
    const problems = check(now);
    if (problems.length) return problemsPop(g, `${g.manifest.name} needs a fix first`, problems);
    let game;
    try { game = await library.tryOut(build(now)); }
    catch (e){
      const why = e.message === 'the game didn\'t start' ? 'It didn’t start: there may be a mistake in game.js that stops it running.' : `It didn’t start: ${e.message}`;
      return problemsPop(g, `${g.manifest.name} didn’t start`, [why]);
    }
    const name = g.manifest.name, folder = g.folder;
    game.back = () => nav.create && nav.create();
    game.onDone = ({ secs, failed }) => {
      lastTry = { name, folder, secs, failed };
      making.note(folder, failed
        ? `${new Date().toLocaleString()} - Tried it: it stopped after ${secs} seconds with this error:\n${failed}\n`
        : `${new Date().toLocaleString()} - Tried it: played ${secs} seconds, no errors.\n`).catch(() => {});
    };
    sfx.select(); closePop(); onPlay(game);
  }

  /* Test and Publish are between this laptop and the TV's Orlis (the family's server): nobody else is in it.
     Test puts the game where the TV can play it (Play, the Testing row); Publish makes it one of the family's
     games, downloaded to the TV and under Play. A game is checked first, and given a newer version number
     if this one's been published before. */
  let testing = new Set();       /* ids being tested on the TV now */
  let published = new Map();     /* id -> version, of this family's published games */
  async function prepare(g, card){
    let now;
    try { now = await making.read(g.folder); } catch (e){ problem(card)(e); return null; }
    const problems = check(now);
    if (problems.length){ problemsPop(g, `${g.manifest.name} needs a fix first`, problems); return null; }
    let m = JSON.parse(now.manifest);
    try {
      const was = published.get(m.id);
      if (was && !newer(m.version, was)){
        await making.setVersion(g.folder, nextVersion(was));
        now = await making.read(g.folder); m = JSON.parse(now.manifest);
      }
      const { bytes } = await pack(now);
      return { bytes, m };
    } catch (e){ problem(card)(e); return null; }
  }
  async function testIt(g, card){
    const ready = await prepare(g, card); if (!ready) return;
    try { await tv.test(ready.bytes); } catch (e){ problem(card)(e); return; }
    sfx.gold?.(); closePop();
    said = `${ready.m.name} is on the TV: open Play, then the Testing row.`;
    await refreshMine();
  }
  async function publishIt(g, card){
    try { await tv.publish(g.manifest.id); } catch (e){ problem(card)(e); return; }
    sfx.gold?.(); closePop();
    said = `${g.manifest.name} is published: it’s downloading to the TV, under Play.`;
    await refreshMine();
  }

  /* One of your games: test it on the TV, publish it, open it in Claude Code, or see its folder. */
  function gamePop(g){
    sfx.select();
    const L = looks({ id: g.manifest.id, icon: g.manifest.icon });
    const card = popup(L.icon('sicon cpopicon'), h('h2', '', esc(g.manifest.name)), h('p', 'fnote', esc(g.manifest.blurb || '')),
      h('p', 'fnote', `Version ${esc(g.manifest.version || '0.1')} · changed ${esc(new Date(g.changed).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))}`),
      h('div', 'cacts'), h('div', 'fbtns'));
    const on = testing.has(g.manifest.id);
    card.querySelector('.cacts').append(
      ...(appMode.creator() ? [] : [btn('<span class="tri"></span>Try it', () => tryIt(g, card), 'cbig')]),
      btn('Test on the TV', () => testIt(g, card), on ? 'cbig' : 'go cbig'),
      btn('Publish', () => publishIt(g, card), on ? 'go cbig' : 'cbig off'));
    if (on) card.querySelector('.fbtns').append(btn('Take it off the TV', async () => { try { await tv.remove(g.manifest.id); } catch (e){ problem(card)(e); return; } sfx.select(); closePop(); said = `${g.manifest.name} is off the TV.`; await refreshMine(); }));
    if (!on) card.insertBefore(h('p', 'fnote', 'Test it on the TV first. When it’s right, publish it: it’s downloaded to the TV and shows up under Play.'), card.querySelector('.cacts'));
    card.querySelector('.fbtns').append(
      btn('Show the folder', () => making.show(g.folder).catch(problem(card))),
      btn('Open in Claude Code', async () => {
        try { await opened(g.folder, g.manifest.name, await making.openClaude(g.folder), false); } catch (e){ problem(card)(e); }
      }));
  }

  /* back from Try it: how it went */
  function afterTry(){
    const t = lastTry; lastTry = null;
    if (!t) return;
    const g = mine.find(x => x.folder === t.folder) || { folder: t.folder, manifest: { name: t.name } };
    const card = popup(h('h2', '', t.failed ? `${esc(t.name)} stopped` : `How was ${esc(t.name)}?`),
      h('p', '', t.failed ? `It stopped after ${t.secs} seconds because something went wrong. It’s written down for Claude: tell it “It broke when I tried it - have a look”.`
        : t.folder === firstFolder ? 'That’s your own game, made on this PC. Now make it yours: press Open in Claude Code and tell Claude what to change - like “make the stars rainbow coloured”, or “make it about catching fish”.'
        : `You played ${t.secs} seconds, with no errors. Tell Claude what to change, or test it on the TV when you’re happy.`),
      h('div', 'fbtns'));
    card.querySelector('.fbtns').append(
      btn('Open in Claude Code', async () => { try { await opened(g.folder, t.name, await making.openClaude(g.folder), false); } catch (e){ problem(card)(e); } }),
      btn('OK', () => { sfx.select(); closePop(); }, 'go'));
  }

  async function refreshMine(){
    if (!making.available) return;
    try { mine = await making.list(); } catch { mine = []; }
    draw();
  }
  /* (back from Try it) */
  if (lastTry) refreshMine().then(afterTry);
  /* (a new grown-up who picked "Make a game" on joining: straight into it) */
  else if (account.state && account.state.firstGame === 'make'){ account.set({ firstGame: false }); autoOpened = true; setTimeout(askPop, 300); }
  /* (someone new with the Dev Kit who picked "Make my first game" in setup) */
  else if (account.state && account.state.firstGame === true && making.available && !appMode.creator()) firstGame();

  /* Their first game: the starter (Star Catch), made in a moment with no
     Claude needed, and straight on to trying it - so the first thing they
     see is a game of their own working on their TV. */
  async function firstGame(){
    account.set({ firstGame: false });
    let card = popup(h('h2', '', 'Making your first game…'), h('p', '', 'One moment.'));
    try {
      const made = await making.make({ name: 'Star Catch', idea: 'Reach up and catch the falling stars', from: null });
      firstFolder = made.folder;
      await refreshMine();
      const g = mine.find(x => x.folder === made.folder) || { folder: made.folder, manifest: { name: made.name } };
      sfx.gold?.();
      card = popup(h('h2', '', 'Your first game is ready'),
        h('p', '', `It’s ${esc(made.name)}: reach up and catch the falling stars. Stand back so the camera can see you, then press Try it.`),
        h('p', 'fnote', 'After that, you’ll make it your own with Claude.'),
        h('div', 'fbtns'));
      card.querySelector('.fbtns').append(btn('Later', () => { sfx.back?.(); closePop(); }), btn('Try it', () => { sfx.select(); closePop(); tryIt(g, card); }, 'go'));
    } catch (e){ problem(card)(e); }
  }

  /* The Dev Kit: building games yourself, with Claude Code. Set up once
     (install it, sign in), then: build a game, or send in a game file. */
  let claudeOk = null;
  function kitPop(){
    sfx.select();
    if (!claudeOk && making.available){
      const go = btn('Build a game', () => { check.stop(); closePop(); newGamePop(); }, 'go');
      go.style.display = 'none';
      const check = claudeChecklist({ onConnected: () => { claudeOk = true; go.style.display = ''; head.textContent = 'Ready!'; draw(); } });
      const head = h('h2', '', 'Dev Kit setup');
      const card = popup(head, h('p', '', 'Build games yourself with Claude Code. Two steps, once.'), check.el, h('div', 'fbtns'));
      card.lastChild.append(btn('Later', () => { sfx.back?.(); check.stop(); closePop(); }, 'flink'), go);
      return;
    }
    const card = popup(h('h2', '', 'Create Pro'), h('div', 'fbtns'));
    if (making.available) card.lastChild.append(btn('Build a game', () => { closePop(); newGamePop(); }, 'go'));
  }

  /* Request a game: the wizard, then back here to see it listed */
  const sendAsk = (recipe) => account.call('POST', '/api/requests', recipe).then((r) => { said = 'Sent!'; week.refresh({ force: true }).catch(() => {}); return r; });
  const store_ = async () => { try { return (await account.call('GET', '/api/store')).games || []; } catch { return []; } };
  let slots = null;              /* { used, total } game slots (none for the owner) */
  let building = null;           /* the builder, while it's open */
  function askPop(quiet){
    if (quiet !== true) sfx.select();
    closePop();
    if (building) return;
    if (slots && slots.used >= slots.total){
      buildHost.innerHTML = '';
      const full = h('section', 'builder');
      full.append(h('div', 'bq bsent', `<div class="bigemoji">${iconHTML('sign', 256)}</div><h1 class="bh">No game slots left</h1><p class="bnote">All ${slots.total} are used. Ask the owner for more.</p>`));
      buildHost.appendChild(full);
      return;
    }
    building = gameBuilder({
      host: buildHost, store: store_, send: sendAsk, onPlay: nav.home && !appMode.creator() ? () => nav.home() : null,
      onDone: () => { building = null; draw(); setTimeout(() => { if (s.isConnected) askPop(true); }, 0); }
    });
  }

  /* a row, the Store's way: its name, then what's in it */
  const row = (name, sub) => {
    const sec = h('section', 'srow');
    sec.appendChild(h('h3', '', `${esc(name)}${sub ? ` <span>${esc(sub)}</span>` : ''}`));
    body.appendChild(sec);
    return sec;
  };

  let drawing = 0;
  async function draw(){
    /* everything it needs first; then, if a newer draw started meanwhile,
       leave it to that one - so overlapping draws never double anything */
    const me = ++drawing;
    const [, , , ok, shop, drafts] = await Promise.all([0, 0,
      account.call('GET', '/api/requests').then(r => { slots = r.slots || null; return r.requests || []; }, () => null),
      kit && making.available && claudeOk === null ? setup.status().then(claudeConnected) : claudeOk,
      store_(), kit ? tv.drafts() : null]);
    if (me !== drawing) return;
    if (ok !== null) claudeOk = ok;
    if (drafts) testing = new Set(drafts.map(d => d.id));
    published = new Map(shop.filter(g => g.mine).map(g => [g.id, g.version]));
    if (said){ toast(said, { bad }); said = ''; bad = false; }
    body.innerHTML = '';
    /* (in the Creator app there's no Play: what's on its way is here, under the questions) */
    if (appMode.creator() && !pro){ await week.refresh({ force: true }).catch(() => {}); if (me !== drawing) return; const row_ = buildingRow(week.building(), () => draw()); if (row_) body.appendChild(row_); }
    /* the page opens straight into making a game (but not on the way back from Try it, or setup's own first game) */
    if (!pro && !autoOpened){ autoOpened = true; if (!lastTry && !(account.state && account.state.firstGame === true)) askPop(true); }
    /* Create Pro: three steps, as big pictures - connect Claude, build a game, test it on the TV (and publish) */
    if (pro && kit){
      const steps = h('div', 'psteps');
      const step = (n, cls, em, label, ...extra) => {
        const c = h('div', `pstep ${cls}`, `<span class="pn">${n}</span><div class="pem">${iconHTML(em, 128)}</div><div class="plb">${label}</div>`);
        const act = h('div', 'pact'); act.append(...extra); c.appendChild(act);
        return c;
      };
      const pbtn = (label, fn) => onPick(button(label, 'pbtn'), fn);
      const chip = (text) => h('span', 'pchip', text);
      const ready = !!claudeOk || !making.available;
      steps.append(
        ready ? step(1, 's1', 'chain', 'Connected', chip('Claude is ready'))
              : step(1, 's1 todo', 'key', 'Connect Claude', pbtn('Connect', kitPop)),
        step(2, 's2', 'wrench', 'Build a game', pbtn('+ New game', () => (claudeOk && making.available ? newGamePop() : kitPop()))),
        mine.length
          ? step(3, 's3', 'tv', 'Test it on the TV', pbtn(testing.size ? 'Test or publish' : 'Test a game', () => gamePop(mine.find(x => testing.has(x.manifest.id)) || mine[0])))
          : step(3, 's3 lock', 'tv', 'Test it on the TV', chip('Build a game first')));
      body.appendChild(steps);
    }

    if (!kit) return;

    /* games they've built themselves (Dev Kit), as the Store's cards */
    if (making.available && (mine.length || claudeOk)){
      const sec = row('Your games', '');
      if (!mine.length) sec.appendChild(h('p', 'cempty', 'None yet.'));
      else {
        const shelf = h('div', 'sshelf');
        for (const g of mine){
          const L = looks({ id: g.manifest.id, icon: g.manifest.icon });
          const b = button('', 'slock');
          const meta = h('div', 'smeta');
          meta.append(L.icon('sicon'), h('div', 'stxt', `<div class="nm">${esc(g.manifest.name)}</div><div class="sub">${esc(g.manifest.blurb || '')}</div>`));
          const thumb = L.art('sthumb');
          b.insertBefore(thumb, b.firstChild);
          b.querySelector('.lbl').replaceWith(meta);
          /* its cover, if it has one (the title's on the art) */
          const dress = (url) => { thumb.style.backgroundImage = `url(${url})`; thumb.classList.add('shot'); b.classList.add('covered'); };
          const cv = coverFor({ id: g.manifest.id, name: g.manifest.name, version: g.manifest.version, icon: g.manifest.icon, cover: g.manifest.cover }, dress);
          if (cv) dress(cv);
          const chip = testing.has(g.manifest.id) ? 'Testing' : published.has(g.manifest.id) ? 'Published' : '';
          if (chip) thumb.appendChild(h('span', 'newchip', chip));
          onPick(b, () => gamePop(g));
          shelf.appendChild(b);
        }
        sec.appendChild(shelf);
      }
    }

  }
  /* Create Pro open and in view: "still here" to the family's server, so the TV knows a creator is testing */
  if (kit){
    const beat = () => { if (!s.isConnected){ clearInterval(beatT); return; } if (!document.hidden) tv.here(); };
    const beatT = setInterval(beat, 10000);
    beat();
  }
  draw();
  refreshMine();

  /* (leaving: no card left over the next page) */
  for (const k of Object.keys(nav)){ const go = nav[k]; nav[k] = () => { closePop(); go(); }; }
  return scene;
}

/* The clean menus (decision 0045): the two squares logo and the wordmark, the big Home button, the one loading pattern, pause, results, and the
   U6 fixes (no emoji picture picker, painted icons). Pictures of every screen are in docs/u5/. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resetDom } from './harness/browser.mjs';
const ui = resetDom();
/* the little DOM has no canvas and no animation frames: a canvas draws nothing, and Cubo's loop never runs */
const El = document.createElement('div').constructor;
El.prototype.getContext = () => null;
globalThis.requestAnimationFrame = () => 0;
const { twoSquares, hopSquares, logo, icon, ICON_NAMES, homeButton, loader, GAME_PROP } = await import('../src/ui/brand.js');
const { results, pauseOverlay } = await import('../src/ui/screens.js');
const { resultWords, countText } = await import('../src/ui/units.js');
const read = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8');

const text = (el) => [el._text, ...el.children.map(text)].join('');
const all = (el, cls) => el.querySelectorAll('.' + cls);

test('the mark is two squares, a blue one and a violet one, with no face; the wordmark has "Play" in the gradient', () => {
  const svg = twoSquares();
  assert.equal((svg.match(/<rect/g) || []).length, 2, 'two squares');
  assert.ok(svg.includes('sq-b') && svg.includes('sq-v'), 'blue and violet');
  assert.ok(!/circle|ellipse|eye|mouth/i.test(svg), 'no face');
  const l = logo();
  assert.equal(l.className, 'lg');
  assert.ok(l.innerHTML.includes('<b>Orlis <i>Play</i></b>'), 'Orlis, then Play in its own gradient element');
  assert.ok(logo({ light: true }).classList.contains('light'), 'a light one for dark art');
  assert.ok(hopSquares().includes('class="b sq-b"') && hopSquares().includes('class="v sq-v"'), 'the loading mark has the two squares to hop');
});

test('the look has no cube, no blobs and no emoji left in the menus', () => {
  const css = read('clean.css') + read('clean-home.css') + read('clean-screens.css') + read('clean-account.css') + read('clean-settings.css') + read('clean-create.css');
  assert.ok(!/launchhead|cubotwirl/.test(read('ui/launch.js')), 'no twirling head on the launch cover');
  assert.ok(!/frontScene[\s\S]*cube\(/.test(read('ui/front.js')), 'the sign-in picture has no cube');
  assert.ok(!/glow\(/.test(read('ui/front.js')) && !/glow\(/.test(read('ui/boot.js')), 'no gradient blobs in the intro or behind sign-in');
  assert.ok(css.includes('--ink') || read('style.css').includes('--ink:#1d1b2e'), 'the near-black ink is a token');
  for (const f of ['ui/home.js', 'ui/menu.js', 'ui/tabs.js', 'ui/brand.js', 'ui/screens.js', 'ui/kid-editor.js', 'ui/create-home.js', 'ui/create-studio.js']) assert.ok(!/\\u\{1F|[\u{1F300}-\u{1FAFF}]/u.test(read(f).replace(/AVATARS[\s\S]*?\};/, '')), f + ' has no emoji');
  for (const w of ['--ink:#1d1b2e', '--paper:#f4f5f9', '--grad:linear-gradient(120deg,#3da9ff,#8b5cf6)', '--tv-title', 'font-face']) assert.ok(read('style.css').includes(w.replace('font-face', '"Outfit"')) || w === 'font-face' && read('style.css').includes('"Outfit"'), w);
});

test('every icon is a drawing in currentColor, and the set has what the screens need', () => {
  for (const n of ['house', 'play', 'again', 'gear', 'person', 'out', 'get', 'back', 'link', 'key', 'hammer', 'tv', 'slot', 'clock', 'plus', 'pencil']) assert.ok(ICON_NAMES.includes(n), n);
  for (const n of ICON_NAMES) { const s = icon(n); assert.ok(s.startsWith('<svg class="i"') && s.includes('currentColor'), n); }
});

test('every screen but Home has a big Home button in the logo\'s place', () => {
  let went = 0;
  const b = homeButton(() => went++);
  assert.ok(b.classList.contains('btn') && b.classList.contains('homebtn'));
  assert.ok(text(b).includes('Home') || b.innerHTML.includes('Home'));
  b.dispatchEvent(new CustomEvent('pick'));
  assert.equal(went, 1, 'a wave picks it');
  const bar = read('ui/tabs.js');
  assert.ok(bar.includes('homeButton') && !bar.includes("'Discover'"), 'the top of the other pages is the Home button, with no tabs');
  for (const f of ['ui/menu.js', 'ui/account.js']) assert.ok(read(f).includes('homeButton'), f);
  assert.ok(read('clean.css').includes('.btn.homebtn'), 'styled where the logo sits');
});

test('loading is the two squares hopping with the game\'s name card', () => {
  const el = loader({ name: 'Pop Party', line: 'Reach up and pop the balloons', cover: 'data:x' });
  assert.ok(el.innerHTML.includes('class="hop"'), 'the hop');
  const card = all(el, 'loadcard')[0];
  assert.ok(card, 'the name card');
  assert.equal(text(card.querySelector('.lwords').querySelector('b')), 'Pop Party');
  assert.ok(read('ui/launch.js').includes('loader('), 'the launch cover uses it');
  assert.ok(!all(loader(), 'loadcard').length, 'no card when no game is named');
});

const GAME = { id: 'pop-party', name: 'Pop Party', accent: '#ff5d8f', unit: 'points' };
const kids = [{ i: 0, name: 'Mia', look: {}, color: '#3da9ff', value: 12 }, { i: 1, name: 'Leo', look: {}, color: '#ff8a3d', value: 9 }, { i: 2, name: 'Ava', look: {}, color: '#22c55e', value: 17 }];

test('results: the count big with the game\'s icon, "New best!", each child\'s face and count, then Play again and Home', () => {
  const ui2 = resetDom(); El.prototype.getContext = () => null;
  let again = 0, home = 0;
  results(GAME, () => again++, () => home++, 'Home', { line: 'You got 38 points', best: true }, { total: 38, kids });
  const s = ui2.querySelector('.end');
  assert.ok(s && s.classList.contains('gamecard'));
  assert.equal(text(s.querySelector('.gbig').querySelector('b')), '38', 'the family total, big');
  assert.ok(text(s.querySelector('.gbig')).includes('balloonspopped') || text(s.querySelector('.gbig').querySelector('span')).includes('balloons'), 'in the game\'s words');
  assert.ok(s.querySelector('.gico'), 'its painted icon');
  assert.ok(s.querySelector('.newbest'), 'New best');
  const pills = all(s, 'gkid');
  assert.equal(pills.length, 3, 'a pill each, in seat order');
  assert.deepEqual(pills.map(p => text(p.querySelector('.gkname'))), ['Mia', 'Leo', 'Ava']);
  assert.deepEqual(pills.map(p => text(p.querySelector('b'))), ['12', '9', '17']);
  assert.equal(pills[1]._listeners && 0, 0);
  const [b1, b2] = all(s, 'cbtn');
  assert.ok(b1.innerHTML.includes('Play again') && b2.innerHTML.includes('Home'));
  assert.ok(b1.classList.contains('ringed') && b2.classList.contains('ringed'), 'both have the hand ring');
  b1.dispatchEvent(new CustomEvent('pick')); b2.dispatchEvent(new CustomEvent('pick'));
  assert.deepEqual([again, home], [1, 1]);
});

test('results: no count when nobody scored; no New best without a best; a story says Read again', () => {
  const ui2 = resetDom(); El.prototype.getContext = () => null;
  results(GAME, () => {}, () => {}, 'Back to Create', null, { total: 0, kids: [] });
  assert.ok(!ui2.querySelector('.gbig') && !ui2.querySelector('.newbest') && !ui2.querySelector('.gkids'));
  assert.ok(all(ui2, 'cbtn')[1].innerHTML.includes('Back to Create'), 'a game being tried goes back to Create');
  const ui3 = resetDom(); El.prototype.getContext = () => null;
  results({ ...GAME, passive: true }, () => {}, () => {}, 'Home', { line: 'The end of the story' }, { total: 0, kids: [] });
  assert.ok(all(ui3, 'cbtn')[0].innerHTML.includes('Read again'));
});

test('the words under the count: the game\'s own, singular for one, its unit otherwise', () => {
  assert.deepEqual(resultWords({ id: 'pop-party' }, 38), ['balloons', 'popped']);
  assert.deepEqual(resultWords({ id: 'pop-party' }, 1), ['balloon', 'popped']);
  assert.deepEqual(resultWords({ id: 'leaf-pile' }, 1), ['leaf', 'swept']);
  assert.deepEqual(resultWords({ id: 'x', unit: 'moves' }, 5), ['moves']);
  assert.deepEqual(resultWords({ id: 'x' }, 1), ['point']);
  assert.equal(countText(1, 'balloons'), '1 balloon');
  assert.ok(GAME_PROP['pop-party'][0] === 'balloon', 'Pop Party\'s painted balloon');
});

test('pause: a card on the left with the name, the time left, a Who\'s who slot and the big Keep playing and Home buttons', () => {
  const ui2 = resetDom(); El.prototype.getContext = () => null;
  let kept = 0, left = 0;
  const s = pauseOverlay(GAME, 103, () => kept++, () => left++, 'Home');
  assert.ok(s.classList.contains('pause') && s.classList.contains('gamecard') && s.classList.contains('dim'));
  assert.equal(text(s.querySelector('h3')), 'Pop Party');
  assert.equal(text(s.querySelector('.gleft')), '1:43 left');
  assert.ok(s.querySelector('.pwho'), 'where who\'s who goes (main.js)');
  const [keep, home] = all(s, 'cbtn');
  assert.ok(keep.innerHTML.includes('Keep playing') && home.innerHTML.includes('Home'));
  keep.dispatchEvent(new CustomEvent('pick')); home.dispatchEvent(new CustomEvent('pick'));
  assert.deepEqual([kept, left], [1, 1]);
  const endless = pauseOverlay(GAME, null, () => {}, () => {});
  assert.ok(!endless.querySelector('.gleft'), 'no clock for an endless game');
  assert.ok(read('main.js').includes(".querySelector('.pwho').appendChild(whoRow("), 'who\'s who goes in the card');
});

test('U6: Edit child has no emoji picture picker (the avatar maker is the picture); a new child goes on to the maker', () => {
  const src = read('ui/kid-editor.js');
  assert.ok(!src.includes('pictures(') && !src.includes('AVATARS') && !src.includes("'avatars'"), 'no picker');
  assert.ok(src.includes('Change avatar') && src.includes('openMaker(made'), 'the avatar maker');
  assert.ok(!/avatar: pick/.test(src), 'the picture is not sent');
});

test('U6: Create Pro\'s cards use painted icons', () => {
  const src = read('ui/create.js');
  assert.ok(!/\\u\{1F(517|511|6E0|4FA|6A7)\}/.test(src), 'no emoji');
  for (const n of ["icon('link')", "icon('key')", "icon('hammer')", "icon('tv')"]) assert.ok(src.includes(n), n);
});

test('U6: Pending approval says what happens next; the back button is a Home button that is not covered', () => {
  const src = read('ui/create.js');
  assert.ok(src.includes("notice('clock', 'Pending approval'") && src.includes('As soon as they say yes'), 'a line on what happens next, with a picture');
  assert.ok(!read('style.css').includes('.btn.burger.cubebtn{ width:12.6vh') || !read('ui/tabs.js').includes('burger'), 'no cube button over the page');
  assert.ok(read('clean-create.css').includes('.ctop{ position:absolute; left:0; top:0; z-index:8; }'));
});

test('error messages keep their wording', () => {
  const acc = read('ui/account.js');
  for (const w of ['Type your email first.', 'That email needs an @ and a dot.', 'Type your password first.', "Orlis is asleep right now. Try again in a little while.", 'The Orlis server needs an update.']) assert.ok(acc.includes(w), w);
  assert.ok(read('ui/kid-editor.js').includes('That didn’t work.'));
});

test('sign-in, Who\'s playing? and Settings are in the clean look at TV size', () => {
  const css = read('clean-account.css') + read('clean-settings.css');
  assert.ok(css.includes('.whoscreen') && css.includes('calc(var(--u)*27)'), 'big faces across the screen');
  assert.ok(css.includes('.setsheet') && css.includes('.setsheet .setrow'), 'Settings as a full-screen sheet');
  assert.ok(read('ui/menu.js').includes("'setscreen', 'setsheet'") && read('ui/menu.js').includes('homeButton(close)'), 'with the Home button');
  assert.ok(!/body\.bigpicture \.screen\.account \.acctcard/.test(read('style.css')), 'no old desktop-size overrides left');
  assert.ok(read('ui/account.js').includes("card.classList.add('whoscreen')"));
});

test('going into a game shows one loading screen at once: no tile opening up first, the card on it from the start', async () => {
  const { launch } = await import('../src/ui/launch.js');
  launch.begin({ url: 'data:x', name: 'Pop Party', blurb: 'Reach up' });
  assert.ok(launch.el.querySelector('.loadhop'), 'the loading screen is up straight away');
  assert.ok(launch.el.querySelector('.loadcard'), 'with the game\'s name card');
  assert.ok(!launch.el.querySelector('.launchname'), 'no first screen (the tile\'s own cover and name)');
  assert.ok(!launch.el.style.backgroundImage, 'no cover painted over the screen');
  launch.card({ title: 'Pop Party' });
  assert.equal(launch.el.querySelectorAll('.loadhop').length, 1, 'asking for the card again adds no second one');
  launch.release(true);
  assert.ok(!/rect|launchname|launchdots/.test(read('ui/launch.js').replace(/\/\*[\s\S]*?\*\//g, '')), 'no tile-opening code left');
  assert.ok(!/rect:/.test(read('ui/home.js').match(/launch\.begin\(\{[^\n]*\}\);/)[0]), 'home does not pass the tile\'s place');
});

test('a game\'s picture is never empty: the loading card falls back to its cover art when no shot is saved', async () => {
  const shots = await import('../src/ui/shots.js');
  assert.equal(typeof shots.coverOf, 'function');
  assert.ok(/coverOf\(g\)/.test(read('ui/home.js').match(/launch\.begin\(\{[^\n]*\}\);/)[0]), 'the launch uses coverOf, not the saved shot alone');
  const src = read('ui/shots.js').match(/export function coverOf[\s\S]*?\n}\n/)[0];
  assert.ok(src.includes('shotOf(g)') && src.includes('makeCover(g)') && src.includes('generatedArt'), 'saved shot, else its own art, else a generated one');
});

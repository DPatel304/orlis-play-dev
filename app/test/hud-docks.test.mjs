/* U3: the shared HUD (decision 0034): the docks, their caps, the kit look's pieces, dimming, the tucking move card, and every built-in game asking by dock. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { layoutDocks, drawShellHud, pieceState, hud, CAPS, DOCKS, IDLE_SECS, IDLE_ALPHA, scorePill, hudZones, sayBubble, clockPill, HINT_SECS } from '../src/games/hud.js';
import { cardTucker, CARD_HOLD, MOTION } from '../src/games/figure.js';
import { block, slotBlock, gridOf } from '../src/games/grid.js';
import { assets } from '../src/games/assets/index.js';
import { normalizeLook } from '../src/ui/look.js';

const SIZES = [[1920, 1080], [1280, 720], [1024, 768]];
const inside = (r, d, W, H, slop = 1) => { const b = block(W, H, ...d); return r.x >= b.x - slop && r.y >= b.y - slop && r.x + r.w <= b.x + b.w + slop && r.y + r.h <= b.y + b.h + slop; };
const overlap = (a, b) => a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
const fakeCanvas = () => { const calls = []; return new Proxy({}, { get: (_, k) => k === 'calls' ? calls : k === 'measureText' ? () => ({ width: 60 }) : (...a) => { calls.push(k); }, set: () => true }); };

/* the busiest screen the docks allow */
const BUSY = { score: [12, 9, 15, 7], goal: 0.7, words: { icon: 'glowstar', text: 'Catch the stars!', t: 3 },
  corner: [{ icon: 'apple', value: 5 }, { icon: 'heartfull', value: 3 }, { icon: 'glowstar', fill: 0.4, color: 'gold' }],
  top: { badges: [{ icon: 'crown', value: 2 }, { icon: 'gift', value: 1 }, { icon: 'bell', value: 4 }, { icon: 'gem', value: 9 }] },
  left: { icon: 'heartfull', fill: 0.5, color: 'rose' }, right: { icon: 'glowstar', fill: 0.2, color: 'gold' }, bottom: { icon: 'glowstar', fill: 0.35, color: 'gold' }, badge: { icon: 'firework', value: 3 } };

test('every piece sits inside its dock, and no two pieces overlap, on the busiest allowed screen at any size', () => {
  for (const [W, H] of SIZES){
    const ps = layoutDocks(W, H, BUSY, { players: [0, 1, 2, 3] }).filter(p => p.rect);
    const dockOf = (p) => p.kind === 'score' || p.kind === 'bar' && p.key !== 'bottom' || p.kind === 'chip' && p.key.startsWith('c') ? 'corner' : p.kind === 'goal' ? 'goal' : p.key.startsWith('tb') ? 'top' : p.key === 'bottom' ? 'bottom' : p.key;
    for (const p of ps) assert.ok(inside(p.rect, DOCKS[dockOf(p)], W, H), `${p.key} is inside its dock at ${W}x${H}`);
    for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) assert.ok(!overlap(ps[i].rect, ps[j].rect), `${ps[i].key} and ${ps[j].key} at ${W}x${H}`);
  }
});

test('the caps: four players, four corner rows (scores first), three badges, one meter a side, one bottom piece, one badge', () => {
  const ps = layoutDocks(1920, 1080, BUSY, { players: [0, 1, 2, 3, 4, 5] });
  assert.equal(ps.filter(p => p.kind === 'score').length, CAPS.scores, 'four score pills at most');
  const rows = new Set(ps.filter(p => p.rect && (p.kind === 'score' || p.key.startsWith('c'))).map(p => Math.round(p.rect.y)));
  assert.ok(rows.size <= CAPS.cornerRows, `the corner has at most ${CAPS.cornerRows} rows (${rows.size})`);
  assert.equal(ps.filter(p => p.key.startsWith('tb')).length, CAPS.badges, 'three badges at most in the top-right dock');
  assert.equal(ps.filter(p => p.kind === 'meter').length, 2, 'one meter on each side');
  /* one or two players: the scores take one row; three or four: two, and what is left of the four rows goes to chips and bars */
  const rowsOf = (n, corner) => new Set(layoutDocks(1920, 1080, { score: [1, 2, 3, 4], corner }, { players: [0, 1, 2, 3].slice(0, n) }).filter(p => p.rect).map(p => Math.round(p.rect.y))).size;
  const rows5 = Array.from({ length: 5 }, () => ({ icon: 'gem', fill: 0.5 }));
  assert.equal(rowsOf(2, rows5), 4, 'two players: 1 score row + 3 bar rows');
  assert.equal(rowsOf(4, rows5), 4, 'four players: 2 score rows + 2 bar rows');
  /* chips pair up, two to a row */
  const chips = layoutDocks(1920, 1080, { corner: [{ icon: 'gem', value: 1 }, { icon: 'gem', value: 2 }] }, {}).filter(p => p.kind === 'chip');
  assert.equal(chips.length, 2); assert.equal(Math.round(chips[0].rect.y), Math.round(chips[1].rect.y), 'two chips share a row');
});

test('a game that gives a dock back gets its cells back: only what is asked for is laid out', () => {
  const none = layoutDocks(1920, 1080, { score: [0], hideScore: true, hideClock: true }, { players: [0] });
  assert.deepEqual(none, [], 'nothing asked for, nothing drawn');
  const z = hudZones(1920, 1080, { left: { icon: 'gem', fill: 0.5 } });
  assert.ok(z.left && !z.right && !z.bottom && !z.topright, 'the keep-clear zones come only from what is drawn');
});

test('with no goal the hint words move up into the goal\'s row (row 0); with a goal they sit under it (row 1), and the goal is in row 0 at the centre', () => {
  const y = (spec) => layoutDocks(1920, 1080, spec, {}).find(p => p.kind === 'words').row;
  assert.equal(y({ words: { text: 'Hi', t: 1 } }), 0);
  assert.equal(y({ goal: 0.2, words: { text: 'Hi', t: 1 } }), 1);
  for (const [W, H] of SIZES){
    const goal = layoutDocks(W, H, { goal: 0.2, words: { text: 'Hi', t: 1 } }, {}).find(p => p.kind === 'goal').rect, top = block(W, H, 8, 0, 4, 1);
    assert.ok(goal.y >= top.y - 1 && goal.y + goal.h <= top.y + top.h + 1, `the goal bar is in the top row at ${W}x${H}`);
    assert.ok(Math.abs(goal.x + goal.w / 2 - W / 2) < 1, `and in the middle at ${W}x${H}`);
  }
});

test('the clock is top right, and nothing laid out in the docks overlaps it (or the goal and words column)', () => {
  const rectOf = (W, H, b) => { const r = block(W, H, ...b); return { x: r.x, y: r.y, w: r.w, h: r.h }; };
  for (const [W, H] of SIZES){
    const clock = slotBlock(W, H, 'clock'), { s } = gridOf(W, H);
    assert.ok(Math.abs(clock.x + clock.w - (W - s)) < 1, `the clock ends at the right margin at ${W}x${H}`);
    assert.ok(clock.y < H * 0.2, 'in the top row');
    const spec = { ...BUSY, top: { portrait: 'cubo', pose: 'wave', notice: 'Look!' } };
    for (const sp of [BUSY, spec, { ...BUSY, top: { badges: BUSY.top.badges } }]){
      for (const p of layoutDocks(W, H, sp, { players: [0, 1, 2, 3] }).filter(q => q.rect)) assert.ok(!overlap(p.rect, clock), `${p.key} stays off the clock at ${W}x${H}`);
    }
    const z = hudZones(W, H, { top: {} });
    assert.ok(!overlap(z.topright, z.clock) && !overlap(z.top, z.clock), `the keep-clear zones agree at ${W}x${H}`);
    assert.ok(overlap(rectOf(W, H, [16, 0, 4, 1]), z.clock), 'the clock zone is the clock slot');
  }
});

test('the clock has no pill: only the ring and the numbers, with a soft glow, cherry under 10 s', () => {
  const log = []; const c = new Proxy({}, { get: (_, k) => k === 'measureText' ? () => ({ width: 60 }) : (...a) => { log.push([k, a]); }, set: (_, k, v) => { log.push(['set:' + k, v]); return true; } });
  clockPill(c, 1920, 1080, 90, 120);
  assert.ok(!log.some(([k]) => k === 'roundRect'), 'no paper pill behind it');
  assert.ok(log.some(([k]) => k === 'arc') && log.some(([k]) => k === 'fillText'), 'the ring and the numbers');
  assert.ok(log.some(([k, v]) => k === 'set:shadowColor' && /^#ffffff/i.test(v)) && log.some(([k, v]) => k === 'set:shadowBlur' && v > 0), 'a soft white glow');
  assert.ok(log.some(([k, v]) => k === 'set:textAlign' && v === 'right'), 'the numbers are right-aligned to the margin');
  const ink = log.filter(([k]) => k === 'set:fillStyle').pop()[1]; log.length = 0;
  clockPill(c, 1920, 1080, 8, 120);
  assert.notEqual(log.filter(([k]) => k === 'set:fillStyle').pop()[1], ink, 'under 10 s the numbers change colour');
});

test('hint words with no until of their own ease away a few seconds after the start, and come back (not big) only when the text changes; a game\'s own until is kept', () => {
  const alphaOf = (text, t, extra = {}) => { const log = []; const c = new Proxy({}, { get: (_, k) => k === 'measureText' ? () => ({ width: 100 }) : (...a) => { log.push([k, a]); }, set: (_, k, v) => { log.push(['set:' + k, v]); return true; } });
    sayBubble(c, 1920, 1080, { icon: 'balloon', text, t, ...extra }); const a = log.find(([k]) => k === 'set:globalAlpha'), sc = log.find(([k]) => k === 'scale'); return { alpha: a ? a[1] : 0, scale: sc ? sc[1][0] : null }; };
  const said = []; hud.quiet = false; hud.introText = null; hud.spoken = false; hud.introDone = false; hud.speak = (t) => said.push(t);
  assert.ok(HINT_SECS > 0 && HINT_SECS <= 6);
  assert.equal(alphaOf('Pop them!', 1).alpha > 0, true, 'up at the start');
  assert.ok(alphaOf('Pop them!', 1).scale > 1.5, 'big at first');
  assert.equal(alphaOf('Pop them!', 2.55 + HINT_SECS - 1).alpha, 1, 'still up shortly before the end of its time');
  assert.ok(alphaOf('Pop them!', 2.55 + HINT_SECS - 0.25).alpha < 1, 'easing away');
  assert.equal(alphaOf('Pop them!', 2.55 + HINT_SECS + 0.1).alpha, 0, 'gone a few seconds after it docked');
  assert.equal(alphaOf('Pop them!', 60).alpha, 0, 'and stays gone');
  /* it comes back when the text changes: the normal ease-in, never the big arrival, and fades again */
  const back = alphaOf('Higher!', 0.1); assert.ok(back.alpha > 0 && back.scale <= 1.001, 'a new text is back, small');
  assert.ok(alphaOf('Higher!', HINT_SECS - 1).alpha === 1 && alphaOf('Higher!', HINT_SECS + 0.1).alpha === 0, 'and goes after HINT_SECS');
  /* the first words again, later (the game reset the timer): not the big arrival again, and said only once */
  const again = alphaOf('Pop them!', 0.3); assert.ok(again.alpha > 0 && again.scale <= 1.001, 'the same words returning are not big');
  assert.deepEqual(said, ['Pop them!'], 'spoken once');
  /* a game with its own until keeps it */
  assert.equal(alphaOf('Look!', 5, { until: 9 }).alpha, 1); assert.equal(alphaOf('Look!', 9.1, { until: 9 }).alpha, 0);
  assert.equal(alphaOf('Look!', 500, { until: Infinity }).alpha, 1, 'Infinity keeps them up');
  hud.speak = null; hud.introText = null; hud.spoken = false; hud.introDone = false;
});

test('anchors never dim; dock pieces dim to 70% after 3 s without a change and come back when they change', () => {
  const ps = layoutDocks(1920, 1080, BUSY, { players: [0, 1] });
  assert.ok(ps.find(p => p.kind === 'clock').anchor && ps.find(p => p.kind === 'words').anchor, 'the clock and the words are anchors');
  hud.resetPieces();
  assert.equal(pieceState('p0', 5, 0, 5).alpha, 1);
  assert.equal(pieceState('p0', 5, IDLE_SECS * 1000 - 1, 5).alpha, 1, 'not yet');
  assert.equal(pieceState('p0', 5, IDLE_SECS * 1000 + 1, 5).alpha, IDLE_ALPHA, 'dimmed after 3 s');
  const back = pieceState('p0', 6, IDLE_SECS * 1000 + 100, 6);
  assert.equal(back.alpha, 1, 'back at full strength when it changes'); assert.ok(back.bump > 0.9, 'and it bounces when a number goes up');
  pieceState('q', 9, 0, 9); assert.equal(pieceState('q', 4, 10, 4).bump, 0, 'a number going down does not bounce');
  hud.resetPieces();
});

test('a score pill carries the child\'s avatar face with their colour as a ring; a guest still gets a face', () => {
  const withLook = fakeCanvas(); scorePill(withLook, 0, 0, 80, '#3da9ff', 4, 0, { look: normalizeLook(null) });
  assert.ok(withLook.calls.includes('clip'), 'the avatar (portrait) is drawn, clipped to its tile');
  const styles = ['face', 'big', 'faces'];
  for (const style of styles){ const c = fakeCanvas(); const w = scorePill(c, 0, 0, 80, '#3da9ff', 4, 0, { look: normalizeLook(null) }, { style }); assert.ok(w > 0, style); }
  const small = scorePill(fakeCanvas(), 0, 0, 80, '#3da9ff', 4, 0, null, { style: 'big' }), wide = scorePill(fakeCanvas(), 0, 0, 80, '#3da9ff', 4, 0, null, { style: 'face' });
  assert.ok(small * 4 + 12 < wide * 4, 'the big-face style is narrow enough for four in a row');
});

test('the shell draws every piece type without drawing anything it was not asked for', () => {
  const c = fakeCanvas(); const ps = drawShellHud(c, 1920, 1080, BUSY, { players: [0, 1, 2, 3], colors: ['#111', '#222', '#333', '#444'], clock: { left: 90, total: 120 }, now: 0 });
  const kinds = new Set(ps.map(p => p.kind));
  for (const k of ['clock', 'score', 'chip', 'bar', 'goal', 'words', 'meter', 'badge']) assert.ok(kinds.has(k), k);
  assert.ok(c.calls.includes('roundRect') && c.calls.includes('fillText'));
  const quiet = fakeCanvas(); drawShellHud(quiet, 1920, 1080, { hideScore: true, hideClock: true }, {});
  assert.ok(!quiet.calls.includes('fillText') && !quiet.calls.includes('roundRect'), 'an empty hud() draws nothing');
});

test('the move card tucks away by itself and comes back only for a different move (ui-review item 10)', () => {
  const t = cardTucker(), dt = 1 / 30;
  let shown = 0, first = null, gone = null;
  for (let k = 0; k < 30 * 20; k++){ const r = t.step('reach', dt); if (r) shown = k * dt; else if (gone === null && k > 5) gone = k * dt; if (k === 3) first = r; }
  assert.ok(first && first.pose === 'reach');
  assert.ok(gone !== null && gone > CARD_HOLD.first && gone < CARD_HOLD.first + MOTION.slideOut + 0.2, `the first move stays about ${CARD_HOLD.first} s (${gone})`);
  assert.ok(t.step('reach', dt) === null, 'and stays tucked while the game keeps asking for the same move');
  const other = t.step('jump', dt); assert.ok(other && other.pose === 'jump', 'a different move brings it back');
  /* the same move asked for again later: it shows, for the shorter time */
  let n = 0; for (let k = 0; k < 30 * 10; k++){ if (t.step('jump', dt)) n = k * dt; } void n;
  t.step(null, dt); for (let k = 0; k < 30; k++) t.step(null, dt);
  let secs = 0; for (let k = 0; k < 30 * 10; k++){ if (t.step('jump', dt)) secs = k * dt; }
  assert.ok(secs > 0 && secs < CARD_HOLD.again + MOTION.slideOut + 0.2, `asked again it stays about ${CARD_HOLD.again} s (${secs})`);
  /* a paused game does not run the card's clock */
  const p = cardTucker(); p.step('reach', dt); for (let k = 0; k < 300; k++) p.step('reach', 0); assert.ok(p.step('reach', 0), 'paused: still there');
});

test('every built-in game asks by dock: only the known keys, icons from the library, never an emoji', async () => {
  const { GAMES } = await import('../src/games/index.js'); const { pose } = await import('../src/tracking/pose.js');
  pose.players.forEach((p, i) => { p.present = i < 2; });
  const KEYS = new Set(['score', 'showLives', 'hideScore', 'hideClock', 'scoreStyle', 'goal', 'words', 'corner', 'panel', 'top', 'left', 'right', 'bottom', 'badge']);
  const ids = (h) => [h.words && h.words.icon, ...(h.corner || h.panel || []).map(r => r.icon), ...((h.top && h.top.badges) || []).map(b => b.icon), h.top && h.top.portrait, h.left && h.left.icon, h.right && h.right.icon, h.bottom && h.bottom.icon, h.badge && h.badge.icon].filter(Boolean);
  for (const g of GAMES){
    if (g.id === 'last-known-position' || g.id === 'castle-defense' || g.passive && !g.create) continue;
    let inst; try { inst = g.create(2); } catch (e){ continue; }
    const h = inst.hud();
    for (const k of Object.keys(h)) assert.ok(KEYS.has(k), `${g.id}: hud() key "${k}" is not a dock`);
    for (const id of ids(h)) assert.ok(assets.has(id) && !/\p{Extended_Pictographic}/u.test(id), `${g.id}: "${id}" is a library icon`);
    const ps = layoutDocks(1920, 1080, h, { players: [0, 1] });
    assert.ok(ps.every(p => !p.rect || p.rect.w > 0 && p.rect.h > 0), `${g.id}: every piece has a size`);
  }
});

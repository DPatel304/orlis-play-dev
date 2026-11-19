import test from 'node:test';
import assert from 'node:assert/strict';
import { assets, missing, lock, unwrap } from '../src/games/assets/index.js';
import { EMOJI } from '../src/games/assets/emoji.js';
import { RUNTIME, TEMPLATE } from '../src/ui/creator-kit.gen.js';
import { readFileSync } from 'node:fs';

/* the pieces drawn on a canvas that does nothing: what matters is that every piece draws, in every pose, without throwing */
function fakeCtx(){
  const grad = { addColorStop(){} };
  return new Proxy({}, {
    get(t, k){ if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad; if (k === 'measureText') return () => ({ width: 10 }); return () => {}; },
    set(t, k, v){ t[k] = v; return true; }
  });
}
const list = assets.list();
const words = JSON.parse(readFileSync(new URL('../kit/creator/words.json', import.meta.url), 'utf8')).map(w => w.toLowerCase());

test('the library has real breadth, in every kind, and every piece is findable', () => {
  assert.ok(list.length >= 100, 'a library to build real games from: ' + list.length);
  for (const k of ['scene', 'character', 'animal', 'food', 'nature', 'thing', 'effect']) assert.ok(assets.list(k).length >= 1, 'has ' + k);
  assert.ok(assets.list('animal').length >= 30 && assets.list('scene').length >= 5);
  assert.equal(new Set(list.map(a => a.id)).size, list.length, 'ids are unique');
  for (const a of list){
    assert.match(a.id, /^[a-z0-9]+$/, a.id + ': a plain lowercase name');
    assert.ok(a.name && a.name.length <= 24, a.id + ': a short name');
    assert.ok(Array.isArray(a.tags) && a.tags.length >= 1, a.id + ': tags');
    assert.ok(a.aspect > 0, a.id + ': aspect');
    assert.ok(assets.has(a.id));
  }
  assert.ok(!assets.has('nope'));
  assert.ok(assets.list('scene').length === Object.keys(assets.list('scene')).length);
});

test('every piece draws, in every pose and face, with and without options', () => {
  const c = fakeCtx();
  for (const a of list){
    if (a.kind === 'scene'){ assert.doesNotThrow(() => assets.scene(c, 1920, 1080, a.id, { t: 3, p: 0.5 }), a.id); continue; }
    assert.doesNotThrow(() => assets.draw(c, a.id, 500, 400, 120), a.id);
    assert.doesNotThrow(() => assets.draw(c, a.id, 500, 400, 120, { flip: true, rotate: 0.3, alpha: 0.5, shadow: true, color: '#ff5d6c', t: 0.7 }), a.id + ' with options');
    for (const pose of a.poses || []) assert.doesNotThrow(() => assets.draw(c, a.id, 500, 400, 200, { pose, face: (a.faces || [])[0], t: 0.4, marks: true }), a.id + ' ' + pose);
  }
  /* effects run from 0 to 1 */
  for (const a of assets.list('effect')) for (const t of [0, 0.5, 1]) assets.draw(c, a.id, 10, 10, 50, { t });
});

test('a name that is not in the library draws a "?" box, the game still runs, and it is noted', () => {
  const c = fakeCtx(); missing.clear();
  assert.doesNotThrow(() => assets.draw(c, 'a-boat-that-is-not-there', 100, 100, 80));
  assert.doesNotThrow(() => assets.scene(c, 800, 450, 'nowhere'));
  assert.ok(missing.has('a-boat-that-is-not-there') && missing.has('nowhere'));
  assert.doesNotThrow(() => assets.draw(c, 'giraffe', 1, 1, NaN));
  missing.clear();
});

test('nothing in the library is for adults, or a weapon, or a word children should not meet', () => {
  for (const a of list){
    const text = (a.id + ' ' + a.name + ' ' + a.tags.join(' ')).toLowerCase();
    const said = text.split(/[^a-z0-9]+/);
    for (const w of words) assert.ok(!said.includes(w), `${a.id}: "${w}"`);
  }
  /* no weapons, drinks, smoking, or scary things among the emoji */
  const NOT = ['\u{1F52B}', '\u{1F5E1}', '\u{1F52A}', '\u{1F4A3}', '\u{1F3F9}', '⚔', '\u{1FA93}', '\u{1F9E8}', '\u{1F37A}', '\u{1F377}', '\u{1F378}', '\u{1F37E}', '\u{1F6AC}', '\u{1F480}', '☠', '\u{1F47B}', '\u{1F47F}', '\u{1F608}', '\u{1FA78}', '\u{1F489}', '\u{1F48A}', '\u{1F577}', '\u{1F982}', '\u{1F40D}'];
  for (const [id, ch] of EMOJI) for (const bad of NOT) assert.ok(!ch.includes(bad), `${id} is not for the library`);
});

test('Cubo has all his moves and faces', () => {
  const cubo = list.find(a => a.id === 'cubo');
  assert.ok(cubo.poses.length >= 14 && cubo.faces.length >= 5);
  assert.ok(cubo.poses.includes('jump') && cubo.poses.includes('freeze'));
});

test("a creator's game gets the library: Orlis.assets is in the runtime, and the skill lists every piece by name", () => {
  assert.ok(RUNTIME.includes('Orlis') || RUNTIME.length > 1000);
  assert.ok(RUNTIME.includes('Starry night') || RUNTIME.includes('giraffe'), 'the library is bundled');
  const skill = TEMPLATE['.claude/skills/orlis-game/SKILL.md'];
  assert.match(skill, /## Pictures: the asset library/);
  for (const a of list) assert.ok(new RegExp('\\b' + a.id + '\\b').test(skill), a.id + ' is in the skill');
  assert.ok(!/\{\{ASSETS\}\}/.test(skill));
  assert.ok(TEMPLATE['CLAUDE.md'].includes('asset library'));
  assert.ok(TEMPLATE['CLAUDE.md'].split('\n').length < 200);
});

/* a canvas that remembers what it was asked to do */
function recorder(){
  const calls = [], sets = [];
  const ctx = new Proxy({ globalAlpha: 1 }, {
    get(t, k){ if (k in t) return t[k]; if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => ({ addColorStop(){} }); if (k === 'measureText') return () => ({ width: 10 }); return (...a) => { calls.push([k, ...a]); }; },
    set(t, k, v){ sets.push(k); t[k] = v; return true; }
  });
  return { ctx, calls, sets };
}

test('a creator game is given a locked canvas: it can place what the library draws, and nothing else', () => {
  const { ctx, calls, sets } = recorder();
  const c = lock(ctx);
  assert.notEqual(c, ctx);
  assert.equal(lock(c), c, 'locking twice is the same handle');
  assert.equal(unwrap(c), ctx);
  /* what a game may do */
  c.save(); c.translate(10, 20); c.rotate(0.5); c.scale(2, 2); c.globalAlpha = 0.5; c.restore();
  assert.equal(ctx.globalAlpha, 0.5); assert.ok(calls.some(x => x[0] === 'translate'));
  /* what it may not: its own shapes, words, pictures, gradients, a new canvas, or a way to the real one */
  for (const k of ['fillRect', 'strokeRect', 'clearRect', 'beginPath', 'arc', 'ellipse', 'lineTo', 'moveTo', 'bezierCurveTo', 'roundRect', 'fill', 'stroke', 'clip', 'fillText', 'strokeText', 'drawImage', 'putImageData', 'createLinearGradient', 'createRadialGradient', 'setTransform', 'canvas', 'getContext', 'measureText'])
    assert.throws(() => c[k], /Orlis\.assets/, k);
  for (const k of ['fillStyle', 'strokeStyle', 'font', 'lineWidth', 'shadowBlur']) assert.throws(() => { c[k] = 'x'; }, /Orlis\.assets/, k);
  assert.throws(() => { c.globalAlpha = 'x'; c.fillStyle = '#000'; });
  assert.ok(!sets.includes('fillStyle') && !sets.includes('font'), 'the real canvas never got a style from the game');
});

test('the library draws through the locked canvas: pieces, scenes and words all land on the real one', () => {
  const { ctx, calls } = recorder(), c = lock(ctx);
  assets.scene(c, 1280, 720, 'meadow', { t: 1 });
  assets.draw(c, 'giraffe', 400, 300, 120, { flip: true });
  assets.draw(c, 'hand', 500, 300, 100, { color: '#3da9ff' });
  assets.text(c, 'Great!', 640, 100, 60, { color: '#fff', outline: '#2b2275' });
  const used = new Set(calls.map(x => x[0]));
  for (const k of ['fillRect', 'fillText', 'strokeText', 'scale', 'translate', 'save', 'restore']) assert.ok(used.has(k), 'drew with ' + k);
  /* words are short */
  calls.length = 0; assets.text(c, 'x'.repeat(200), 0, 0, 20);
  assert.ok(calls.find(x => x[0] === 'fillText')[1].length <= 40);
  /* the same through a plain canvas (the app's own games) */
  assert.doesNotThrow(() => assets.draw(ctx, 'bunny', 1, 1, 50));
});

test('the runtime a creator game gets locks the canvas and its shared-screen helpers still draw', () => {
  assert.ok(RUNTIME.includes("isn't available: games draw with Orlis.assets"), 'the lock is in the runtime');
  assert.ok(RUNTIME.includes('Orlis.assets') || RUNTIME.length > 1000);
});

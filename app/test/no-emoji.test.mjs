/* U4: no emoji on screen. System emoji look different on every device, so the built-in games and the shell's screens use painted icons from
   the asset library (games/assets/icons.js; ui/icons.js for the DOM). This reads the source of the games and the shell, turns every \u escape
   into its character, and fails on any emoji.
   Left alone on purpose (a reviewer may delete them, or they are the library's own table):
     - Last Known Position (lkp-*.js) and Tower Defense (castle-*.js): not part of U3/U4 while the owner decides whether to keep them;
     - games/assets/legacy-emoji.js: the one place old emoji are named, to turn them into icons. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EXEMPT = [/\/lkp-[^/]*\.js$/, /\/castle-[^/]*\.js$/, /assets\/legacy-emoji\.js$/];
const EMOJI = /\p{Extended_Pictographic}|\p{Emoji_Presentation}|\uFE0F|\u200D/u;

const files = (d) => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : /\.(js|mjs|md|json)$/.test(p) ? [p] : []; });
/* "\u{1F388}" and "\u2605" in the source mean the character */
const decode = (s) => s.replace(/\\u\{([0-9a-fA-F]{1,6})\}/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));

function offenders(paths){
  const out = [];
  for (const p of paths){
    const rel = relative(root, p).split('\\').join('/');
    if (EXEMPT.some(r => r.test('/' + rel))) continue;
    /* (creator-kit.gen.js is generated: its first lines hold the bundled runtime, which includes the exempt files above; its skill, CLAUDE.md and game.js are checked) */
    decode(readFileSync(p, 'utf8')).split('\n').filter(l => !(rel.endsWith('creator-kit.gen.js') && l.startsWith('export const RUNTIME'))).forEach((line, i) => { if (EMOJI.test(line)) out.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)}`); });
  }
  return out;
}

test('no emoji in the built-in games, the shell\'s screens, or Create\'s hints and kit', () => {
  const paths = [...files(join(root, 'src/games')), ...files(join(root, 'src/ui')), join(root, 'src/main.js'), ...files(join(root, 'kit/creator/template'))].filter(p => !/\.test\./.test(p));
  const bad = offenders(paths);
  assert.deepEqual(bad, [], 'Use a painted icon from the asset library (assets/icons.js; ui/icons.js iconHTML for the DOM), not an emoji:\n' + bad.slice(0, 30).join('\n'));
});

test('the painted replacements are real: every icon the shell and the games name exists in the library', async () => {
  const { assets } = await import('../src/games/assets/index.js');
  for (const id of ['giraffe', 'bunny', 'bird', 'frog', 'elephant', 'penguin', 'dinosaur', 'fallenleaf', 'volleyball', 'balloon', 'block', 'musicnote', 'snowflake', 'apple', 'pear', 'strawberry', 'feather',
    'dice', 'wind', 'raven', 'basket', 'confetti', 'sparkles', 'glowstar', 'gem', 'volcano', 'palm', 'pinetree', 'roundtree', 'fern', 'egg', 'flower', 'lizard', 'waterfall', 'paintbrush', 'whale', 'sailboat', 'bee',
    'gamepad', 'compass', 'clock', 'pencil', 'chain', 'key', 'wrench', 'tv', 'warning', 'sign', 'crane', 'tag', 'speech', 'pointer', 'acrobat', 'palette', 'rocket', 'helicopter', 'house',
    /* the last emoji pieces, now painted */
    'turtle', 'duck', 'lion', 'panda', 'fox', 'pig', 'sheep', 'cow', 'horse', 'mouse', 'hedgehog', 'ladybug', 'snail', 'crab', 'octopus', 'dolphin', 'koala', 'kangaroo', 'flamingo', 'parrot', 'swan', 'seal',
    'banana', 'orange', 'grapes', 'cherry', 'watermelon', 'carrot', 'cookie', 'icecream', 'pizza', 'sunflower', 'tulip', 'mapleleaf', 'mushroom', 'snowman', 'cactus', 'seedling', 'shell',
    'car', 'train', 'castle', 'tent', 'drum', 'guitar', 'teddy', 'basketball', 'soccerball', 'umbrella', 'balloonemoji'])
    assert.ok(assets.has(id), id);
  /* and an old-style hint still shows: the leading emoji becomes the icon that says the same */
  const { splitHint } = await import('../src/games/assets/legacy-emoji.js');
  assert.deepEqual(splitHint('\u{1F388} Pop the balloons!'), { icon: 'balloon', text: 'Pop the balloons!' });
  assert.deepEqual(splitHint('\u{1F9FF} Mystery'), { icon: '', text: 'Mystery' }, 'an emoji with no icon is dropped, never shown');
  assert.deepEqual(splitHint('Plain words'), { icon: '', text: 'Plain words' });
});

test('every painted icon draws without throwing, at a small and a large size', async () => {
  const { assets } = await import('../src/games/assets/index.js'); const { ICONS } = await import('../src/games/assets/icons.js');
  const c = new Proxy({}, { get: (_, k) => k === 'measureText' ? () => ({ width: 10 }) : (...a) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? { addColorStop(){} } : undefined), set: () => true });
  for (const id of Object.keys(ICONS)) for (const s of [24, 200]) assert.doesNotThrow(() => assets.draw(c, id, 0, 0, s), id);
});

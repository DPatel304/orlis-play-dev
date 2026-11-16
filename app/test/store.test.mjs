import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildOrlis, PACKAGES } from '../kit/build-orlis.mjs';
import { readOrlis, manifestOf } from '../../server/src/orlis-file.js';
import { KIT } from '../src/kit.js';
import { FROM_STORE, STARTER_GAMES } from '../src/games/index.js';

/* The Store's side of the app: games packaged as .orlis files, sharing the
   app's parts through the Game Kit. */
test('Pop Party packs into a .orlis file that runs in the sandbox, carrying no camera or sound engine', async () => {
  const r = await buildOrlis('pop-party');
  const parts = readOrlis(readFileSync(new URL('../../server/starter/pop-party.orlis', import.meta.url)));
  const m = manifestOf(parts);
  assert.equal(m.id, 'pop-party'); assert.equal(m.name, 'Pop Party'); assert.equal(m.version, r.version);
  assert.equal(m.kit, KIT, 'built for the app\'s kit');
  const code = parts['game.js'].toString();
  assert.ok(!/detectForVideo|createGain|getUserMedia|OrlisKit|indexedDB|localStorage\.setItem\(\s*['"]orlis/.test(code), 'none of the app\'s engines or storage');
  assert.ok(code.includes('postMessage') && code.includes('transferToImageBitmap'), 'the sandbox runtime, talking by messages');
  assert.ok(r.bytes < 100 * 1024, 'small');
});

test('the sandbox seals a game off: scripts only, nothing to load or connect to', () => {
  const sb = readFileSync(new URL('../src/ui/sandbox.js', import.meta.url), 'utf8');
  assert.ok(sb.includes("f.setAttribute('sandbox', 'allow-scripts')"), 'no same-origin: no app, account or storage');
  assert.ok(!/allow-same-origin|allow-top-navigation|allow-popups|allow-forms/.test(sb.replace(/\/\*[\s\S]*?\*\//g, '')), 'nothing else allowed');
  assert.match(sb, /default-src 'none'/, 'no internet');
  assert.ok(sb.includes('hasOwnProperty.call(bank, m.name)'), 'only the app\'s own sounds');
  const lib = readFileSync(new URL('../src/ui/library.js', import.meta.url), 'utf8');
  assert.ok(lib.includes('await sandboxed(rec)') && !lib.includes('import(u)'), 'downloaded games only ever run sandboxed');
});

test('the starter games are built in everywhere (playable before the owner lets you in); Store games can still update them', () => {
  for (const id of STARTER_GAMES) assert.ok(!FROM_STORE.has(id), `${id} is built in`);
  assert.ok(PACKAGES['pop-party'], 'Pop Party is still packaged, so the Store can send a newer version');
  const idx = readFileSync(new URL('../src/games/index.js', import.meta.url), 'utf8');
  assert.ok(idx.includes('.filter(g => !(inApp && FROM_STORE.has(g.id)))'));
});

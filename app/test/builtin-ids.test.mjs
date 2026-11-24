/* The server keeps its own short list of the app's built-in games (server/src/builtin.js: the owner can feature them, decision 0058).
   It must be the Home games in app/src/games/index.js, without the HIDDEN ones in app/src/ui/menu.js: same ids, same names, same order. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { GAMES } from '../src/games/index.js';
import { HIDDEN } from '../src/ui/menu.js';
import { BUILT_IN_GAMES } from '../../server/src/builtin.js';

test('the server\'s list of built-in games matches the app\'s Home games', () => {
  const home = GAMES.filter(g => !HIDDEN.has(g.id)).map(g => [g.id, g.name]);
  assert.deepEqual(BUILT_IN_GAMES, home, 'update server/src/builtin.js when a built-in game is added, renamed or hidden');
});

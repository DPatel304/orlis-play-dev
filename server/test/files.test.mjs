import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { folderFiles, checkKey } from '../src/files.js';

const fresh = () => mkdtempSync(join(tmpdir(), 'orlis-files-'));

test('the file store keeps, lists, reads and deletes files by key, as S3 would', async () => {
  const root = fresh(), f = folderFiles(root);
  assert.equal(await f.get('games/a.orlis'), null, 'nothing there yet');
  assert.deepEqual(await f.list('games/'), []);
  await f.put('games/a.orlis', Buffer.from('one'));
  await f.put('games/b.orlis', Buffer.from('two!'));
  assert.equal((await f.get('games/a.orlis')).toString(), 'one');
  const listed = (await f.list('games/')).sort((x, y) => x.key.localeCompare(y.key));
  assert.deepEqual(listed.map(x => [x.key, x.size]), [['games/a.orlis', 3], ['games/b.orlis', 4]]);
  assert.ok(listed.every(x => x.modified > 0));
  assert.ok(existsSync(join(root, 'games', 'a.orlis')), 'on the laptop, it is the data folder as before');
  assert.equal(await f.del('games/a.orlis'), true);
  assert.equal(await f.del('games/a.orlis'), false);
  assert.deepEqual((await f.list('games/')).map(x => x.key), ['games/b.orlis']);
  assert.ok(!readdirSync(join(root, 'games')).some(n => n.endsWith('.part')), 'no half-written files left');
});

test('a key can never step outside the store', () => {
  for (const bad of ['../x', 'games/../../x', '/etc/passwd', 'games\\x', 'games//x', '', 'a/./b']) assert.throws(() => checkKey(bad), bad);
  assert.equal(checkKey('games/pop-party.orlis'), 'games/pop-party.orlis');
});

/* Cubo's Create end to end (decision 0060): the Create tab driven by the remote, by the mouse and by a scripted body, to a saved, playing game and
   back (headless Chromium). The tests live in cubo-create-e2e.node.mjs and run in a plain Node process (see pad-page.test.mjs for why). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('Cubo\'s Create from the real page: remote only, mouse only, body only, slots full, cancelling, the camera check, a second person, the server out of reach (headless Chromium)', async () => {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, ['--test', new URL('./cubo-create-e2e.node.mjs', import.meta.url).pathname], { stdio: ['ignore', 'pipe', 'pipe'], env, cwd: new URL('..', import.meta.url).pathname });
  let out = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
  const code = await new Promise((resolve) => child.on('close', resolve));
  assert.equal(code, 0, 'the Cubo\'s Create end-to-end tests failed:\n' + out.slice(-8000));
  assert.match(out, /# fail 0/);
  assert.match(out, /# pass [1-9]/);
});

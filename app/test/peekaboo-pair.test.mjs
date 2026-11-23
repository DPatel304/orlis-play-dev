/* Peekaboo Garden, both sides together (K4 + K5): the integrated end-to-end test. The tests live in peekaboo-pair.node.mjs and run in a plain Node process
   (see pad-hub.test.mjs for why). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('Peekaboo Garden, real game on the TV and real tablet program together: join, stick, pot, lantern, found, play again, pause and rejoin, hidden (headless Chromium)', async () => {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, [new URL('./peekaboo-pair.node.mjs', import.meta.url).pathname], { stdio: ['ignore', 'pipe', 'pipe'], env, cwd: new URL('..', import.meta.url).pathname });
  let out = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
  const code = await new Promise((resolve) => child.on('close', resolve));
  assert.equal(code, 0, 'the Peekaboo pair tests failed:\n' + out.slice(-6000));
  assert.match(out, /# fail 0/);
  assert.match(out, /# pass [1-9]/);
});

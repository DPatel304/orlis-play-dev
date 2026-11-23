/* The Peekaboo tablet view (plan package K5): the end-to-end test with the Node hub, the built pad page and headless Chromium. The tests live in
   peekaboo-pad.node.mjs and run in a plain Node process (see pad-hub.test.mjs for why). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('Peekaboo tablet view: joins, the stick moves the hider, a pot and "Step out", the lantern glow, found and hidden results (headless Chromium)', async () => {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, [new URL('./peekaboo-pad.node.mjs', import.meta.url).pathname], { stdio: ['ignore', 'pipe', 'pipe'], env, cwd: new URL('..', import.meta.url).pathname });
  let out = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
  const code = await new Promise((resolve) => child.on('close', resolve));
  assert.equal(code, 0, 'the Peekaboo tablet tests failed:\n' + out.slice(-6000));
  assert.match(out, /# fail 0/);
  assert.match(out, /# pass [1-9]/);
});

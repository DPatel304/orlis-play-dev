/* The pad page (plan package P3): spec tests 1 to 3 with real pages in headless Chromium. The tests live in pad-page.node.mjs and run in a
   plain Node process (see pad-hub.test.mjs for why). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('the pad page: joins with the pictures, rejoins by itself, comes straight back with an old token (headless Chromium)', async () => {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, [new URL('./pad-page.node.mjs', import.meta.url).pathname], { stdio: ['ignore', 'pipe', 'pipe'], env, cwd: new URL('..', import.meta.url).pathname });
  let out = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
  const code = await new Promise((resolve) => child.on('close', resolve));
  assert.equal(code, 0, 'the pad page tests failed:\n' + out.slice(-6000));
  assert.match(out, /# fail 0/);
  assert.match(out, /# pass [1-9]/);
});

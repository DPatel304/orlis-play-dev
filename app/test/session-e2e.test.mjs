/* The real host session behind the Node hub with the built pad page (plan package P4): spec tests 1 to 3 of docs/specs/pad-protocol.md.
   The tests live in session-e2e.node.mjs and run in a plain Node process (see pad-page.test.mjs). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('the real session behind the hub: join by pictures, drop and rejoin the same seat, a returning phone comes straight back (headless Chromium)', async () => {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, [new URL('./session-e2e.node.mjs', import.meta.url).pathname], { stdio: ['ignore', 'pipe', 'pipe'], env, cwd: new URL('..', import.meta.url).pathname });
  let out = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
  const code = await new Promise((resolve) => child.on('close', resolve));
  assert.equal(code, 0, 'the session end-to-end tests failed:\n' + out.slice(-6000));
  assert.match(out, /# fail 0/);
  assert.match(out, /# pass [1-9]/);
});

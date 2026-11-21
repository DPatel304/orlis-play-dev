/* The real game shell with a phone (plan packages S1 and P5): the Node hub, the built pad page and the shell on the dev server, running the pad lab.
   The tests live in pads-shell.node.mjs and run in a plain Node process (see session-e2e.test.mjs). */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('the shell with a phone: join card, Start, the stick moves the dot, a dropped phone pauses with the waiting pill and resumes, the Wi-Fi line, trusted phones (headless Chromium)', async () => {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;
  const child = spawn(process.execPath, [new URL('./pads-shell.node.mjs', import.meta.url).pathname], { stdio: ['ignore', 'pipe', 'pipe'], env, cwd: new URL('..', import.meta.url).pathname });
  let out = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
  const code = await new Promise((resolve) => child.on('close', resolve));
  assert.equal(code, 0, 'the shell and phone end-to-end tests failed:\n' + out.slice(-6000));
  assert.match(out, /# fail 0/);
  assert.match(out, /# pass 3/);
});

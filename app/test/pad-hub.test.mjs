/* The pad hub (plan package P1). The tests live in pad-hub.node.mjs and run in a plain Node process: the shared test harness replaces
   Node's Event class (for the games' fake browser), and the WebSocket client the pads use in these tests needs the real one. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

test('the pad hub: spec tests 1, 4 and 5 (join by pictures, host restart, limits) and the hub\'s relay rules', async () => {
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT;      /* (so it runs as its own test run, not as part of this one) */
  const child = spawn(process.execPath, [new URL('./pad-hub.node.mjs', import.meta.url).pathname], { stdio: ['ignore', 'pipe', 'pipe'], env });
  let out = ''; child.stdout.on('data', d => { out += d; }); child.stderr.on('data', d => { out += d; });
  const code = await new Promise((resolve) => child.on('close', resolve));
  const lines = out.split('\n').filter(l => /^(not )?ok |^# (pass|fail)|error:/.test(l)).join('\n');
  assert.equal(code, 0, 'the hub tests failed:\n' + lines + '\n' + (code === 0 ? '' : out.slice(-3000)));
  assert.match(out, /# fail 0/);
  assert.match(out, /# pass [1-9]/);
});

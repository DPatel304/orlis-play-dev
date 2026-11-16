import test from 'node:test';
import assert from 'node:assert/strict';
import { connectSteps, claudeSteps, claudeConnected } from '../src/ui/setup.js';

const states = (steps) => steps.map(s => [s.key, s.state, s.action]);

test('nothing yet: install Tailscale is the step to do, with its button', () => {
  assert.deepEqual(states(connectSteps({ tailscale: { state: 'missing' } })),
    [['install', 'now', 'install'], ['signin', 'later', null], ['share', 'later', null]]);
});

test('installed, not signed in: sign in is next, with its button', () => {
  assert.deepEqual(states(connectSteps({ tailscale: { installed: true, state: 'signin' } })),
    [['install', 'done', null], ['signin', 'now', 'signin'], ['share', 'later', null]]);
});

test('switched off: it says how to switch it on', () => {
  const s = connectSteps({ tailscale: { installed: true, state: 'off' } });
  assert.match(s[1].line, /switch it on/);
});

test('signed in: waiting for the share; found: all done', () => {
  assert.deepEqual(states(connectSteps({ tailscale: { installed: true, state: 'on' } })),
    [['install', 'done', null], ['signin', 'done', null], ['share', 'now', null]]);
  assert.deepEqual(connectSteps({ tailscale: { installed: true, state: 'on' } }, true).map(s => s.state), ['done', 'done', 'done']);
});

test('connect Claude Code: install, then sign in once, then connected', () => {
  const at = (c) => claudeSteps({ claude: c }).map(s => [s.key, s.state, s.action]);
  assert.deepEqual(at({ installed: false }), [['install', 'now', 'install'], ['signin', 'later', null]]);
  assert.deepEqual(at({ installed: true, signedIn: false }), [['install', 'done', null], ['signin', 'now', 'signin']]);
  assert.deepEqual(at({ installed: true, signedIn: true }), [['install', 'done', null], ['signin', 'done', null]]);
  assert.equal(claudeConnected(null), false);
  assert.equal(claudeConnected({ claude: { installed: true, signedIn: true } }), true);
});

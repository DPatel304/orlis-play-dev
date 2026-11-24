import test from 'node:test';
import assert from 'node:assert/strict';
import { net, notFoundWords, call } from '../src/ui/account.js';

test('can\'t find Orlis: online means it is asleep; offline means this laptop is not online', () => {
  const on = notFoundWords(true), off = notFoundWords(false);
  assert.equal(on.heading, 'Orlis is asleep right now');
  assert.match(on.lede, /wake up soon/);
  assert.equal(off.heading, 'This laptop isn’t online');
  assert.match(off.lede, /Connect to Wi-Fi/);
  for (const w of [on, off]) assert.ok(!/server|tailscale/i.test(w.heading + w.lede));
});

test('the online check: any answer from the connection-test address is online, a failure is not', async () => {
  const real = globalThis.fetch; let seen;
  try {
    globalThis.fetch = async (u, o) => { seen = [u, o]; return {}; };
    assert.equal(await net.online(), true);
    assert.equal(seen[0], 'https://www.msftconnecttest.com/connecttest.txt');
    assert.equal(seen[1].mode, 'no-cors');
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    assert.equal(await net.online(), false);
  } finally { globalThis.fetch = real; }
});

test('a call that cannot connect says Orlis is asleep, with status 0', async () => {
  const real = globalThis.fetch;
  try {
    globalThis.fetch = async () => { throw new TypeError('Failed to fetch'); };
    await assert.rejects(call('https://x.example', 'GET', '/api/hello'), (e) => e.status === 0 && e.message === 'Orlis is asleep right now. Try again in a little while.');
  } finally { globalThis.fetch = real; }
});

test('the can\'t-find screen re-checks online or asleep on each retry', async () => {
  const src = (await import('node:fs')).readFileSync(new URL('../src/ui/account.js', import.meta.url), 'utf8');
  assert.ok(/words = notFoundWords\(await net\.online\(\)\);\s*if \(!s\.contains\(me\)\) return;\s*head\.textContent/.test(src));
});

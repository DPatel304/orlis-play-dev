import test from 'node:test';
import assert from 'node:assert/strict';
import { serverUrl } from '../src/ui/account.js';

test('a typed address: an https one (Tailscale Funnel) as it is; a laptop on the Wi-Fi gets http and the port', () => {
  assert.equal(serverUrl('https://orlis.tailb28684.ts.net'), 'https://orlis.tailb28684.ts.net');
  assert.equal(serverUrl(' https://orlis.tailb28684.ts.net/ '), 'https://orlis.tailb28684.ts.net');
  assert.equal(serverUrl('192.168.1.20'), 'http://192.168.1.20:47871');
  assert.equal(serverUrl('http://192.168.1.20:47871'), 'http://192.168.1.20:47871');
  assert.equal(serverUrl('100.101.102.103'), 'http://100.101.102.103:47871');
});

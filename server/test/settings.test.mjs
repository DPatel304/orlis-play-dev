import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { settings, startOptions, DEFAULTS } from '../src/settings.js';

test('on the laptop with nothing set, the defaults', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orlis-set-'));
  assert.deepEqual(settings({ env: {}, defaultDataDir: dir }), { dataDir: dir, ...DEFAULTS });
  assert.equal(startOptions(settings({ env: {}, defaultDataDir: dir })).discoveryPort, 47870);
});

test('settings.json changes them, and the environment wins over both (as a cloud server is set up)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orlis-set-'));
  writeFileSync(join(dir, 'settings.json'), JSON.stringify({ name: 'The Patels', port: 8080, tailscaleJoin: false }));
  const s = settings({ env: { ORLIS_PORT: '9000', ORLIS_DISCOVERY: 'false', ORLIS_PUBLIC_URL: 'https://orlis.example.com/' }, defaultDataDir: dir });
  assert.equal(s.name, 'The Patels');
  assert.equal(s.port, 9000, 'the environment wins');
  assert.equal(s.tailscaleJoin, false);
  assert.equal(s.discovery, false);
  assert.equal(s.publicUrl, 'https://orlis.example.com');
  assert.equal(startOptions(s).discoveryPort, false, 'no Wi-Fi discovery in the cloud');
});

test('a setting that makes no sense is said, not guessed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'orlis-set-'));
  assert.throws(() => settings({ env: { ORLIS_PORT: 'lots' }, defaultDataDir: dir }), /port/);
  assert.throws(() => settings({ env: { ORLIS_PUBLIC_URL: 'http://plain.example.com' }, defaultDataDir: dir }), /https/);
});

test('the download link starts as the regular release stable one, not the Beta installer', () => {
  assert.equal(DEFAULTS.downloadUrl, 'https://github.com/DPatel304/orlis-play-dev/releases/latest/download/Orlis-Play-Setup.exe');
});

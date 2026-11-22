/* The QR encoder for the TV join card (plan package P5). It was checked against a real decoder (jsQR) for every length from 1 to 104 bytes at
   level M and 1 to 132 at level L; those runs are not repeated here (no decoder is installed), so this pins the parts that make a code scannable:
   the Reed-Solomon codewords (a known vector), the finder, timing and format patterns, the version chosen, and golden pictures of the codes
   the app actually shows (their sha-256 hashes were decoded back to their URLs when recorded). */
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { qrMatrix, rsRemainder, drawQR } from '../src/session/qr.js';

const rows = (m) => Array.from({ length: m.size }, (_, y) => Array.from({ length: m.size }, (_, x) => (m.get(x, y) ? '1' : '0')).join('')).join('\n');
const sha = (m) => crypto.createHash('sha256').update(rows(m)).digest('hex');

test('Reed-Solomon: the standard 1-M example gives the standard error-correction codewords', () => {
  assert.deepEqual(rsRemainder([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236, 17, 236, 17], 10), [196, 35, 39, 119, 235, 215, 231, 226, 93, 23]);
  assert.deepEqual(rsRemainder([0, 0, 0], 4), [0, 0, 0, 0]);
});

test('size grows with the text: a LAN address is version 2 or 3 (25 or 29 modules)', () => {
  assert.equal(qrMatrix('http://192.168.1.20:47880/').size, 25);
  assert.equal(qrMatrix('http://192.168.100.100:47880/').size, 29);
  assert.equal(qrMatrix('a').size, 21); assert.equal(qrMatrix('a'.repeat(106)).version, 6);
  assert.throws(() => qrMatrix('a'.repeat(107)), /too long/);
  assert.equal(qrMatrix('a'.repeat(134), 'L').version, 6); assert.throws(() => qrMatrix('a'.repeat(135), 'L'), /too long/);
});

test('the fixed patterns: three finders, timing lines, the dark module', () => {
  const m = qrMatrix('http://10.0.0.5:47881/'), n = m.size;
  const finder = (ox, oy) => { for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) { const edge = x === 0 || y === 0 || x === 6 || y === 6, core = x >= 2 && x <= 4 && y >= 2 && y <= 4; assert.equal(m.get(ox + x, oy + y), edge || core, `finder at ${ox},${oy} module ${x},${y}`); } };
  finder(0, 0); finder(n - 7, 0); finder(0, n - 7);
  for (let i = 8; i < n - 8; i++) { assert.equal(m.get(i, 6), i % 2 === 0, 'row timing'); assert.equal(m.get(6, i), i % 2 === 0, 'column timing'); }
  assert.equal(m.get(8, n - 8), true, 'the dark module');
  for (let i = 0; i < 8; i++) { assert.equal(m.get(7, i), false, 'separator'); assert.equal(m.get(i, 7), false, 'separator'); }
});

test('the format information is valid (BCH) in both places, says level M and the mask used', () => {
  for (const url of ['http://192.168.1.20:47880/', 'http://10.0.0.5:47881/', 'x', 'http://192.168.100.100:47880/']) {
    const m = qrMatrix(url), n = m.size, bit = (x, y) => (m.get(x, y) ? 1 : 0);
    let a = 0, b = 0;
    for (let i = 0; i <= 5; i++) a |= bit(8, i) << i;
    a |= bit(8, 7) << 6; a |= bit(8, 8) << 7; a |= bit(7, 8) << 8;
    for (let i = 9; i < 15; i++) a |= bit(14 - i, 8) << i;
    for (let i = 0; i < 8; i++) b |= bit(n - 1 - i, 8) << i;
    for (let i = 8; i < 15; i++) b |= bit(8, n - 15 + i) << i;
    assert.equal(a, b, 'two copies agree');
    const data = (a ^ 0x5412) >>> 10; let rem = data; for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    assert.equal(((data << 10) | rem) ^ 0x5412, a, 'a valid BCH code word');
    assert.equal(data >>> 3, 0, 'error correction level M'); assert.equal(data & 7, m.mask, 'the mask that was applied');
  }
});

test('golden pictures: the codes the join card shows (each was decoded back to its address when recorded)', () => {
  assert.equal(sha(qrMatrix('http://192.168.1.20:47880/')), 'db3bf850447d4989cc22a66f4fc51fabe1f85c4c3354d871fb24e17a6319e220');
  assert.equal(sha(qrMatrix('http://192.168.100.100:47880/')), '2348d4226960a3b06fc8807d1ed72ea619f953e93f38d8415ec9e9a8e1f3bb08');
  assert.equal(sha(qrMatrix('http://10.0.0.5:47881/')), '17042733aae31bb76243cfa8b4747f5e4de29d1c2a3ba8d8b9b840a04bf1b199');
  assert.equal(sha(qrMatrix('http://10.0.0.5:47881/')), sha(qrMatrix('http://10.0.0.5:47881/')), 'the same every time');
});

test('drawQR paints a light square with the quiet zone and one rectangle per dark module', () => {
  const m = qrMatrix('http://10.0.0.5:47881/'); const calls = [];
  const c = { save() {}, restore() {}, set fillStyle(v) { calls.push(['fill', v]); }, fillRect(...a) { calls.push(['rect', ...a]); } };
  drawQR(c, m, 0, 0, 290, { fg: '#000', bg: '#fff' });
  let dark = 0; for (let y = 0; y < m.size; y++) for (let x = 0; x < m.size; x++) if (m.get(x, y)) dark++;
  const rects = calls.filter(x => x[0] === 'rect');
  assert.equal(rects.length, dark + 1); assert.deepEqual(rects[0].slice(1), [0, 0, 290, 290]);
  const k = 290 / (m.size + 8), first = rects[1];
  assert.ok(first[1] >= 4 * k - 1e-9 && first[2] >= 4 * k - 1e-9, 'nothing dark in the quiet zone');
});

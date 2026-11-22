/* A small QR code encoder for the TV join card (plan package P5): the QR only opens the pad page at the hub's LAN address, so the text is a short
   URL. Byte mode, error correction L, M, Q is not needed; versions 1 to 6 (up to 134 bytes at L, 106 at M), which is far more than a URL.
   No library is in the app, so this is the whole of it (about 150 lines). Checked against a real decoder (see app/test/qr.test.mjs).

     const m = qrMatrix('http://192.168.1.20:47880/');   // m.size, m.get(x, y) -> true for a dark module
     drawQR(ctx, m, x, y, side)                          // paints dark modules on a light square, with the quiet zone */

/* [error-correction codewords per block, blocks of the first size, data codewords in each, blocks of the second size, data codewords in each] */
const BLOCKS = {
  L: [null, [7, 1, 19, 0, 0], [10, 1, 34, 0, 0], [15, 1, 55, 0, 0], [20, 1, 80, 0, 0], [26, 1, 108, 0, 0], [18, 2, 68, 0, 0]],
  M: [null, [10, 1, 16, 0, 0], [16, 1, 28, 0, 0], [26, 1, 44, 0, 0], [18, 2, 32, 0, 0], [24, 2, 43, 0, 0], [16, 4, 27, 0, 0]]
};
const FORMAT = { L: 1, M: 0 };
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]];
const REMAINDER = [0, 0, 7, 7, 7, 7, 7];

/* ---- Reed-Solomon over GF(256), polynomial 0x11D ---- */
const EXP = new Uint8Array(512), LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);
function generator(deg) {
  let g = [1];
  for (let i = 0; i < deg; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) { next[j] ^= g[j]; next[j + 1] ^= mul(g[j], EXP[i]); }
    g = next;
  }
  return g;                                           /* highest power first */
}
export function rsRemainder(data, deg) {
  const g = generator(deg), res = new Array(deg).fill(0);
  for (const b of data) {
    const f = b ^ res.shift(); res.push(0);
    if (f) for (let i = 0; i < deg; i++) res[i] ^= mul(g[i + 1], f);
  }
  return res;
}

/* ---- the bytes: mode, length, text, padding, blocks, interleaved ---- */
function codewords(bytes, level, version) {
  const [ec, n1, d1, n2, d2] = BLOCKS[level][version], total = n1 * d1 + n2 * d2;
  const bits = [], push = (v, n) => { for (let i = n - 1; i >= 0; i--) bits.push((v >>> i) & 1); };
  push(4, 4); push(bytes.length, 8); for (const b of bytes) push(b, 8);
  push(0, Math.min(4, total * 8 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data = []; for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2));
  for (let pad = 0xec; data.length < total; pad ^= 0xec ^ 0x11) data.push(pad);
  const blocks = []; let at = 0;
  for (let b = 0; b < n1 + n2; b++) { const len = b < n1 ? d1 : d2, d = data.slice(at, at + len); at += len; blocks.push({ d, e: rsRemainder(d, ec) }); }
  const out = [], longest = Math.max(d1, d2);
  for (let i = 0; i < longest; i++) for (const b of blocks) if (i < b.d.length) out.push(b.d[i]);
  for (let i = 0; i < ec; i++) for (const b of blocks) out.push(b.e[i]);
  return out;
}

/* ---- the picture ---- */
export function qrMatrix(text, level = 'M') {
  const bytes = [...new TextEncoder().encode(String(text))];
  let version = 1;
  const room = (v) => { const [, n1, d1, n2, d2] = BLOCKS[level][v]; return n1 * d1 + n2 * d2 - 2; };   /* (bytes that fit: the mode and length take two) */
  while (version <= 6 && bytes.length > room(version)) version++;
  if (version > 6) throw new Error('qr: text too long');
  const size = 17 + 4 * version;
  const mod = Array.from({ length: size }, () => new Array(size).fill(false)), fn = Array.from({ length: size }, () => new Array(size).fill(false));
  const setFn = (x, y, dark) => { mod[y][x] = dark; fn[y][x] = true; };

  /* timing, finders with their separators, alignment patterns */
  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx, y = cy + dy; if (x < 0 || y < 0 || x >= size || y >= size) continue;
      const d = Math.max(Math.abs(dx), Math.abs(dy)); setFn(x, y, d !== 2 && d !== 4);
    }
  const al = ALIGN[version];
  for (const cy of al) for (const cx of al) {
    if ((cx === 6 && cy === 6) || (cx === 6 && cy === al[al.length - 1]) || (cy === 6 && cx === al[al.length - 1])) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  /* the format areas are reserved now and written for the chosen mask */
  const formatBits = (mask) => {
    const data = (FORMAT[level] << 3) | mask; let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    return ((data << 10) | rem) ^ 0x5412;
  };
  const drawFormat = (mask) => {
    const bits = formatBits(mask), bit = (i) => ((bits >>> i) & 1) === 1;
    for (let i = 0; i <= 5; i++) setFn(8, i, bit(i));
    setFn(8, 7, bit(6)); setFn(8, 8, bit(7)); setFn(7, 8, bit(8));
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, bit(i));
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, bit(i));
    setFn(8, size - 8, true);
  };
  drawFormat(0);

  /* the data, in the zigzag */
  const cw = codewords(bytes, level, version), nbits = cw.length * 8 + REMAINDER[version];
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, y = ((right + 1) & 2) === 0 ? size - 1 - vert : vert;
      if (!fn[y][x] && i < nbits) { mod[y][x] = i < cw.length * 8 ? ((cw[i >>> 3] >>> (7 - (i & 7))) & 1) === 1 : false; i++; }
    }
  }

  /* the mask with the lowest penalty */
  const MASKS = [(x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];
  const apply = (mask) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[mask](x, y)) mod[y][x] = !mod[y][x]; };
  let best = 0, bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    apply(mask); drawFormat(mask);
    const s = penalty(mod, size); if (s < bestScore) { bestScore = s; best = mask; }
    apply(mask);                                       /* (undo) */
  }
  apply(best); drawFormat(best);
  return { size, version, mask: best, get: (x, y) => mod[y][x] };
}

function penalty(m, n) {
  let p = 0;
  const run = (get) => {
    for (let a = 0; a < n; a++) {
      let len = 1;
      for (let b = 1; b <= n; b++) {
        if (b < n && get(a, b) === get(a, b - 1)) len++;
        else { if (len >= 5) p += 3 + len - 5; len = 1; }
      }
      for (let b = 0; b + 11 <= n; b++) {                /* the 1:1:3:1:1 look-alike with four light modules beside it */
        const w = (k) => get(a, b + k);
        if (w(0) && !w(1) && w(2) && w(3) && w(4) && !w(5) && w(6) && !w(7) && !w(8) && !w(9) && !w(10)) p += 40;
        if (!w(0) && !w(1) && !w(2) && !w(3) && w(4) && !w(5) && w(6) && w(7) && w(8) && !w(9) && w(10)) p += 40;
      }
    }
  };
  run((r, c) => m[r][c]); run((c, r) => m[r][c]);
  for (let y = 0; y + 1 < n; y++) for (let x = 0; x + 1 < n; x++) if (m[y][x] === m[y][x + 1] && m[y][x] === m[y + 1][x] && m[y][x] === m[y + 1][x + 1]) p += 3;
  let dark = 0; for (const r of m) for (const v of r) if (v) dark++;
  p += Math.floor(Math.abs(dark * 20 - n * n * 10) / (n * n)) * 10;
  return p;
}

/* Paint it: a light square (`bg`) with the dark modules (`fg`) and the four-module quiet zone, filling `side` pixels. */
export function drawQR(c, m, x, y, side, { fg = '#2f2b45', bg = '#ffffff' } = {}) {
  const cells = m.size + 8, k = side / cells;
  c.save();
  c.fillStyle = bg; c.fillRect(x, y, side, side);
  c.fillStyle = fg;
  for (let r = 0; r < m.size; r++) for (let q = 0; q < m.size; q++) if (m.get(q, r)) c.fillRect(x + (q + 4) * k, y + (r + 4) * k, Math.ceil(k), Math.ceil(k));
  c.restore();
}

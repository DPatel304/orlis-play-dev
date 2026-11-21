/* A ratchet for raw colours (decision 0040): built-in games and screens may not gain colour codes (#rrggbb, rgb(), hsl()) -
   they move onto assets.color('group.name') one file at a time, when next worked on. Today's counts are in colour-baseline.json.
   A file may have fewer; a file not in the baseline may have none. palette.js (where the colours live) and the generated
   creator-kit.gen.js (the bundled runtime) are exempt.
   After lowering a count: UPDATE_COLOUR_BASELINE=1 node --test test/colours.test.mjs   (rewrites the JSON) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = join(root, 'test/colour-baseline.json');
const RAW = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![0-9a-z])|\b(?:rgb|hsl)a?\s*\(/gi;
const EXEMPT = new Set(['src/games/assets/palette.js', 'src/ui/creator-kit.gen.js']);

function files(d){
  return readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : []; });
}
function count(){
  const now = {};
  for (const d of ['src/games', 'src/ui']) for (const p of files(join(root, d))){
    const rel = relative(root, p).split('\\').join('/');
    if (EXEMPT.has(rel)) continue;
    const n = (readFileSync(p, 'utf8').match(RAW) || []).length;
    if (n) now[rel] = n;
  }
  return Object.fromEntries(Object.entries(now).sort(([a], [b]) => a.localeCompare(b)));
}

test('raw colour codes in built-in games and screens never grow (a ratchet; palette.js is exempt)', () => {
  const now = count();
  if (process.env.UPDATE_COLOUR_BASELINE){ writeFileSync(BASELINE, JSON.stringify(now, null, 1) + '\n'); return; }
  const base = JSON.parse(readFileSync(BASELINE, 'utf8'));
  const grew = Object.entries(now).filter(([f, n]) => n > (base[f] || 0)).map(([f, n]) => `${f}: ${n} (allowed ${base[f] || 0})`);
  assert.deepEqual(grew, [], `Raw colours went up. Use assets.color('group.name') from src/games/assets/palette.js instead of a colour code.\n` +
    'If a file has fewer now, lower the baseline: UPDATE_COLOUR_BASELINE=1 node --test test/colours.test.mjs');
});

/* Replay a tracking recording through the real tracker, with any combination of the Testing switches, and print what it did.

     cd app && node tools/replay.mjs <file> [--switches=steady,apart] [--compare] [--json]
       <file>          orlis-track-<date>.json.gz (or .json) from Settings > Testing > Save recording
       --switches=a,b  the switches on for this run (appearance, zoom, steady, apart, ...); default none (= how the app tracks today)
       --compare       the file under: none, each switch alone, and all together - side by side
       --json          the numbers as JSON

   It feeds each look's people (the body points that were recorded, as pose.js `_assign` got them) to `_assign` and the filters exactly as
   the live tracker does, then draws between looks the way the screen does. Pictures were never recorded: the clothes switch is replayed
   from the colour counts recorded with the looks (if "Recognise players by clothes" was on while recording), and "Look closer" (zoom) is
   already in what was recorded. Coloured wristbands are replayed from the learnt colour ranges and the band blobs recorded with the looks (if "Track
   coloured wristbands" was on while recording; the picture is not needed: the blobs are the evidence). The numbers are explained in tools/playtest/metrics.mjs (dropouts, jumps, suspect swaps, jitter, lag,
   join time); there is no ground truth in a recording, so swaps are a proxy (a slot ends a crossing where the other one was heading). */
import '../test/harness/browser.mjs';
import { register } from 'node:module';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
register('../test/harness/hooks.mjs', import.meta.url);

const { pose } = await import('../src/tracking/pose.js');
const { SWITCH_KEYS, forceSwitches } = await import('../src/tracking/switches.js');
const { unpack, unpackSig, unpackBlobs } = await import('../src/tracking/recorder.js');
const { unpackRange } = await import('../src/tracking/bands.js');
const { resetPose } = await import('./playtest/rig.mjs');
const { TrackMetrics, fmt } = await import('./playtest/metrics.mjs');

export function load(path){
  let buf = readFileSync(path);
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = gunzipSync(buf);
  const rec = JSON.parse(buf.toString('utf8'));
  if (rec.orlis !== 'track') throw new Error('not an Orlis tracking recording');
  return rec;
}

/* One run: the recording through the tracker with `on` (a list of switch names). Gives the metrics and the cost per look. */
export function replay(rec, on = [], { draws = 2, cap } = {}){
  const map = Object.fromEntries(Object.keys(SWITCH_KEYS).map(k => [k, on.includes(k)]));
  forceSwitches(map);
  const m = new TrackMetrics(), frames = rec.frames, rounds = rec.rounds && rec.rounds.length ? rec.rounds : [{ at: 0, lineup: cap || 2 }];
  let ri = -1, cost = 0, sigsMissing = 0, bandsMissing = 0;
  try {
    for (let k = 0; k < frames.length; k++){
      while (ri + 1 < rounds.length && rounds[ri + 1].at <= k){ ri++; resetPose(pose); pose.cap = Math.max(1, Math.min(4, cap || rounds[ri].lineup || 2)); }
      if (ri < 0){ ri = 0; resetPose(pose); pose.cap = cap || 2; }
      const f = frames[k], t = f.t;
      pose.clock = () => t;
      const people = f.p.map(unpack), sigOf = new Map();
      /* coloured wristbands: the learnt colours of this round, and the blobs found at each person's wrists (the picture itself was never recorded) */
      let bandSrc;
      if (map.bands){
        const kit = rounds[ri].bands;
        /* (the round's learnt colours go to each place as its player is in: the replay lets them join afresh, which clears a place's band) */
        if (kit) kit.forEach((b, i) => { const q = pose.players[i]; if (q.present && !q.band) q.band = b ? { state: 'ok', range: unpackRange(b), weight: b.weight ?? 1 } : { state: 'none' }; });
        const blobs = new Map(); if (f.b) f.b.forEach((l, i) => { if (people[i]) blobs.set(people[i], unpackBlobs(l)); });
        bandSrc = { blobsFor: (lm) => blobs.get(lm) || { blobs: [], clear: 0 } };
        if (!kit) bandsMissing++;
      }
      if (f.s) f.s.forEach((s, i) => { if (s && people[i]) sigOf.set(people[i], unpackSig(s)); });
      else if (map.appearance && people.length > 1) sigsMissing++;
      const frame = map.appearance ? () => ({ sigFor: (lm) => sigOf.get(lm) || null }) : undefined;
      const t0 = performance.now();
      pose._assign(people, f.dt, frame, bandSrc);
      pose.at(t);
      cost += performance.now() - t0;
      m.step(t / 1000, f.dt, pose, people, null);
      const next = frames[k + 1], gap = next && next.t > t && next.t - t < 400 ? next.t - t : 0;
      if (gap) for (let q = 1; q <= draws; q++){ const tt = t + gap * q / (draws + 1); pose.at(tt); m.drawnAt(tt / 1000, pose); }
    }
  } finally { forceSwitches(null); }
  return { ...m.result(), msPerLook: frames.length ? cost / frames.length : 0, sigsMissing, bandsMissing };
}

export const ROWS = [
  ['looks', r => r.looks], ['seconds', r => fmt(r.seconds, 0)], ['crossings', r => r.crossings],
  ['dropouts (lost with a body nearby)', r => r.dropouts], ['missed looks (no body for a player who had one near)', r => r.missFrames],
  ['jumps during crossings', r => r.jumps.during], ['jumps after crossings', r => r.jumps.after], ['jumps elsewhere', r => r.jumps.other],
  ['suspect swaps (proxy)', r => r.suspectSwaps],
  ['jitter raw (H/s, wrist near-still)', r => fmt(r.jitterRaw, 3)], ['jitter drawn (H/s)', r => fmt(r.jitterDrawn, 3)],
  ['lag at peak speed (ms)', r => r.lagMs == null ? '-' : fmt(r.lagMs, 0) + ' (' + r.lagPeaks + ' peaks)'],
  ['join time median / max (ms)', r => r.join.n ? `${fmt(r.join.medianMs, 0)} / ${fmt(r.join.maxMs, 0)} (${r.join.n})` : '-'],
  ['cost per look (ms)', r => fmt(r.msPerLook, 3)]
];
export function table(cols){
  const w = Math.max(...ROWS.map(r => r[0].length));
  console.log(''.padEnd(w) + cols.map(c => '  ' + c.name.padEnd(22)).join(''));
  for (const [name, f] of ROWS) console.log(name.padEnd(w) + cols.map(c => '  ' + String(f(c.r)).padEnd(22)).join(''));
}

if (process.argv[1] && process.argv[1].endsWith('replay.mjs')){
  const argv = process.argv.slice(2), file = argv.find(a => !a.startsWith('--'));
  const arg = (n) => { const a = argv.find(x => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : null; };
  if (!file){ console.error('usage: node tools/replay.mjs <file> [--switches=a,b] [--compare] [--json]'); process.exit(2); }
  const rec = load(file);
  console.log(`${file}: ${rec.frames.length} looks, ${rec.rounds.length} round(s), picture ${rec.frame && rec.frame.w}x${rec.frame && rec.frame.h}, recorded with ${Object.keys(rec.switches || {}).filter(k => rec.switches[k]).join(', ') || 'no switches'}`);
  const combos = argv.includes('--compare')
    ? [[], ...['appearance', 'steady', 'apart'].map(k => [k]), ['steady', 'apart'], ['apart', 'appearance'], ['steady', 'apart', 'appearance'], ['bands'], ['apart', 'bands']]
    : [(arg('switches') || '').split(',').filter(Boolean)];
  const cols = combos.map(on => ({ name: on.join('+') || 'none', r: replay(rec, on) }));
  if (argv.includes('--json')) console.log(JSON.stringify(cols, null, 1)); else table(cols);
  if (cols.some(c => c.r.bandsMissing)) console.log('(note: wristbands were asked for but the recording has no band colours or blobs: nothing to replay for', cols[0].r.bandsMissing, 'looks)');
  if (cols.some(c => c.r.sigsMissing)) console.log('(note: clothes were asked for but the recording has no colour counts for', cols[0].r.sigsMissing, 'looks)');
}

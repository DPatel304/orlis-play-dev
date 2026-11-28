/* Recording tracking (Settings > Testing > "Record tracking (points only)"; off unless the owner turns it on).

   While a round is playing, every look the tracker takes is kept in memory as the list of people it found - each person's 33 body
   points (x, y, depth, how sure) - exactly as they go into pose.js `_assign`, with the time, the step since the last look and the
   picture's size in pixels. NEVER the picture: no pixel, no thumbnail, no face. (When "Recognise players by clothes" is also on, each
   person's torso colour counts - 26 small numbers, the same ones the tracker keeps in memory to tell players apart - are kept too, so a
   replay can use the clothes; they cannot be turned back into a picture.) The newest RECORD_MS stay; older looks are dropped.

   Settings > Save recording writes a file: JSON, gzipped where the webview can (orlis-track-<date>.json.gz), else plain
   (orlis-track-<date>.json). tools/replay.mjs reads either.

   File layout (version 1): { orlis: 'track', v: 1, created, q: 10000, frame: { w, h }, switches: {...}, rounds: [{ at, game, lineup,
   switches }], frames: [{ t, dt, p: [[x*q, y*q, z*q, v*q] x 33 flattened] per person, s?: [[26 bytes] | null per person] }] }
   `at` is the index of a round's first look. Numbers are whole (rounded to 1/q), so a replay is the live run to within 0.0001.      */
import { switchStates } from './switches.js';

export const RECORD_MS = 10 * 60 * 1000;
export const Q = 10000;
const KEEP_SLACK = 200;               /* looks dropped in a bunch, not one at a time */

const pack = (lm) => {
  const a = new Int16Array(lm.length * 4);
  for (let i = 0; i < lm.length; i++){
    const k = lm[i], j = i * 4;
    a[j] = Math.round(k.x * Q); a[j + 1] = Math.round(k.y * Q); a[j + 2] = Math.round((k.z || 0) * Q); a[j + 3] = Math.round((k.v ?? k.visibility ?? 1) * Q);
  }
  return a;
};
export const unpack = (a) => {
  const out = [];
  for (let j = 0; j + 3 < a.length; j += 4) out.push({ x: a[j] / Q, y: a[j + 1] / Q, z: a[j + 2] / Q, v: a[j + 3] / Q });
  return out;
};
const packSig = (s) => s ? Uint8Array.from(s, v => Math.max(0, Math.min(255, Math.round(v * 255)))) : null;
export const unpackSig = (a) => a ? Float32Array.from(a, v => v / 255) : null;

export class Recorder {
  constructor({ ms = RECORD_MS } = {}){ this.ms = ms; this.clear(); }
  clear(){ this.frames = []; this.rounds = []; this.frame = { w: 0, h: 0 }; this.dropped = 0; this.created = null; }
  /* a round starts: its game and how many are lined up, and which switches are on now */
  begin({ game = '', lineup = 0 } = {}){
    if (!this.created) this.created = new Date().toISOString();
    this.rounds.push({ at: this.frames.length + this.dropped, game: String(game), lineup: lineup | 0, switches: switchStates() });
  }
  /* one look: t (ms, the tracker's clock), dt (seconds since the last look), people (landmark lists, as given to _assign), sigs (optional,
     a torso colour-count list per person), size (the video's pixels) */
  add(t, dt, people, sigs, size){
    if (size && size.w) this.frame = { w: size.w | 0, h: size.h | 0 };
    const f = { t: Math.round(t), dt: Math.round(dt * 1e4) / 1e4, p: people.map(pack) };
    if (sigs && sigs.some(Boolean)) f.s = sigs.map(packSig);
    this.frames.push(f);
    if (this.frames.length > KEEP_SLACK && f.t - this.frames[0].t > this.ms + 2000){
      let n = 0; while (n < this.frames.length && f.t - this.frames[n].t > this.ms) n++;
      this.frames.splice(0, n); this.dropped += n;
    }
  }
  get seconds(){ const n = this.frames.length; return n < 2 ? 0 : (this.frames[n - 1].t - this.frames[0].t) / 1000; }
  get count(){ return this.frames.length; }
  /* the file's content as text pieces (a Blob takes them without one giant string); a round started before the oldest kept look is cut to it */
  parts(){
    const rounds = this.rounds.map(r => ({ ...r, at: Math.max(0, r.at - this.dropped) })).filter(r => r.at < this.frames.length);
    const head = { orlis: 'track', v: 1, created: this.created || new Date().toISOString(), q: Q, frame: this.frame, switches: switchStates(), rounds };
    const parts = [JSON.stringify(head).slice(0, -1) + ',"frames":['];
    this.frames.forEach((f, i) => {
      const o = { t: f.t, dt: f.dt, p: f.p.map(a => Array.from(a)) };
      if (f.s) o.s = f.s.map(a => a ? Array.from(a) : null);
      parts.push((i ? ',' : '') + JSON.stringify(o));
    });
    parts.push(']}');
    return parts;
  }
}

/* A recording's file name: orlis-track-2026-11-28-1405.json.gz */
export function fileName(gz, d = new Date()){
  const p = (n) => String(n).padStart(2, '0');
  return `orlis-track-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}.json${gz ? '.gz' : ''}`;
}

/* The file as a Blob: gzipped where CompressionStream exists, else plain. Gives { blob, gz }. */
export async function toBlob(rec){
  const raw = new Blob(rec.parts(), { type: 'application/json' });
  if (typeof CompressionStream === 'function' && typeof Response === 'function' && raw.stream){
    try { return { blob: await new Response(raw.stream().pipeThrough(new CompressionStream('gzip'))).blob(), gz: true }; }
    catch (e){ /* (plain, below) */ }
  }
  return { blob: raw, gz: false };
}

/* Save it. The app has no file-save route of its own (no save dialog in the Tauri app, nothing in the page), so this is the browser's
   download: an <a download> on a Blob link. In the Windows app's webview (WebView2) that is a normal download to the Downloads
   folder. Gives { name, bytes, gz } or throws (the caller shows a short message). */
export async function saveRecording(rec, { doc = typeof document !== 'undefined' ? document : null, now = new Date() } = {}){
  if (!rec || !rec.count) throw new Error('Nothing recorded yet');
  const { blob, gz } = await toBlob(rec), name = fileName(gz, now);
  if (!doc || !URL || !URL.createObjectURL) throw new Error('This page cannot save files');
  const url = URL.createObjectURL(blob), a = doc.createElement('a');
  a.href = url; a.download = name;
  (doc.body || doc.documentElement).append(a);
  a.click();
  setTimeout(() => { try { a.remove(); URL.revokeObjectURL(url); } catch (e){} }, 4000);
  return { name, bytes: blob.size, gz };
}

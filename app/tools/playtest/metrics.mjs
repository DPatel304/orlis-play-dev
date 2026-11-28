/* Tracking metrics, shared by tools/replay.mjs (real recordings) and the playtest rig (synthetic runs, where the truth is known).
   Call step() once per look, right after pose._assign and pose.at(t); result() gives the numbers. Units: picture heights (H) for distances
   (x is scaled by 16/9), seconds, milliseconds where named.

   dropouts      a player who was in and is out now, while a standing body (one the tracker would let play) was within DROP_NEAR of where
                 they were and not taken by another player: the tracker lost someone it could have kept
   missFrames    looks where an in-game player got no body though such a body was within MATCH of where they were heading
   jumps         a player's hips moving implausibly far in one look (a body changing hands): counted by when - during (another player's hips
                 within a body or so), after (within AFTER_S seconds of a crossing), or other
   suspectSwaps  after each crossing (two players' hips close, then apart again): the two slots now stand where the OTHER one was heading
                 (a proxy for a swap where there is no ground truth)
   swaps         (the rig only: truth known) times a slot changed from following one person to following another while the two bodies
                 were clear of each other (a torso length apart); mergedFlips: the same change while they overlapped or the model reported them as one
                 skeleton (which of them it reports is its own doing, and a hold decides it once they part)
   jitterRaw / jitterDrawn
                 mean speed (H/s) of the raw / drawn wrist while the raw wrist is near-still (within STILL of itself for +-STILL_S); lower is
                 steadier, and drawn should be well under raw
   lagMs         at the peaks of the raw wrist's speed, the delay at which the raw wrist best matches the drawn one (median, ms; negative
                 means the drawn hand is ahead); lagPeaks how many peaks
   join          from a body's first look (standing, near the others' size) to its player being in the game: n, median and max, in ms      */
import { L } from '../../src/tracking/pose-shared.js';
import { sizeOf, seated } from '../../src/tracking/pose.js';

const A = 16 / 9;
const apart = (a, b) => Math.hypot((a.x - b.x) * A, a.y - b.y);
const hipOf = (lm) => ({ x: (lm[L.L_HIP].x + lm[L.R_HIP].x) / 2, y: (lm[L.L_HIP].y + lm[L.R_HIP].y) / 2 });
const median = (a) => { const b = a.filter(Number.isFinite).sort((x, y) => x - y); if (!b.length) return null; const m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
const mean = (a) => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;

export const DROP_NEAR = 0.3, MATCH = 0.25, JUMP_DIST = 0.06, JUMP_SPEED = 2.0, AFTER_S = 1.0;
export const STILL = 0.02, STILL_S = 0.4, PEAK_MIN = 0.4, GAP_S = 0.25;
const CLEAR_K = 1.0;            /* a swap counts only when the two bodies are this many torso lengths apart (clear of each other) */
const CROSS_K = 1.4;            /* two players are "crossing" when their hips are within this many torso lengths */

export class TrackMetrics {
  constructor(){
    this.n = 0; this.t0 = null; this.t = 0;
    this.dropouts = 0; this.mergedFlips = 0; this.wrongLooks = 0; this.missFrames = 0; this.jumps = { during: 0, after: 0, other: 0 }; this.suspectSwaps = 0; this.crossings = 0; this.swaps = 0;
    this.slot = [];                 /* per slot: { present, hip, t, owner, vx, vy, trail } */
    this.series = {};               /* 'slot:side' -> { raw: [{t,x,y,v}], drawn: [{t,x,y}] } */
    this.cross = new Map();         /* 'i:j' -> { from: {a:{x,y,vx,vy}, b:...}, t, apartFor } */
    this.lastCrossAt = -9;
    this.blobs = []; this.joins = [];
  }
  _sl(i){ return this.slot[i] || (this.slot[i] = { present: false, hip: null, t: 0, owner: null, trail: [] }); }
  _ser(i, side){ const k = i + ':' + side; return this.series[k] || (this.series[k] = { raw: [], drawn: [] }); }

  /* people: the landmark lists this look was given (raw); ids: Map(landmark list -> person id) when the truth is known */
  step(t, dt, pose, people, ids = null){
    if (this.t0 == null) this.t0 = t;
    this.n++; this.t = t;
    const got = pose.lastAssign || new Map();
    const takenLm = new Set([...got.values()].map(d => d.lm));
    const biggest = Math.max(0, ...people.map(sizeOf));
    const standing = (lm) => !seated(lm) && sizeOf(lm) >= 0.38 * biggest;
    const free = people.filter(lm => !takenLm.has(lm) && standing(lm));
    const hips = pose.players.map(p => p.present && p.lm ? hipOf(p.lm) : null);

    /* who is near whom (crossings) */
    const present = pose.players.map((p, i) => p.present && p.at ? i : -1).filter(i => i >= 0);
    const nowNear = new Set();
    for (let a = 0; a < present.length; a++) for (let b = a + 1; b < present.length; b++){
      const i = present[a], j = present[b], pi = pose.players[i], pj = pose.players[j];
      const lim = CROSS_K * Math.max(pi.at.size || 0.1, pj.at.size || 0.1);
      if (apart(pi.at, pj.at) < lim) nowNear.add(i + ':' + j);
    }
    for (const k of nowNear){
      const c = this.cross.get(k);
      if (c){ c.apartFor = 0; c.lastNear = t; }
      else {
        const [i, j] = k.split(':').map(Number);
        const proj = (s) => { const tr = this._sl(s).trail; const o = tr.length && this.slot[s].hip ? tr[0] : null; return o ? { x: o.x, y: o.y, vx: (this.slot[s].hip.x - o.x) / Math.max(1e-3, t - o.t), vy: (this.slot[s].hip.y - o.y) / Math.max(1e-3, t - o.t) } : null; };
        this.cross.set(k, { t, lastNear: t, apartFor: 0, a: proj(i), b: proj(j), i, j });
      }
    }
    for (const [k, c] of [...this.cross]){
      if (nowNear.has(k)) continue;
      c.apartFor += dt;
      if (c.apartFor < 0.3) continue;
      this.cross.delete(k); this.crossings++; this.lastCrossAt = t;
      const A_ = this.slot[c.i], B_ = this.slot[c.j];
      if (c.a && c.b && A_ && B_ && A_.hip && B_.hip && A_.present && B_.present){
        const span = t - c.t, pa = { x: c.a.x + c.a.vx * span, y: c.a.y + c.a.vy * span }, pb = { x: c.b.x + c.b.vx * span, y: c.b.y + c.b.vy * span };
        const same = apart(A_.hip, pa) + apart(B_.hip, pb), swap = apart(A_.hip, pb) + apart(B_.hip, pa);
        if (swap < same * 0.6 && same > 0.05) this.suspectSwaps++;
      }
    }

    /* per slot */
    pose.players.forEach((p, i) => {
      const s = this._sl(i), d = got.get(i) || null, was = s.present;
      if (was && !p.present && s.hip){
        if (free.some(lm => apart(hipOf(lm), s.hip) < DROP_NEAR)) this.dropouts++;
      }
      if (p.present && !d && p.at){
        const px = p.at.x + p.at.vx * Math.min(p.lostFor, 0.5), py = p.at.y + p.at.vy * Math.min(p.lostFor, 0.5);
        if (free.some(lm => apart(hipOf(lm), { x: px, y: py }) < MATCH)) this.missFrames++;
      }
      if (d){
        const hip = hipOf(d.lm);
        if (s.hip && was){
          const dd = apart(hip, s.hip), sp = dd / Math.max(1e-3, t - s.t);
          if (dd > JUMP_DIST && sp > JUMP_SPEED){
            const nearOther = pose.players.some((q, k) => k !== i && hips[k] && apart(hips[k], hip) < CROSS_K * Math.max(sizeOf(d.lm), 0.1));
            if (nearOther) this.jumps.during++; else if (t - this.lastCrossAt < AFTER_S || this.cross.size) this.jumps.after++; else this.jumps.other++;
          }
        }
        if (ids){
          const who = ids.has(d.lm) ? ids.get(d.lm) : null, here = new Set(people.map(lm => ids.get(lm)));
          /* a swap: the slot goes from one person to another while both are seen as separate bodies (when the model reports two people as one
             skeleton, which one it reports is its own doing: counted apart, as mergedFlips) */
          if (who != null && s.owner != null && who !== s.owner && was){
            const old = people.find(lm => ids.get(lm) === s.owner);
            if (old && apart(hipOf(old), hip) > CLEAR_K * Math.max(sizeOf(old), sizeOf(d.lm))) this.swaps++; else this.mergedFlips++;
          }
          if (who != null && s.home == null) s.home = who;
          if (who != null && s.home != null && who !== s.home){
            const hm = people.find(lm => ids.get(lm) === s.home);
            if (hm && apart(hipOf(hm), hip) > CLEAR_K * Math.max(sizeOf(hm), sizeOf(d.lm))) this.wrongLooks++;
          }
          if (who != null) s.owner = who;
        }
        s.hip = hip; s.t = t; s.trail.push({ t, x: hip.x, y: hip.y }); while (s.trail.length > 1 && t - s.trail[0].t > 0.4) s.trail.shift();
      }
      if (p.present && !was) this._joined(t, i, p);
      s.present = !!p.present;
      if (!p.present){ s.owner = null; s.home = null; s.trail.length = 0; }
      /* wrists: the raw one the body gave and the one drawn */
      for (const [side, k] of [[0, L.L_WRIST], [1, L.R_WRIST]]){
        const ser = this._ser(i, side);
        if (d && p.lm) ser.raw.push({ t, x: d.lm[k].x, y: d.lm[k].y, v: d.lm[k].v ?? 1 });
        if (p.present && p.lm) ser.drawn.push({ t, x: p.lm[k].x, y: p.lm[k].y, look: !!d });
      }
    });

    /* join time: bodies seen standing, from their first look */
    for (const b of this.blobs) b.hit = false;
    for (const lm of people){
      if (!standing(lm)) continue;
      const hip = hipOf(lm);
      let best = null, bd = 0.15;
      for (const b of this.blobs){ if (b.hit) continue; const dist = apart(b, hip); if (dist < bd){ bd = dist; best = b; } }
      if (!best){ best = { x: hip.x, y: hip.y, first: t, last: t, hit: true, joined: false }; this.blobs.push(best); }
      best.x = hip.x; best.y = hip.y; best.last = t; best.hit = true;
    }
    this.blobs = this.blobs.filter(b => t - b.last < 0.6);
  }
  _joined(t, i, p){
    let best = null, bd = 0.2;
    const hip = hipOf(p.lm);
    for (const b of this.blobs){ if (b.joined) continue; const dist = apart(b, hip); if (dist < bd){ bd = dist; best = b; } }
    if (best){ best.joined = true; this.joins.push((t - best.first) * 1000); }
  }
  /* an extra drawn-hand sample between looks (the replay draws a few times per look, as the screen does) */
  drawnAt(t, pose){
    pose.players.forEach((p, i) => {
      if (!p.present || !p.lm) return;
      for (const [side, k] of [[0, L.L_WRIST], [1, L.R_WRIST]]) this._ser(i, side).drawn.push({ t, x: p.lm[k].x, y: p.lm[k].y, look: false });
    });
  }

  result(){
    const jr = [], jd = [], lags = [];
    for (const ser of Object.values(this.series)){
      const raw = ser.raw, drawn = ser.drawn.filter(d => d.look);
      /* segments of raw looks with no gap */
      const spd = (arr, k) => k > 0 && k < arr.length && arr[k].t - arr[k - 1].t < GAP_S ? apart(arr[k], arr[k - 1]) / (arr[k].t - arr[k - 1].t) : null;
      const dAt = new Map(drawn.map(d => [d.t, d]));
      for (let k = 1; k < raw.length; k++){
        if (raw[k].v < 0.5 || raw[k - 1].v < 0.5) continue;
        let still = true, lo = k, hi = k;
        while (lo > 0 && raw[k].t - raw[lo - 1].t <= STILL_S) lo--;
        while (hi < raw.length - 1 && raw[hi + 1].t - raw[k].t <= STILL_S) hi++;
        if (raw[k].t - raw[lo].t < STILL_S * 0.7 || raw[hi].t - raw[k].t < STILL_S * 0.7) continue;
        for (let m = lo; m <= hi && still; m++) if (apart(raw[m], raw[k]) > STILL) still = false;
        if (!still) continue;
        const sr = spd(raw, k), a = dAt.get(raw[k].t), b = dAt.get(raw[k - 1].t);
        if (sr == null || !a || !b) continue;
        jr.push(sr); jd.push(apart(a, b) / (raw[k].t - raw[k - 1].t));
      }
      /* lag at the peaks of the raw speed */
      const sm = raw.map((_, k) => { const v = [spd(raw, k - 1), spd(raw, k), spd(raw, k + 1)].filter(x => x != null); return v.length ? mean(v) : 0; });
      const R = (t) => { let lo = 0, hi = raw.length - 1; if (t <= raw[0].t) return raw[0]; if (t >= raw[hi].t) return raw[hi];
        while (hi - lo > 1){ const m = (lo + hi) >> 1; if (raw[m].t <= t) lo = m; else hi = m; }
        const u = (t - raw[lo].t) / (raw[hi].t - raw[lo].t); return { x: raw[lo].x + (raw[hi].x - raw[lo].x) * u, y: raw[lo].y + (raw[hi].y - raw[lo].y) * u }; };
      for (let k = 2; k < raw.length - 2; k++){
        if (sm[k] < PEAK_MIN || sm[k] < sm[k - 1] || sm[k] < sm[k + 1] || sm[k] < sm[k - 2] || sm[k] < sm[k + 2]) continue;
        const win = ser.drawn.filter(d => Math.abs(d.t - raw[k].t) < 0.2);
        if (win.length < 4 || raw[k].t - raw[0].t < 0.3) continue;
        let bestTau = null, bestE = Infinity;
        for (let tau = -0.1; tau <= 0.25001; tau += 0.004){
          let e = 0; for (const d of win){ const r = R(d.t - tau); e += (d.x - r.x) * (d.x - r.x) * A * A + (d.y - r.y) * (d.y - r.y); }
          if (e < bestE){ bestE = e; bestTau = tau; }
        }
        if (bestTau != null) lags.push(bestTau * 1000);
      }
    }
    const dur = this.n > 1 ? this.t - this.t0 : 0;
    return {
      looks: this.n, seconds: dur, dropouts: this.dropouts, missFrames: this.missFrames, jumps: { ...this.jumps }, crossings: this.crossings,
      suspectSwaps: this.suspectSwaps, swaps: this.swaps, mergedFlips: this.mergedFlips, wrongLooks: this.wrongLooks,
      jitterRaw: mean(jr), jitterDrawn: mean(jd), stillLooks: jr.length, lagMs: median(lags), lagPeaks: lags.length,
      join: { n: this.joins.length, medianMs: median(this.joins), maxMs: this.joins.length ? Math.max(...this.joins) : null }
    };
  }
}
export function merge(rs){
  const sum = (f) => rs.reduce((s, r) => s + f(r), 0);
  const avg = (f) => mean(rs.map(f).filter(x => x != null));
  return {
    runs: rs.length, dropouts: sum(r => r.dropouts), missFrames: sum(r => r.missFrames), jumps: sum(r => r.jumps.during + r.jumps.after + r.jumps.other),
    jumpsDuring: sum(r => r.jumps.during), jumpsAfter: sum(r => r.jumps.after), crossings: sum(r => r.crossings), suspectSwaps: sum(r => r.suspectSwaps), swaps: sum(r => r.swaps), wrongLooks: sum(r => r.wrongLooks),
    jitterRaw: avg(r => r.jitterRaw), jitterDrawn: avg(r => r.jitterDrawn), lagMs: avg(r => r.lagMs), joinMs: avg(r => r.join.medianMs), joins: sum(r => r.join.n)
  };
}
export const fmt = (v, d = 1) => v == null ? '-' : (Math.round(v * 10 ** d) / 10 ** d).toString();

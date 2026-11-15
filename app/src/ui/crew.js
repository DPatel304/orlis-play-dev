/* Who's who: which of the family is which player on camera, so each child
   is their own avatar in every game.

   The line-up (lineup.js) asks once a session - "Ellie, wave!" - and the
   one who waves is Ellie. After that the camera's tracking keeps each
   avatar on its body. When someone steps out of view their place is
   forgotten (the tracker may give them another one when they're back), so
   they're remembered as away, with the colour of their clothes; whoever
   walks in next is matched to the away child whose clothes they're
   wearing - or, with only one child away, simply them - and their name
   pops up: "Ellie's back!". Anyone it can't tell stays a guest until the
   pause screen's Who's who? sorts it.

   Nothing here is saved anywhere: it lasts as long as the app is open.

   crew.step(dt, present, sample)   each frame: present[i] - is player i
                                    here; sample(i) - their clothes' colour
                                    [r, g, b] 0..255, or null
   crew.set(i, id) / crew.clear()   the line-up's answers
   crew.of(i)                       player i's profile id, or null
   crew.popped()                    names to show: [{ i, id }] (taken) */
import { MAX_PLAYERS } from '../tracking/pose-shared.js';

/* The two generic crew avatars, one per player, while making your own is
   off (avatar-maker.js MAKING): friendly, plain, told apart at a glance by
   their colour (the player's colour) and their hair. */
export const GENERIC = [
  { skin: '#c98f6a', hair: 'short', hairColor: '#4a2c1a', eyes: 'dots', mouth: 'smile', color: '#3da9ff', outfit: 'plain', extra: 'none' },
  { skin: '#e9b892', hair: 'ponytail', hairColor: '#2b1a12', eyes: 'dots', mouth: 'grin', color: '#ff8a3d', outfit: 'plain', extra: 'none' },
  { skin: '#8d5a3b', hair: 'curly', hairColor: '#1c120d', eyes: 'dots', mouth: 'smile', color: '#3fcf7f', outfit: 'plain', extra: 'none' },
  { skin: '#f2c6a0', hair: 'bob', hairColor: '#8a4b23', eyes: 'dots', mouth: 'grin', color: '#c46bff', outfit: 'plain', extra: 'none' }
];

/* Clothes this alike (distance in RGB, 0..441) are the same clothes; a
   match must also be this much nearer than the next best. */
export const SAME_CLOTHES = 70, CLEARLY = 25;
/* How often a player's clothes are looked at again (they turn, the light
   changes), and how much each look counts. */
export const LOOK_EVERY = 1, LOOK_WEIGHT = 0.25;

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function makeCrew(n = MAX_PLAYERS){
  const crew = {
    seat: Array(n).fill(null),       /* profile id per player */
    clothes: Array(n).fill(null),    /* [r, g, b] per player */
    was: Array(n).fill(false),
    look: Array(n).fill(0),
    away: new Map(),                 /* profile id -> clothes */
    pops: [],
    lined: false,                    /* the line-up's been done this session */

    profiles: [],                    /* the family's profiles (the app sets them) */

    of(i){ return this.seat[i]; },
    /* player i's profile, look, name and colour - or nulls for a guest */
    profileOf(i){ const id = this.seat[i]; return id == null ? null : this.profiles.find(p => p.id === id) || null; },
    /* player i's avatar: their own, if avatars are made (personal), else the
       generic one for their place */
    personal: false,
    lookOf(i){ const p = this.personal && this.profileOf(i); return (p && p.look) || GENERIC[i % GENERIC.length]; },
    nameOf(i){ const p = this.profileOf(i); return p ? p.name : null; },
    colorOf(i, fallback = null){ const l = this.lookOf(i); return (l && l.color) || fallback; },
    playerOf(id){ const i = this.seat.indexOf(id); return i < 0 ? null : i; },
    set(i, id){
      if (id != null){ const j = this.seat.indexOf(id); if (j >= 0 && j !== i) this.seat[j] = null; this.away.delete(id); }
      this.seat[i] = id;
    },
    clear(){ this.seat.fill(null); this.away.clear(); this.pops = []; },
    popped(){ const p = this.pops; this.pops = []; return p; },

    step(dt, present, sample = () => null){
      for (let i = 0; i < n; i++){
        const here = !!present[i];
        if (here && !this.was[i]) this._arrive(i, sample(i));
        else if (!here && this.was[i]) this._leave(i);
        else if (here){
          this.look[i] += dt;
          if (this.look[i] >= LOOK_EVERY){
            this.look[i] = 0;
            const s = sample(i);
            if (s) this.clothes[i] = this.clothes[i] ? this.clothes[i].map((v, k) => v + (s[k] - v) * LOOK_WEIGHT) : s;
          }
        }
        this.was[i] = here;
      }
    },
    _leave(i){
      if (this.seat[i] != null) this.away.set(this.seat[i], this.clothes[i]);
      this.seat[i] = null; this.clothes[i] = null;
    },
    _arrive(i, s){
      this.clothes[i] = s; this.look[i] = 0;
      if (this.seat[i] != null || !this.away.size) return;
      const id = this.match(s);
      if (id == null) return;
      this.set(i, id);
      this.pops.push({ i, id });
    },
    /* Which away child is this? With only one away, them; otherwise the
       one in the same clothes, if it's clear. */
    match(s){
      const away = [...this.away.entries()];
      if (away.length === 1) return away[0][0];
      if (!s) return null;
      const scored = away.filter(([, c]) => c).map(([id, c]) => ({ id, d: dist(s, c) })).sort((a, b) => a.d - b.d);
      if (!scored.length || scored[0].d > SAME_CLOTHES) return null;
      if (scored[1] && scored[1].d - scored[0].d < CLEARLY) return null;
      return scored[0].id;
    }
  };
  return crew;
}

/* The one for the app. */
export const crew = makeCrew();

/* The colour of a player's clothes, from the camera: the average of the
   middle of their torso (between the shoulders and the hips), from a small
   copy of the video frame. Landmarks are mirrored (x = 1 - the video's). */
let small = null;
export function clothesOf(video, lm){
  if (!video || !lm || !video.videoWidth || typeof document === 'undefined') return null;
  const ls = lm[11], rs = lm[12], lh = lm[23], rh = lm[24];
  if (!ls || !rs || !lh || !rh) return null;
  const W = 64, H = 36;
  if (!small){ small = document.createElement('canvas'); small.width = W; small.height = H; }
  const g = small.getContext('2d', { willReadFrequently: true });
  try { g.drawImage(video, 0, 0, W, H); } catch { return null; }
  /* the box between the shoulders and hips, a little in from each side */
  const xs = [ls.x, rs.x, lh.x, rh.x].map(x => (1 - x) * W), ys = [ls.y, rs.y, lh.y, rh.y].map(y => y * H);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  const bx = Math.max(0, Math.floor(x0 + (x1 - x0) * 0.25)), bw = Math.max(1, Math.floor((x1 - x0) * 0.5));
  const by = Math.max(0, Math.floor(y0 + (y1 - y0) * 0.2)), bh = Math.max(1, Math.floor((y1 - y0) * 0.6));
  if (bx >= W || by >= H) return null;
  const d = g.getImageData(bx, by, Math.min(bw, W - bx), Math.min(bh, H - by)).data;
  let r = 0, gg = 0, b = 0, k = 0;
  for (let p = 0; p < d.length; p += 4){ r += d[p]; gg += d[p + 1]; b += d[p + 2]; k++; }
  return k ? [r / k, gg / k, b / k] : null;
}

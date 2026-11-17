/* Who's who: which of the family is which player on camera, so each child
   is their own avatar in every game.

   The line-up (lineup.js) asks once a session - "Ellie, wave!" - and the
   one who waves is Ellie. After that the camera's tracking keeps each
   avatar on its body. When someone steps out of view their place is
   forgotten (the tracker may give them another one when they're back), so
   they're remembered as away; with only one child away, whoever walks in
   next is simply them, and their name pops up: "Ellie's back!". With two or
   more away it can't tell (it never looks at the picture, only at the body's
   points), so they stay guests until the pause screen's Who's who? sorts it.

   Nothing here is saved anywhere: it lasts as long as the app is open.

   crew.step(dt, present)           each frame: present[i] - is player i here
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

export function makeCrew(n = MAX_PLAYERS){
  const crew = {
    seat: Array(n).fill(null),       /* profile id per player */
    was: Array(n).fill(false),
    away: new Set(),                 /* profile ids stepped out */
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

    step(dt, present){
      for (let i = 0; i < n; i++){
        const here = !!present[i];
        if (here && !this.was[i]) this._arrive(i);
        else if (!here && this.was[i]) this._leave(i);
        this.was[i] = here;
      }
    },
    _leave(i){
      if (this.seat[i] != null) this.away.add(this.seat[i]);
      this.seat[i] = null;
    },
    _arrive(i){
      if (this.seat[i] != null || this.away.size !== 1) return;
      const id = [...this.away][0];
      this.set(i, id);
      this.pops.push({ i, id });
    }
  };
  return crew;
}

/* The one for the app. */
export const crew = makeCrew();

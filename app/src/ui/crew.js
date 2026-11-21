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
import { setPlayerColours, resolveColours } from '../tracking/player-colours.js';
import { color } from '../games/assets/palette.js';
import { normalizeLook } from './look.js';

/* The generic crew characters, one per player, while making your own is off (avatar-maker.js MAKING): the same cube character,
   told apart at a glance by colour (the player's colour) and what they wear. */
export const GENERIC = [
  { colour: 'sky', face: { eyes: 'dot', mouth: 'smile' }, top: 'tuft', outfit: 'plain', outfitColour: 'shade.card', extra: 'none' },
  { colour: 'orange', face: { eyes: 'happy', mouth: 'grin' }, top: 'bob', outfit: 'plain', outfitColour: 'earth.bark', extra: 'none' },
  { colour: 'green', face: { eyes: 'dot', mouth: 'smile' }, top: 'cap', outfit: 'stripes', outfitColour: 'shade.card', extra: 'none' },
  { colour: 'purple', face: { eyes: 'wink', mouth: 'grin' }, top: 'bow', outfit: 'plain', outfitColour: 'ui.gold', extra: 'none' }
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
    lookOf(i){
      if (!this.personal) return normalizeLook(GENERIC[i % GENERIC.length]);
      const p = this.profileOf(i);
      /* a profile with no look is Cubo; a guest is Cubo in the next free favourite (so guests are told apart) */
      /* (and a child who clashed on a colour is drawn in the one they play in, so the pill and the character match) */
      return { ...normalizeLook(p && p.look), colour: this.colourNames()[i] };
    },
    /* the favourite (by name) player i asked for with their avatar: null for a guest */
    wantedOf(i){ const p = this.personal && this.profileOf(i); return p ? normalizeLook(p.look).colour : (this.personal ? null : GENERIC[i % GENERIC.length].colour); },
    nameOf(i){ const p = this.profileOf(i); return p ? p.name : null; },
    /* U8: who is playing decides every player's colour; only the app's own crew pushes it to PLAYER_COLORS (see sync) */
    colourNames(){ return resolveColours(Array.from({ length: n }, (_, i) => this.wantedOf(i))); },
    colorOf(i, fallback = null){ const nm = this.colourNames()[i]; return nm ? color('fav.' + nm) : fallback; },
    pushes: false,
    sync(){ if (this.pushes) setPlayerColours(Array.from({ length: n }, (_, i) => this.wantedOf(i))); },
    playerOf(id){ const i = this.seat.indexOf(id); return i < 0 ? null : i; },
    set(i, id){
      if (id != null){ const j = this.seat.indexOf(id); if (j >= 0 && j !== i) this.seat[j] = null; this.away.delete(id); }
      this.seat[i] = id; this.sync();
    },
    clear(){ this.seat.fill(null); this.away.clear(); this.pops = []; this.sync(); },
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
      this.seat[i] = null; this.sync();
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
crew.pushes = true;

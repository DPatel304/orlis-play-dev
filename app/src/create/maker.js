/* Who made a game: the family's profile, and its face (the badge on every creation's tile, and "Made by ..." in the builder). */
import { account } from '../ui/account.js';
import { faceOf } from '../ui/avatar-maker.js';

export const profileOf = (id) => ((account.state && account.state.profiles) || []).find(p => p.id === id) || null;
/* the profile playing now (the maker of whatever is made now) */
export const currentMaker = () => account.current || ((account.state && account.state.profiles) || [])[0] || null;
export const makerName = (id) => { const p = profileOf(id); return p ? p.name : ''; };
/* the maker's face, as a small canvas (a generic head when nobody is known) */
export const makerFace = (id, size = 96) => faceOf(profileOf(id) || {}, size);

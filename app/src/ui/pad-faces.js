/* A round face for a person on the TV: their avatar's head on their colour, with the paper edge (plan package P5; docs/pads-mockup.html).
   Used by the join card (who has joined, with a tick when ready), the "Waiting for Sam's phone" pill and Settings' Trusted phones.

     faceChip({ avatar, colour }, px)      a <div class="padface"> (px is its size in CSS pixels); colour is a favourite name or null (calm grey)
     personOf(profileId, profiles)         { name, avatar } for a profile id ('guest' or an unknown one: Guest, drawn as Cubo) */
import { head } from './avatar-art.js';
import { normalizeLook } from './look.js';
import { color } from '../games/assets/palette.js';

export function paintFace(cv, look) {
  const s = cv.width, c = cv.getContext && cv.getContext('2d'); if (!c) return;
  c.clearRect(0, 0, s, s);
  try { head(c, s / 2, s * 0.66, s * 0.27, normalizeLook(look)); } catch { /* a blank face is better than a broken card */ }
}

export function faceChip({ avatar = null, colour = null } = {}, px = 64) {
  const d = document.createElement('div'); d.className = 'padface';
  d.style.setProperty('--c', colour ? color('fav.' + colour) : color('shade.light'));
  if (!colour) d.classList.add('calm');
  d.style.width = d.style.height = px + 'px';
  const cv = document.createElement('canvas');
  const k = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
  cv.width = cv.height = Math.max(48, Math.round(px * k));
  d.appendChild(cv); paintFace(cv, avatar);
  return d;
}

export function personOf(id, profiles = []) {
  const p = id && id !== 'guest' ? profiles.find(q => q && q.id === id) : null;
  return p ? { name: p.name, avatar: p.look || null } : { name: id === 'guest' || !id ? 'Guest' : 'Someone', avatar: null };
}

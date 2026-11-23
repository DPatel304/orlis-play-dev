/* Painted icons for the shell's screens (U4): the same library icons the HUD uses (games/assets/icons.js), as pictures the DOM can hold, so no screen
   shows a system emoji (they look different on every device).

     iconHTML('rocket', 64)    an <img class="oicon"> as a string, for innerHTML (px: the size it is painted at; CSS sizes it: 1em square; tint: one palette colour for the one-colour icons, people and tabletgrip)
     iconEl('rocket', 64)      the same as an element
   An id the library does not have gives nothing. Where there is no canvas (the tests), an empty span with data-icon. */
import { assets } from '../games/assets/index.js';

const urls = new Map();
function urlOf(id, px, tint){
  const key = id + ':' + px + ':' + (tint || '');
  if (urls.has(key)) return urls.get(key);
  let u = '';
  try {
    if (typeof document !== 'undefined' && assets.has(id)){
      const cv = document.createElement('canvas'); cv.width = cv.height = px;
      const c = cv.getContext && cv.getContext('2d');
      if (c){ assets.draw(c, id, px / 2, px / 2, px * 0.92, tint ? { tint } : {}); u = cv.toDataURL('image/png'); }
    }
  } catch (e){ u = ''; }
  urls.set(key, u);
  return u;
}
export function iconHTML(id, px = 192, tint){
  if (!id) return '';
  const u = urlOf(id, px, tint);
  return u ? `<img class="oicon" src="${u}" alt="" draggable="false">` : `<span class="oicon" data-icon="${String(id).replace(/[^\w-]/g, '')}"></span>`;
}
export function iconEl(id, px = 192, tint){
  const w = document.createElement('span'); w.innerHTML = iconHTML(id, px, tint);
  return w.firstChild || w;
}

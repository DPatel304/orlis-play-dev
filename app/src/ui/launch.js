/* Going into a game: the tile you picked opens up to fill the screen - its
   own cover, title and all - and stays there while the game gets ready (the
   camera starts underneath; nothing is said about it). When the game's
   ready the cover fades away and the game's there.

     launch.begin({ rect, url, accent, name })   expand from the tile's place
     launch.release()                            fade it away (now: at once)
     launch.at                                   when it began (ms)            */
import { loader } from './brand.js';
const OPEN_MS = 560;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const launch = {
  el: null, at: 0, OPEN: OPEN_MS / 1000,

  begin({ rect, url = null, accent = '#6d5efc', name = '' }){
    this.release(true);
    const el = document.createElement('div');
    el.className = 'launchveil';
    el.style.setProperty('--accent', accent);
    this.url = url;
    if (url) el.style.backgroundImage = `url(${url})`;
    else el.innerHTML = `<div class="launchname">${String(name).replace(/[&<>]/g, '')}</div>`;
    document.body.appendChild(el);
    this.el = el; this.at = performance.now();
    if (reduced() || !rect){ el.classList.add('full', 'plain'); return; }
    Object.assign(el.style, { left: rect.left + 'px', top: rect.top + 'px', width: rect.width + 'px', height: rect.height + 'px' });
    el.getBoundingClientRect();                      /* (settle, so the move animates) */
    el.classList.add('full');
    Object.assign(el.style, { left: 0, top: 0, width: '100vw', height: '100vh' });
  },

  /* The card that says what to do, on the cover while the camera starts: the game's name and a line about it, there
     at once. No countdown - nothing says when it ends; the twirling head says it's working. The game starts when the cover goes. */
  card({ title = '', blurb = '' } = {}){
    const el = this.el; if (!el || el.querySelector('.loadhop')) return;
    el.classList.add('hascard');
    /* the one loading pattern (decision 0045): the two squares hopping, with the game's name card, over the paper */
    el.appendChild(loader({ name: title, line: blurb, cover: this.url || '' }));
  },

  release(now = false){
    const el = this.el; if (!el) return;
    this.el = null;
    if (now){ el.remove(); return; }
    el.classList.add('away');
    setTimeout(() => el.remove(), 800);
  }
};

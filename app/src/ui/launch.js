/* Going into a game: picking a tile goes straight to the one loading screen
   (decision 0045: the two squares hopping, with the game's name card, over
   the paper) with a quick fade - no tile opening up first. It stays while the
   game gets ready (the camera starts underneath; nothing is said about it).
   When the game's ready it fades away and the game's there.

     launch.begin({ url, name, blurb })   the loading screen, at once (url: the game's cover, for its card)
     launch.card({ title, blurb })        make sure the card is there (it is, from begin, when the game is named)
     launch.release()                     fade it away
     launch.at                            when it began (ms)                */
import { loader } from './brand.js';

export const launch = {
  el: null, at: 0, url: null,

  begin({ url = null, name = '', blurb = '' } = {}){
    this.release(true);
    const el = document.createElement('div');
    el.className = 'launchveil';
    this.url = url;
    document.body.appendChild(el);
    this.el = el; this.at = performance.now();
    if (name) this.card({ title: name, blurb });
  },

  card({ title = '', blurb = '' } = {}){
    const el = this.el; if (!el || el.querySelector('.loadhop')) return;
    el.classList.add('hascard');
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

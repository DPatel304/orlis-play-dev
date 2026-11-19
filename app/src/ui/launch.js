/* Going into a game: the tile you picked opens up to fill the screen - its
   own cover, title and all - and stays there while the game gets ready (the
   camera starts underneath; nothing is said about it). When the game's
   ready the cover fades away and the game's there.

     launch.begin({ rect, url, accent, name })   expand from the tile's place
     launch.release()                            fade it away (now: at once)
     launch.at                                   when it began (ms)            */
const OPEN_MS = 560;
const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export const launch = {
  el: null, at: 0, OPEN: OPEN_MS / 1000,

  begin({ rect, url = null, accent = '#6d5efc', name = '' }){
    this.release(true);
    const el = document.createElement('div');
    el.className = 'launchveil';
    el.style.setProperty('--accent', accent);
    if (url) el.style.backgroundImage = `url(${url})`;
    else el.innerHTML = `<div class="launchname">${String(name).replace(/[&<>]/g, '')}</div>`;
    /* Something is happening (not how long it will take): Cubo's head, top right, twirling. */
    el.insertAdjacentHTML('beforeend', '<div class="launchhead"><div class="lh"><i class="eye"></i><i class="eye"></i><i class="mouth"></i></div></div>');
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
    const el = this.el; if (!el || el.querySelector('.launchcard')) return;
    const esc = (s) => String(s).replace(/[&<>]/g, '');
    el.classList.add('hascard');
    el.insertAdjacentHTML('beforeend', `<div class="launchcard"><h2>${esc(title)}</h2><p>${esc(blurb)}</p></div>`);
  },

  release(now = false){
    const el = this.el; if (!el) return;
    this.el = null;
    if (now){ el.remove(); return; }
    el.classList.add('away');
    setTimeout(() => el.remove(), 800);
  }
};

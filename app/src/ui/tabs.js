/* The top of every page but Home (decision 0045): no tabs any more, just a big Home button where the logo sits on Home.

   topBar(page, nav, opts) gives { el, tick() }: put el on the page and call tick() each frame. nav has home(). (The profile face,
   Settings and signing out are on Home, behind the profile face: menu.js openProfileSheet.) */
import { homeButton } from './brand.js';
import { h } from './screens.js';

export function topBar(page, nav, { isBusy = () => false } = {}){
  const top = h('div', 'ctop');
  if (nav && nav.home) top.appendChild(homeButton(() => { if (isBusy()) return; nav.home(); }));
  return { el: top, pill: null, page, get menuOpen(){ return false; }, tick(){} };
}

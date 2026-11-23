/* The top of every page but Home (decision 0045): a big Home button where the logo sits on Home.
   Decision 0055: Play and Create are two tabs beside the logo, on Play and on Create (grown-ups only).

   topBar(page, nav, opts) gives { el, tick() }: put el on the page and call tick() each frame. nav has home(). With opts.tabs ('create')
   the bar is the logo and the tabs (that one lit) instead of the Home button. (The profile face, Settings and signing out are on Home,
   behind the profile face: menu.js openProfileSheet.)

   brandBar({ tabs, current, nav, light }) gives { el, tabs: [button] }: the "Orlis Play" logo, then (when `tabs` isn't empty) a white pill for
   the current tab and the other one quiet. nav: { play(), create() }. light: on a dark picture (Play) rather than on paper (Create). */
import { button, onPick } from './cursor.js';
import { homeButton, logo, icon } from './brand.js';
import { sfx } from '../audio/sound.js';
import { h } from './screens.js';

const TABS = { play: { name: 'Play', icon: 'play' }, create: { name: 'Create', icon: 'pencil' } };

export function brandBar({ tabs = [], current = 'play', nav = {}, light = false, isBusy = () => false } = {}){
  const el = h('div', 'hbrand' + (light ? ' light' : ''));
  el.appendChild(logo({ size: 'calc(var(--u)*4.4)', light }));
  const els = [];
  if (tabs.length){
    const bar = h('div', 'ptabs'); bar.setAttribute('role', 'tablist');
    for (const id of tabs){
      const t = button('', 'ptab' + (id === current ? ' cur focus' : '')); t.setAttribute('data-tab', id);
      t.querySelector('.lbl').innerHTML = `${icon(TABS[id].icon)}<span>${TABS[id].name}</span>`;
      t.setAttribute('role', 'tab'); t.setAttribute('aria-selected', id === current ? 'true' : 'false'); t.setAttribute('aria-label', TABS[id].name);
      onPick(t, () => { if (id === current || isBusy()) return; sfx.select?.(); nav[id] && nav[id](); });
      bar.appendChild(t); els.push(t);
    }
    el.appendChild(bar);
  }
  return { el, tabs: els };
}

export function topBar(page, nav, { isBusy = () => false, tabs = null } = {}){
  const top = h('div', 'ctop');
  if (tabs && tabs.length){
    top.appendChild(brandBar({ tabs, current: page === 'pro' ? 'create' : page, nav: { play: nav.home, create: nav.create }, isBusy }).el);
  } else if (nav && nav.home) top.appendChild(homeButton(() => { if (isBusy()) return; nav.home(); }));
  return { el: top, pill: null, page, get menuOpen(){ return false; }, tick(){} };
}

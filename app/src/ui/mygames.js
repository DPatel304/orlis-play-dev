/* "Games on this TV" (decision 0055): the games downloaded from Discover, each with a Remove, for grown-ups. Discover only lists what isn't
   here yet, so this is where a family looks after what they have. It is in the profile sheet (menu.js), a full-screen sheet like Settings.

   gamesOnTv() is the list (no DOM, tested): the downloaded games, by name. openGames({ onChanged }) is the sheet; onChanged() is called
   once it closes if anything was removed (Home needs its tiles again). */
import { GAMES } from '../games/index.js';
import { button, onPick } from './cursor.js';
import { screen, h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { account } from './account.js';
import { appMode } from './mode.js';
import { library } from './library.js';
import { homeButton } from './brand.js';

/* who may see it: a grown-up (not a child), in the Player app */
export const mayManageGames = () => !account.isKid && !account.waiting && !appMode.creator();

export function gamesOnTv(){
  return [...library.installed.entries()].map(([id, version]) => {
    const g = GAMES.find(x => x.id === id);
    return { id, version, name: g ? g.name : id };
  }).sort((a, b) => a.name.localeCompare(b.name));
}

export function openGames({ onChanged = () => {} } = {}){
  const s = screen('dim setscreen setsheet gamessheet'); s.style.zIndex = 5;
  const card = h('div', 'setcard');
  let changed = false, shut = false;
  const close = () => { if (shut) return; shut = true; sfx.back?.(); s.remove(); if (changed) onChanged(); };
  const home = homeButton(close); home.classList.add('close');
  s.appendChild(home);
  const head = h('div', 'sethead'); head.append(h('h2', '', 'Games on this TV'));
  card.appendChild(head);
  const list = h('div', 'gameslist');
  card.appendChild(list);
  const fill = () => {
    list.innerHTML = '';
    const all = gamesOnTv();
    if (!all.length){ list.appendChild(h('p', 'gamesnone', 'No downloaded games yet. Games you get from Discover show up here.')); return; }
    for (const g of all){
      const r = h('div', 'setrow'), c = h('div', 'setctl'), name = h('span', 'setname');
      name.textContent = g.name;
      /* (asks once: the first press says "Sure?", the second removes it) */
      const rm = onPick(button('Remove', 'setbtn gamerm'), async () => {
        if (!rm.classList.contains('sure')){
          sfx.select(); rm.classList.add('sure'); rm.querySelector('.lbl').textContent = 'Sure? Remove'; return;
        }
        sfx.back?.();
        try { await library.remove(g.id); changed = true; } catch {}
        fill();
      });
      c.appendChild(rm); r.append(name, c); list.appendChild(r);
    }
  };
  fill();
  s.appendChild(card);
  return Object.assign(s, { close });
}

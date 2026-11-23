/* Looking after the family, on the first screen (the one you get to by picking
   your picture): a pencil on each profile opens a small card to rename them,
   change their avatar, or remove them (a child, not the grown-up
   who made the account); a pencil by the family's name changes that.

   The account's maker is the head of the household and a grown-up; everyone
   else is a family member, taken to be under 18. There's no second grown-up to
   invite. Nothing else is kept about a child: a name and a picture. */
import { button, onPick } from './cursor.js';
import { screen, h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { account } from './account.js';
import { openMaker, faceOf } from './avatar-maker.js';

const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SURE = 4000;

/* a small card in the middle, over whatever's showing */
function popup(...parts){
  const wrap = screen('dim fpopwrap'); wrap.style.zIndex = 8;
  const card = h('div', 'fpop');
  card.append(...parts);
  wrap.appendChild(card);
  const close = () => { wrap.remove(); removeEventListener('keydown', esc_, true); };
  const esc_ = (e) => { if (e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); sfx.back?.(); close(); } };
  addEventListener('keydown', esc_, true);
  wrap.addEventListener('pointerdown', (e) => { if (e.target === wrap){ sfx.back?.(); close(); } });
  return { card, close };
}
const btn = (label, fn, cls = '') => onPick(button(label, 'setbtn ' + cls), fn);
const problem = (card) => (e) => { card.querySelector('.ferr')?.remove(); card.appendChild(h('p', 'ferr', esc(e.message || 'That didn’t work.'))); };
function sure(label, ask, fn){
  let at = 0;
  const b = btn(label, () => {
    if (Date.now() - at < SURE){ at = 0; fn(); return; }
    at = Date.now(); sfx.select(); b.querySelector('.lbl').textContent = ask;
    setTimeout(() => { if (at && Date.now() - at >= SURE - 50 && b.isConnected){ at = 0; b.querySelector('.lbl').textContent = label; } }, SURE);
  }, 'danger');
  return b;
}
const nameBox = (value = '', max = 20, placeholder = 'A first name or nickname') => {
  const i = document.createElement('input');
  i.type = 'text'; i.maxLength = max; i.value = value; i.placeholder = placeholder; i.className = 'finput';
  return i;
};
/* a profile to change: p, or null to add a child. self: the grown-up's own (no Remove). */
export function editProfile(p, { self = false, onDone = () => {} } = {}){
  const box = nameBox(p ? p.name : '');
  const { card, close } = popup(h('h2', '', p ? esc(p.name) : 'Add a child'), box);
  const finish = () => { close(); onDone(); };
  /* the avatar maker is the picture: their character, and a way to change it (a new child goes straight on to making theirs) */
  if (p){
    const row = h('div', 'favrow'); row.append(faceOf(p, 140), btn('Change avatar', () => { close(); openMaker(p, { onDone }); }, 'go'));
    card.appendChild(row);
  }
  if (!self) card.appendChild(h('p', 'fnote', 'Just a name and an avatar - nothing else is kept about a child.'));
  const go = async () => {
    const name = box.value.trim(); if (!name) return box.focus();
    try {
      if (p){ await account.call('PATCH', `/api/profiles/${encodeURIComponent(p.id)}`, { name }); sfx.gold?.(); finish(); }
      else {
        const made = await account.call('POST', '/api/profiles', { name, avatar: 'cube' });
        sfx.gold?.(); close();
        /* straight on to making their avatar (Cancel keeps Cubo's face) */
        openMaker(made, { onDone });
      }
    } catch (e){ problem(card)(e); }
  };
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
  const row = h('div', 'fbtns');
  if (p && !self) row.appendChild(sure('Remove', 'Remove? Pick again', async () => {
    try { await account.call('DELETE', `/api/profiles/${encodeURIComponent(p.id)}`); finish(); } catch (e){ problem(card)(e); }
  }));
  row.append(btn('Cancel', () => { sfx.back?.(); close(); }), btn(p ? 'Save' : 'Add', go, 'go'));
  card.appendChild(row);
  setTimeout(() => { box.focus(); if (p) box.select(); }, 50);
}

/* the family's name */
export function renameFamily({ onDone = () => {} } = {}){
  const current = (account.state.household && account.state.household.name) || '';
  const box = nameBox(current, 40, 'The family’s name');
  const { card, close } = popup(h('h2', '', 'The family’s name'), box);
  const save = async () => {
    try { await account.call('PATCH', '/api/household', { name: box.value }); sfx.select(); close(); onDone(); } catch (e){ problem(card)(e); }
  };
  box.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  card.appendChild(h('div', 'fbtns')).append(btn('Cancel', () => { sfx.back?.(); close(); }), btn('Save', save, 'go'));
  setTimeout(() => { box.focus(); box.select(); }, 50);
}

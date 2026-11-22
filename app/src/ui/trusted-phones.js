/* Settings' "Trusted phones" (plan package P5; mockup docs/pads-mockup.html; decision 0032). Grown-up small print: which phones joined before,
   who they were last, when, and Remove; and "Forget all phones". A removed phone has to use the three pictures again.

     openTrustedPhones()                 the list, over Settings
     whenText(lastSeen, now)             "Today", "Yesterday", "3 days ago", "3 weeks ago" ...
     phoneRows(entries, profiles, now)   the list as plain rows (tested) */
import { button, onPick } from './cursor.js';
import { screen, h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { account } from './account.js';
import { createTrust } from '../session/trust.js';
import { currentPads } from '../session/pads.js';
import { faceChip, personOf } from './pad-faces.js';
import { normalizeLook } from './look.js';

const DAY = 86400000;
const startOfDay = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/* when a phone was last used, as a person would say it (calendar days, not 24-hour blocks) */
export function whenText(lastSeen, now = Date.now()) {
  if (!lastSeen) return 'A while ago';
  const days = Math.round((startOfDay(now) - startOfDay(lastSeen)) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/* the trust store's entries as rows for the list */
export function phoneRows(entries, profiles = [], now = Date.now()) {
  return entries.map(e => {
    const p = personOf(e.who, profiles);
    return { token: e.token, device: e.name || 'Phone', who: e.who, name: p.name, avatar: p.avatar, when: whenText(e.lastSeen, now) };
  });
}

/* Remove one phone: through the running session if a game with phones is on (it also closes that phone), else straight from the store. */
export function forgetPhone(token, trust = createTrust()) {
  const rt = currentPads();
  return rt ? rt.session.forget(token) : trust.remove(token);
}

export function openTrustedPhones({ trust = createTrust() } = {}) {
  const s = screen('dim setscreen trusted');
  s.style.zIndex = 6;
  const card = h('div', 'setcard trustcard');
  const close = () => { sfx.back?.(); s.remove(); };
  const head = h('div', 'sethead');
  head.append(h('div', '', '<div class="sk">Settings</div><h2>Trusted phones</h2>'), onPick(button('✕', 'setclose'), close));
  card.appendChild(head);
  card.appendChild(h('p', 'trustsay', 'Phones that joined before come straight back. Remove one to make it use the pictures again.'));
  const list = h('div', 'trustlist');
  card.appendChild(list);
  const foot = h('div', 'trustfoot');
  card.appendChild(foot);
  s.appendChild(card);
  s.addEventListener('pointerdown', (e) => { if (e.target === s) close(); });

  function render() {
    const rows = phoneRows(trust.list(), (account.state && account.state.profiles) || []);
    list.replaceChildren(); foot.replaceChildren();
    if (!rows.length) { list.appendChild(h('div', 'trustnone', 'No phones yet. A phone that joins a game with the three pictures is remembered here.')); return; }
    for (const r of rows) {
      const row = h('div', 'trow'); row.dataset.token = r.token;
      const face = faceChip({ avatar: r.avatar, colour: r.avatar ? normalizeLook(r.avatar).colour : null }, Math.round((typeof innerHeight === 'number' ? innerHeight : 720) * 0.064));
      const rm = onPick(button('Remove', 'setbtn trustrm'), () => { sfx.select?.(); forgetPhone(r.token, trust); render(); });
      row.append(h('span', 'dev', r.device), face, h('span', 'nm', ''), h('span', 'when', r.when), rm);
      row.querySelector('.nm').textContent = r.name;
      list.appendChild(row);
    }
    foot.appendChild(onPick(button('Forget all phones', 'setbtn danger trustall'), () => { sfx.select?.(); for (const e of trust.list()) forgetPhone(e.token, trust); render(); }));
  }
  render();
  return s;
}

/* "Connect Claude Code": for a grown-up who'd like to make games themselves,
   on their own Claude account. A checklist that keeps itself up to date -
   install Claude Code (a button runs its installer), sign in once (a button
   opens it to sign in) - and says Connected when both are done.

     claudeChecklist({ onConnected })   { el, stop() }   el: the list and a note */
import { button, onPick } from './cursor.js';
import { h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { setup, claudeSteps, claudeConnected } from './setup.js';

const SAYS = {
  install: 'Claude Code is installing in its own window. When it says it’s done, close that window - this ticks itself.',
  signin: 'Claude Code has opened in its own window: choose your Claude account, then sign in on the page that opens in the browser. Close that window once you’re signed in - this ticks itself.'
};

export function claudeChecklist({ onConnected = () => {}, every = 4000 } = {}){
  const el = h('div', 'claudecheck');
  const list = h('ol', 'setupsteps'), note = h('p', 'lede small setupnote', '');
  el.append(list, note);
  let last = '', busy = false, timer = null, stopped = false, told = false;
  const draw = (st) => {
    const steps = claudeSteps(st), key = steps.map(x => x.state).join();
    if (key === last) return;
    if (last) note.textContent = '';
    last = key;
    list.innerHTML = '';
    for (const x of steps){
      const li = h('li', 'setupstep ' + x.state, `<span class="tick">${x.state === 'done' ? '✓' : ''}</span><div><b>${x.title}</b><small>${x.line}</small></div>`);
      if (x.action) li.lastChild.appendChild(onPick(button(x.action === 'install' ? 'Install Claude Code' : 'Sign in to Claude', 'go small'), async () => {
        if (busy) return; busy = true; sfx.select(); note.textContent = '';
        try { await (x.action === 'install' ? setup.installClaude() : setup.claudeSignin()); note.textContent = SAYS[x.action]; }
        catch (e){ note.textContent = e.message; }
        busy = false;
      }));
      list.appendChild(li);
    }
    if (claudeConnected(st) && !told){ told = true; onConnected(); }
  };
  let shown = false;
  const tick = async () => {
    if (stopped) return;
    /* (gone from the screen: stop looking) */
    if (el.isConnected) shown = true; else if (shown){ stopped = true; return; }
    const st = await setup.status();
    if (stopped) return;
    draw(st);
    timer = setTimeout(tick, every);
  };
  draw(null);
  tick();
  return { el, stop(){ stopped = true; clearTimeout(timer); } };
}

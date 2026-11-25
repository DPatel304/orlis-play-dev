/* The TV remote - any plain one that plugs into the laptop and acts as a
   keyboard - or the laptop's own arrow keys. Arrows move a highlight to the
   nearest button that way on whatever's on top (an open window first, else
   the screen), OK (Enter) presses it, and Back (Escape, Backspace, or a
   remote's own Back key) goes back: closes a window, pauses a game, leaves
   the scores.

   It works alongside pointing and waving: the highlight starts from
   whatever the screen has picked (the home screen's tile, say), and a
   button picked by moving to it hears 'remotefocus' so the screen can
   follow along. */
import { sfx } from '../audio/sound.js';

const DIRS = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
const OK = new Set(['Enter', 'NumpadEnter', ' ', 'Select', 'Accept']);
const BACK = new Set(['Escape', 'Backspace', 'BrowserBack', 'GoBack', 'Back']);

export const remote = {
  cur: null,
  lastKey: 0,          /* when it was last used (a count, for the screens to notice) */
  back: null,          /* what Back does when nothing's open (main.js) */

  /* The highlighted button. */
  mark(el){
    document.querySelectorAll('.kfocus').forEach(e => { if (e !== el) e.classList.remove('kfocus'); });
    if (el) el.classList.add('kfocus');
    /* a box in a sign-in form: typing goes there; off it, the box lets go */
    if (el && el.tagName === 'INPUT') el.focus();
    else if (document.activeElement && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
    this.cur = el || null;
  },

  /* What's on top: an open window, else the screen. */
  layer(){
    const ui = document.getElementById('ui');
    if (!ui) return null;
    const all = [...ui.children].filter(e => e.classList && e.classList.contains('screen') && !e.classList.contains('ghost'));
    return all.filter(e => e.classList.contains('dim') && !e.classList.contains('lost')).pop() || all.pop() || null;
  },
  buttons(layer){
    /* (and the boxes and tick of a sign-in form, so the remote can go up and down them) */
    const boxes = [...layer.querySelectorAll('.acctform input')].filter(i => i.type !== 'hidden');
    /* (and a slider, which Left and Right move: Settings' Volume) */
    const sliders = [...layer.querySelectorAll('input')].filter(isSlider);
    return [...layer.querySelectorAll('.btn'), ...boxes, ...sliders].filter(b => !b.disabled && !b.closest('.hide, .away') && b.getBoundingClientRect().width > 0);
  },
  /* Where to start from in this layer. */
  start(layer, bs){
    if (this.cur && bs.includes(this.cur)) return this.cur;
    return layer.querySelector('.btn.focus') || null;
  },

  /* The nearest button that way: the next row (or column) over first -
     never skipping one - then the closest along it. Left and right stay on
     the same row. */
  nearest(from, bs, [dx, dy]){
    const a = from.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    const cand = [];
    for (const b of bs){
      if (b === from) continue;
      const r = b.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const along = (x - ax) * dx + (y - ay) * dy, side = Math.abs((x - ax) * dy - (y - ay) * dx);
      if (along <= 4) continue;
      if (dx && side > Math.max(a.height, r.height) * 0.6) continue;
      cand.push({ b, along, side, size: dx ? r.width : r.height });
    }
    if (!cand.length) return null;
    const near = Math.min(...cand.map(c => c.along));
    const band = cand.filter(c => c.along <= near + Math.max(a[dx ? 'width' : 'height'], c.size) * 0.5);
    band.sort((p, q) => (p.side - q.side) || (p.along - q.along));
    return band[0].b;
  },

  /* A slider shares its row with a button (Settings: the speaker, then the Volume bar), so Down from the button would skip over it. Up and Down
     make it a stop of its own: going Down the order is the button, then the slider; going Up it is the slider, then the button. */
  rowSlider(b, bs){
    const a = b.getBoundingClientRect(), ay = a.top + a.height / 2, ax = a.left + a.width / 2;
    return bs.find(x => { if (!isSlider(x) || x === b) return false; const r = x.getBoundingClientRect(); return Math.abs(r.top + r.height / 2 - ay) < Math.max(a.height, r.height) * 0.6 && r.left > ax; }) || null;
  },
  vertical(cur, bs, dir){
    const dy = dir[1];
    if (dy > 0 && !isSlider(cur)){ const sl = this.rowSlider(cur, bs); if (sl) return sl; }
    if (dy < 0 && isSlider(cur)){
      const a = cur.getBoundingClientRect(), ay = a.top + a.height / 2;
      const left = bs.filter(x => x !== cur && !isSlider(x) && x.classList.contains('btn') && Math.abs(x.getBoundingClientRect().top + x.getBoundingClientRect().height / 2 - ay) < a.height * 0.6 && x.getBoundingClientRect().right <= a.left + 4).pop();
      if (left) return left;
    }
    const next = this.nearest(cur, bs, dir);
    return next && dy < 0 && !isSlider(next) && this.rowSlider(next, bs) || next;
  },

  key(e){
    /* typing in a box (an email, a password): the keys are the box's */
    if (typing(e)) return false;
    const dir = DIRS[e.key];
    if (dir || OK.has(e.key)){
      const layer = this.layer();
      const bs = layer ? this.buttons(layer) : [];
      if (!bs.length) return false;
      e.preventDefault?.();
      this.lastKey++;
      document.body.classList.add('remote');
      /* (from the box being typed in, if that's where you are) */
      const cur = e.target && bs.includes(e.target) ? e.target : this.start(layer, bs);
      if (OK.has(e.key)){ const b = cur || bs[0]; this.mark(b); if (!isSlider(b)) b.click(); return true; }
      /* a slider: Left and Right move it a step; at its end the key moves on to the next button that way, as it does anywhere else */
      if (cur && isSlider(cur) && dir[0] && stepSlider(cur, dir[0])){ this.mark(cur); sfx.nav?.(); return true; }
      const next = cur ? (dir[1] ? this.vertical(cur, bs, dir) : this.nearest(cur, bs, dir)) : bs[0];
      if (!next) return true;
      this.mark(next);
      if (!next.classList.contains('tvtile')) sfx.nav();
      next.dispatchEvent(new CustomEvent('remotefocus'));
      return true;
    }
    if (BACK.has(e.key)){
      e.preventDefault?.();
      const layer = this.layer();
      const close = layer && layer.classList.contains('dim') && layer.querySelector('.btn.close');
      if (close){ sfx.back(); close.click(); return true; }
      /* a small card (Create's, Family's) closes as a tap outside it does */
      if (layer && layer.classList.contains('fpopwrap')){ layer.dispatchEvent(new Event('pointerdown')); return true; }
      if (this.back) this.back();
      return true;
    }
    return false;
  },

  /* Each frame, once the remote's in use: a new window or screen gets its
     highlight straight away (what it's picked, else its first button). */
  sync(){
    if (typeof document === 'undefined' || !document.body.classList.contains('remote')) return;
    const layer = this.layer(); if (!layer) return;
    if (this.cur && this.cur.isConnected && layer.contains(this.cur)) return;
    const bs = this.buttons(layer);
    const act = document.activeElement;
    if (bs.length) this.mark(act && bs.includes(act) ? act : layer.querySelector('.btn.focus') || bs[0]);
  },

  install(back){
    this.back = back;
    addEventListener('keydown', (e) => this.key(e));
    /* a sign-in box that gets the cursor (a new screen's first box) takes the highlight too */
    addEventListener('focusin', (e) => { const t = e.target; if (t && t.closest && t.closest('.acctform') && t.tagName === 'INPUT' && document.body.classList.contains('remote')) this.mark(t); });
    if (typeof window !== 'undefined') window.__remote = this;
    /* pointing again: the remote's highlight steps aside */
    addEventListener('pointermove', () => document.body.classList.remove('remote'));
  }
};

/* a slider (input type=range) is moved by the remote in this many steps from end to end */
export const SLIDER_STEPS = 10;
const isSlider = (el) => !!el && el.tagName === 'INPUT' && String(el.type).toLowerCase() === 'range';
/* move a slider one remote step (dir -1 or 1) and tell the page it changed; false when it is already at that end */
function stepSlider(el, dir){
  const min = Number(el.min) || 0, max = el.max === '' || el.max == null ? 100 : Number(el.max), v = Number(el.value), step = (max - min) / SLIDER_STEPS;
  const next = Math.max(min, Math.min(max, Math.round((v + dir * step) / step) * step));
  if (Math.abs(next - v) < 1e-9) return false;
  el.value = String(Math.round(next * 1000) / 1000);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}

/* Whether a key went to a text box being typed in. */
export function typing(e){
  const t = e && e.target;
  if (!t || !t.tagName) return false;
  if (t.isContentEditable) return true;
  if (t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return true;
  /* in a sign-in box, up and down move to the next box (left and right stay the box's) */
  if (t.tagName === 'INPUT' && t.closest && t.closest('.acctform') && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) return false;
  return t.tagName === 'INPUT' && !['checkbox', 'radio', 'button', 'submit', 'range'].includes((t.type || 'text').toLowerCase());
}

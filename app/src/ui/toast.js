/* A short note that pops up at the top of the screen and goes away by
   itself - the one way the app says something happened ("Sent!") or went
   wrong (red), on every page, like the problems under the sign-in card.
   A newer note replaces the one showing. */
let showing = null;

export function toast(text, { bad = false, ms = bad ? 6000 : 3500 } = {}){
  if (typeof document === 'undefined' || !text) return;
  if (showing){ showing.remove(); showing = null; }
  const t = document.createElement('div');
  t.className = 'toast' + (bad ? ' bad' : '');
  t.setAttribute('role', bad ? 'alert' : 'status');
  t.textContent = text;
  document.body.appendChild(t);
  showing = t;
  setTimeout(() => { t.classList.add('out'); setTimeout(() => { t.remove(); if (showing === t) showing = null; }, 350); }, ms);
  return t;
}

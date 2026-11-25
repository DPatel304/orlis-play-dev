/* Places a hand's ring or orb is never drawn over: any element marked data-nocursor (the big count on the results card). Rectangles as
   shares of the window, a little padded. Only what is drawn: the hand still points at buttons wherever it is. (Its own file: a packaged
   game carries avatars.js but not the cursor.) */
export function keepOut(x, y){
  if (typeof document === 'undefined' || !document.querySelectorAll) return false;
  const w = window.innerWidth || 1, hh = window.innerHeight || 1;
  for (const el of document.querySelectorAll('[data-nocursor]')){
    const r = el.getBoundingClientRect();
    if (r.width > 0 && x >= r.left / w - 0.03 && x <= r.right / w + 0.03 && y >= r.top / hh - 0.05 && y <= r.bottom / hh + 0.05) return true;
  }
  return false;
}

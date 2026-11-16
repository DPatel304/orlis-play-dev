/* The welcome screens' look: a soft glow in the brand's colours with the
   cube, big and faint, behind the sign-in card; and the logo for the card. */
const CUBE = `<path d="M32 6 56 19v26L32 58 8 45V19z" fill="#7fb8c9"/><path d="M32 6 56 19 32 32 8 19z" fill="#cfe4ea"/><path d="M32 32v26L8 45V19z" fill="#9f97d6"/>`;

export function brandGlow(){
  const d = document.createElement('div');
  d.className = 'acctbg';
  d.setAttribute('aria-hidden', 'true');
  d.innerHTML = `<div class="glow g1"></div><div class="glow g2"></div><div class="glow g3"></div>
    <svg class="bigcube" viewBox="0 0 64 64">${CUBE}</svg><div class="grain"></div>`;
  return d;
}

/* the cube and the name, in place of a sentence */
export function logo(){
  const d = document.createElement('div');
  d.className = 'acctlogo';
  d.innerHTML = `<svg viewBox="0 0 64 64" aria-hidden="true">${CUBE}</svg><h2>Orlis Play</h2>`;
  return d;
}

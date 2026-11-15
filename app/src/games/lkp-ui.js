/* Last Known Position's on-screen words and panels, in the painted house
   style (as the mockups and Pop Party): soft cream cards with a gentle
   shadow, warm dark ink, no black outlines. Every call-out, label and
   panel in the game draws through these, so they all match.

     card(c, x, y, w, h, r)               a cream card
     plate(c, text, x, y, size, opts)     words on a cream pill
     callout(c, W, H, text, col, s, y)    a big call-out (CLIMB!, JUMP!) -
                                          its colour kept as an accent
     word(c, text, x, y, size, col)       a sound word (BOING!), in the
                                          scene: coloured, a soft edge */

export const INK = '#2d2a26', SOFT_INK = '#6b6358', CREAM = 'rgba(250,247,238,.95)', SHADE = '#3a3360';
const FONT = (px, w = 700) => `${w} ${Math.round(px)}px Fredoka, sans-serif`;

/* A colour's ink: the colour taken darker, so it reads on cream - white or
   near-white is plain ink. */
const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
export function inkOf(col){
  if (!col || col[0] !== '#' || col.length !== 7) return INK;
  const c = hex(col), lum = (c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11) / 255;
  if (lum > 0.88) return INK;
  const k = 0.42, i = hex(INK);
  return `rgb(${c.map((v, n) => Math.round(v + (i[n] - v) * k)).join(',')})`;
}

export function card(c, x, y, w, h, r = h * 0.3, fill = CREAM){
  c.save();
  c.shadowColor = 'rgba(58,51,96,.18)'; c.shadowBlur = h * 0.35; c.shadowOffsetY = h * 0.08;
  c.fillStyle = fill; c.beginPath(); c.roundRect(x, y, w, h, Math.min(r, h / 2, w / 2)); c.fill();
  c.restore();
}

/* Words on a pill. opts: ink, align ('center' | 'left' | 'right': where x
   is), weight, accent (a dot of colour before the words), pad. Returns
   the pill's width. */
export function plate(c, text, x, y, size, { ink = INK, align = 'center', weight = 700, accent = null, pad = 0.75 } = {}){
  c.save();
  c.font = FONT(size, weight); c.textBaseline = 'middle';
  const tw = c.measureText(text).width, dot = accent ? size * 0.9 : 0, w = tw + size * pad * 2 + dot, h = size * 1.75;
  const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
  card(c, x0, y - h / 2, w, h, h / 2);
  if (accent){ c.fillStyle = accent; c.beginPath(); c.arc(x0 + size * pad + size * 0.3, y, size * 0.3, 0, 6.2832); c.fill(); }
  c.fillStyle = ink; c.textAlign = 'left'; c.fillText(text, x0 + size * pad + dot, y + size * 0.04);
  c.restore();
  return w;
}

/* The big call-out: a cream pill, the words in the call-out's colour (made
   dark enough to read), centred at y. s scales it (a little bounce). */
export function callout(c, W, H, text, col, s = 1, y = H * 0.2){
  c.save(); c.translate(W / 2, y); c.scale(s, s);
  plate(c, text, 0, 0, H * 0.06, { ink: inkOf(col), accent: col && col !== '#ffffff' ? col : null });
  c.restore();
}

/* A sound word in the scene: its colour, a soft edge in the shade tone. */
export function word(c, text, x, y, size, col = '#fff6e2'){
  c.save(); c.font = FONT(size, 800); c.textAlign = 'center'; c.textBaseline = 'middle';
  c.lineJoin = 'round'; c.lineWidth = size * 0.16; c.strokeStyle = 'rgba(58,51,96,.55)'; c.strokeText(text, x, y);
  c.fillStyle = col; c.fillText(text, x, y);
  c.restore();
}

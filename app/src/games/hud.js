/* The words and the meter every game puts on its sky, drawn one way: a speech bubble under the clock, and under that, if
   the game has something to fill, a bar. (The clock is the shell's, top centre; a score, if a game shows one, is the
   game's own, top right.) They go away on the results screen, so nothing from the game sits behind "Well played!". */
export const hud = { quiet: false };

const INK = '#33322e', PAPER = 'rgba(250,247,238,.95)';
const FONT = 'Inter, Segoe UI, sans-serif';

/* text: the words. t: seconds since they changed (they ease in). x, y: where, as a share of the screen. until: seconds
   after which they ease away (a hint that has done its job). */
export function sayBubble(c, W, H, { text, t = 1, x = 0.5, y = 0.19, until = Infinity }){
  if (hud.quiet || !text) return;
  const k = Math.min(1, t / 0.25), out = isFinite(until) ? Math.max(0, Math.min(1, (until - t) / 0.5)) : 1;
  if (out <= 0) return;
  const size = Math.round(H * 0.04);
  c.save(); c.font = `800 ${size}px ${FONT}`;
  const w = c.measureText(text).width + size * 1.6;
  c.globalAlpha = k * out; c.translate(W * x, H * y); c.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
  c.fillStyle = PAPER; c.beginPath(); c.roundRect(-w / 2, -size * 0.95, w, size * 1.9, size * 0.95); c.fill();
  c.fillStyle = INK; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 0, 2);
  c.restore();
}

/* k: how full, 0 to 1. color: the fill (gold when done). Under the words. */
export function goalBar(c, W, H, k, { color = '#7398c4', x = 0.5, y = 0.25 } = {}){
  if (hud.quiet) return;
  const w = W * 0.2, h = H * 0.022, bx = W * x - w / 2, by = H * y;
  c.save();
  c.fillStyle = 'rgba(250,247,238,.9)'; c.beginPath(); c.roundRect(bx, by, w, h, h / 2); c.fill();
  if (k > 0){ c.fillStyle = color; c.beginPath(); c.roundRect(bx + 3, by + 3, Math.max(h - 6, (w - 6) * Math.min(1, k)), h - 6, (h - 6) / 2); c.fill(); }
  c.restore();
}

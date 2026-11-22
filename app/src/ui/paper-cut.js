/* The paper cut for the app (not for the creator kit - see avatar-art.js setPaperCut): a thin cream paper edge and a soft shadow around the
   character. The figure is drawn flat into a scratch canvas; a cream copy of its shape is laid down at eight small offsets (the edge), the
   first with a soft shadow; then the figure on top. */
import { color, alpha } from '../games/assets/palette.js';
import { setPaperCut } from './avatar-art.js';

const scratch = [null, null];
function sheet(i, w, h){
  if (!scratch[i]){ if (typeof document === 'undefined') return null; scratch[i] = document.createElement('canvas'); }
  const cv = scratch[i]; if (cv.width < w) cv.width = w; if (cv.height < h) cv.height = h;
  return cv;
}
function cut(c, box, S, flat, sc){
  const k = Math.min(3, Math.max(0.25, sc)), e = S * 0.009, pad = e + S * 0.06;
  const bx = box[0] - pad, by = box[1] - pad, w = Math.ceil((box[2] + pad * 2) * k), h = Math.ceil((box[3] + pad * 2) * k);
  const A = sheet(0, w, h), B = sheet(1, w, h);
  if (!A || !B || !A.getContext) return flat(c);
  const a = A.getContext('2d'); a.setTransform(1, 0, 0, 1, 0, 0); a.clearRect(0, 0, A.width, A.height);
  a.setTransform(k, 0, 0, k, -bx * k, -by * k);
  flat(a);
  const b = B.getContext('2d'); b.setTransform(1, 0, 0, 1, 0, 0); b.globalCompositeOperation = 'copy'; b.drawImage(A, 0, 0, w, h, 0, 0, w, h);
  b.globalCompositeOperation = 'source-in'; b.fillStyle = color('shade.card'); b.fillRect(0, 0, w, h); b.globalCompositeOperation = 'source-over';
  const sw = w / k, sh = h / k;
  c.save();
  for (let i = 0; i < 8; i++){
    const an = i / 8 * Math.PI * 2;
    if (i === 0){ c.shadowColor = alpha('shade.shadow', 0.26); c.shadowBlur = S * 0.014 * sc; c.shadowOffsetX = S * 0.04 * sc; c.shadowOffsetY = S * 0.04 * sc; }
    else { c.shadowColor = 'transparent'; c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; }
    c.drawImage(B, 0, 0, w, h, bx + Math.cos(an) * e, by + Math.sin(an) * e, sw, sh);
  }
  c.restore();
  c.drawImage(A, 0, 0, w, h, bx, by, sw, sh);
}
export const installPaperCut = () => setPaperCut(cut);
installPaperCut();

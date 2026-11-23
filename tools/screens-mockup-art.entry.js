/* Browser side of tools/screens-mockup.mjs: draws the real Orlis art (the block-limb Cubo, the kids' avatars, the game covers, the
   painted props, the Pop Party sky) onto canvases and returns each one as a data URI. Bundled by esbuild; imports nothing of its own. */
import { assets } from '../app/src/games/assets/index.js';
import { color } from '../app/src/games/assets/palette.js';
import { body, portrait } from '../app/src/ui/avatar-art.js';
import { CUBO } from '../app/src/ui/look.js';
import { makeCover } from '../app/src/ui/covers.js';
import { Scene } from '../app/src/games/pop-party-scene.js';

/* three kids, in the colours of players 1 to 3 (decision 0042: a colour, a face, a top, an outfit, an extra) */
export const KIDS = {
  mia: { colour: 'sky', face: { eyes: 'happy', mouth: 'grin' }, top: 'bow', outfit: 'stripes', outfitColour: 'ui.gold', extra: 'cheeks' },
  leo: { colour: 'orange', face: { eyes: 'wink', mouth: 'cat' }, top: 'cap', outfit: 'overalls', outfitColour: 'touch.skyBlue', extra: 'none' },
  ava: { colour: 'green', face: { eyes: 'star', mouth: 'grin' }, top: 'flower', outfit: 'dots', outfitColour: 'ui.go', extra: 'freckles' }
};
const GAMES = ['pop-party', 'sky-painter', 'leaf-pile', 'sleepy-bear', 'stack-it-high', 'animal-gym', 'keep-it-up', 'ptero-flight'];

const out = {};
const canvas = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const png = (name, w, h, draw) => { const c = canvas(w, h), x = c.getContext('2d'); draw(x, w, h); out[name] = c.toDataURL('image/png'); };
const jpg = (name, w, h, draw, q = 0.86) => { const c = canvas(w, h), x = c.getContext('2d'); draw(x, w, h); out[name] = c.toDataURL('image/jpeg', q); };

window.renderAll = async () => {
  for (const id of GAMES){
    /* the wide painted world (no words) for backdrops, and the cover with the game's own painted title for tiles */
    const wide = makeCover({ id, name: id }, { w: 1280, h: 720 }); if (!wide) throw new Error('no wide art for ' + id);
    jpg('bg-' + id, 1280, 720, (x, w, h) => x.drawImage(wide.art, 0, 0, w, h), 0.78);
    const name = { 'pop-party': 'Pop Party', 'sky-painter': 'Sky Painter', 'leaf-pile': 'Leaf Pile', 'sleepy-bear': 'Sleepy Bear', 'stack-it-high': 'Stack It High', 'animal-gym': 'Animal Gym', 'keep-it-up': 'Keep It Up!', 'ptero-flight': 'Pterry Flight' }[id];
    const cov = makeCover({ id, name }); if (!cov) throw new Error('no cover for ' + id);
    jpg('cover-' + id, 640, 400, (x, w, h) => x.drawImage(cov.cover, 0, 0, w, h), 0.84);
  }
  /* Cubo and the kids, whole (every figure on the same 560 x 600 canvas, feet 32 px from the bottom) */
  const fig = (name, look, pose) => png(name, 560, 600, (x, w, h) => body(x, w / 2, h - 32, 460, look, 0.2, pose));
  fig('cubo-freeze', CUBO, 'freeze'); fig('mia-jump', KIDS.mia, 'jump'); fig('leo-dance', KIDS.leo, 'dance'); fig('ava-wave', KIDS.ava, 'wave'); fig('mia-stand', KIDS.mia, 'stand');
  for (const [k, look] of Object.entries(KIDS)) png('face-' + k, 360, 360, (x) => portrait(x, 180, 180, 330, look, 0));
  png('face-cubo', 360, 360, (x) => portrait(x, 180, 180, 330, CUBO, 0));
  /* painted props: the game's icon, a star, and icons for the Make a game row */
  const prop = (name, id, size, o = {}) => png(name, size, size, (x) => { x.translate(size / 2, size / 2); assets.draw(x, id, 0, 0, size * 0.86, o); });
  prop('icon-balloon', 'balloon', 320, { color: color('ui.go') });
  prop('icon-star', 'star', 200); prop('icon-sparkle', 'sparkle', 300); prop('icon-chest', 'chest', 300); prop('icon-block', 'block', 300);
  /* a bouquet: n balloons gathered on strings into one knot, laid out the way Pop Party's outro does (a sunflower spiral) */
  const HUES = ['touch.cherry', 'touch.tangerine', 'touch.sunflower', 'touch.mint', 'touch.lagoon', 'touch.skyBlue', 'touch.grape', 'touch.bubblegum'];
  const bouquet = (name, n, S = 520) => png(name, S, S * 1.25, (x, w, h) => {
    const R = S * 0.34, r = S * 0.1 * Math.min(1, Math.sqrt(20 / n)) * 1.25, cx = w / 2, cy = S * 0.42, knot = [cx, h - 30], items = [];
    for (let k = 0; k < n; k++){ const rr = Math.sqrt((k + 0.5) / n) * R, a = k * 2.39996; items.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.85, k }); }
    x.strokeStyle = color('shade.ink'); x.globalAlpha = 0.45; x.lineWidth = 3; x.lineCap = 'round';
    for (const b of items){ x.beginPath(); x.moveTo(b.x, b.y + r * 0.9); x.quadraticCurveTo((b.x + knot[0]) / 2, (b.y + knot[1]) / 2 + 10, knot[0], knot[1]); x.stroke(); }
    x.globalAlpha = 1;
    items.sort((a, b) => a.y - b.y).forEach((b) => assets.draw(x, 'balloon', b.x, b.y, r * 2.2, { color: color(HUES[(b.k * 3) % HUES.length]) }));
  });
  bouquet('bouquet-21', 21); bouquet('bouquet-12', 12, 440); bouquet('bouquet-9', 9, 420); bouquet('bouquet-17', 17, 480);
  /* the Pop Party sky: the paused moment, and the end with the rainbow */
  const sky = (name, p, rainbow, balloons) => jpg(name, 1280, 720, (x, W, H) => {
    const s = new Scene();
    for (let i = 0; i < 40; i++) s.step(0.05, { t: 20 + i * 0.05, p, storm: false, wind: 0.2, joy: rainbow ? 1 : 0.5, look: 0, rainbow });
    s.drawBack(x, W, H); s.drawFront(x, W, H);
    for (const [bx, by, col, sz] of balloons) assets.draw(x, 'balloon', bx * W, by * H, H * sz, { color: color(col) });
  }, 0.84);
  sky('sky-play', 0.3, false, [[0.16, 0.5, 'touch.skyBlue', 0.2], [0.38, 0.28, 'touch.sunflower', 0.18], [0.62, 0.55, 'touch.bubblegum', 0.22], [0.82, 0.3, 'touch.mint', 0.18], [0.5, 0.78, 'touch.cherry', 0.16], [0.9, 0.7, 'touch.grape', 0.15]]);
  sky('sky-end', 0.92, true, []);
  return out;
};

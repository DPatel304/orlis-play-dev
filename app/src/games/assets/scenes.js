/* Scenes: whole painted backgrounds, drawn in code in the Orlis house style - a soft sky, a sun or moon, a few clouds, bands of
   hills and a ground - and nothing else, so a game's own pieces sit on top. Each one is drawn from nothing every frame
   (Orlis.assets.scene(c, W, H, 'meadow', { t })): t is seconds, so the clouds drift. They keep the top of the screen
   calm for the shared screen's words and the bottom edge plain for the move card. */
import { PALETTE, color as pal } from './palette.js';
const N = PALETTE.night;
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const hexOf = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
/* a colour (an [r, g, b] list) as '#rrggbb' plus an alpha byte, for the sky gradient and the glows (the only gradients, in the background layer) */
const hexA = (a, al = 1) => '#' + [...a, al * 255].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');

/* top/low: the sky; hills: far to near; ground: the grass (or sand, or snow); sun: 'sun' | 'moon' | null; stars: how many; cloud: their colour */
export const SCENES = {
  meadow:  { name: 'Sunny meadow', tags: 'day outdoors', top: pal('sky.high'), low: pal('sky.horizon'), hills: [pal('meadow.lawn'), pal('meadow.grass'), pal('meadow.fresh')], ground: pal('meadow.fresh'), sun: 'sun', stars: 0, cloud: pal('earth.snow') },
  sunset:  { name: 'Evening sky', tags: 'evening outdoors', top: pal('dusk.high'), low: pal('earth.peach', 'light'), hills: [pal('meadow.far'), pal('meadow.soft'), pal('meadow.grass')], ground: pal('meadow.grass'), sun: 'sun', stars: 0, cloud: pal('earth.peach', 'light'), warm: true },
  autumn:  { name: 'Autumn afternoon', tags: 'autumn outdoors', top: pal('dusk.high'), low: pal('earth.path', 'light'), hills: [pal('autumn.straw'), pal('autumn.straw', 'shade'), pal('autumn.hay')], ground: pal('autumn.hay'), sun: 'sun', stars: 0, cloud: pal('earth.path', 'light') },
  night:   { name: 'Starry night', tags: 'night outdoors', top: N.sky, low: N.dusk, hills: [N.farHills, N.hills, N.grass], ground: N.grass, sun: 'moon', moon: N.moon, star: N.star, edge: N.shade, stars: 40, cloud: hexA(hexOf(PALETTE.shade.light), 0.3) },
  snow:    { name: 'Snowy hills', tags: 'winter outdoors', top: pal('sky.high'), low: pal('sky.low', 'light'), hills: [pal('sky.low'), pal('sky.low', 'light'), pal('earth.snow')], ground: pal('earth.snow'), sun: 'sun', stars: 0, cloud: pal('earth.snow') },
  beach:   { name: 'Sunny beach', tags: 'summer sea', top: pal('sky.high'), low: pal('sky.low', 'light'), hills: [pal('sea.sunlit'), pal('sea.far'), pal('earth.path')], ground: pal('earth.path'), sun: 'sun', stars: 0, cloud: pal('earth.snow'), sea: true }
};

/* p: how far through the day, 0..1 (nudges the light warmer toward 1); t: seconds */
export function drawScene(c, W, H, id, { t = 0, p = 0 } = {}){
  const S = SCENES[id]; if (!S) return false;
  const top = mix(hexOf(S.top), [255, 190, 150], S.warm ? p * 0.35 : p * 0.12), low = mix(hexOf(S.low), [255, 226, 170], S.warm ? p * 0.4 : p * 0.1);
  const sky = c.createLinearGradient(0, 0, 0, H * 0.75); sky.addColorStop(0, hexA(top)); sky.addColorStop(1, hexA(low));
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  /* stars, steady little squares */
  c.fillStyle = S.star || pal('earth.snow');
  for (let i = 0; i < S.stars; i++){ c.globalAlpha = 0.45 + 0.4 * Math.sin(t * 1.4 + i); c.fillRect(((i * 173) % 1000) / 1000 * W, ((i * 61) % 380) / 1000 * H + H * 0.03, Math.max(2, H * 0.004), Math.max(2, H * 0.004)); }
  c.globalAlpha = 1;
  /* the sun or the moon, high on the right, out of the shared screen's way */
  if (S.sun){
    const x = W * 0.84, y = H * 0.24, r = H * 0.07;
    const glow = c.createRadialGradient(x, y, r * 0.5, x, y, r * 3.2); const gc = hexOf(S.sun === 'moon' ? S.moon : PALETTE.sky.sunGlow); glow.addColorStop(0, hexA(gc, S.sun === 'moon' ? 0.4 : 0.55)); glow.addColorStop(1, hexA(gc, 0));
    c.fillStyle = glow; c.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
    c.fillStyle = S.sun === 'moon' ? S.moon : pal('sky.sunGlow'); c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
  }
  /* clouds drift left to right, slowly */
  c.fillStyle = S.cloud;
  for (let i = 0; i < 4; i++){
    const x = (((i * 0.31 + t * 0.006 + 0.1) % 1.3) - 0.15) * W, y = H * (0.1 + (i % 3) * 0.07), k = H * (0.05 + (i % 2) * 0.02);
    c.beginPath();      /* (one shape, filled once, so a see-through cloud has no seams) */
    for (const [dx, dy, r] of [[-1.1, 0.2, 0.7], [-0.4, -0.15, 0.95], [0.4, -0.05, 0.85], [1.1, 0.2, 0.65]]){ c.moveTo(x + dx * k + r * k, y + dy * k); c.arc(x + dx * k, y + dy * k, r * k, 0, 7); }
    c.rect(x - 1.1 * k, y + 0.2 * k, 2.2 * k, 0.65 * k); c.fill();
  }
  /* hills, far to near */
  const bases = S.sea ? [0.52, 0.6, 0.78] : [0.62, 0.7, 0.8];
  S.hills.forEach((col, i) => {
    c.fillStyle = col; c.beginPath(); c.moveTo(0, H);
    const amp = S.sea && i < 2 ? 0.004 : 0.045 - i * 0.008;
    for (let n = 0; n <= 48; n++){ const x = n * W / 48; c.lineTo(x, H * (bases[i] - amp * (0.5 + 0.5 * Math.sin(x / W * (5 + i * 2) + i * 2 + 1)))); }
    c.lineTo(W, H); c.closePath(); c.fill();
  });
  /* the ground band at the bottom */
  c.fillStyle = S.ground; c.fillRect(0, H * 0.9, W, H * 0.1);
  c.fillStyle = S.edge ? hexA(hexOf(S.edge), 0.35) : hexA(hexOf(PALETTE.shade.shadow), 0.12); c.fillRect(0, H * 0.9, W, H * 0.006);
  return true;
}

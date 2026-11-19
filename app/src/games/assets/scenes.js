/* Scenes: whole painted backgrounds, drawn in code in the Orlis house style - a soft sky, a sun or moon, a few clouds, bands of
   hills and a ground - and nothing else, so a game's own pieces sit on top. Each one is drawn from nothing every frame
   (Orlis.assets.scene(c, W, H, 'meadow', { t })): t is seconds, so the clouds drift. They keep the top of the screen
   calm for the shared screen's words and the bottom edge plain for the move card. */
const mix = (a, b, k) => a.map((v, i) => v + (b[i] - v) * k);
const hexOf = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
const rgb = (a, al = 1) => `rgba(${a[0] | 0},${a[1] | 0},${a[2] | 0},${al})`;

/* top/low: the sky; hills: far to near; ground: the grass (or sand, or snow); sun: 'sun' | 'moon' | null; stars: how many; cloud: their colour */
export const SCENES = {
  meadow:  { name: 'Sunny meadow', tags: 'day outdoors', top: '#8fd0ff', low: '#e6f4ee', hills: ['#8ed98a', '#6fc77a', '#58b068'], ground: '#58b068', sun: 'sun', stars: 0, cloud: '#ffffff' },
  sunset:  { name: 'Evening sky', tags: 'evening outdoors', top: '#8aa8d6', low: '#f6ead2', hills: ['#c0cf9b', '#a9c98f', '#8fbf6a'], ground: '#8fbf6a', sun: 'sun', stars: 0, cloud: '#fff1e2', warm: true },
  autumn:  { name: 'Autumn afternoon', tags: 'autumn outdoors', top: '#9fb4d6', low: '#f6e2c4', hills: ['#c8c07c', '#b9b06a', '#a8a05c'], ground: '#a8a05c', sun: 'sun', stars: 0, cloud: '#fff5ea' },
  night:   { name: 'Starry night', tags: 'night outdoors', top: '#241c5c', low: '#6c4a96', hills: ['#4a3f94', '#3d3480', '#322a6e'], ground: '#322a6e', sun: 'moon', stars: 40, cloud: 'rgba(210,205,245,.35)' },
  snow:    { name: 'Snowy hills', tags: 'winter outdoors', top: '#9ec4f0', low: '#eef6ff', hills: ['#dbe8f7', '#e9f3ff', '#ffffff'], ground: '#ffffff', sun: 'sun', stars: 0, cloud: '#ffffff' },
  beach:   { name: 'Sunny beach', tags: 'summer sea', top: '#7cc8ff', low: '#e9f8ff', hills: ['#5fb7e8', '#4aa7dc', '#f3d9a0'], ground: '#f3d9a0', sun: 'sun', stars: 0, cloud: '#ffffff', sea: true }
};

/* p: how far through the day, 0..1 (nudges the light warmer toward 1); t: seconds */
export function drawScene(c, W, H, id, { t = 0, p = 0 } = {}){
  const S = SCENES[id]; if (!S) return false;
  const top = mix(hexOf(S.top), [255, 190, 150], S.warm ? p * 0.35 : p * 0.12), low = mix(hexOf(S.low), [255, 226, 170], S.warm ? p * 0.4 : p * 0.1);
  const sky = c.createLinearGradient(0, 0, 0, H * 0.75); sky.addColorStop(0, rgb(top)); sky.addColorStop(1, rgb(low));
  c.fillStyle = sky; c.fillRect(0, 0, W, H);
  /* stars, steady little squares */
  c.fillStyle = '#fff';
  for (let i = 0; i < S.stars; i++){ c.globalAlpha = 0.45 + 0.4 * Math.sin(t * 1.4 + i); c.fillRect(((i * 173) % 1000) / 1000 * W, ((i * 61) % 380) / 1000 * H + H * 0.03, Math.max(2, H * 0.004), Math.max(2, H * 0.004)); }
  c.globalAlpha = 1;
  /* the sun or the moon, high on the right, out of the shared screen's way */
  if (S.sun){
    const x = W * 0.84, y = H * 0.24, r = H * 0.07;
    const glow = c.createRadialGradient(x, y, r * 0.5, x, y, r * 3.2); glow.addColorStop(0, S.sun === 'moon' ? 'rgba(255,251,224,.4)' : 'rgba(255,236,170,.55)'); glow.addColorStop(1, 'rgba(255,236,170,0)');
    c.fillStyle = glow; c.fillRect(x - r * 3.2, y - r * 3.2, r * 6.4, r * 6.4);
    c.fillStyle = S.sun === 'moon' ? '#fffbe0' : '#ffe08a'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
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
  c.fillStyle = 'rgba(0,0,0,.07)'; c.fillRect(0, H * 0.9, W, H * 0.006);
  return true;
}

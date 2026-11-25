/* Sky Painter's covers: what hides the picture. Five of them, each in three layers that wear off one after another:

     clouds   puffy clouds that push apart, thin mist, sparkly stardust
     frost    thick frost with crystals, foggy breath, droplets that run down
     snow     fluffy top snow, packed snow, a thin icy glaze
     foam     big bubbles, suds, a squeaky-clean wipe
     sand     dry sand, damp sand, a last dusting (the picture is buried treasure)

   For each: the three textures (painted once per picture on offscreen canvases, 1920 x 1080 and up, by `bake`), how thick each layer is
   (in passes of a hand: one pass over a spot is 1), the bits that fly off while it's worn (`bits`), the words, and the scrub sound of
   each layer (from the sound kit's own sounds). Every colour is a palette name. Nothing in here knows about the game's rules. */
import { color, alpha, tone } from './assets/palette.js';

const TAU = 6.2832;
/* a small seeded dice (so a cover looks the same every time it's made for the same picture, in the tests too) */
export function dice(seed){
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const between = (r, a, b) => a + (b - a) * r();
const dot = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); };
const ring = (c, x, y, r) => { c.beginPath(); c.arc(x, y, r, 0, TAU); c.stroke(); };
const fillAll = (c, W, H, a, b, col0, col1) => { const g = c.createLinearGradient(0, 0, a, b); g.addColorStop(0, col0); g.addColorStop(1, col1); c.fillStyle = g; c.fillRect(0, 0, W, H); };
const grain = (c, W, H, r, n, cols, r0, r1, a = 1) => { c.globalAlpha = a; for (let i = 0; i < n; i++){ c.fillStyle = cols[i % cols.length]; dot(c, r() * W, r() * H, between(r, r0, r1)); } c.globalAlpha = 1; };
const soft = (c, x, y, rad, col, a) => { const g = c.createRadialGradient(x, y, 0, x, y, rad); g.addColorStop(0, alpha(col, a)); g.addColorStop(1, alpha(col, 0)); c.fillStyle = g; c.fillRect(x - rad, y - rad, rad * 2, rad * 2); };
/* a four-pointed sparkle */
function spark(c, x, y, r){
  c.beginPath(); c.moveTo(x, y - r);
  c.quadraticCurveTo(x + r * 0.12, y - r * 0.12, x + r, y); c.quadraticCurveTo(x + r * 0.12, y + r * 0.12, x, y + r);
  c.quadraticCurveTo(x - r * 0.12, y + r * 0.12, x - r, y); c.quadraticCurveTo(x - r * 0.12, y - r * 0.12, x, y - r); c.closePath(); c.fill();
}
/* a frost crystal's branch: a line with side branches (all in the path being built, stroked once) */
function frond(c, x, y, ang, len, depth, r){
  const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
  c.moveTo(x, y); c.lineTo(x2, y2);
  if (depth <= 0) return;
  for (const t of [0.32, 0.58, 0.82]){
    const bx = x + (x2 - x) * t, by = y + (y2 - y) * t;
    for (const s of [-1, 1]) frond(c, bx, by, ang + s * (0.85 + r() * 0.3), len * (0.52 - t * 0.3), depth - 1, r);
  }
}

/* ---------------------------------------------------------------- clouds */
function cloudPuff(c, x, y, w, r){
  const n = 6 + ((r() * 4) | 0), parts = [];
  for (let i = 0; i < n; i++){ const t = i / (n - 1), s = Math.sin(t * Math.PI); parts.push([x + (t - 0.5) * w, y - s * w * 0.12 * (0.5 + r()), w * (0.12 + 0.12 * s) * (0.8 + r() * 0.4)]); }
  c.fillStyle = alpha('shade.light', 0.7); for (const [px, py, pr] of parts) dot(c, px, py + pr * 0.38, pr);
  c.fillStyle = color('earth.snow'); for (const [px, py, pr] of parts) dot(c, px, py, pr * 0.96);
  c.fillStyle = alpha('sky.sunGlow', 0.3); for (const [px, py, pr] of parts) dot(c, px - pr * 0.25, py - pr * 0.3, pr * 0.55);
  c.fillStyle = color('earth.snow'); c.beginPath(); c.ellipse(x, y + w * 0.04, w * 0.52, w * 0.06, 0, 0, TAU); c.fill();
}
function clouds0(c, W, H, r){
  const u = H / 1080; fillAll(c, W, H, 0, H, color('sky.high'), color('sky.low'));
  const list = []; for (let i = 0; i < 70; i++) list.push([r() * W, r() * H * 1.05, between(r, 200, 380) * u]);
  list.sort((a, b) => a[1] - b[1]);                  /* (the ones further down are in front) */
  for (const [x, y, w] of list) cloudPuff(c, x, y, w, r);
}
function clouds1(c, W, H, r){
  const u = H / 1080; fillAll(c, W, H, 0, H, color('sky.mist'), color('sky.horizon'));
  for (let i = 0; i < 26; i++) soft(c, r() * W, r() * H, between(r, 160, 360) * u, i % 2 ? 'earth.snow' : 'sky.low', 0.55);
  c.fillStyle = color('earth.snow');
  for (let i = 0; i < 90; i++){ c.globalAlpha = between(r, 0.18, 0.4); c.beginPath(); c.ellipse(r() * W, r() * H, between(r, 140, 420) * u, between(r, 8, 22) * u, between(r, -0.1, 0.1), 0, TAU); c.fill(); }
  c.globalAlpha = 1;
}
function clouds2(c, W, H, r){
  const u = H / 1080; const g = c.createLinearGradient(0, 0, W * 0.3, H); g.addColorStop(0, color('dusk.high')); g.addColorStop(0.55, color('dusk.deep')); g.addColorStop(1, color('dusk.rose'));
  c.fillStyle = g; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 14; i++) soft(c, r() * W, r() * H, between(r, 200, 420) * u, i % 2 ? 'dusk.rose' : 'space.nebula', 0.35);
  grain(c, W, H, r, 900, [color('earth.snow'), color('sky.sunGlow'), color('sky.sun')], 1.2 * u, 3.2 * u, 0.85);
  c.fillStyle = color('sky.sun');
  for (let i = 0; i < 70; i++){ c.globalAlpha = between(r, 0.6, 1); spark(c, r() * W, r() * H, between(r, 7, 20) * u); }
  c.globalAlpha = 1;
}

/* ---------------------------------------------------------------- frost window */
function frost0(c, W, H, r){
  const u = H / 1080; fillAll(c, W, H, W * 0.4, H, tone(color('sea.sunlit'), 'light'), color('earth.snow'));
  soft(c, W * 0.5, H * 0.5, H * 0.9, 'sea.sunlit', 0.35);
  /* the crystals: ferns of ice, with a pale shadow under each */
  c.lineCap = 'round';
  for (let i = 0; i < 46; i++){
    const x = r() * W, y = r() * H, a = r() * TAU, len = between(r, 80, 170) * u;
    for (const [col, a2, w, dx] of [[color('sea.far'), 0.35, 4.5, 2.5], [color('earth.snow'), 0.95, 3, 0]]){
      c.strokeStyle = col; c.globalAlpha = a2; c.lineWidth = w * u; c.beginPath(); frond(c, x + dx * u, y + dx * u, a, len, 3, dice(i * 91 + 7 + (dx ? 1 : 0))); c.stroke();
    }
  }
  /* a few six-armed snowflakes among them */
  for (let i = 0; i < 16; i++){
    const x = r() * W, y = r() * H, len = between(r, 36, 70) * u, rr = dice(i + 500);
    c.strokeStyle = color('earth.snow'); c.globalAlpha = 1; c.lineWidth = 3 * u; c.beginPath();
    for (let k = 0; k < 6; k++) frond(c, x, y, k * TAU / 6, len, 1, rr);
    c.stroke();
  }
  c.globalAlpha = 1; grain(c, W, H, r, 2600, [color('earth.snow'), color('sea.sunlit', 'light'), color('sea.far')], 0.8 * u, 2.2 * u, 0.6);
}
function frost1(c, W, H, r){
  const u = H / 1080; fillAll(c, W, H, 0, H, color('space.dust'), color('sky.mist'));
  for (let i = 0; i < 40; i++) soft(c, r() * W, r() * H, between(r, 180, 420) * u, i % 3 ? 'earth.snow' : 'shade.light', 0.4);
  /* a few wiped streaks and a smiley a finger drew */
  c.lineCap = 'round'; c.strokeStyle = alpha('earth.snow', 0.5); c.lineWidth = 34 * u;
  for (let i = 0; i < 6; i++){ const x = r() * W, y = r() * H; c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + between(r, -80, 80) * u, y + 110 * u, x + between(r, -50, 50) * u, y + 240 * u); c.stroke(); }
  c.fillStyle = alpha('sea.sunlit', 0.35); for (let i = 0; i < 700; i++){ dot(c, r() * W, r() * H, between(r, 1.5, 4.5) * u); }
  c.fillStyle = alpha('earth.snow', 0.5); for (let i = 0; i < 500; i++) dot(c, r() * W, r() * H, between(r, 1, 3) * u);
}
function frost2(c, W, H, r){
  const u = H / 1080; fillAll(c, W, H, W * 0.2, H, color('sky.low'), tone(color('sea.sunlit'), 'light'));
  soft(c, W * 0.3, H * 0.2, H * 0.7, 'earth.snow', 0.5);
  /* trails: a drop that ran, leaving a clear wet line */
  c.lineCap = 'round';
  for (let i = 0; i < 70; i++){
    const x = r() * W, y = r() * H * 0.9, len = between(r, 70, 260) * u;
    c.strokeStyle = alpha('earth.snow', 0.5); c.lineWidth = between(r, 3, 6) * u; c.beginPath(); c.moveTo(x, y); c.lineTo(x + between(r, -8, 8) * u, y + len); c.stroke();
    c.fillStyle = alpha('sea.far', 0.45); c.beginPath(); c.ellipse(x, y + len, 7 * u, 10 * u, 0, 0, TAU); c.fill();
    c.fillStyle = alpha('earth.snow', 0.9); dot(c, x - 2 * u, y + len - 3 * u, 2.5 * u);
  }
  for (let i = 0; i < 260; i++){
    const x = r() * W, y = r() * H, rx = between(r, 5, 15) * u;
    c.fillStyle = alpha('sea.sunlit', 0.55); c.beginPath(); c.ellipse(x, y, rx, rx * 1.25, 0, 0, TAU); c.fill();
    c.strokeStyle = alpha('sea.shade', 0.4); c.lineWidth = 1.6 * u; c.beginPath(); c.ellipse(x, y, rx, rx * 1.25, 0, 0.3, 2.8); c.stroke();
    c.fillStyle = color('earth.snow'); dot(c, x - rx * 0.3, y - rx * 0.4, rx * 0.28);
  }
}

/* ---------------------------------------------------------------- deep snow */
function snow0(c, W, H, r){
  const u = H / 1080; c.fillStyle = color('earth.snow'); c.fillRect(0, 0, W, H);
  const lumps = []; for (let i = 0; i < 90; i++) lumps.push([r() * W, r() * H * 1.05, between(r, 70, 170) * u]);
  lumps.sort((a, b) => a[1] - b[1]);
  for (const [x, y, rad] of lumps){
    const g = c.createRadialGradient(x - rad * 0.3, y - rad * 0.35, rad * 0.1, x, y, rad);
    g.addColorStop(0, color('earth.snow')); g.addColorStop(0.7, color('earth.snow')); g.addColorStop(1, alpha('shade.light', 0.85));
    c.fillStyle = g; dot(c, x, y, rad);
  }
  grain(c, W, H, r, 1400, [color('shade.light'), color('sea.sunlit', 'light')], 1.5 * u, 4 * u, 0.4);
  c.fillStyle = color('earth.snow'); for (let i = 0; i < 60; i++){ c.globalAlpha = 0.9; spark(c, r() * W, r() * H, between(r, 5, 11) * u); } c.globalAlpha = 1;
}
function snow1(c, W, H, r){
  const u = H / 1080; fillAll(c, W, H, W * 0.5, H, tone(color('sea.sunlit'), 'light'), tone(color('shade.light'), 'light'));
  c.lineCap = 'round';
  for (let i = 0; i < 420; i++){
    const x = r() * W, y = r() * H, len = between(r, 40, 160) * u;
    c.strokeStyle = r() < 0.5 ? alpha('shade.light', 0.45) : alpha('earth.snow', 0.6); c.lineWidth = between(r, 2, 5) * u;
    c.beginPath(); c.moveTo(x, y); c.lineTo(x + len, y + between(r, -6, 6) * u); c.stroke();
  }
  /* dimples and little cracks where it was pressed */
  for (let i = 0; i < 160; i++){ const x = r() * W, y = r() * H, rr = between(r, 8, 24) * u; c.fillStyle = alpha('shade.light', 0.45); c.beginPath(); c.ellipse(x, y, rr, rr * 0.5, 0, 0, TAU); c.fill(); c.fillStyle = alpha('earth.snow', 0.7); c.beginPath(); c.ellipse(x - rr * 0.1, y + rr * 0.18, rr * 0.8, rr * 0.3, 0, 0, TAU); c.fill(); }
  c.strokeStyle = alpha('sea.far', 0.35); c.lineWidth = 2 * u;
  for (let i = 0; i < 40; i++){ let x = r() * W, y = r() * H; c.beginPath(); c.moveTo(x, y); for (let k = 0; k < 6; k++){ x += between(r, -30, 40) * u; y += between(r, -22, 22) * u; c.lineTo(x, y); } c.stroke(); }
  grain(c, W, H, r, 900, [color('earth.snow'), color('shade.light')], 1 * u, 2.8 * u, 0.6);
}
function snow2(c, W, H, r){
  const u = H / 1080; fillAll(c, W, H, W, H, tone(color('sea.sunlit'), 'light'), color('sea.sunlit'));
  /* glossy diagonal bands */
  c.save(); c.rotate(-0.5);
  for (let i = -6; i < 16; i++){ c.fillStyle = alpha('earth.snow', i % 2 ? 0.28 : 0.12); c.fillRect(i * 210 * u - 400 * u, -H, between(r, 40, 120) * u, H * 3); }
  c.restore();
  /* cracks in the ice */
  for (let i = 0; i < 26; i++){
    const x = r() * W, y = r() * H, a = r() * TAU, rr = dice(i + 90);
    for (const [col, w, d] of [[alpha('sea.deep', 0.25), 3.5, 2], [color('earth.snow'), 1.8, 0]]){
      c.strokeStyle = col; c.lineWidth = w * u; c.lineCap = 'round'; c.beginPath(); frond(c, x + d * u, y + d * u, a, between(r, 60, 130) * u, 2, rr); c.stroke();
    }
  }
  c.strokeStyle = alpha('earth.snow', 0.8); c.lineWidth = 2 * u;
  for (let i = 0; i < 120; i++){ const x = r() * W, y = r() * H, rr = between(r, 3, 9) * u; ring(c, x, y, rr); }
  c.fillStyle = color('earth.snow'); for (let i = 0; i < 90; i++) spark(c, r() * W, r() * H, between(r, 6, 16) * u);
}

/* ---------------------------------------------------------------- car-wash foam */
function bubble(c, x, y, rad, tint){
  c.fillStyle = alpha('earth.snow', 0.5); dot(c, x, y, rad);
  c.lineWidth = Math.max(1.5, rad * 0.05); c.strokeStyle = alpha(tint, 0.75); ring(c, x, y, rad * 0.97);
  c.strokeStyle = alpha('touch.bubblegum', 0.4); c.beginPath(); c.arc(x, y, rad * 0.84, 3.5, 4.9); c.stroke();
  c.strokeStyle = alpha('sea.sunlit', 0.7); c.beginPath(); c.arc(x, y, rad * 0.84, 0.3, 1.5); c.stroke();
  c.fillStyle = alpha('earth.snow', 0.95); c.beginPath(); c.ellipse(x - rad * 0.38, y - rad * 0.42, rad * 0.22, rad * 0.11, -0.7, 0, TAU); c.fill();
  dot(c, x + rad * 0.42, y + rad * 0.38, rad * 0.06);
}
function foam0(c, W, H, r){
  const u = H / 1080; fillAll(c, W, H, 0, H, tone(color('sea.sunlit'), 'light'), color('earth.snow'));
  const list = []; for (let i = 0; i < 80; i++) list.push([r() * W, r() * H, between(r, 38, 96) * u]);
  list.sort((a, b) => b[2] - a[2]);
  for (const [x, y, rad] of list) bubble(c, x, y, rad, ['touch.lagoon', 'touch.skyBlue', 'touch.grape'][(r() * 3) | 0]);
  for (let i = 0; i < 70; i++) bubble(c, r() * W, r() * H, between(r, 14, 30) * u, 'touch.lagoon');
}
function foam1(c, W, H, r){
  const u = H / 1080; fillAll(c, W, H, W, H, tone(color('sea.sunlit'), 'light'), color('earth.snow'));
  for (let i = 0; i < 1300; i++){
    const x = r() * W, y = r() * H, rad = between(r, 9, 24) * u;
    c.fillStyle = alpha('earth.snow', 0.92); dot(c, x, y, rad);
    c.strokeStyle = alpha('shade.light', 0.55); c.lineWidth = 1.6 * u; ring(c, x, y, rad);
    c.fillStyle = alpha('sea.sunlit', 0.45); c.beginPath(); c.arc(x + rad * 0.2, y + rad * 0.25, rad * 0.7, 0.2, 2.6); c.fill();
    c.fillStyle = color('earth.snow'); dot(c, x - rad * 0.35, y - rad * 0.35, rad * 0.2);
  }
}
function foam2(c, W, H, r){
  const u = H / 1080; fillAll(c, W, H, W * 0.6, H, color('sky.low'), tone(color('sea.sunlit'), 'light'));
  soft(c, W * 0.7, H * 0.25, H * 0.8, 'earth.snow', 0.55);
  /* the long wipes of a squeegee, and the shine they leave */
  c.lineCap = 'round';
  for (let i = 0; i < 9; i++){
    const y = (i + 0.5) / 9 * H + between(r, -20, 20) * u;
    c.strokeStyle = alpha('earth.snow', 0.38); c.lineWidth = between(r, 60, 110) * u; c.beginPath(); c.moveTo(-40, y + 40 * u); c.quadraticCurveTo(W * 0.5, y - 110 * u, W + 40, y + 20 * u); c.stroke();
    c.strokeStyle = alpha('sea.sunlit', 0.4); c.lineWidth = 8 * u; c.beginPath(); c.moveTo(-40, y + 90 * u); c.quadraticCurveTo(W * 0.5, y - 60 * u, W + 40, y + 70 * u); c.stroke();
  }
  for (let i = 0; i < 40; i++) bubble(c, r() * W, r() * H, between(r, 8, 20) * u, 'touch.lagoon');
  c.fillStyle = color('earth.snow'); for (let i = 0; i < 70; i++) spark(c, r() * W, r() * H, between(r, 6, 17) * u);
}

/* ---------------------------------------------------------------- beach sand */
function sand0(c, W, H, r){
  const u = H / 1080; fillAll(c, W, H, 0, H, color('earth.path'), color('earth.sand'));
  c.lineWidth = 7 * u; c.lineCap = 'round';
  for (let i = 0; i < 34; i++){            /* wind ripples */
    const y = r() * H, a = between(r, 8, 22) * u, ph = r() * 6;
    c.strokeStyle = alpha('earth.sand', 0.55); c.beginPath(); for (let x = 0; x <= W; x += 40) c.lineTo(x, y + Math.sin(x / (160 * u) + ph) * a); c.stroke();
    c.strokeStyle = alpha('earth.snow', 0.28); c.beginPath(); for (let x = 0; x <= W; x += 40) c.lineTo(x, y + 9 * u + Math.sin(x / (160 * u) + ph) * a); c.stroke();
  }
  grain(c, W, H, r, 12000, [tone(color('earth.sand'), 'shade'), color('earth.snow'), color('earth.peach'), color('earth.clay')], 0.7 * u, 2 * u, 0.5);
}
function sand1(c, W, H, r){
  const u = H / 1080; fillAll(c, W, H, 0, H, tone(color('earth.sand'), 'shade'), tone(color('earth.clay'), 'light'));
  for (let i = 0; i < 24; i++) soft(c, r() * W, r() * H, between(r, 120, 300) * u, 'earth.path', 0.3);   /* wet sheen */
  grain(c, W, H, r, 11000, [tone(color('earth.sand'), 'shade'), color('earth.bark'), color('earth.clay')], 0.8 * u, 2.2 * u, 0.45);
  /* pebbles and shells */
  for (let i = 0; i < 26; i++){
    const x = r() * W, y = r() * H, rad = between(r, 9, 22) * u;
    c.fillStyle = alpha('shade.shadow', 0.22); c.beginPath(); c.ellipse(x + 3 * u, y + 5 * u, rad, rad * 0.7, 0, 0, TAU); c.fill();
    c.fillStyle = [color('shade.light'), color('earth.path'), color('earth.bark', 'light')][i % 3]; c.beginPath(); c.ellipse(x, y, rad, rad * 0.72, 0.4, 0, TAU); c.fill();
    c.fillStyle = alpha('earth.snow', 0.5); c.beginPath(); c.ellipse(x - rad * 0.3, y - rad * 0.3, rad * 0.3, rad * 0.16, 0.4, 0, TAU); c.fill();
  }
  for (let i = 0; i < 14; i++){
    const x = r() * W, y = r() * H, rad = between(r, 16, 30) * u;
    c.fillStyle = color('earth.peach'); c.beginPath(); c.moveTo(x, y + rad); c.arc(x, y, rad, 0.2, Math.PI - 0.2, true); c.closePath(); c.fill();
    c.strokeStyle = alpha('earth.clay', 0.8); c.lineWidth = 2 * u; for (let k = -2; k <= 2; k++){ c.beginPath(); c.moveTo(x, y + rad * 0.9); c.lineTo(x + k * rad * 0.4, y - rad * 0.6); c.stroke(); }
  }
}
function sand2(c, W, H, r){
  const u = H / 1080; fillAll(c, W, H, W, H, color('earth.path'), tone(color('earth.peach'), 'light'));
  soft(c, W * 0.5, H * 0.5, H * 0.9, 'sky.sunGlow', 0.45);
  c.lineWidth = 5 * u; c.lineCap = 'round';
  for (let i = 0; i < 40; i++){            /* swirls of blown dust */
    const x = r() * W, y = r() * H, rad = between(r, 40, 140) * u;
    c.strokeStyle = alpha('earth.snow', 0.35); c.beginPath(); c.arc(x, y, rad, r() * 6, r() * 6 + 2.4); c.stroke();
  }
  grain(c, W, H, r, 7000, [color('earth.sand'), color('earth.snow'), color('earth.peach')], 0.7 * u, 1.9 * u, 0.55);
  c.fillStyle = alpha('ui.gold', 0.8); for (let i = 0; i < 26; i++) spark(c, r() * W, r() * H, between(r, 5, 11) * u);   /* a gleam of what's under it */
}

/* ---------------------------------------------------------------- the covers */
/* bits: what flies off a worn layer. kind: puff, soft, star, shard, drip, bubble, grain, chunk. col: palette names. size: in screen heights.
   g: gravity (screen heights a second, squared; negative floats up). life: seconds. scrub: [kit sound, least, most seconds between]. */
export const COVERS = [
  { id: 'clouds', hint: 'Push the clouds away!', icon: 'cloudy', thick: [0.7, 0.6, 0.5], bake: [clouds0, clouds1, clouds2],
    bits: [{ kind: 'puff', col: ['earth.snow', 'shade.light'], size: [0.025, 0.05], g: -0.02, life: 0.9, push: 0.5 },
           { kind: 'soft', col: ['sky.mist', 'earth.snow'], size: [0.04, 0.08], g: -0.03, life: 1.0, push: 0.2 },
           { kind: 'star', col: ['sky.sun', 'sky.sunGlow', 'earth.snow'], size: [0.012, 0.026], g: -0.05, life: 1.1, push: 0.1 }] },
  { id: 'frost', hint: 'Wipe away the frost!', icon: 'snowflake', thick: [0.8, 0.55, 0.45], bake: [frost0, frost1, frost2],
    bits: [{ kind: 'shard', col: ['earth.snow', 'sea.sunlit'], size: [0.008, 0.018], g: 0.35, life: 0.7, push: 0.4 },
           { kind: 'soft', col: ['space.dust', 'earth.snow'], size: [0.03, 0.06], g: -0.02, life: 0.9, push: 0.15 },
           { kind: 'drip', col: ['sea.sunlit', 'sea.far'], size: [0.008, 0.016], g: 0.55, life: 0.9, push: 0.05 }] },
  { id: 'snow', hint: 'Brush off the snow!', icon: 'snowball', thick: [0.6, 0.7, 0.5], bake: [snow0, snow1, snow2],
    bits: [{ kind: 'puff', col: ['earth.snow', 'shade.light'], size: [0.02, 0.04], g: 0.1, life: 0.9, push: 0.45 },
           { kind: 'chunk', col: ['earth.snow', 'shade.light', 'sea.sunlit'], size: [0.012, 0.024], g: 0.5, life: 0.7, push: 0.35 },
           { kind: 'star', col: ['earth.snow', 'sea.sunlit'], size: [0.01, 0.022], g: 0.05, life: 0.9, push: 0.15 }] },
  { id: 'foam', hint: 'Scrub off the bubbles!', icon: 'bubbles', thick: [0.6, 0.7, 0.5], bake: [foam0, foam1, foam2],
    bits: [{ kind: 'bubble', col: ['touch.lagoon', 'touch.bubblegum', 'touch.skyBlue'], size: [0.025, 0.055], g: -0.06, life: 1.0, push: 0.15 },
           { kind: 'bubble', col: ['sea.sunlit', 'earth.snow'], size: [0.01, 0.022], g: -0.04, life: 0.8, push: 0.2 },
           { kind: 'star', col: ['earth.snow', 'sea.sunlit', 'touch.lagoon'], size: [0.012, 0.026], g: 0, life: 0.8, push: 0.1 }] },
  { id: 'sand', hint: 'Sweep away the sand!', icon: 'shell', thick: [0.7, 0.6, 0.5], bake: [sand0, sand1, sand2],
    bits: [{ kind: 'grain', col: ['earth.path', 'earth.sand', 'earth.peach'], size: [0.004, 0.008], g: 0.7, life: 0.8, push: 0.7 },
           { kind: 'chunk', col: ['earth.sand', 'earth.clay', 'earth.bark'], size: [0.008, 0.016], g: 0.8, life: 0.7, push: 0.5 },
           { kind: 'star', col: ['ui.gold', 'sky.sunGlow', 'earth.snow'], size: [0.01, 0.022], g: 0.15, life: 0.9, push: 0.2 }] }
];
export const COVER_IDS = COVERS.map(c => c.id);

/* the scrub sounds, from the kit's own: [what to call, shortest and longest seconds between] for each layer of each cover */
const SCRUB = {
  clouds: [[(s, r) => s.rustle?.(), 0.16, 0.3], [(s, r) => s.spray?.(), 0.14, 0.26], [(s, r) => s.twinkle?.(), 0.2, 0.4]],
  frost: [[(s, r) => s.crunch?.(), 0.3, 0.5], [(s, r) => s.breath?.(0.3, 1), 0.5, 0.8], [(s, r) => s.jar?.((r() * 6) | 0), 0.2, 0.4]],
  snow: [[(s, r) => s.step?.((r() * 3) | 0, 0.5), 0.18, 0.32], [(s, r) => s.crunch?.(), 0.3, 0.5], [(s, r) => s.blockTick?.(r()), 0.15, 0.3]],
  foam: [[(s, r) => s.pop?.(0.3 + r() * 0.6, 0), 0.12, 0.28], [(s, r) => s.spray?.(), 0.14, 0.26], [(s, r) => s.squeak?.(), 0.7, 1.1]],
  sand: [[(s, r) => s.rustle?.(), 0.16, 0.3], [(s, r) => s.step?.((r() * 3) | 0, 0.4), 0.2, 0.36], [(s, r) => s.spray?.(), 0.16, 0.3]]
};
/* make a scrub sound for this cover's layer; returns the seconds to wait before the next */
export function scrubSound(sfx, cover, layer, r = Math.random){
  const [make, lo, hi] = SCRUB[cover.id][Math.min(2, layer)];
  try { make(sfx, r); } catch {}
  return lo + (hi - lo) * r();
}
/* the little fanfare when a picture is uncovered */
export function fanfare(sfx, cover){
  try { sfx.fanfare?.(); sfx.hooray?.(); if (cover.id === 'sand') sfx.gold?.(); if (cover.id === 'clouds' || cover.id === 'frost') sfx.twinkle?.(); } catch {}
}

/* make one bit of a layer, at (x, y) in screen widths and heights; (dx, dy): which way the hand is going */
export function makeBit(cover, layer, x, y, dx, dy, r, calm = false){
  const b = cover.bits[Math.min(2, layer)], sz = between(r, b.size[0], b.size[1]), a = r() * TAU, v = 0.05 + r() * 0.12;
  return { kind: b.kind, x, y, vx: dx * b.push * 0.5 + Math.cos(a) * v * (calm ? 0.4 : 1), vy: dy * b.push * 0.5 + Math.sin(a) * v * (calm ? 0.4 : 1) - 0.02,
    g: b.g, age: 0, life: b.life * between(r, 0.7, 1.2) * (calm ? 0.8 : 1), r: sz, col: color(b.col[(r() * b.col.length) | 0]), rot: r() * TAU, spin: (r() - 0.5) * 6, tw: r() * 6 };
}
/* a burst when a picture's uncovered: gold and white sparkles from everywhere */
export function burst(cover, n, r){
  const out = [];
  for (let i = 0; i < n; i++){
    const gold = cover.id === 'sand' || r() < 0.4;
    out.push({ kind: 'star', x: r(), y: 0.1 + r() * 0.8, vx: (r() - 0.5) * 0.1, vy: -0.03 - r() * 0.08, g: 0.04, age: 0, life: 1.4 + r() * 0.8, r: between(r, 0.014, 0.034),
      col: color(gold ? 'ui.gold' : ['earth.snow', 'sky.sunGlow', 'touch.bubblegum', 'touch.lagoon'][(r() * 4) | 0]), rot: 0, spin: 0, tw: r() * 6 });
  }
  return out;
}
export function stepBit(b, dt){ b.age += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += b.g * dt; b.vx *= 1 - Math.min(1, dt * 1.5); b.rot += b.spin * dt; }
/* draw one bit (x, y are fractions of the screen; sizes of the screen's height) */
export function drawBit(c, b, W, H){
  const k = b.age / b.life, fade = k < 0.15 ? k / 0.15 : Math.max(0, 1 - (k - 0.15) / 0.85), x = b.x * W, y = b.y * H, rad = b.r * H;
  if (fade <= 0) return;
  c.globalAlpha = fade; c.fillStyle = b.col; c.strokeStyle = b.col;
  switch (b.kind){
    case 'puff': for (const [dx, dy, s] of [[0, 0, 1], [0.7, 0.2, 0.7], [-0.7, 0.25, 0.75], [0.1, -0.5, 0.7]]) dot(c, x + dx * rad, y + dy * rad, rad * s * (0.7 + k * 0.6)); break;
    case 'soft': { const g = c.createRadialGradient(x, y, 0, x, y, rad * (1 + k)); g.addColorStop(0, b.col); g.addColorStop(1, alpha('earth.snow', 0)); c.fillStyle = g; c.globalAlpha = fade * 0.7; dot(c, x, y, rad * (1 + k)); break; }
    case 'star': { const s = rad * (0.6 + 0.4 * Math.abs(Math.sin(b.tw + b.age * 9))); spark(c, x, y, s); break; }
    case 'shard': c.save(); c.translate(x, y); c.rotate(b.rot); c.beginPath(); c.moveTo(0, -rad); c.lineTo(rad * 0.45, 0); c.lineTo(0, rad); c.lineTo(-rad * 0.45, 0); c.closePath(); c.fill(); c.restore(); break;
    case 'drip': c.beginPath(); c.ellipse(x, y, rad * 0.7, rad * 1.1, 0, 0, TAU); c.fill(); c.fillStyle = color('earth.snow'); dot(c, x - rad * 0.2, y - rad * 0.3, rad * 0.22); break;
    case 'bubble':
      if (k > 0.85){ c.lineWidth = Math.max(1.5, rad * 0.08); ring(c, x, y, rad * (1 + (k - 0.85) * 8)); }       /* it pops: a ring that grows */
      else { c.globalAlpha = fade * 0.35; dot(c, x, y, rad); c.globalAlpha = fade; c.lineWidth = Math.max(1.5, rad * 0.1); ring(c, x, y, rad); c.fillStyle = color('earth.snow'); dot(c, x - rad * 0.35, y - rad * 0.35, rad * 0.2); }
      break;
    case 'grain': dot(c, x, y, Math.max(1.5, rad)); break;
    case 'chunk': c.save(); c.translate(x, y); c.rotate(b.rot); c.beginPath(); c.roundRect ? c.roundRect(-rad, -rad * 0.7, rad * 2, rad * 1.4, rad * 0.4) : c.rect(-rad, -rad * 0.7, rad * 2, rad * 1.4); c.fill(); c.restore(); break;
  }
  c.globalAlpha = 1;
}

/* Props, drawn in code in the Orlis house style: flat colour, one shadow tone, a dark indigo outline where a thing needs one.
   Each is a function (c, s, o): c is already moved to the middle of the asset, s is its height in pixels, o its options
   (o.color for the ones that take a colour; o.t for the ones that move). Widths follow from `aspect` in the table. */
const INK = '#2b2275';
const shade = 'rgba(52,40,96,.2)';
const rr = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
const outline = (c, s, w = 0.045) => { c.lineWidth = s * w; c.strokeStyle = INK; c.lineJoin = 'round'; c.stroke(); };

export const BALLOON_COLORS = ['#ff5d6c', '#ffb84d', '#ffe36e', '#4cc9a0', '#4da3ff', '#a98bff', '#ff7eb3'];
const WEDGES = ['#ff5d6c', '#ffb84d', '#ffe36e', '#4cc9a0', '#4da3ff', '#a98bff'];

export const PROPS = {
  /* [id]: [name, tags, aspect, draw] */
  chest: ['Treasure chest', 'thing treasure', 1.3, (c, s) => {
    const w = s * 1.3, h = s;
    c.fillStyle = '#b9772f'; rr(c, -w * 0.45, -h * 0.05, w * 0.9, h * 0.5, s * 0.08); c.fill(); outline(c, s);
    c.fillStyle = '#d28a3a'; c.beginPath(); c.moveTo(-w * 0.45, -h * 0.05); c.quadraticCurveTo(0, -h * 0.62, w * 0.45, -h * 0.05); c.closePath(); c.fill(); outline(c, s);
    c.fillStyle = '#ffd24a'; c.fillRect(-w * 0.05, -h * 0.05, w * 0.1, h * 0.5); c.beginPath(); c.arc(0, h * 0.1, s * 0.07, 0, 7); c.fill();
  }],
  basket: ['Basket', 'thing garden', 1.25, (c, s) => {
    const w = s * 1.25;
    c.fillStyle = '#c08a4a'; c.beginPath(); c.moveTo(-w * 0.45, -s * 0.12); c.lineTo(-w * 0.34, s * 0.42); c.quadraticCurveTo(0, s * 0.55, w * 0.34, s * 0.42); c.lineTo(w * 0.45, -s * 0.12); c.closePath(); c.fill(); outline(c, s, 0.05);
    c.strokeStyle = 'rgba(122,82,38,.4)'; c.lineWidth = s * 0.03; for (let i = -3; i <= 3; i++){ c.beginPath(); c.moveTo(i * w * 0.12, -s * 0.1); c.lineTo(i * w * 0.1, s * 0.46); c.stroke(); }
    c.fillStyle = '#c08a4a'; rr(c, -w * 0.5, -s * 0.2, w, s * 0.16, s * 0.08); c.fill(); outline(c, s, 0.05);
  }],
  beachball: ['Beach ball', 'thing ball', 1, (c, s, o) => {
    const r = s / 2, rot = (o.t || 0) * 0.4;
    c.save(); c.rotate(rot);
    WEDGES.forEach((col, i) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, 0); c.arc(0, 0, r, i * Math.PI * 2 / 6, (i + 1) * Math.PI * 2 / 6); c.closePath(); c.fill(); });
    c.restore();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.16, -0.6, 0, 7); c.fill();
    c.beginPath(); c.arc(0, 0, r, 0, 7); outline(c, s, 0.04);
  }],
  balloon: ['Balloon', 'thing party', 0.8, (c, s, o) => {
    const col = o.color || BALLOON_COLORS[0], w = s * 0.8, h = s * 0.82;
    c.strokeStyle = 'rgba(60,60,90,.5)'; c.lineWidth = s * 0.02; c.beginPath(); c.moveTo(0, h * 0.5); c.quadraticCurveTo(-s * 0.08, s * 0.7, 0, s * 0.95); c.stroke();
    c.fillStyle = col; c.beginPath(); c.ellipse(0, -s * 0.08, w / 2, h / 2, 0, 0, 7); c.fill();
    c.beginPath(); c.moveTo(-s * 0.05, h * 0.42); c.lineTo(s * 0.05, h * 0.42); c.lineTo(0, h * 0.5); c.closePath(); c.fill();
    c.fillStyle = shade; c.beginPath(); c.ellipse(w * 0.1, -s * 0.02, w * 0.34, h * 0.4, 0, -1.2, 1.9); c.fill();
    c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.ellipse(-w * 0.2, -s * 0.22, w * 0.1, h * 0.14, -0.5, 0, 7); c.fill();
    c.beginPath(); c.ellipse(0, -s * 0.08, w / 2, h / 2, 0, 0, 7); outline(c, s, 0.03);
  }],
  heart: ['Heart', 'thing love', 1.1, (c, s, o) => {
    const k = s / 2, shape = () => { c.beginPath(); c.moveTo(0, k * 0.8); c.bezierCurveTo(-k * 1.6, -k * 0.2, -k * 0.7, -k * 1.2, 0, -k * 0.45); c.bezierCurveTo(k * 0.7, -k * 1.2, k * 1.6, -k * 0.2, 0, k * 0.8); c.closePath(); };
    shape(); c.fillStyle = o.color || '#ff5d8a'; c.fill(); c.save(); c.clip(); c.fillStyle = shade; c.beginPath(); c.arc(k * 0.8, k * 0.5, k * 1.1, 0, 7); c.fill(); c.restore(); shape(); outline(c, s, 0.04);
  }],
  star: ['Star', 'thing night', 1, (c, s, o) => {
    const r = s / 2, shape = () => { c.beginPath(); for (let k = 0; k < 10; k++){ const a = -Math.PI / 2 + k * Math.PI / 5, q = k % 2 ? r * 0.45 : r; c.lineTo(Math.cos(a) * q, Math.sin(a) * q); } c.closePath(); };
    shape(); c.fillStyle = o.color || '#ffe680'; c.fill(); c.save(); shape(); c.clip(); c.fillStyle = shade; c.beginPath(); c.arc(r * 0.7, r * 0.4, r, 0, 7); c.fill(); c.restore();
    shape(); outline(c, s, 0.04);
  }],
  block: ['Toy block', 'thing toy', 1, (c, s, o) => {
    const w = s, col = o.color || '#4da3ff';
    c.fillStyle = col; rr(c, -w / 2, -w / 2, w, w, s * 0.12); c.fill(); c.save(); rr(c, -w / 2, -w / 2, w, w, s * 0.12); c.clip(); c.fillStyle = shade; c.fillRect(w * 0.1, -w / 2, w, w); c.restore();
    c.fillStyle = 'rgba(255,255,255,.35)'; rr(c, -w * 0.38, -w * 0.38, w * 0.3, w * 0.12, w * 0.05); c.fill(); rr(c, -w / 2, -w / 2, w, w, s * 0.12); outline(c, s, 0.05);
  }],
  tree: ['Tree', 'nature tree', 0.95, (c, s) => {
    c.fillStyle = '#8a5a33'; c.beginPath(); c.moveTo(-s * 0.07, s * 0.5); c.quadraticCurveTo(-s * 0.04, s * 0.15, -s * 0.05, -s * 0.05); c.lineTo(s * 0.05, -s * 0.05); c.quadraticCurveTo(s * 0.04, s * 0.15, s * 0.08, s * 0.5); c.closePath(); c.fill(); outline(c, s, 0.03);
    for (const [dx, dy, r, col] of [[-0.2, -0.15, 0.26, '#3f9b4f'], [0.2, -0.15, 0.25, '#46a857'], [0, -0.3, 0.27, '#4fb560'], [0, -0.1, 0.28, '#46a857']]){ c.fillStyle = col; c.beginPath(); c.arc(dx * s, dy * s, r * s, 0, 7); c.fill(); }
  }],
  pine: ['Pine tree', 'nature tree snow', 0.7, (c, s) => {
    c.fillStyle = '#7a5230'; c.fillRect(-s * 0.04, s * 0.32, s * 0.08, s * 0.18);
    [[0.34, 0.58, '#2f8f5b'], [0.12, 0.48, '#37a068'], [-0.1, 0.36, '#3fb074']].forEach(([y, w, col]) => { c.fillStyle = col; c.beginPath(); c.moveTo(0, y * s - s * 0.3); c.lineTo(w * s / 1.4, y * s + s * 0.16); c.lineTo(-w * s / 1.4, y * s + s * 0.16); c.closePath(); c.fill(); });
    c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(0, -s * 0.44); c.lineTo(s * 0.12, -s * 0.28); c.lineTo(-s * 0.12, -s * 0.28); c.closePath(); c.fill();
  }],
  bush: ['Bush', 'nature garden', 1.4, (c, s) => {
    for (const [dx, dy, r, col] of [[-0.3, 0.1, 0.28, '#3f9b4f'], [0.3, 0.1, 0.28, '#3f9b4f'], [0, -0.02, 0.34, '#4fb560']]){ c.fillStyle = col; c.beginPath(); c.arc(dx * s, dy * s, r * s, 0, 7); c.fill(); }
  }],
  cloud: ['Cloud', 'sky', 2, (c, s, o) => {
    const k = s; c.fillStyle = o.color || 'rgba(255,255,255,.92)';
    c.beginPath();
    for (const [dx, dy, r] of [[-0.55, 0.1, 0.3], [-0.2, -0.1, 0.4], [0.25, -0.02, 0.36], [0.6, 0.12, 0.28]]){ c.moveTo(dx * k + r * k, dy * k); c.arc(dx * k, dy * k, r * k, 0, 7); }
    c.rect(-0.55 * k, 0.1 * k, 1.15 * k, 0.3 * k); c.fill();
  }],
  sun: ['Sun', 'sky', 1, (c, s, o) => {
    const t = o.t || 0, r = s * 0.28;
    c.strokeStyle = 'rgba(255,214,102,.8)'; c.lineWidth = s * 0.06; c.lineCap = 'round';
    for (let i = 0; i < 10; i++){ const a = i * Math.PI / 5 + t * 0.2; c.beginPath(); c.moveTo(Math.cos(a) * r * 1.35, Math.sin(a) * r * 1.35); c.lineTo(Math.cos(a) * r * 1.8, Math.sin(a) * r * 1.8); c.stroke(); }
    c.fillStyle = '#ffd666'; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.fillStyle = '#1e1b4b'; c.beginPath(); c.arc(-r * 0.35, -r * 0.1, r * 0.08, 0, 7); c.arc(r * 0.35, -r * 0.1, r * 0.08, 0, 7); c.fill();
    c.strokeStyle = '#1e1b4b'; c.lineWidth = r * 0.07; c.beginPath(); c.arc(0, r * 0.15, r * 0.3, 0.2, Math.PI - 0.2); c.stroke();
    c.fillStyle = 'rgba(255,130,130,.45)'; c.beginPath(); c.arc(-r * 0.6, r * 0.2, r * 0.14, 0, 7); c.arc(r * 0.6, r * 0.2, r * 0.14, 0, 7); c.fill();
  }],
  rainbow: ['Rainbow', 'sky', 2, (c, s) => {
    const cols = ['#ff7a7a', '#ffb870', '#ffe27a', '#8fd98a', '#7ab8ff', '#b490ff'], w = s * 2, r0 = w / 2;
    cols.forEach((col, i) => { c.strokeStyle = col; c.globalAlpha = 0.8; c.lineWidth = s * 0.1; c.beginPath(); c.arc(0, s * 0.5, r0 - i * s * 0.1 - s * 0.05, Math.PI, 0); c.stroke(); });
    c.globalAlpha = 1;
  }],
  rock: ['Rock', 'nature', 1.3, (c, s) => {
    const shape = () => { c.beginPath(); c.moveTo(-s * 0.6, s * 0.4); c.quadraticCurveTo(-s * 0.55, -s * 0.3, -s * 0.1, -s * 0.38); c.quadraticCurveTo(s * 0.4, -s * 0.4, s * 0.6, s * 0.4); c.closePath(); };
    c.fillStyle = '#a39aa8'; shape(); c.fill();
    c.save(); c.clip(); c.fillStyle = shade; c.beginPath(); c.arc(s * 0.5, s * 0.3, s * 0.6, 0, 7); c.fill(); c.restore(); shape(); outline(c, s, 0.04);
  }],
  puddle: ['Puddle', 'nature', 2.4, (c, s) => { c.fillStyle = 'rgba(122,190,235,.85)'; c.beginPath(); c.ellipse(0, 0, s * 1.2, s * 0.5, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.5)'; c.beginPath(); c.ellipse(-s * 0.3, -s * 0.12, s * 0.35, s * 0.1, 0, 0, 7); c.fill(); }],
  /* a player's hand: the glowing mitt every Orlis game shows (o.color: the player's colour) */
  hand: ['Hand', 'player hand', 1, (c, s, o) => {
    const r = s * 0.25, col = o.color || '#3da9ff';
    const g = c.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 2.4); g.addColorStop(0, col + 'aa'); g.addColorStop(1, col + '00');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 2.4, 0, 7); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill(); c.lineWidth = r * 0.28; c.strokeStyle = col; c.stroke();
    c.fillStyle = col; c.beginPath(); for (let i = 0; i < 8; i++){ const a = i * Math.PI / 4, d = i % 2 ? r * 0.22 : r * 0.55; c.lineTo(Math.cos(a) * d, Math.sin(a) * d); } c.closePath(); c.fill();
  }],
  /* a soft glowing dot (o.color), for trails and little lights */
  dot: ['Glow dot', 'effect light', 1, (c, s, o) => {
    const col = o.color || '#ffe680', g = c.createRadialGradient(0, 0, 0, 0, 0, s / 2); g.addColorStop(0, col); g.addColorStop(1, col + '00');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, s / 2, 0, 7); c.fill();
  }],
  ring: ['Ring', 'effect', 1, (c, s, o) => { c.strokeStyle = o.color || '#fff'; c.lineWidth = s * 0.08; c.beginPath(); c.arc(0, 0, s * 0.44, 0, 7); c.stroke(); }],
  /* the raven from Save the Harvest */
  raven: ['Raven', 'animal fly', 1.8, (c, s, o) => {
    const k = s / 90, flap = Math.sin((o.t || 0) * 8) * 0.5 + 0.5;
    c.save(); c.scale(k, k); c.lineJoin = 'round'; c.strokeStyle = INK; c.lineWidth = 5; c.fillStyle = '#3b3a52';
    c.beginPath(); c.ellipse(0, 0, 44, 30, 0, 0, 7); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-6, -8); c.quadraticCurveTo(6, -46 - flap * 30, 58, -26 - flap * 30); c.quadraticCurveTo(28, -10, 10, 2); c.closePath(); c.fillStyle = '#4d4b6a'; c.fill(); c.stroke();
    c.beginPath(); c.arc(-34, -18, 20, 0, 7); c.fillStyle = '#3b3a52'; c.fill(); c.stroke();
    c.fillStyle = '#ffb347'; c.beginPath(); c.moveTo(-52, -18); c.lineTo(-72, -10); c.lineTo(-52, -8); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(-38, -24, 7, 0, 7); c.fill(); c.fillStyle = '#1e1b4b'; c.beginPath(); c.arc(-40, -24, 3.5, 0, 7); c.fill(); c.restore();
  }],
  /* effects: a burst of sparkles that grows and fades over o.t (0 to 1) */
  sparkle: ['Sparkle burst', 'effect', 1, (c, s, o) => {
    const k = Math.max(0, Math.min(1, o.t == null ? 0.5 : o.t)), a = 1 - k;
    c.globalAlpha *= a; c.fillStyle = o.color || '#ffe680';
    for (let i = 0; i < 8; i++){ const ang = i * Math.PI / 4, d = s * (0.15 + k * 0.35), r = s * 0.07 * (1 - k * 0.5); c.beginPath();
      for (let j = 0; j < 8; j++){ const q = j % 2 ? r * 0.4 : r, b = -Math.PI / 2 + j * Math.PI / 4; c.lineTo(Math.cos(ang) * d + Math.cos(b) * q, Math.sin(ang) * d + Math.sin(b) * q); } c.closePath(); c.fill(); }
  }],
  popring: ['Pop ring', 'effect', 1, (c, s, o) => {
    const k = Math.max(0, Math.min(1, o.t == null ? 0.5 : o.t)); c.globalAlpha *= 1 - k; c.strokeStyle = o.color || '#fff'; c.lineWidth = s * 0.06 * (1 - k * 0.6);
    c.beginPath(); c.arc(0, 0, s * (0.2 + k * 0.3), 0, 7); c.stroke();
  }]
};

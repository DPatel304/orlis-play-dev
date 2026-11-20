/* Peekaboo Garden, the TV side, as a measurement (owner only; plan package K1).
   The question: can the TV draw a real 3D garden at 60 fps while camera tracking runs?
   A garden in the 3D sibling look (decision 0038) from a fixed, high three-quarter view; each tracked player's hand is a lantern on the ground
   (a ray from the TV camera through the hand's screen point onto the floor). A pretend hider (a paper bunny) moves between
   the bushes; the TV shows it only when a lantern finds it, and bushes rustle when it passes. Nothing is repainted per frame.
   The 3D picture is its own canvas under the shell's 2D canvas (no copy between them). */
import { loadThree } from '../../stage/stage.js';
import { assets } from '../assets/index.js';
import { pose, PLAYER_COLORS, MAX_PLAYERS } from '../../tracking/pose.js';

export const ROUND = 90;
export default {
  id: 'peekaboo-lab', unit: 'finds', name: 'Peekaboo Garden (3D test)', stars: 1, accent: '#7fb069', secs: ROUND,
  moves: ['arms'], lab: true,
  create(n){ return new PeekabooLab(n); }
};

let T = null, R = null, glCanvas = null, lastDraw = 0, watch = 0;
function layer(){
  if (glCanvas) { glCanvas.style.display = 'block'; return glCanvas; }
  glCanvas = document.createElement('canvas');
  glCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block';
  const st = document.getElementById('stage'); st.parentNode.insertBefore(glCanvas, st);
  R = new T.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'default' });
  /* hide the 3D layer whenever the shell stops drawing this game (results, menus) */
  watch = setInterval(() => { if (glCanvas && performance.now() - lastDraw > 400) glCanvas.style.display = 'none'; }, 250);
  return glCanvas;
}

const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
/* a painted piece from the asset library, with no white rim (the 2D look has none) */
function cutout(id, px, opts){
  const asp = (assets.list().find(r => r.id === id) || {}).aspect || 1, pad = Math.round(px * 0.06);
  const W = Math.ceil(px * asp) + pad * 2, H = px + pad * 2, o = mk(W, H), x = o.getContext('2d');
  x.save(); x.translate(W / 2, H / 2); assets.draw(x, id, 0, 0, px, opts || {}); x.restore();
  return { cv: o, W, H, px, pad };
}
const paint = (w, h, draw) => { const c = mk(w, h); draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };

class PeekabooLab {
  constructor(players){
    this.players = players; this.t = 0; this.over = false; this.finds = 0;
    this.score = Array.from({ length: MAX_PLAYERS }, () => 0);
    this.ready = false; this.err = '';
    loadThree().then((m) => { if (!m) { this.err = 'no 3D here'; return; } T = m; this._build(); }).catch((e) => { this.err = String(e && e.message || e); });
  }

  /* The look is decision 0038's 3D sibling of the painted 2D look: the 2D shade colour (a cool purple-grey) from a lavender sky light,
     the sun upper left, one shade tone, a thin ink edge on the things that matter, soft blob shadows, a horizon mist, and painted pieces
     (grass, flowers, seedlings, far trees) standing in the world. Real 3D only for what you walk on, go around or bump into:
     the ground, the hedges, the shed, the bushes and pots you hide behind. */
  _build(){
    layer();
    const scene = this.scene = new T.Scene();
    const MIST = 0xe4ebe6; scene.background = new T.Color(MIST); scene.fog = new T.Fog(MIST, 34, 70);
    const ramp = new T.DataTexture(new Uint8Array([200, 200, 200, 255, 255, 255, 255, 255]), 2, 1);
    ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.needsUpdate = true;
    const toon = (col) => new T.MeshToonMaterial({ color: col, gradientMap: ramp });
    scene.add(new T.HemisphereLight(0xe6e0f7, 0xcfc8e6, 2.9));
    const sun = new T.DirectionalLight(0xfff3dc, 1.6); sun.position.set(-10, 12, 8); scene.add(sun);
    /* the thin ink edge: the outline only, as on the 2D pieces */
    const ink = new T.MeshBasicMaterial({ color: 0x2f2b45, side: T.BackSide, fog: false });
    const edge = (m, k = 1.05) => { const h = new T.Mesh(m.geometry, ink); h.scale.setScalar(k); m.add(h); return m; };
    /* soft shadows under things, as in the 2D polish */
    const blobT = paint(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(52,40,96,.42)'); g.addColorStop(1, 'rgba(52,40,96,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
    const blobM = new T.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false });
    const blob = (px, pz, r) => { const m = new T.Mesh(new T.PlaneGeometry(r * 2, r * 2), blobM); m.rotation.x = -Math.PI / 2; m.position.set(px + r * 0.15, 0.02, pz + r * 0.1); scene.add(m); return m; };
    /* the ground: a painted lawn and path, painted once, in the sibling's greens */
    const gt = paint(512, 512, (x) => {
      x.fillStyle = '#93b67a'; x.fillRect(0, 0, 512, 512);
      for (let i = 0; i < 220; i++){ x.fillStyle = i % 2 ? 'rgba(178,206,146,.35)' : 'rgba(120,160,104,.28)'; x.beginPath(); x.ellipse(Math.random() * 512, Math.random() * 512, 12 + Math.random() * 28, 8 + Math.random() * 16, Math.random() * 3, 0, 6.3); x.fill(); }
      x.strokeStyle = '#e6d7b0'; x.lineWidth = 34; x.lineCap = 'round'; x.beginPath(); x.moveTo(256, 520); x.bezierCurveTo(200, 380, 330, 260, 250, 120); x.stroke();
    });
    const ground = this.ground = new T.Mesh(new T.PlaneGeometry(30, 30), new T.MeshToonMaterial({ map: gt, gradientMap: ramp }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    /* a wider meadow beyond the hedges, fading into the mist */
    const far = new T.Mesh(new T.PlaneGeometry(160, 160), toon(0xa9c890)); far.rotation.x = -Math.PI / 2; far.position.y = -0.02; scene.add(far);
    /* hedges: rows of soft round clumps (not boxes), with the ink edge */
    const hedgeG = new T.SphereGeometry(1, 18, 12), hedgeM = toon(0x7fa86c), clumps = [];
    for (const [x0, z0, x1, z1] of [[-15, -15, 15, -15], [-15, 15, 15, 15], [-15, -15, -15, 15], [15, -15, 15, 15]]){
      const n = 24; for (let i = 0; i <= n; i++) clumps.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, 1 + ((i * 7) % 5) * 0.06]); }
    const hedge = new T.InstancedMesh(hedgeG, hedgeM, clumps.length), hedgeInk = new T.InstancedMesh(hedgeG, ink, clumps.length), d = new T.Object3D();
    clumps.forEach(([cx, cz, k], i) => { d.position.set(cx, 0.75 * k, cz); d.scale.set(0.95 * k, 0.95 * k, 0.95 * k); d.updateMatrix(); hedge.setMatrixAt(i, d.matrix); d.scale.multiplyScalar(1.05); d.updateMatrix(); hedgeInk.setMatrixAt(i, d.matrix); });
    scene.add(hedge, hedgeInk);
    /* the shed: a building, so real 3D, warm and simple, with the edge */
    const shed = new T.Group(), wall = edge(new T.Mesh(new T.BoxGeometry(4, 2.6, 3), toon(0xe07a5f)), 1.03); wall.position.y = 1.3; shed.add(wall);
    [-1, 1].forEach(s => { const r = edge(new T.Mesh(new T.BoxGeometry(4.4, 0.18, 2.1), toon(0x8a6f8f)), 1.03); r.position.set(0, 3.0, s * 0.78); r.rotation.x = s * 0.6; shed.add(r); });
    const door = new T.Mesh(new T.PlaneGeometry(1.1, 1.8), toon(0xfff1d6)); door.position.set(0.6, 0.9, 1.51); shed.add(door);
    shed.position.set(-9, 0, -9); scene.add(shed); blob(-9, -9, 3.4);
    /* painted pieces standing in the world, turned to the camera */
    this.cut = {}; this.spots = []; this.standees = [];
    const stand = (id, h, px, pz, opts) => {
      const key = id + JSON.stringify(opts || {}), c = this.cut[key] || (this.cut[key] = cutout(id, 256, opts));
      const t = new T.CanvasTexture(c.cv); t.colorSpace = T.SRGBColorSpace;
      const k = h / c.px, geo = new T.PlaneGeometry(c.W * k, c.H * k); geo.translate(0, c.H * k / 2 - c.pad * k, 0);
      const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.05 }));
      m.position.set(px, 0, pz); scene.add(m); this.standees.push(m); return m;
    };
    /* hiding places: round bushes and flower pots are 3D (you hide behind them); tall seedlings are painted */
    const bushM = toon(0x8fb87a), potM = toon(0xd9895b), ball = new T.SphereGeometry(1, 20, 14);
    const bush = (px, pz) => { const g = new T.Group(); [[0, 0, 0, 1], [-.8, -.2, .1, .75], [.8, -.25, -.1, .7], [0, .7, -.1, .65]].forEach(([a, b, c, r]) => {
        const m = edge(new T.Mesh(ball, bushM)); m.scale.setScalar(r); m.position.set(a, 1 + b, c); g.add(m); }); g.position.set(px, 0, pz); scene.add(g); blob(px, pz, 1.9); return g; };
    for (let i = 0; i < 9; i++){
      const a = i / 9 * 6.2832 + 0.3, r = 5 + (i % 3) * 2.6, px = Math.cos(a) * r, pz = Math.sin(a) * r;
      const kind = i % 3;
      let m;
      if (kind === 0) m = bush(px, pz);
      else if (kind === 1){ m = edge(new T.Mesh(new T.CylinderGeometry(1.0, 0.75, 1.4, 20), potM), 1.05); m.position.set(px, 0.7, pz); scene.add(m); blob(px, pz, 1.3); stand('tulip', 1.1, px, pz + 0.01).position.y = 1.4; }
      else { m = stand('seedling', 1.6, px, pz); blob(px, pz, 0.9); }
      this.spots.push({ x: px, z: pz, m, kind, rustle: 0 });
    }
    for (let i = 0; i < 9; i++){ const a = Math.PI + 0.2 + i / 8 * (Math.PI - 0.4), r = 13; stand(i % 2 ? 'tree' : 'pine', 4 + (i % 3) * 0.8, Math.cos(a) * r, Math.sin(a) * r); }   /* trees along the back and sides only, so none hides the garden; far, so painted */
    /* a few painted flowers on the lawn (one draw call); no grass tufts: the owner found them too busy */
    const flowerT = paint(64, 64, (x) => { x.strokeStyle = '#6e9a5a'; x.lineWidth = 3; x.beginPath(); x.moveTo(32, 62); x.lineTo(32, 30); x.stroke(); x.save(); x.translate(32, 24); assets.draw(x, 'flower', 0, 0, 34, {}); x.restore(); });
    this.fields = [[flowerT, 40, 0.75]].map(([tex, n, size]) => {
      const g = new T.PlaneGeometry(size, size); g.translate(0, size / 2, 0);
      const im = new T.InstancedMesh(g, new T.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.3 }), n);
      im.userData.pos = Array.from({ length: n }, () => { for (;;){ const px = (Math.random() - 0.5) * 27, pz = (Math.random() - 0.5) * 27; if (!this.spots.some(s => Math.hypot(s.x - px, s.z - pz) < 1.6) && Math.hypot(px + 9, pz + 9) > 3) return [px, pz]; } });
      scene.add(im); return im; });
    /* the pretend hider (a painted bunny) and the lanterns */
    this.hider = stand('bunny', 1.3, 0, 0); this.hider.material.opacity = 0; this.hider.material.transparent = true;
    this.hs = { from: 0, to: 1, k: 0, wait: 2 };
    this.lanterns = PLAYER_COLORS.slice(0, MAX_PLAYERS).map((col) => {
      const disc = new T.Mesh(new T.CircleGeometry(2.2, 40), new T.MeshBasicMaterial({ color: 0xfff1b8, transparent: true, opacity: 0.45, blending: T.AdditiveBlending, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.03; disc.visible = false; scene.add(disc);
      const light = new T.PointLight(0xffe2a0, 0, 7, 1.6); light.position.y = 1.6; scene.add(light);
      return { disc, light, col, x: 0, z: 0, on: false };
    });
    this.cam = new T.PerspectiveCamera(42, 16 / 9, 0.1, 200);
    this.cam.position.set(0, 21, 21); this.cam.lookAt(0, 0, 0.8);
    /* the camera is fixed, so the painted pieces are turned to it once */
    for (const im of this.fields){ im.userData.pos.forEach(([px, pz], i) => { d.position.set(px, 0, pz); d.rotation.set(0, Math.atan2(this.cam.position.x - px, this.cam.position.z - pz), 0); d.scale.setScalar(0.8 + ((i * 13) % 7) / 14); d.updateMatrix(); im.setMatrixAt(i, d.matrix); }); im.instanceMatrix.needsUpdate = true; }
    this.ray = new T.Raycaster(); this.ndc = new T.Vector2();
    this.ready = true;
  }

  step(dt){
    if (!this.ready) return;
    this.t += dt; if (this.t >= ROUND) this.over = true;
    /* the pretend hider: hops from hiding place to hiding place */
    const h = this.hs, S = this.spots;
    if (h.wait > 0){ h.wait -= dt; if (h.wait <= 0){ h.from = h.to; h.to = (h.to + 1 + Math.floor(Math.random() * (S.length - 1))) % S.length; h.k = 0; } }
    else { h.k = Math.min(1, h.k + dt * 0.35); if (h.k >= 1) h.wait = 2 + Math.random() * 3; }
    const a = S[h.from], b = S[h.to], e = h.k * h.k * (3 - 2 * h.k);
    const hx = a.x + (b.x - a.x) * e, hz = a.z + (b.z - a.z) * e;
    this.hider.position.set(hx, Math.abs(Math.sin(this.t * 9)) * 0.25 * (h.wait > 0 ? 0 : 1), hz + 0.4);
    for (const s of S){ if (Math.hypot(s.x - hx, s.z - hz) < 1.8 && h.wait <= 0) s.rustle = 1; s.rustle = Math.max(0, s.rustle - dt * 2); }
    /* lanterns: each player's hand, as a ray from the TV camera onto the ground */
    let lit = 0;
    for (let i = 0; i < this.lanterns.length; i++){
      const L = this.lanterns[i], p = pose.players[i], on = i < this.players && p && p.present;
      L.on = !!on; L.disc.visible = L.on; L.light.intensity = L.on ? 6 : 0;
      if (!on) continue;
      const hand = p.hands.right.speed >= p.hands.left.speed ? p.hands.right : p.hands.left;
      this.ndc.set(hand.x * 2 - 1, -(hand.y * 2 - 1)); this.ray.setFromCamera(this.ndc, this.cam);
      const hit = this.ray.intersectObject(this.ground)[0];
      if (hit){ L.x += (hit.point.x - L.x) * Math.min(1, dt * 12); L.z += (hit.point.z - L.z) * Math.min(1, dt * 12); }
      L.disc.position.set(L.x, 0.03, L.z); L.light.position.set(L.x, 1.6, L.z);
      if (Math.hypot(L.x - hx, L.z - hz) < 2.2){ lit = Math.max(lit, 1); this.score[i] += dt; }
    }
    const m = this.hider.material; m.opacity += ((lit ? 1 : 0) - m.opacity) * Math.min(1, dt * 6);
    if (lit && m.opacity > 0.95 && !this._found){ this._found = true; this.finds++; } else if (!lit) this._found = false;
  }

  draw(c, W, H){
    lastDraw = performance.now();
    c.clearRect(0, 0, W, H);                         /* the 2D canvas goes clear: the 3D layer underneath shows */
    if (!this.ready){ c.fillStyle = '#0d0b1a'; c.fillRect(0, 0, W, H); c.fillStyle = '#fff'; c.font = `600 ${Math.round(H * 0.03)}px system-ui`; c.textAlign = 'center'; c.fillText(this.err || 'Planting the garden…', W / 2, H / 2); return; }
    layer();
    const dpr = Math.min(window.devicePixelRatio || 1, 2), w = glCanvas.clientWidth, h = glCanvas.clientHeight;
    if (this._w !== w || this._h !== h){ this._w = w; this._h = h; R.setPixelRatio(dpr); R.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
    for (const s of this.spots){ const r = s.rustle; s.m.rotation.z = r ? Math.sin(this.t * 40) * 0.08 * r : 0; }
    for (const m of this.standees) m.rotation.y = Math.atan2(this.cam.position.x - m.position.x, this.cam.position.z - m.position.z);
    R.render(this.scene, this.cam);
    /* the hands, on the 2D layer, so a player can see where they point */
    for (let i = 0; i < this.players; i++){
      const p = pose.players[i]; if (!p || !p.present) continue;
      const hand = p.hands.right.speed >= p.hands.left.speed ? p.hands.right : p.hands.left;
      c.fillStyle = PLAYER_COLORS[i]; c.globalAlpha = 0.85; c.beginPath(); c.arc(hand.x * W, hand.y * H, H * 0.018, 0, 6.2832); c.fill(); c.globalAlpha = 1;
    }
    c.fillStyle = 'rgba(255,255,255,.85)'; c.font = `600 ${Math.round(H * 0.018)}px system-ui`; c.textAlign = 'left';
    c.fillText(`3D test - tracking: ${pose.worker ? 'separate worker' : 'main thread'} (Shift+G on home to switch) - press P for speed, R for a report`, W * 0.02, H * 0.97);
  }

  card(){ return this.t < 6 ? 'wave' : null; }
  hud(){ return { score: this.score.map(s => Math.floor(s)), showLives: false, hideScore: true }; }
  pausable(){ return true; }
  tally(){ return [{ label: 'Finds', value: this.finds, color: '#7fb069' }]; }
  winner(){ return null; }
  value(){ return this.finds; }
}

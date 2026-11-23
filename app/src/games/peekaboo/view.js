/* Peekaboo Garden on the TV (plan package K4): the 3D garden, in the 3D sibling of the painted look (decision 0038): a fixed high camera, a lavender
   shade, a painted sky dome and mist, painted cutouts for far things, a thin ink edge on what matters. Its own WebGL canvas sits under the shell's 2D
   canvas. Everything is built once; per frame only a few things move (lanterns, shaking bushes, a few leaves, the hider's card when it shows).
   The hider is never drawn unless a lantern is on them (a faint silhouette) or they are found / have stayed hidden (the reveal).
   Colours come from the master palette by name (assets.color). */
import { loadThree } from '../../stage/stage.js';
import { assets } from '../assets/index.js';
import { alpha } from '../assets/palette.js';
import { body, poseBounds } from '../../ui/avatar-art.js';
import { cubo } from '../../ui/look.js';
import { CAM_POS, CAM_TARGET, FOV, toScene } from './camera.js';
import { LIGHT_RADIUS } from './rules.js';

const col = (n, t) => assets.color(n, t);
const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
const ease = (k) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const backOut = (k) => { k = Math.min(1, Math.max(0, k)); const c1 = 1.9, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); };

/* ---- the 3D layer: one canvas under the shell's, shared by every round ---- */
let glCanvas = null, R = null, lastDraw = 0, watch = 0;
export { loadThree };
export function glLayer(T) {
  if (glCanvas && R) { glCanvas.style.display = 'block'; return glCanvas; }
  glCanvas = document.createElement('canvas');
  glCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;display:block';
  const st = document.getElementById('stage'); st.parentNode.insertBefore(glCanvas, st);
  lastDraw = performance.now();
  R = new T.WebGLRenderer({ canvas: glCanvas, antialias: true, powerPreference: 'default' });
  /* hide the 3D layer whenever the shell stops drawing this game (results, menus) */
  watch = setInterval(() => { if (glCanvas && performance.now() - lastDraw > 400) glCanvas.style.display = 'none'; }, 250);
  return glCanvas;
}

/* ---- the hider's card: their own block-limb character, painted once into one texture (four drawings side by side) ---- */
const CARD = [['stand', 0], ['wave', 0.157], ['wave', 0.47], ['cheer', 0.2]];
export const REVEAL_SCALE = 2.4;     /* on the reveal the character is shown big, so the whole room sees them */
export const HIDER_HEIGHT = 1.9;      /* how tall the character stands on the TV, in steps */
function paintCard(look) {
  const S = 170, bs = ['stand', 'wave', 'cheer'].map(p => poseBounds(p, false));
  const x0 = Math.min(...bs.map(b => b.x0)), x1 = Math.max(...bs.map(b => b.x1)), y0 = Math.min(...bs.map(b => b.y0)), y1 = Math.max(...bs.map(b => b.y1));
  const pad = 14, cw = Math.ceil((x1 - x0) * S) + pad * 2, ch = Math.ceil((y1 - y0) * S) + pad * 2;
  const cv = mk(cw * CARD.length, ch), x = cv.getContext('2d'), feet = -y0 * S + pad, mid = -x0 * S + pad;
  CARD.forEach(([pose, t], i) => body(x, i * cw + mid, feet, S, look || cubo(), t, pose, { still: true }));
  const standTop = -poseBounds('stand', false).y0;                  /* the character's own height, in S units */
  const k = HIDER_HEIGHT / (standTop * S);                          /* steps per pixel */
  return { cv, cw, ch, feet, mid, k };
}

export class GardenView {
  /* T: three.js; world: the garden (world.js); look: the hider's look (or null for Cubo) */
  constructor(T, world, look) {
    this.T = T; this.world = world; this.t = 0; this.ready = false;
    this._build(T, world, look);
  }

  _build(T, world, look) {
    const scene = this.scene = new T.Scene();
    const MIST = col('sky.mist');
    scene.background = new T.Color(MIST); scene.fog = new T.Fog(MIST, 62, 125);
    const ramp = new T.DataTexture(new Uint8Array([200, 200, 200, 255, 255, 255, 255, 255]), 2, 1);
    ramp.minFilter = ramp.magFilter = T.NearestFilter; ramp.needsUpdate = true;
    const toon = (c) => new T.MeshToonMaterial({ color: c, gradientMap: ramp });
    const paint = (w, h, draw) => { const c = mk(w, h); draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };
    this.hemi = new T.HemisphereLight(col('shade.light'), col('shade.light', 'shade'), 3.2); scene.add(this.hemi);
    const sun = new T.DirectionalLight(col('sky.sun'), 1.7); sun.position.set(-12, 16, 10); scene.add(sun);
    /* the painted sky dome: a gradient, painted once */
    const sky = new T.Mesh(new T.SphereGeometry(110, 16, 10), new T.MeshBasicMaterial({
      map: paint(8, 128, (x, w, h) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, col('sky.high')); g.addColorStop(0.5, col('sky.mid')); g.addColorStop(0.8, col('sky.low')); g.addColorStop(1, col('sky.horizon')); x.fillStyle = g; x.fillRect(0, 0, w, h); }),
      side: T.BackSide, fog: false, depthWrite: false }));
    sky.renderOrder = -1; scene.add(sky);
    /* the thin ink edge, and soft shadows under things */
    const ink = new T.MeshBasicMaterial({ color: col('shade.ink'), side: T.BackSide, fog: false });
    const edge = (m, k = 1.05) => { const h = new T.Mesh(m.geometry, ink); h.scale.setScalar(k); m.add(h); return m; };
    const blobT = paint(64, 64, (x) => { const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, alpha('shade.shadow', 0.42)); g.addColorStop(1, alpha('shade.shadow', 0)); x.fillStyle = g; x.fillRect(0, 0, 64, 64); });
    const blobM = new T.MeshBasicMaterial({ map: blobT, transparent: true, depthWrite: false });
    const blob = (sx, sz, r) => { const m = new T.Mesh(new T.PlaneGeometry(r * 2, r * 2), blobM); m.rotation.x = -Math.PI / 2; m.position.set(sx + r * 0.15, 0.02, sz - r * 0.1); scene.add(m); return m; };
    this._blob = blob;
    /* the ground: one painted lawn with a path, 30 by 30 steps, and a wider meadow beyond the hedge fading into the mist */
    const gt = paint(512, 512, (x) => {
      x.fillStyle = col('meadow.lawn'); x.fillRect(0, 0, 512, 512);
      let s = 7; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;       /* (a fixed pattern: the same garden every time) */
      for (let i = 0; i < 220; i++) { x.fillStyle = i % 2 ? alpha('meadow.far', 0.4) : alpha('meadow.deep', 0.22); x.beginPath(); x.ellipse(rnd() * 512, rnd() * 512, 12 + rnd() * 28, 8 + rnd() * 16, rnd() * 3, 0, 6.3); x.fill(); }
      x.strokeStyle = col('earth.path'); x.lineWidth = 34; x.lineCap = 'round'; x.beginPath(); x.moveTo(256, 530); x.bezierCurveTo(200, 380, 330, 260, 250, -10); x.stroke();
    });
    const ground = new T.Mesh(new T.PlaneGeometry(30, 30), new T.MeshToonMaterial({ map: gt, gradientMap: ramp }));
    ground.rotation.x = -Math.PI / 2; scene.add(ground);
    const far = new T.Mesh(new T.PlaneGeometry(260, 260), toon(col('meadow.soft'))); far.rotation.x = -Math.PI / 2; far.position.y = -0.02; scene.add(far);
    /* hedges: rows of soft round clumps; the one nearest the TV is low so it never hides the garden */
    const hedgeG = new T.SphereGeometry(1, 16, 10), clumps = [];
    for (const [x0, z0, x1, z1, k0] of [[-15, -15, 15, -15, 1], [-15, 15, 15, 15, 0.5], [-15, -15, -15, 15, 1], [15, -15, 15, 15, 1]]) {
      const n = 24; for (let i = 0; i <= n; i++) clumps.push([x0 + (x1 - x0) * i / n, z0 + (z1 - z0) * i / n, (1 + ((i * 7) % 5) * 0.06) * k0]);
    }
    const hedge = new T.InstancedMesh(hedgeG, toon(col('meadow.leaf')), clumps.length), hedgeInk = new T.InstancedMesh(hedgeG, ink, clumps.length), d = new T.Object3D();
    clumps.forEach(([cx, cz, k], i) => { d.position.set(cx, 0.75 * k, cz); d.scale.setScalar(0.95 * k); d.updateMatrix(); hedge.setMatrixAt(i, d.matrix); d.scale.multiplyScalar(1.05); d.updateMatrix(); hedgeInk.setMatrixAt(i, d.matrix); });
    scene.add(hedge, hedgeInk);
    /* the shed (world.shed): a building, so real 3D */
    const sh = world.shed, sw = sh.x1 - sh.x0, sd = sh.z1 - sh.z0, sc = toScene((sh.x0 + sh.x1) / 2, (sh.z0 + sh.z1) / 2);
    const shed = new T.Group(), wall = edge(new T.Mesh(new T.BoxGeometry(sw, 2.8, sd), toon(col('earth.brick'))), 1.02); wall.position.y = 1.4; shed.add(wall);
    [-1, 1].forEach(s => { const r = edge(new T.Mesh(new T.BoxGeometry(sw + 0.5, 0.2, sd / 2 + 0.5), toon(col('earth.plumRoof'))), 1.02); r.position.set(0, 3.25, s * sd * 0.26); r.rotation.x = s * 0.55; shed.add(r); });
    const door = new T.Mesh(new T.PlaneGeometry(1.2, 2), toon(col('shade.paper'))); door.position.set(0.8, 1, sd / 2 + 0.02); shed.add(door);
    shed.position.set(sc.x, 0, sc.z); scene.add(shed); blob(sc.x, sc.z, Math.max(sw, sd) * 0.7);
    /* painted pieces (far trees, flowers) stand in the world turned to the camera, which never moves */
    this.standees = []; this.cut = {};
    const cutout = (id, px) => {
      const asp = (assets.list().find(r => r.id === id) || {}).aspect || 1, pad = Math.round(px * 0.06), W = Math.ceil(px * asp) + pad * 2, H = px + pad * 2, o = mk(W, H), x = o.getContext('2d');
      x.save(); x.translate(W / 2, H / 2); assets.draw(x, id, 0, 0, px, {}); x.restore(); return { cv: o, W, H, px, pad };
    };
    const stand = (id, h, sx, sy, sz) => {
      const c = this.cut[id] || (this.cut[id] = cutout(id, 256)), tex = new T.CanvasTexture(c.cv); tex.colorSpace = T.SRGBColorSpace;
      const k = h / c.px, geo = new T.PlaneGeometry(c.W * k, c.H * k); geo.translate(0, c.H * k / 2 - c.pad * k, 0);
      const m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05 }));
      m.position.set(sx, sy, sz); m.rotation.y = Math.atan2(CAM_POS[0] - sx, CAM_POS[2] - sz); scene.add(m); return m;
    };
    /* far trees outside the hedge, along the back and sides */
    const farTrees = []; for (let i = 0; i <= 8; i++) farTrees.push([-22 + i * 5.5, -19.5]);
    for (let i = 0; i < 4; i++) { farTrees.push([-20, -12 + i * 6]); farTrees.push([20, -12 + i * 6]); }
    farTrees.forEach(([sx, sz], i) => stand(i % 2 ? 'tree' : 'pine', 6 + (i % 3) * 1.2, sx, 0, sz));
    /* tree trunks (world.trees): solid, with a small painted crown above */
    for (const t of world.trees) {
      const s = toScene(t.x, t.z), g = new T.Group();
      const trunk = edge(new T.Mesh(new T.CylinderGeometry(t.r * 0.55, t.r * 0.7, 2.6, 14), toon(col('earth.bark'))), 1.06); trunk.position.y = 1.3; g.add(trunk);
      [[0, 3.3, 0, 1.25], [-0.7, 3.0, 0.2, 0.9], [0.7, 3.1, -0.2, 0.9]].forEach(([a, b, c, r]) => { const m = edge(new T.Mesh(new T.SphereGeometry(1, 16, 10), toon(col('meadow.fresh')))); m.scale.setScalar(r); m.position.set(a, b, c); g.add(m); });
      g.position.set(s.x, 0, s.z); scene.add(g); blob(s.x, s.z, 1.7);
    }
    /* the nine hiding places: 3D shapes with the painted skin */
    this.places = {};
    const ball = new T.SphereGeometry(1, 18, 12), bushM = toon(col('meadow.grass')), potM = toon(col('earth.clay')), bladeM = toon(col('meadow.fresh'));
    const blade = new T.ConeGeometry(0.2, 1.7, 5);
    for (const p of world.places) {
      const s = toScene(p.x, p.z), g = new T.Group();
      if (p.kind === 'bush') {
        const k = p.r / 1.25;
        [[0, 0, 0, 1], [-.8, -.2, .1, .75], [.8, -.25, -.1, .7], [0, .7, -.1, .65]].forEach(([a, b, c, r]) => { const m = edge(new T.Mesh(ball, bushM)); m.scale.setScalar(r * k); m.position.set(a * k, (1 + b) * k, c * k); g.add(m); });
        blob(s.x, s.z, p.r * 1.5);
      } else if (p.kind === 'pot') {
        const pot = edge(new T.Mesh(new T.CylinderGeometry(p.r * 1.0, p.r * 0.78, 1.25, 20), potM), 1.05); pot.position.y = 0.62; g.add(pot);
        const rim = edge(new T.Mesh(new T.CylinderGeometry(p.r * 1.12, p.r * 1.05, 0.22, 20), potM), 1.05); rim.position.y = 1.3; g.add(rim);
        blob(s.x, s.z, p.r * 1.8);
      } else {
        const patch = new T.Mesh(new T.CircleGeometry(p.r * 1.05, 24), toon(col('meadow.soft'))); patch.rotation.x = -Math.PI / 2; patch.position.y = 0.03; g.add(patch);
        for (let i = 0; i < 11; i++) {
          const a = i * 2.4, rr = p.r * 0.72 * Math.sqrt((i + 0.5) / 11), b = edge(new T.Mesh(blade, bladeM), 1.12);
          b.position.set(Math.cos(a) * rr, 0.85, Math.sin(a) * rr); b.rotation.set(Math.sin(a * 1.7) * 0.22, 0, Math.cos(a * 1.3) * 0.22); b.scale.y = 0.85 + (i % 3) * 0.18; g.add(b);
        }
      }
      g.position.set(s.x, 0, s.z); scene.add(g);
      this.places[p.id] = { id: p.id, kind: p.kind, r: p.r, g, sx: s.x, sz: s.z, rustle: 0 };
    }
    this.potTulips = world.places.filter(p => p.kind === 'pot').map(p => { const s = toScene(p.x, p.z); return stand('tulip', 1.3, s.x, 1.35, s.z); });
    /* a few painted flowers on the lawn: one draw call */
    const flowerT = paint(64, 64, (x) => { x.strokeStyle = col('meadow.leaf'); x.lineWidth = 3; x.beginPath(); x.moveTo(32, 62); x.lineTo(32, 30); x.stroke(); x.save(); x.translate(32, 24); assets.draw(x, 'flower', 0, 0, 34, {}); x.restore(); });
    const fg = new T.PlaneGeometry(0.75, 0.75); fg.translate(0, 0.375, 0);
    const flowers = new T.InstancedMesh(fg, new T.MeshBasicMaterial({ map: flowerT, transparent: true, alphaTest: 0.3 }), 36);
    { let s = 11, n = 0; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
      while (n < 36) {
        const wx = 1 + rnd() * 28, wz = 1 + rnd() * 28;
        if (world.places.some(p => Math.hypot(p.x - wx, p.z - wz) < p.r + 1) || world.trees.some(t => Math.hypot(t.x - wx, t.z - wz) < 2) || (wx > sh.x0 - 1 && wx < sh.x1 + 1 && wz > sh.z0 - 1 && wz < sh.z1 + 1)) continue;
        const q = toScene(wx, wz); d.position.set(q.x, 0, q.z); d.rotation.set(0, Math.atan2(CAM_POS[0] - q.x, CAM_POS[2] - q.z), 0); d.scale.setScalar(0.8 + (n % 5) / 12); d.updateMatrix(); flowers.setMatrixAt(n++, d.matrix);
      }
      d.rotation.set(0, 0, 0); scene.add(flowers); }
    /* leaves for a rustle: one set of points, a few thrown up at a time */
    const leafT = paint(32, 32, (x) => { x.fillStyle = col('meadow.fresh'); x.strokeStyle = col('shade.ink'); x.lineWidth = 2.5; x.beginPath(); x.ellipse(16, 16, 11, 6, -0.6, 0, 6.3); x.fill(); x.stroke(); });
    this.NL = 36; this.leaf = { pos: new Float32Array(this.NL * 3).fill(-50), vel: new Float32Array(this.NL * 3), life: new Float32Array(this.NL), next: 0 };
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.BufferAttribute(this.leaf.pos, 3));
    this.leaves = new T.Points(lg, new T.PointsMaterial({ map: leafT, size: 0.7, transparent: true, alphaTest: 0.1, depthWrite: false, fog: false })); this.leaves.frustumCulled = false; scene.add(this.leaves);
    /* lanterns: a warm pool on the ground in the seeker's colour, with a little real light */
    this.lanterns = [0, 1].map(() => {
      const mat = new T.MeshBasicMaterial({ transparent: true, depthWrite: false, opacity: 0 }), disc = new T.Mesh(new T.CircleGeometry(LIGHT_RADIUS / 0.86, 40), mat);
      disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; disc.visible = false; scene.add(disc);
      const light = new T.PointLight(col('sky.sunGlow'), 0, 8, 1.4); light.position.y = 1.8; scene.add(light);
      return { disc, light, mat, colour: '', x: 0, z: 0, k: 0, tex: null };
    });
    /* the hider's card (their own character), shown only when lit or found; one texture, four drawings */
    const card = this.card = paintCard(look);
    const tex = new T.CanvasTexture(card.cv); tex.colorSpace = T.SRGBColorSpace; tex.repeat.set(1 / CARD.length, 1); this.cardTex = tex;
    const gw = card.cw * card.k, gh = card.ch * card.k, geo = new T.PlaneGeometry(gw, gh); geo.translate(0, gh / 2 - (card.ch - card.feet) * card.k, 0);
    this.hider = new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, opacity: 0, color: col('shade.mid') }));
    this.hider.renderOrder = 10; this.hider.rotation.x = -0.75;      /* leaning to the high camera, so the card is not squashed */
     this.hider.visible = false; scene.add(this.hider);
    this.hblob = blob(0, 0, 1.0); this.hblob.visible = false;
    this.reveal = { name: '', t: 0 };
    this.cam = new T.PerspectiveCamera(FOV, 16 / 9, 0.1, 260);
    this.cam.position.set(...CAM_POS); this.cam.lookAt(...CAM_TARGET);
    this.ready = true;
  }

  /* a bush shakes and throws a few leaves */
  rustle(placeId) {
    const p = this.places[placeId]; if (!p) return;
    p.rustle = 1;
    const L = this.leaf;
    for (let i = 0; i < 4; i++) {
      const j = L.next; L.next = (L.next + 1) % this.NL;
      L.pos[j * 3] = p.sx + (Math.random() - 0.5) * p.r; L.pos[j * 3 + 1] = 1.2 + Math.random() * 1.2; L.pos[j * 3 + 2] = p.sz + (Math.random() - 0.5) * p.r;
      L.vel[j * 3] = (Math.random() - 0.5) * 1.6; L.vel[j * 3 + 1] = 1 + Math.random() * 1.2; L.vel[j * 3 + 2] = (Math.random() - 0.5) * 1.6; L.life[j] = 1;
    }
  }

  _lantern(i, l, dt) {
    const L = this.lanterns[i]; if (!L) return;
    if (!l) { L.k = Math.max(0, L.k - dt * 5); } else {
      if (L.colour !== l.color) { L.colour = l.color; if (L.tex) L.tex.dispose(); L.tex = this._poolTexture(l.color); L.mat.map = L.tex; L.mat.needsUpdate = true; }
      const s = toScene(l.x, l.z); if (L.k < 0.05) { L.x = s.x; L.z = s.z; } else { L.x += (s.x - L.x) * Math.min(1, dt * 14); L.z += (s.z - L.z) * Math.min(1, dt * 14); }
      L.k = Math.min(1, L.k + dt * 6);
    }
    L.disc.visible = L.k > 0.01; L.mat.opacity = L.k; L.light.intensity = 7 * L.k;
    L.disc.position.set(L.x, 0.05, L.z); L.light.position.set(L.x, 1.8, L.z);
  }
  _poolTexture(colour) {
    const T = this.T, c = mk(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, alpha('sky.sun', 0.8)); g.addColorStop(0.55, alpha('sky.sunGlow', 0.42)); g.addColorStop(0.8, alpha('sky.sunGlow', 0.2)); g.addColorStop(0.86, colour); g.addColorStop(0.93, colour); g.addColorStop(1, alpha('earth.snow', 0));
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }

  /* m: { phase, t (the phase's seconds), hider:{x,z,place}, meter, lit, result, lanterns:[{x,z,color}] } */
  update(m, dt) {
    this.t += dt;
    for (let i = 0; i < this.lanterns.length; i++) this._lantern(i, m.phase === 'seek' ? m.lanterns[i] : null, dt);
    for (const p of Object.values(this.places)) {
      if (p.rustle > 0) { p.rustle = Math.max(0, p.rustle - dt * 2.2); p.g.rotation.z = Math.sin(this.t * 42) * 0.07 * p.rustle; p.g.rotation.x = Math.cos(this.t * 37) * 0.04 * p.rustle; }
      else if (p.g.rotation.z) p.g.rotation.z = p.g.rotation.x = 0;
    }
    const L = this.leaf; let any = false;
    for (let j = 0; j < this.NL; j++) {
      if (L.life[j] <= 0) continue;
      L.life[j] -= dt * 0.9; any = true;
      if (L.life[j] <= 0) { L.pos[j * 3 + 1] = -50; continue; }
      L.vel[j * 3 + 1] -= 3.2 * dt; L.pos[j * 3] += L.vel[j * 3] * dt; L.pos[j * 3 + 1] = Math.max(0.05, L.pos[j * 3 + 1] + L.vel[j * 3 + 1] * dt); L.pos[j * 3 + 2] += L.vel[j * 3 + 2] * dt;
    }
    if (any) this.leaves.geometry.attributes.position.needsUpdate = true;
    this._hider(m, dt);
  }

  /* the hider: nothing, a faint silhouette in a lantern, or the reveal (pops out, waves or cheers) */
  _hider(m, dt) {
    const h = this.hider, mat = h.material, T = this.T;
    let want = 0, cell = 0, rise = 1, pop = 1;
    if (m.phase === 'reveal') {
      const p = this.world.place(m.hider.place), s = toScene(m.hider.x, m.hider.z);
      const out = (p ? p.r + 1.4 : 0.8);
      h.position.set(s.x, 0, s.z + out);
      want = 1; mat.color.set(col('earth.snow'));
      const k = m.t;
      rise = backOut(k / 0.45); pop = REVEAL_SCALE * (0.6 + 0.4 * Math.min(1, ease(k / 0.35)));
      cell = m.result === 'hidden' ? 3 : (Math.floor(this.t * 6) % 2 ? 2 : 1);
      const hop = m.result === 'hidden' ? Math.abs(Math.sin(k * 7)) * 0.8 * Math.min(1, k) : 0;
      h.position.y = -(1 - Math.min(1.1, rise)) * HIDER_HEIGHT * REVEAL_SCALE * 0.9 + hop;
      h.scale.set(pop, pop, 1);
      this.hblob.visible = true; const q = this.hblob.position; q.x = s.x + 0.15; q.z = s.z + out - 0.1;
    } else {
      this.hblob.visible = false;
      const s = toScene(m.hider.x, m.hider.z);
      h.position.set(s.x, 0, s.z); h.scale.set(1, 1, 1);
      mat.color.set(col('shade.mid'));
      want = m.phase === 'seek' && m.lit ? 0.22 + 0.6 * m.meter : 0; cell = 0;
    }
    mat.opacity += (want - mat.opacity) * Math.min(1, dt * (want ? 10 : 8));
    if (m.phase === 'reveal') mat.opacity = Math.min(1, mat.opacity + dt * 4);
    h.visible = mat.opacity > 0.01;
    this.cardTex.offset.x = cell / CARD.length;
  }

  render() {
    if (!glCanvas || !R) return;
    lastDraw = performance.now(); glCanvas.style.display = 'block';
    const w = glCanvas.clientWidth, h = glCanvas.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (this._w !== w || this._h !== h) { this._w = w; this._h = h; R.setPixelRatio(dpr); R.setSize(w, h, false); this.cam.aspect = w / h; this.cam.updateProjectionMatrix(); }
    R.render(this.scene, this.cam);
  }

  dispose() {
    this.ready = false;
    this.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      const ms = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
      for (const mt of ms) { if (mt.map) mt.map.dispose(); mt.dispose(); }
    });
    for (const L of this.lanterns) if (L.tex) L.tex.dispose();
  }
}

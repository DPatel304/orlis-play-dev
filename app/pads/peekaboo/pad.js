/* Peekaboo Garden: the hider's tablet (plan package K5). Spec: docs/specs/peekaboo-views.md, "The tablet view"; mockup: docs/games/peekaboo-hider.html.
   A plain ES module the hub serves at /pads/peekaboo/pad.js; the pad page calls the default export with the pad API (docs/specs/pad-protocol.md)
   and, in api.kit, three.js, the palette, the painted pieces, the garden's world and the rules' numbers (app/pad/kit.js).

   What it does: draws the garden in 3D from a guided camera behind and a little beside the hider; the hider is their own block-limb character on a
   painted card that flips when turning; a stick (bottom-left) moves the hider at once with the same rules as the host (host = truth, we ease to it);
   in a pot a big "Step out" button; HUD: sun ring, three leaves, glowing screen edges when a lantern is close. */
export default async function start(api) {
  const kit = api.kit;
  if (!kit || !kit.garden) throw new Error('no kit: this pad page is too old for Peekaboo');
  const G = kit.garden;
  const T = await kit.loadThree();
  const world = G.createWorld();
  const col = kit.color;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const damp = (dt, rate) => 1 - Math.exp(-dt * rate);
  const hash = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };   /* the same "random" every time */
  const root = api.root;

  /* ------------------------------------------------------------------ the page: canvas, HUD, stick, button ------------------------------------------------------------------ */
  const css = document.createElement('style');
  css.textContent = `
.pk{ position:absolute; inset:0; overflow:hidden; touch-action:none; background:${col('sky.horizon')}; font-family:var(--display,system-ui); color:${col('shade.ink')}; -webkit-user-select:none; user-select:none }
.pk canvas.pk-gl{ position:absolute; inset:0; width:100%; height:100%; display:block }
.pk-glow{ position:absolute; inset:0; pointer-events:none; opacity:0; box-shadow:inset 0 0 14vmin 2vmin rgba(255,214,120,.75) }
.pk-glow i{ position:absolute; inset:0; background:radial-gradient(circle at var(--gx,50%) var(--gy,100%), rgba(255,226,150,.85) 0, rgba(255,226,150,0) 42vmin) }
.pk-ring{ position:absolute; left:3vw; top:4vh; width:12vh; height:12vh; pointer-events:none }
.pk-ring svg{ width:100%; height:100%; overflow:visible }
.pk-ring .bg{ fill:${col('shade.card')}; stroke:${col('shade.line')}; stroke-width:6 }
.pk-ring .fg{ fill:none; stroke:${col('ui.gold')}; stroke-width:6; stroke-linecap:round; transform:rotate(-90deg); transform-origin:20px 20px }
.pk-ring .sun{ fill:${col('ui.gold')}; stroke:${col('shade.ink')}; stroke-width:1.2 }
.pk-leaves{ position:absolute; right:3vw; top:4vh; display:flex; gap:1.4vh; padding:1.4vh 2.4vh; border-radius:999px; background:${col('shade.card')}; border:.5vh solid ${col('shade.ink')}; box-shadow:0 .8vh 0 rgba(52,40,96,.18); pointer-events:none }
.pk-leaves i{ width:5vh; height:5vh; border-radius:0 4vh; background:${col('meadow.fresh')}; transition:background .35s, transform .35s }
.pk-leaves i.off{ background:#e2dccd; transform:scale(.82) }
.pk-banner,.pk-result{ position:absolute; left:50%; transform:translateX(-50%); pointer-events:none; text-align:center; font-weight:600; white-space:nowrap; opacity:0; transition:opacity .3s }
.pk-banner{ top:5vh; padding:1.2vh 5vh; background:${col('shade.card')}; border:.5vh solid ${col('shade.ink')}; border-radius:999px; font-size:6.4vh; box-shadow:0 .8vh 0 rgba(52,40,96,.18) }
.pk-result{ top:12vh; padding:2vh 6vh; background:${col('shade.card')}; border:.6vh solid ${col('shade.ink')}; border-radius:4vh; font-size:8vh; box-shadow:0 1vh 0 rgba(52,40,96,.18) }
.pk-result.gold{ background:#fff6d8 }
.pk-result svg{ width:7vh; height:7vh; vertical-align:-1vh; margin-left:1.5vh }
.pk-on{ opacity:1 }
.pk-zone{ position:absolute; left:0; bottom:0; width:46%; height:68%; touch-action:none }
.pk-base{ position:absolute; left:5vw; bottom:7vh; width:30vh; height:30vh; border-radius:50%; background:rgba(255,253,248,.38); border:.7vh solid rgba(255,253,248,.92); box-shadow:0 .8vh 0 rgba(52,40,96,.12) }
.pk-knob{ position:absolute; left:50%; top:50%; width:13.5vh; height:13.5vh; margin:-6.75vh 0 0 -6.75vh; border-radius:50%; background:${col('shade.card')}; box-shadow:0 .9vh 0 rgba(52,40,96,.22); will-change:transform }
.pk-base.dim{ opacity:.45 }
.pk-out{ position:absolute; right:5vw; bottom:9vh; width:26vh; height:26vh; border-radius:50%; background:${col('ui.go')}; color:#fff; border:.7vh solid ${col('shade.card')}; box-shadow:0 1vh 0 rgba(52,40,96,.28); font:600 4.4vh/1.05 var(--display,system-ui); display:none; flex-direction:column; align-items:center; justify-content:center; gap:.6vh; touch-action:none; -webkit-tap-highlight-color:transparent }
.pk-out.show{ display:flex; animation:pk-pop .35s cubic-bezier(.2,.8,.25,1) }
.pk-out:active{ transform:translateY(.6vh); box-shadow:0 .3vh 0 rgba(52,40,96,.28) }
.pk-out svg{ width:9vh; height:9vh }
.pk-pause{ position:absolute; inset:0; background:rgba(47,43,69,.45); display:none; align-items:center; justify-content:center; gap:3vh }
.pk-pause.on{ display:flex }
.pk-pause i{ width:5vh; height:5vh; border-radius:50%; background:${col('shade.card')}; animation:pk-dot 1.2s infinite ease-in-out }
.pk-pause i:nth-child(2){ animation-delay:.2s } .pk-pause i:nth-child(3){ animation-delay:.4s }
@keyframes pk-pop{ from{ transform:scale(.6); opacity:0 } to{ transform:none; opacity:1 } }
@keyframes pk-dot{ 0%,80%,100%{ transform:scale(.5); opacity:.5 } 40%{ transform:scale(1); opacity:1 } }
`;
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; };
  const ui = el('div', 'pk');
  const cv = el('canvas', 'pk-gl');
  const glow = el('div', 'pk-glow', '<i></i>');
  const ring = el('div', 'pk-ring', '<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="16" class="bg"/><circle cx="20" cy="20" r="16" class="fg" stroke-dasharray="0 101"/><circle class="sun" cx="20" cy="4" r="3.4"/></svg>');
  const ringFg = ring.querySelector('.fg'), ringSun = ring.querySelector('.sun');
  const leaves = el('div', 'pk-leaves', '<i></i><i></i><i></i>');
  const banner = el('div', 'pk-banner'), result = el('div', 'pk-result');
  const zone = el('div', 'pk-zone'), base = el('div', 'pk-base'), knob = el('div', 'pk-knob');
  base.append(knob); zone.append(base);
  const outBtn = el('button', 'pk-out', '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M5 11l7-7 7 7"/></svg><span>Step out</span>');
  outBtn.type = 'button';
  const pause = el('div', 'pk-pause on', '<i></i><i></i><i></i>'); pause.classList.remove('on');
  ui.append(cv, glow, ring, leaves, banner, result, zone, outBtn, pause);
  root.replaceChildren(css, ui);
  root.style.touchAction = 'none';
  const leafEls = [...leaves.children];

  /* ------------------------------------------------------------------ three.js: renderer, scene, camera ------------------------------------------------------------------ */
  const renderer = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  const scene = new T.Scene();
  scene.fog = new T.Fog(new T.Color(col('sky.horizon')), 16, 62);
  const camera = new T.PerspectiveCamera(48, 1.6, 0.3, 220);
  let W = 0, H = 0;
  function resize() {
    const w = Math.max(2, ui.clientWidth), h = Math.max(2, ui.clientHeight);
    if (w === W && h === H) return;
    W = w; H = h; renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.fov = w / h < 1.3 ? 62 : 48; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);

  /* the painted sky (a gradient the shell cannot show through, so it is a texture) */
  {
    const c = document.createElement('canvas'); c.width = 8; c.height = 256;
    const x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, col('sky.high')); g.addColorStop(0.22, col('sky.mid')); g.addColorStop(0.4, col('sky.low')); g.addColorStop(0.52, col('sky.horizon')); g.addColorStop(1, col('sky.horizon'));
    x.fillStyle = g; x.fillRect(0, 0, 8, 256);
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; scene.background = t;
  }
  /* light: a soft sky/ground wash and one warm sun from the TV's side; toon steps give the painted, shaded look */
  scene.add(new T.HemisphereLight(new T.Color(col('sky.low')), new T.Color(col('shade.light')), 1.5));
  const sun = new T.DirectionalLight(new T.Color(col('sky.sun')), 2.2); sun.position.set(-6, 10, -5); scene.add(sun);
  const steps = new T.DataTexture(new Uint8Array([120, 195, 255]), 3, 1, T.RedFormat); steps.minFilter = steps.magFilter = T.NearestFilter; steps.needsUpdate = true;
  const toon = () => new T.MeshToonMaterial({ vertexColors: true, gradientMap: steps, side: T.DoubleSide });
  const inkMat = new T.MeshBasicMaterial({ color: new T.Color(col('shade.ink')), side: T.BackSide });

  /* ------------------------------------------------------------------ the garden (from world.js) ------------------------------------------------------------------ */
  const SZ = G.SIZE;
  const tint = (geom, name, tone) => {        /* paint a piece one palette colour (vertex colours, so a whole place is one draw call) */
    const c = new T.Color(col(name, tone)), n = geom.attributes.position.count, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geom.setAttribute('color', new T.BufferAttribute(a, 3)); return geom;
  };
  const sph = (r, x, y, z, name, tone, sy = 1) => { const g = new T.SphereGeometry(r, 10, 7); g.scale(1, sy, 1); g.translate(x, y, z); return tint(g, name, tone); };
  const merge = (list) => T.mergeGeometries(list, false);
  const place = (geom, outline = 1.06) => {
    const grp = new T.Group(), mat = toon(), m = new T.Mesh(geom, mat); grp.add(m);
    let o = null; if (outline) { o = new T.Mesh(geom, inkMat); o.scale.set(outline, outline, outline); grp.add(o); }
    return { grp, mat, body: m, outline: o };
  };

  /* the lawn: one painted texture for the ground (grass, the sandy path, little flowers) */
  {
    const S = 1024, c = document.createElement('canvas'); c.width = c.height = S;
    const x = c.getContext('2d'), k = S / SZ;
    x.fillStyle = col('meadow.grass'); x.fillRect(0, 0, S, S);
    for (let i = 0; i < 90; i++) {                 /* mottled light and dark patches */
      x.fillStyle = i % 2 ? col('meadow.soft') : col('meadow.lawn'); x.globalAlpha = 0.28;
      x.beginPath(); x.ellipse(hash(i) * S, hash(i + 200) * S, (1.2 + hash(i + 400) * 2.4) * k, (0.8 + hash(i + 600) * 1.6) * k, hash(i + 800) * 3, 0, 7); x.fill();
    }
    x.globalAlpha = 1;
    /* the path: from the start in the front, curving to the shed */
    x.strokeStyle = col('earth.path'); x.lineCap = 'round'; x.lineWidth = 2.3 * k;
    x.beginPath(); x.moveTo(15 * k, -1 * k); x.bezierCurveTo(15 * k, 7 * k, 11 * k, 9 * k, 14 * k, 14 * k); x.bezierCurveTo(16 * k, 18 * k, 14 * k, 19 * k, 15 * k, 22 * k); x.stroke();
    x.strokeStyle = col('earth.sand'); x.globalAlpha = 0.35; x.lineWidth = 0.35 * k; x.stroke(); x.globalAlpha = 1;
    const dots = ['touch.sunflower', 'ui.gold', 'touch.bubblegum', 'earth.snow'];
    for (let i = 0; i < 110; i++) {                /* flowers: a dot with a lighter middle */
      const fx = hash(i + 1000) * S, fy = hash(i + 2000) * S, r = (0.09 + hash(i + 3000) * 0.07) * k;
      x.fillStyle = col(dots[i % 4]); x.beginPath(); x.arc(fx, fy, r, 0, 7); x.fill();
      x.fillStyle = col('earth.snow'); x.beginPath(); x.arc(fx, fy, r * 0.4, 0, 7); x.fill();
    }
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    const lawn = new T.Mesh(new T.PlaneGeometry(SZ, SZ), new T.MeshBasicMaterial({ map: tex }));
    lawn.rotation.x = -Math.PI / 2; lawn.position.set(SZ / 2, 0, SZ / 2); scene.add(lawn);
    const far = new T.Mesh(new T.PlaneGeometry(500, 500), new T.MeshBasicMaterial({ color: new T.Color(col('meadow.far')) }));
    far.rotation.x = -Math.PI / 2; far.position.set(SZ / 2, -0.02, SZ / 2); scene.add(far);
  }

  /* the hedge: a ring of round leafy blobs, low enough to see over */
  {
    const parts = [], lo = world.hedge.min - 0.28, hi = world.hedge.max + 0.28; let n = 0;
    for (let t = lo; t <= hi + 0.01; t += 1.05) for (const [x, z] of [[t, lo], [t, hi], [lo, t], [hi, t]]) {
      parts.push(sph(0.78 + hash(n) * 0.12, x, 0.5, z, n++ % 2 ? 'meadow.leaf' : 'meadow.deep', null, 0.9));
    }
    const h = place(merge(parts), 1.04); scene.add(h.grp);
  }

  /* trees (trunk + painted-leaf crown), the shed, and the hiding places */
  const blockers = [];              /* trees and the shed: they turn see-through when they stand between the camera and the hider */
  for (const t of world.trees) {
    const trunk = new T.CylinderGeometry(t.r * 0.4, t.r * 0.55, 2.2, 8); trunk.translate(0, 1.1, 0);
    const p = place(merge([tint(trunk, 'earth.bark'), sph(1.15, 0, 3.0, 0, 'meadow.fresh'), sph(0.85, 0.7, 2.6, 0.2, 'meadow.leaf'), sph(0.85, -0.65, 2.65, -0.2, 'meadow.leaf'), sph(0.7, 0.1, 3.8, 0.1, 'meadow.fresh')]), 1.04);
    p.grp.position.set(t.x, 0, t.z); scene.add(p.grp); blockers.push({ ...p, x: t.x, z: t.z, r: 1.5, faded: false });
  }
  {
    const s = world.shed, w = s.x1 - s.x0, d = s.z1 - s.z0, h = 2.6;
    const wall = new T.BoxGeometry(w, h, d); wall.translate(0, h / 2, 0);
    const roof = new T.ConeGeometry(0.5, 1.6, 4, 1); roof.rotateY(Math.PI / 4); roof.scale(w * 1.55, 1, d * 1.55); roof.translate(0, h + 0.8, 0);
    const door = new T.BoxGeometry(1.5, 1.9, 0.1); door.translate(0, 0.95, -d / 2 - 0.04);
    const p = place(merge([tint(wall, 'earth.brick'), tint(roof, 'earth.plumRoof'), tint(door, 'shade.card')]), 1.02);
    p.grp.position.set((s.x0 + s.x1) / 2, 0, (s.z0 + s.z1) / 2); scene.add(p.grp); blockers.push({ ...p, x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2, r: 3.6, faded: false });
  }

  const spots = {};                 /* id -> { grp, mat, outline, kind, x, z, r, shake } */
  for (const pl of world.places) {
    let geom, outline = 1.06;
    if (pl.kind === 'bush') {
      const r = pl.r, list = [sph(r * 0.66, 0, r * 0.52, 0, 'meadow.fresh', null, 0.95), sph(r * 0.5, r * 0.55, r * 0.36, r * 0.2, 'meadow.leaf'), sph(r * 0.5, -r * 0.55, r * 0.36, r * 0.15, 'meadow.leaf'),
        sph(r * 0.48, r * 0.1, r * 0.4, -r * 0.55, 'meadow.fresh', 'shade'), sph(r * 0.45, -r * 0.2, r * 0.4, r * 0.55, 'meadow.fresh'), sph(r * 0.42, 0.05, r * 0.95, 0, 'meadow.leaf')];
      geom = merge(list);
    } else if (pl.kind === 'grass') {
      const list = []; const disc = new T.CircleGeometry(pl.r, 16); disc.rotateX(-Math.PI / 2); disc.translate(0, 0.03, 0); list.push(tint(disc, 'meadow.deep'));
      for (let i = 0; i < 22; i++) {
        const a = hash(i + pl.x) * 6.283, rr = Math.sqrt(hash(i + 40 + pl.z)) * (pl.r - 0.15), hgt = 0.7 + hash(i + 80) * 0.5;
        const blade = new T.ConeGeometry(0.16, hgt, 4, 1); blade.translate(Math.cos(a) * rr, hgt / 2, Math.sin(a) * rr);
        list.push(tint(blade, i % 3 === 0 ? 'meadow.leaf' : i % 3 === 1 ? 'meadow.fresh' : 'meadow.lawn'));
      }
      geom = merge(list); outline = 0;
    } else {                                        /* pot: a clay flowerpot, open at the top */
      const prof = [[0, 0], [0.42, 0], [0.55, 0.15], [0.66, 0.85], [0.78, 0.9], [0.78, 1.08], [0.66, 1.08], [0.6, 0.95], [0.0, 0.95]].map(([x, y]) => new T.Vector3(x, y, 0));
      const body = new T.LatheGeometry(prof.map(v => ({ x: v.x, y: v.y * 0.78 })), 14);
      const soil = new T.CircleGeometry(0.6, 12); soil.rotateX(-Math.PI / 2); soil.translate(0, 0.74, 0);
      geom = merge([tint(body, 'earth.clay'), tint(soil, 'earth.bark', 'shade')]);
      outline = 1.06;
    }
    const p = place(geom, outline); p.grp.position.set(pl.x, 0, pl.z); scene.add(p.grp);
    spots[pl.id] = { ...p, kind: pl.kind, x: pl.x, z: pl.z, r: pl.r, shake: 0, faded: false };
  }

  /* far trees: painted cutouts outside the hedge (one texture, flat planes that turn to face the camera) */
  const farTrees = [];
  {
    const c = document.createElement('canvas'); c.width = 256; c.height = 300;
    const x = c.getContext('2d'); kit.assets.draw(x, 'tree', 128, 150, 290);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    const mat = new T.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.05, side: T.DoubleSide });
    const geomT = new T.PlaneGeometry(1, 300 / 256);
    const at = [];
    for (let x2 = -16; x2 <= 46; x2 += 6.5) at.push([x2 + hash(x2 + 9) * 2, 40 + hash(x2) * 7, 8 + hash(x2 + 3) * 3]);
    for (let z = 3; z <= 34; z += 7) { at.push([-9 - hash(z) * 4, z, 8 + hash(z + 1) * 3]); at.push([39 + hash(z + 2) * 4, z, 8 + hash(z + 3) * 3]); }
    for (let i = 0; i < 6; i++) at.push([-12 + i * 10 + hash(i) * 4, -9 - hash(i + 5) * 3, 8 + hash(i + 7) * 2]);   /* (behind the TV side: seen when walking toward it) */
    for (const [tx, tz, s] of at) {
      const m = new T.Mesh(geomT, mat); m.scale.set(s * 0.8, s * 0.8, s * 0.8); m.position.set(tx, s * 0.8 * 300 / 256 / 2 - 0.2, tz); scene.add(m); farTrees.push(m);
    }
  }

  /* the lanterns as warm pools of light on the lawn */
  const pools = [];
  {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,244,190,.95)'); g.addColorStop(0.5, 'rgba(255,236,170,.6)'); g.addColorStop(0.78, 'rgba(255,230,160,.25)'); g.addColorStop(1, 'rgba(255,230,160,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace;
    const geomP = new T.PlaneGeometry(1, 1); geomP.rotateX(-Math.PI / 2);
    for (let i = 0; i < 4; i++) {
      const m = new T.Mesh(geomP, new T.MeshBasicMaterial({ map: tex, transparent: true, blending: T.AdditiveBlending, depthWrite: false, fog: false, opacity: 0 }));
      m.scale.set(G.LIGHT_RADIUS * 2.6, 1, G.LIGHT_RADIUS * 2.6); m.position.y = 0.06; m.visible = false; m.renderOrder = 0; scene.add(m);
      pools.push({ mesh: m, seat: null, x: 0, z: 0, a: 0, want: 0 });
    }
  }

  /* ------------------------------------------------------------------ the hider: a painted card ------------------------------------------------------------------ */
  const atlas = kit.character(api.who && api.who.avatar);
  const atex = new T.CanvasTexture(atlas.canvas); atex.colorSpace = T.SRGBColorSpace; atex.minFilter = T.LinearFilter; atex.generateMipmaps = false;
  atex.repeat.set(1 / atlas.cols, 1 / atlas.rows);
  const HIDER_H = 1.4, CARD = HIDER_H * atlas.cell / atlas.S;          /* the card's side, so the character is HIDER_H steps tall */
  const cardGeom = new T.PlaneGeometry(CARD, CARD); cardGeom.translate(0, CARD * (0.5 - (1 - atlas.base)), 0);   /* feet on the ground */
  const cardMat = new T.MeshBasicMaterial({ map: atex, transparent: true, alphaTest: 0.02, side: T.DoubleSide, fog: false });
  const card = new T.Mesh(cardGeom, cardMat); card.renderOrder = 1; scene.add(card);
  const showCell = (n) => { atex.offset.set((n % atlas.cols) / atlas.cols, 1 - (Math.floor(n / atlas.cols) + 1) / atlas.rows); };

  /* the card's own little state: which side shows, which way it is mirrored, and the flip between */
  const cs = { face: 'back', mir: 1, flip: null, since: 9, clock: 0, dur: 0.26 }, want = { face: 'back', mir: 1 };
  function tickCard(dt) {
    cs.since += dt;
    if (!cs.flip && cs.since > 0.28 && (cs.face !== want.face || cs.mir !== want.mir)) cs.flip = { p: 0, from: cs.mir, swapped: false };
    let sx = cs.mir;
    if (cs.flip) {
      const f = cs.flip; f.p = Math.min(1, f.p + dt / cs.dur);
      if (f.p >= 0.5 && !f.swapped) { cs.face = want.face; cs.mir = want.mir; f.swapped = true; }
      const v = f.p < 0.5 ? f.from * (1 - 2 * f.p) : cs.mir * (2 * f.p - 1);       /* squash to a sliver, then open the other way */
      sx = (v < 0 ? -1 : 1) * Math.max(0.07, Math.abs(v));
      if (f.p >= 1) { cs.flip = null; cs.since = 0; sx = cs.mir; }
    }
    card.scale.x = sx;
  }
  function pickFrame(dt, mode) {                       /* mode: 'stand' | 'march' | 'run' | 'cheer' | 'wave' */
    const F = atlas.frames[cs.face] || atlas.frames.back;
    if (mode === 'stand' || !F[mode]) return F.stand;
    if (mode === 'cheer') return F.cheer;
    cs.clock += dt * (mode === 'run' ? 8 : mode === 'wave' ? 4 : 5.5);
    return F[mode][Math.floor(cs.clock) % F[mode].length];
  }

  /* ------------------------------------------------------------------ the state: me (predicted), the host (truth), the input ------------------------------------------------------------------ */
  const me = { x: world.start.x, z: world.start.z, place: null, moving: false, mag: 0 };
  const vis = { x: me.x, z: me.z };                    /* what is drawn (eases to me; in a pot it eases to the pot's middle) */
  const net = { phase: 'hide', clock: 0, leaves: 1, near: 1, meter: 0, host: { x: me.x, z: me.z, place: null }, lanterns: [], seen: false, graceUntil: 0, outTries: 0, outAt: 0, result: null, paused: false };
  const input = { x: 0, y: 0, held: false, id: null, sent: '0,0' };
  let now = 0, stopped = false, raf = 0;

  const kindOf = (id) => (id && world.place(id) ? world.place(id).kind : 'open');
  const inPot = () => !!me.place && kindOf(me.place) === 'pot';
  const playing = () => (net.phase === 'hide' || net.phase === 'seek') && !net.paused;

  /* the same rules as the host (rules.js, move): dead zone, speed, hedge/shed/trunks, entering places, a pot holds you until "Step out" */
  function moveMe(dt) {
    me.moving = false; me.mag = 0;
    if (!playing() || inPot()) return;
    let sx = input.x, sy = input.y; const mag = Math.hypot(sx, sy);
    if (mag < G.DEAD_ZONE) return;
    if (mag > 1) { sx /= mag; sy /= mag; }
    const q = world.clamp(me.x + sx * G.SPEED * dt, me.z + sy * G.SPEED * dt);
    me.x = q.x; me.z = q.z; me.moving = true; me.mag = Math.min(1, mag);
    const p = world.placeAt(me.x, me.z); me.place = p ? p.id : null;
  }
  function stepOut() {
    if (!inPot() || !playing()) return;
    const p = world.place(me.place), q = world.clamp(p.x, p.z - p.r - 0.05);
    me.x = q.x; me.z = q.z; me.place = null; net.graceUntil = now + 0.7; net.outTries = 6; net.outAt = now + 0.25;
    api.send({ act: 'out' });
  }

  /* a state from the host (15 to 20 a second) */
  function onState(s) {
    if (!s || !s.hider) return;
    const was = net.phase;
    net.phase = s.phase; net.clock = s.clock || 0; net.leaves = s.leaves | 0; net.near = s.near == null ? 1 : s.near; net.meter = s.meter || 0;
    net.host = s.hider; net.lanterns = Array.isArray(s.lanterns) ? s.lanterns : [];
    if (s.rustles) for (const id of s.rustles) rustle(id, false);
    if (!net.seen || was !== s.phase) {               /* the first state, or a new phase: take the host's word at once */
      if (!net.seen || s.phase === 'hide') { me.x = s.hider.x; me.z = s.hider.z; me.place = s.hider.place || null; vis.x = me.x; vis.z = me.z; }
      net.seen = true; phaseChanged(s.phase);
    }
    if (net.outTries > 0 && !(kindOf(s.hider.place) === 'pot')) net.outTries = 0;   /* the host has let us out */
    paintHud();
  }

  /* host truth: ease toward it (never while a fresh "Step out" is in flight; a long way off = take its word) */
  function reconcile(dt) {
    if (!net.seen || now < net.graceUntil) return;
    const h = net.host, ex = h.x - me.x, ez = h.z - me.z, err = Math.hypot(ex, ez);
    if (kindOf(h.place) === 'pot' && me.place !== h.place) { me.x = h.x; me.z = h.z; me.place = h.place; me.moving = false; return; }   /* the host says we are in a pot: so we are */
    const k = err > 2.5 ? damp(dt, 9) : !me.moving ? damp(dt, 6) : 0;
    if (k) { me.x += ex * k; me.z += ez * k; }
    if (!me.moving && err < 0.1) me.place = h.place || null;
  }

  /* ------------------------------------------------------------------ events, sounds ------------------------------------------------------------------ */
  let ac = null, noiseBuf = null;
  function audio() {
    if (!ac) { try { const A = window.AudioContext || window.webkitAudioContext; ac = A ? new A() : null; } catch { ac = null; } }
    if (ac && ac.state === 'suspended') ac.resume().catch(() => {});
    return ac;
  }
  function puff(vol, ms, lo, hi) {                      /* a soft burst of noise: a footstep or a rustle */
    const a = ac; if (!a || a.state !== 'running') return;
    if (!noiseBuf) { noiseBuf = a.createBuffer(1, a.sampleRate * 0.5, a.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
    const src = a.createBufferSource(); src.buffer = noiseBuf;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = (lo + hi) / 2; f.Q.value = 0.7;
    const g = a.createGain(); g.gain.setValueAtTime(vol, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0008, a.currentTime + ms / 1000);
    src.connect(f); f.connect(g); g.connect(a.destination); src.start(); src.stop(a.currentTime + ms / 1000 + 0.05);
  }
  const lastRustle = {};
  function rustle(id, sound) {
    const s = spots[id]; if (!s || now - (lastRustle[id] || -9) < 0.3) return;
    lastRustle[id] = now; s.shake = 1; if (sound) puff(0.07, 380, 1800, 5000);
  }
  api.onEvent((e) => {
    if (!e) return;
    switch (e.e) {
      case 'rustle': rustle(e.placeId, true); break;
      case 'found': net.result = 'found'; showResult(); break;
      case 'hidden': net.result = 'hidden'; showResult(); break;
      case 'pause': net.paused = true; pause.classList.add('on'); releaseStick(); break;
      case 'resume': net.paused = false; pause.classList.remove('on'); break;
      case 'phase': if (e.name && e.name !== net.phase) { net.phase = e.name; phaseChanged(e.name); } break;
      default: break;
    }
  });

  /* ------------------------------------------------------------------ the HUD ------------------------------------------------------------------ */
  let bannerTimer = 0;
  function say(text, ms) { banner.textContent = text; banner.classList.add('pk-on'); clearTimeout(bannerTimer); bannerTimer = setTimeout(() => banner.classList.remove('pk-on'), ms); }
  const STAR = '<svg viewBox="0 0 24 24"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.5 7-6.3-3.6-6.3 3.6 1.5-7L2 9.3l7-.8z" fill="#f5c542" stroke="#2f2b45" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  function showResult() {
    const found = net.result === 'found' || (net.result == null && net.meter >= 0.999);
    result.className = 'pk-result pk-on' + (found ? '' : ' gold');
    result.innerHTML = found ? 'They found you!' : 'You stayed hidden!' + STAR;
    banner.classList.remove('pk-on');
  }
  function phaseChanged(name) {
    result.classList.remove('pk-on');
    if (name === 'hide') { net.result = null; want.face = 'back'; say('Hide!', 2400); }
    else if (name === 'seek') say("They're looking!", 2600);
    else if (name === 'reveal') showResult();
    paintHud();
  }
  let hudKey = '';
  function paintHud() {
    leafEls.forEach((e, i) => e.classList.toggle('off', i >= net.leaves));
    const frac = net.phase === 'seek' ? 1 - net.clock : net.phase === 'hide' ? net.clock : 0;
    const key = net.phase + Math.round(frac * 200); if (key === hudKey) return; hudKey = key;
    ringFg.setAttribute('stroke-dasharray', (frac * 100.5).toFixed(1) + ' 101');
    const a = frac * Math.PI * 2;
    ringSun.setAttribute('cx', (20 + 16 * Math.sin(a)).toFixed(2)); ringSun.setAttribute('cy', (20 - 16 * Math.cos(a)).toFixed(2));
  }
  let glowNow = 0;
  const gv = new T.Vector3();
  function paintGlow(dt) {
    let want = 0, gx = 50, gy = 100;
    if (net.phase === 'seek' && net.lanterns.length) {
      want = Math.pow(1 - clamp(net.near, 0, 1), 0.8) * 1.25 + (net.meter > 0 ? 0.15 : 0);
      let best = null, bd = 1e9;
      for (const l of net.lanterns) { const d = Math.hypot(l.x - me.x, l.z - me.z); if (d < bd) { bd = d; best = l; } }
      if (best) {                                     /* which edge: where the lantern is on the screen */
        gv.set(best.x, 0, best.z).applyMatrix4(camera.matrixWorldInverse);
        let nx, ny;
        if (gv.z > -0.3) { nx = gv.x >= 0 ? 0.9 : -0.9; ny = -1.2; }
        else { gv.set(best.x, 0, best.z).project(camera); nx = gv.x; ny = gv.y; }
        const m = Math.max(Math.abs(nx), Math.abs(ny), 1e-3); nx /= m; ny /= m;
        gx = (nx * 0.5 + 0.5) * 100; gy = (0.5 - ny * 0.5) * 100;
      }
    }
    glowNow = lerp(glowNow, clamp(want, 0, 1), damp(dt, want > glowNow ? 7 : 3));
    if (glowNow < 0.01) { if (glow.style.opacity !== '0') glow.style.opacity = '0'; return; }
    glow.style.opacity = glowNow.toFixed(3);
    glow.style.setProperty('--gx', gx.toFixed(0) + '%'); glow.style.setProperty('--gy', gy.toFixed(0) + '%');
  }

  /* ------------------------------------------------------------------ the stick and the button ------------------------------------------------------------------ */
  let baseBox = null, sendTimer = 0;
  const R = () => baseBox.width / 2;
  function stickAt(e) {
    const r = R(), cx = baseBox.left + r, cy = baseBox.top + r;
    let dx = (e.clientX - cx) / r, dy = (e.clientY - cy) / r; const len = Math.hypot(dx, dy);
    if (len > 1) { dx /= len; dy /= len; }
    input.x = dx; input.y = -dy;                      /* up = away from the TV (rules: y > 0) */
    knob.style.transform = `translate(${(dx * r * 0.62).toFixed(1)}px,${(dy * r * 0.62).toFixed(1)}px)`;
  }
  function pushStick(force) {
    const x = Math.round(input.x * 100) / 100, y = Math.round(input.y * 100) / 100, k = x + ',' + y;
    if (!force && !input.held && k === input.sent) return;
    input.sent = k; api.send({ stick: { x, y } });
  }
  function releaseStick() {
    if (!input.held && input.x === 0 && input.y === 0) return;
    input.held = false; input.id = null; input.x = input.y = 0; knob.style.transform = '';
    clearInterval(sendTimer); sendTimer = 0;
    pushStick(true); setTimeout(() => { if (!input.held) pushStick(true); }, 160);   /* (twice: a lost stop would walk the hider on) */
  }
  zone.addEventListener('pointerdown', (e) => {
    if (input.held || net.paused) return;
    audio(); baseBox = base.getBoundingClientRect();
    input.held = true; input.id = e.pointerId; try { zone.setPointerCapture(e.pointerId); } catch { /* fine */ }
    stickAt(e); pushStick(true);
    clearInterval(sendTimer); sendTimer = setInterval(() => pushStick(true), 50);    /* about 20 a second while held */
    e.preventDefault();
  });
  zone.addEventListener('pointermove', (e) => { if (input.held && e.pointerId === input.id) stickAt(e); });
  const up = (e) => { if (input.held && e.pointerId === input.id) releaseStick(); };
  zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up); zone.addEventListener('lostpointercapture', up);
  outBtn.addEventListener('pointerdown', (e) => { audio(); stepOut(); e.preventDefault(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseStick(); });

  /* ------------------------------------------------------------------ the frame ------------------------------------------------------------------ */
  const cam = { x: me.x + 1.2, z: me.z - 4.6, fx: me.x, fz: me.z, dx: 0, dz: 1 };
  const CAM = { back: 4.7, up: 2.9, side: 1.2, ahead: 6.5, eye: 0.9 };
  /* is this thing on the line from the camera to the hider (so it would hide them)? */
  function between(o, r) {
    const cx = camera.position.x, cz = camera.position.z, dx = vis.x - cx, dz = vis.z - cz, L2 = dx * dx + dz * dz || 1;
    const u = clamp(((o.x - cx) * dx + (o.z - cz) * dz) / L2, 0, 1);
    return u < 0.97 && Math.hypot(cx + dx * u - o.x, cz + dz * u - o.z) < r;
  }
  function fadeTo(s, fade, alpha) {
    if (fade === s.faded) return;
    s.faded = fade; s.mat.transparent = fade; s.mat.opacity = fade ? alpha : 1; s.mat.depthWrite = !fade; s.mat.needsUpdate = true;
    if (s.outline) s.outline.visible = !fade; s.body.renderOrder = fade ? 2 : 0;
  }
  let stride = 0, lastCell = -1;
  function frame(t) {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(handle.maxDt, Math.max(0.001, (t - (frame.last || t)) / 1000)); frame.last = t; now += dt;
    resize();

    moveMe(dt); reconcile(dt);
    if (net.outTries > 0 && now > net.outAt && net.seen) { net.outTries--; net.outAt = now + 0.25; api.send({ act: 'out' }); }   /* (if the host missed it) */

    /* where the card is drawn: eased; inside a pot it settles in the middle of the pot */
    let tx = me.x, tz = me.z;
    if (inPot()) { const p = world.place(me.place); tx = p.x; tz = p.z; }
    const kv = damp(dt, inPot() ? 7 : 22); vis.x += (tx - vis.x) * kv; vis.z += (tz - vis.z) * kv;
    const sp = spots[me.place || ''];

    /* the guided camera: behind and a little beside, a little above; it trails the hider and swings round as they turn */
    const kf = damp(dt, 3.2); cam.fx += (vis.x - cam.fx) * kf; cam.fz += (vis.z - cam.fz) * damp(dt, 4.5);
    const wx = me.moving ? input.x : 0, wz = me.moving ? input.y : 0, wl = Math.hypot(wx, wz) || 1;
    if (me.moving) { cam.dx += (wx / wl - cam.dx) * damp(dt, 1.4); cam.dz += (wz / wl - cam.dz) * damp(dt, 1.4); }
    else { cam.dx += (0 - cam.dx) * damp(dt, 0.8); cam.dz += (1 - cam.dz) * damp(dt, 0.8); }
    const dl = Math.hypot(cam.dx, cam.dz) || 1, ux = cam.dx / dl, uz = cam.dz / dl;
    camera.position.set(clamp(cam.fx + CAM.side - ux * 0.9, world.hedge.min + 0.1, world.hedge.max - 0.1), CAM.up, clamp(cam.fz - CAM.back - Math.min(0, uz) * 1.2, -9, SZ + 3));
    camera.lookAt(cam.fx + ux * 2.4, CAM.eye, cam.fz + CAM.ahead * 0.55 + Math.max(0, uz) * 1.5);
    camera.updateMatrixWorld();

    /* the card: faces the camera, flips when the hider turns, walks and runs on the character's own poses */
    let mode = 'stand';
    const reveal = net.phase === 'reveal';
    if (reveal) { want.face = 'front'; mode = net.result === 'found' || (net.result == null && net.meter >= 0.999) ? 'wave' : 'cheer'; }
    else if (me.moving) {
      if (Math.abs(input.x) > 0.3) want.mir = input.x > 0 ? 1 : -1;
      if (input.y < -0.4) want.face = 'front'; else if (input.y > 0.4) want.face = 'back';
      mode = me.mag > 0.78 ? 'run' : 'march';
    }
    tickCard(dt);
    const cell = pickFrame(dt, mode);
    if (cell !== lastCell) { showCell(cell); lastCell = cell; }
    card.position.set(vis.x, 0, vis.z);
    card.rotation.y = Math.atan2(camera.position.x - vis.x, camera.position.z - vis.z);
    cardMat.color.setRGB(1, 1, 1);
    if (net.phase === 'seek' && net.meter > 0.02) { const m = net.meter; cardMat.color.setRGB(1, 1 - 0.1 * m, 1 - 0.28 * m); }   /* a warm tint as the light finds you */
    if (me.moving) {                                  /* soft footsteps */
      stride += dt * (mode === 'run' ? 8 : 5.5);
      if (stride >= 2) { stride -= 2; puff(sp && sp.kind === 'bush' ? 0.012 : 0.03, 90, 250, 900); }
    } else stride = 1.6;

    /* the places: rustle shake; the place we are in turns see-through so the hider shows */
    for (const id in spots) {
      const s = spots[id];
      if (s.shake > 0) { s.shake = Math.max(0, s.shake - dt * 2.2); const w = Math.sin(now * 46) * 0.045 * s.shake; s.grp.rotation.z = w; s.grp.rotation.x = Math.cos(now * 39) * 0.03 * s.shake; }
      else if (s.grp.rotation.z) { s.grp.rotation.z = 0; s.grp.rotation.x = 0; }
      fadeTo(s, s.kind !== 'pot' && (me.place === id || between(s, s.r * 0.8)), 0.28);
    }
    for (const b of blockers) fadeTo(b, between(b, b.r + 0.3) || Math.hypot(camera.position.x - b.x, camera.position.z - b.z) < b.r + 1.2, 0.22);
    for (const f of farTrees) f.rotation.y = card.rotation.y;

    /* lantern pools: follow the host's points smoothly, fade in and out */
    const live = net.phase === 'seek' ? net.lanterns : [];
    for (const p of pools) p.want = 0;
    for (const l of live) {
      let p = pools.find(q => q.seat === l.seat) || pools.find(q => q.a < 0.02 && q.seat == null) || pools.find(q => q.a < 0.02);
      if (!p) continue;
      if (p.seat !== l.seat) { p.seat = l.seat; p.x = l.x; p.z = l.z; }
      p.want = 1; const k = damp(dt, 12); p.x += (l.x - p.x) * k; p.z += (l.z - p.z) * k;
    }
    for (const p of pools) {
      p.a += (p.want - p.a) * damp(dt, 6); if (p.a < 0.02 && !p.want) { p.seat = null; }
      p.mesh.visible = p.a > 0.02; if (p.mesh.visible) { p.mesh.position.set(p.x, 0.06, p.z); p.mesh.material.opacity = p.a * 0.95; }
    }

    paintGlow(dt);
    outBtn.classList.toggle('show', inPot() && playing());
    base.classList.toggle('dim', inPot());
    root.dataset.phase = net.phase; root.dataset.place = me.place || '';
    renderer.render(scene, camera);
  }
  resize(); paintHud();
  api.onState(onState);            /* (last: it hands over the latest state at once) */
  raf = requestAnimationFrame(frame);

  /* a small handle for tests and the owner's pictures */
  const handle = {
    me, vis, net, input, cs, spots, camera, scene,
    say, maxDt: 0.1,
    setPixelRatio: (n) => { renderer.setPixelRatio(n); W = H = 0; },
    /* the pictures: jump straight to a state (no network) */
    pose: (o) => {
      if (o.x != null) { me.x = vis.x = o.x; me.z = vis.z = o.z; cam.fx = o.x; cam.fz = o.z; }
      if (o.place !== undefined) me.place = o.place;
      Object.assign(net, o.net || {});
      if (o.input) { input.x = o.input.x; input.y = o.input.y; }
      paintHud();
    },
    stop() {
      stopped = true; cancelAnimationFrame(raf); clearInterval(sendTimer); removeEventListener('resize', resize);
      try { renderer.dispose(); } catch { /* fine */ }
      try { ac && ac.close(); } catch { /* fine */ }
      if (window.__pk === handle) delete window.__pk;
    }
  };
  window.__pk = handle;
  return handle;
}

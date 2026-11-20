/* The stage: how a flat game puts the painted look and paper cutouts on screen, ready for 3D later.

   A game gives it a painted backdrop (the 2D painter that already draws the sky, hills and grass) and then places actors -
   the pictures from the asset library - by name:

     const stage = new Stage({ backdrop: scene });         scene has drawBack(c, W, H) and drawFront(c, W, H)
     const b = stage.actor('balloon', { x: .5, y: .8, size: .1, z: 3 });     x, y: 0..1 of the screen (y down); size: a fraction of
                                                                         the screen's height; z: depth, in front of FG_Z is over the grass
     b.y -= dt * .1;  b.alpha = .8;  stage.remove(b);
     stage.burst(x, y, '#ff5b5b');                                       a puff of confetti
     stage.step(dt);  stage.draw(c, W, H);

   Games keep their rules in the flat 0..1 screen coordinates they have always used; only the drawing goes through here. The stage
   draws in 3D where it can (the backdrop and foreground as flat pictures at the far and near ends, each actor a paper cutout
   in between, on a locked camera) and by painting the same pictures straight onto the canvas where it can't (no 3D yet,
   or none on this machine), so a game always draws. */
import { assets } from '../games/assets/index.js';

export const WORLD_H = 12;     /* the flat view is 12 units tall; its width follows the screen */
export const FG_Z = 2;         /* actors with a larger z draw over the painted foreground; the rest draw behind it */

/* x, y in 0..1 of the screen (y down) <-> the 3D world's units (y up) */
export const toWorld = (nx, ny, aspect) => ({ x: (nx * 2 - 1) * (WORLD_H / 2) * aspect, y: (1 - ny) * WORLD_H });
export const fromWorld = (wx, wy, aspect) => ({ x: (wx / ((WORLD_H / 2) * aspect) + 1) / 2, y: 1 - wy / WORLD_H });

/* three.js is loaded the first time a stage starts, so no other game pays for it */
let T = null, loading = null, glFailed = false;
const renderers = new Map();
export function loadThree(){
  if (!loading) loading = import('three').then((m) => (T = m)).catch(() => { glFailed = true; return null; });
  return loading;
}
function renderer(aa = true){
  if (renderers.has(aa) || glFailed || !T) return renderers.get(aa) || null;
  try {
    const cv = document.createElement('canvas');
    const r = new T.WebGLRenderer({ canvas: cv, antialias: aa, alpha: false, powerPreference: 'high-performance' });
    r.setClearColor(0xe9f0f0); renderers.set(aa, r); return r;
  } catch (e){ glFailed = true; return null; }
}

/* ---------- cutouts: a library picture, painted onto a canvas with a paper edge ---------- */
const cutouts = new Map();
function cutout(id, drawOpts, px, fit){
  const key = `${id}|${JSON.stringify(drawOpts || {})}|${px}|${fit}`;
  let cut = cutouts.get(key); if (cut) return cut;
  const aspect = (assets.list().find(r => r.id === id) || { aspect: 1 }).aspect;
  const pad = Math.round(px * 0.06), W = Math.ceil(px * fit * aspect) + pad * 2 + (fit < 1 ? Math.round(px * 0.1) : 0), Hc = px + pad * 2;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = Hc; return c; };
  const out = mk(), t1 = mk(), t2 = mk(), edge = Math.max(3, px * fit * 0.02);
  const x1 = t1.getContext('2d'), x2 = t2.getContext('2d'), x = out.getContext('2d');
  x1.save(); x1.translate(W / 2, Hc / 2); assets.draw(x1, id, 0, 0, px * fit, drawOpts || {}); x1.restore();
  x2.drawImage(t1, 0, 0); x2.globalCompositeOperation = 'source-in'; x2.fillStyle = '#fffdf6'; x2.fillRect(0, 0, W, Hc);
  for (let k = 0; k < 16; k++){ const a = k / 16 * 6.2832; x.drawImage(t2, Math.cos(a) * edge, Math.sin(a) * edge); }
  x.drawImage(t1, 0, 0);
  cut = { key, canvas: out, W, Hc, px, fit, tex: null, geo: null };
  cutouts.set(key, cut);
  return cut;
}
/* pictures cost memory: keep the most recent ones */
function trimCutouts(keep = 48){
  if (cutouts.size <= keep) return;
  for (const [k, c] of cutouts){ if (cutouts.size <= keep) break; if (c.tex) c.tex.dispose(); if (c.geo) c.geo.dispose(); cutouts.delete(k); }
}

export class Stage {
  /* Options for a lighter stage, for slower machines: backdropEvery (repaint the backdrop every N frames), backdropScale (its picture's size,
     relative to the screen), scale (how big the 3D picture is drawn, relative to the screen) and antialias. */
  constructor({ backdrop = null, gl = true, backdropEvery = 2, backdropScale = 1.25, scale = 1, antialias = true } = {}){
    this.backdrop = backdrop;
    this.opt = { backdropEvery, backdropScale, scale, antialias };
    this.perf = { n: 0, painter: 0, gl: 0, copy: 0 };
    this.actors = []; this.shards = [];
    this.t = 0; this.n = 0;
    this.mode = '2d';                 /* '2d' until three.js is ready (and always, if there is no 3D here) */
    /* (gl: false keeps it on the canvas painter, for tests and for machines known to have no 3D) */
    this.ready = gl ? loadThree().then(() => this._start()) : Promise.resolve();
  }

  /* ----- the game's side ----- */
  actor(id, o = {}){
    const a = { id, x: 0.5, y: 0.5, z: 3, size: 0.1, fit: 1, draw: null, rot: 0, alpha: 1, flip: false, sway: 0, visible: true, px: 384, ...o, _m: null, _ph: Math.random() * 6.28 };
    this.actors.push(a); return a;
  }
  remove(a){
    const i = this.actors.indexOf(a); if (i >= 0) this.actors.splice(i, 1);
    if (a._m && this.scene){ this.scene.remove(a._m); a._m.material.dispose(); a._m = null; }
  }
  /* a puff of confetti where something popped (x, y in 0..1 of the screen) */
  burst(x, y, color = '#ffffff', n = 16){
    for (let i = 0; i < n; i++){
      const ang = Math.random() * 6.2832, sp = 0.25 + Math.random() * 0.5;
      this.shards.push({ x, y, vx: Math.cos(ang) * sp * 0.6, vy: Math.sin(ang) * sp - 0.15, life: 0, max: 0.7 + Math.random() * 0.4, color, w: 0.008 + Math.random() * 0.01 });
    }
    if (this.shards.length > 300) this.shards.splice(0, this.shards.length - 300);
  }
  step(dt){
    this.t += dt;
    for (const s of this.shards){ s.life += dt; s.vy += 0.75 * dt; s.x += s.vx * dt; s.y += s.vy * dt; }
    this.shards = this.shards.filter(s => s.life < s.max);
  }
  dispose(){
    for (const a of this.actors.slice()) this.remove(a);
    for (const o of [this._bd, this._fg]) if (o) { o.tex.dispose(); o.mesh.material.dispose(); }
    this.scene = null; this.mode = '2d'; this.actors = []; this.shards = [];
    trimCutouts();
  }

  /* ----- drawing ----- */
  draw(c, W, H){
    this.n++;
    if (this.mode === 'gl') { try { return this._drawGL(c, W, H); } catch (e){ this.mode = '2d'; } }
    this._draw2d(c, W, H);
  }

  /* the same picture without 3D: the painter's backdrop, the actors behind the grass, the grass, the actors in front */
  _draw2d(c, W, H){
    const behind = [], infront = [];
    for (const a of this.actors) if (a.visible) (a.z <= FG_Z ? behind : infront).push(a);
    const byZ = (p, q) => p.z - q.z;
    if (this.backdrop && this.backdrop.drawBack) this.backdrop.drawBack(c, W, H);
    for (const a of behind.sort(byZ)) this._actor2d(c, a, W, H);
    if (this.backdrop && this.backdrop.drawFront) this.backdrop.drawFront(c, W, H);
    for (const a of infront.sort(byZ)) this._actor2d(c, a, W, H);
    for (const s of this.shards){
      const k = s.life / s.max;
      c.globalAlpha = Math.max(0, 1 - k * k); c.fillStyle = s.color;
      c.beginPath(); c.arc(s.x * W, s.y * H, s.w * H * (1 - k * 0.5), 0, 6.2832); c.fill();
    }
    c.globalAlpha = 1;
  }
  _actor2d(c, a, W, H){
    assets.draw(c, a.id, a.x * W, a.y * H, a.size * H, { ...(a.draw || {}), rotate: a.rot || 0, flip: a.flip, alpha: a.alpha });
  }

  /* ----- 3D ----- */
  _start(){
    const r = renderer(this.opt.antialias); if (!r) return;
    const S = new T.Scene();
    this.scene = S; this.r = r;
    this.cam = new T.OrthographicCamera(-1, 1, WORLD_H / 2, -WORLD_H / 2, 1, 700);
    this.cam.position.set(0, WORLD_H / 2, 60); this.cam.lookAt(0, WORLD_H / 2, 0);
    const mkPlane = (z, transparent) => {
      const tex = new T.CanvasTexture(document.createElement('canvas')); tex.colorSpace = T.SRGBColorSpace; tex.generateMipmaps = false; tex.minFilter = tex.magFilter = T.LinearFilter;
      const mesh = new T.Mesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ map: tex, transparent, depthWrite: false, fog: false }));
      mesh.position.set(0, WORLD_H / 2, z); S.add(mesh); return { tex, mesh, cv: null, w: 0, h: 0 };
    };
    this._bd = mkPlane(-300, false); this._fg = mkPlane(FG_Z, true);
    this.shardMesh = new T.InstancedMesh(new T.PlaneGeometry(1, 1), new T.MeshBasicMaterial({ transparent: true, depthWrite: false, fog: false }), 300);
    this.shardMesh.count = 0; this.shardMesh.position.z = FG_Z + 3; S.add(this.shardMesh);
    this.mode = 'gl';
  }
  _plane(p, W, H, dpr){
    const k = Math.min(dpr, this.opt.backdropScale), w = Math.max(2, Math.round(W * k)), h = Math.max(2, Math.round(H * k));
    if (!p.cv || p.w !== w || p.h !== h){
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      p.tex.dispose(); p.tex = new T.CanvasTexture(cv); p.tex.colorSpace = T.SRGBColorSpace; p.tex.generateMipmaps = false; p.tex.minFilter = p.tex.magFilter = T.LinearFilter;
      p.mesh.material.map = p.tex; p.mesh.material.needsUpdate = true; p.cv = cv; p.w = w; p.h = h;
    }
    p.mesh.scale.set((W / H) * WORLD_H, WORLD_H, 1);
    return p;
  }
  _mesh(a){
    const cut = cutout(a.id, a.draw, a.px, a.fit);
    if (!cut.tex){ cut.tex = new T.CanvasTexture(cut.canvas); cut.tex.colorSpace = T.SRGBColorSpace; cut.tex.generateMipmaps = false; cut.tex.minFilter = cut.tex.magFilter = T.LinearFilter; }
    if (!cut.geo) cut.geo = new T.PlaneGeometry(cut.W, cut.Hc);
    const m = new T.Mesh(cut.geo, new T.MeshBasicMaterial({ map: cut.tex, transparent: true, alphaTest: 0.06, side: T.DoubleSide, fog: false }));
    m.userData.cut = cut; this.scene.add(m); a._m = m; return m;
  }
  _drawGL(c, W, H){
    const r = this.r, tr = c.getTransform ? c.getTransform() : null, dpr = tr ? tr.a : 1, pw = Math.round(W * dpr * this.opt.scale), ph = Math.round(H * dpr * this.opt.scale), asp = W / H, now = performance.now();
    const size = r.getSize(new T.Vector2());
    if (size.x !== pw || size.y !== ph){ r.setPixelRatio(1); r.setSize(pw, ph, false); }
    this.cam.left = -asp * WORLD_H / 2; this.cam.right = asp * WORLD_H / 2; this.cam.updateProjectionMatrix();
    /* the painted backdrop and foreground, redrawn every other frame: they barely move */
    const bd = this._plane(this._bd, W, H, dpr), fg = this._plane(this._fg, W, H, dpr);
    if (this.n % this.opt.backdropEvery === 0 || !bd.drawn){
      const bx = bd.cv.getContext('2d'), fx = fg.cv.getContext('2d');
      if (this.backdrop && this.backdrop.drawBack) this.backdrop.drawBack(bx, bd.w, bd.h);
      fx.clearRect(0, 0, fg.w, fg.h); if (this.backdrop && this.backdrop.drawFront) this.backdrop.drawFront(fx, fg.w, fg.h);
      bd.tex.needsUpdate = fg.tex.needsUpdate = true; bd.drawn = true;
    }
    const t1 = performance.now();
    /* the actors: each a paper cutout in the world */
    for (const a of this.actors){
      if (!a.visible){ if (a._m) a._m.visible = false; continue; }
      const m = a._m || this._mesh(a), cut = m.userData.cut, w = toWorld(a.x, a.y, asp), k = (a.size * WORLD_H) / (cut.px * cut.fit);
      m.visible = true; m.position.set(w.x, w.y, a.z); m.scale.set(a.flip ? -k : k, k, 1);
      m.rotation.z = -(a.rot || 0) + (a.sway ? Math.sin(this.t * 0.9 + a._ph) * a.sway : 0);
      m.material.opacity = a.alpha;
    }
    /* confetti */
    const dummy = this._dummy || (this._dummy = new T.Object3D()), sm = this.shardMesh;
    let i = 0;
    for (const s of this.shards){
      if (i >= 300) break;
      const k = s.life / s.max, w = toWorld(s.x, s.y, asp), q = s.w * WORLD_H * (1 - k * 0.5);
      dummy.position.set(w.x, w.y, 0); dummy.scale.set(q * 1.4, q, 1); dummy.rotation.z = s.life * 6; dummy.updateMatrix();
      sm.setMatrixAt(i, dummy.matrix); sm.setColorAt(i, (this._col || (this._col = new T.Color())).set(s.color)); i++;
    }
    sm.count = i; sm.instanceMatrix.needsUpdate = true; if (sm.instanceColor) sm.instanceColor.needsUpdate = true;
    const t2 = performance.now();
    r.render(this.scene, this.cam);
    const t3 = performance.now();
    c.drawImage(r.domElement, 0, 0, W, H);
    const t4 = performance.now(), p = this.perf;
    p.n++; p.painter += t1 - now; p.gl += t3 - t2; p.copy += t4 - t3;
  }

  /* where the time went, per frame, for the owner's results line */
  perfLine(){
    const p = this.perf; if (!p.n) return '';
    const f = (v) => (v / p.n).toFixed(1);
    return `per frame: backdrop painting ${f(p.painter)} ms, 3D drawing ${f(p.gl)} ms, copying to the screen ${f(p.copy)} ms`;
  }
}

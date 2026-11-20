/* The 3D check (owner only, key G): which graphics chip the page really uses, and how fast a plain 3D scene runs on it - boxes with
   painted sides and paper-like standees, nothing repainted per frame. It answers "can this machine do 3D?" apart from any game. */
import { loadThree } from './stage.js';
import { gpuName } from '../ui/perfreport.js';
import { pose } from '../tracking/pose.js';

const stats = (ms) => {
  if (ms.length < 10) return 'too few frames';
  const s = ms.slice().sort((a, b) => a - b), avg = ms.reduce((a, b) => a + b, 0) / ms.length;
  return `${(1000 / avg).toFixed(0)} fps average, slowest 5% over ${s[Math.floor(s.length * 0.95)].toFixed(0)} ms`;
};

export async function gpuCheck(onStatus = () => {}){
  const T = await loadThree();
  const lines = [`graphics (what the page sees): ${gpuName()}`];
  if (!T) return lines.concat('3D graphics are not available here.').join('\n');
  const cv = document.createElement('canvas');
  cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:99999;background:#e9f0f0';
  document.body.appendChild(cv);
  const dpr = Math.min(devicePixelRatio || 1, 2), W = innerWidth, H = innerHeight;
  const r = new T.WebGLRenderer({ canvas: cv, antialias: true, powerPreference: 'default' });
  r.setPixelRatio(dpr); r.setSize(W, H, false);
  const dbg = r.getContext().getExtension('WEBGL_debug_renderer_info');
  if (dbg) lines[0] = `graphics (what the 3D drawing uses): ${r.getContext().getParameter(dbg.UNMASKED_RENDERER_WEBGL)}`;
  const tex = (col) => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'); x.fillStyle = col; x.fillRect(0, 0, 128, 128); x.fillStyle = '#fff8'; x.fillRect(20, 20, 40, 40); x.fillRect(70, 20, 40, 40); const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t; };
  const mats = ['#e0705a', '#a9c1de', '#c9604a', '#d9d2c3'].map(c => new T.MeshBasicMaterial({ map: tex(c) }));
  const scene = new T.Scene(), cam = new T.PerspectiveCamera(60, W / H, 0.1, 200);
  scene.background = new T.Color(0xe9f0f0);
  const box = new T.BoxGeometry(2, 2, 2), plane = new T.PlaneGeometry(2, 3), things = [];
  for (let i = 0; i < 400; i++){
    const m = i % 3 ? new T.Mesh(box, mats[i % 4]) : new T.Mesh(plane, new T.MeshBasicMaterial({ map: tex('#7fd0b0'), transparent: true }));
    m.position.set((Math.random() - 0.5) * 80, 1, (Math.random() - 0.5) * 80); scene.add(m); things.push(m);
  }
  /* a lit scene with animated characters: each is a few boxes whose arms, legs and head swing (rigged parts, nothing repainted) */
  const lit = new T.Group(); lit.visible = false; scene.add(lit);
  const sun = new T.DirectionalLight(0xffffff, 1.6); sun.position.set(20, 40, 10); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -45, right: 45, top: 45, bottom: -45, near: 1, far: 120 }); lit.add(sun, new T.HemisphereLight(0xffffff, 0x88aa88, 1.2));
  const floor = new T.Mesh(new T.PlaneGeometry(100, 100), new T.MeshStandardMaterial({ color: 0x8cb07b })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; lit.add(floor);
  const part = (w, h, d, col, x, y, z) => { const m = new T.Mesh(new T.BoxGeometry(w, h, d), new T.MeshStandardMaterial({ color: col })); m.position.set(x, y, z); m.castShadow = true; return m; };
  const crew = [];
  for (let i = 0; i < 24; i++){
    const g = new T.Group(), col = [0x6f8cff, 0xe0705a, 0x7fd0b0, 0xffd24a][i % 4];
    const head = part(1, 1, 1, col, 0, 2.6, 0), body = part(1.2, 1.4, 0.8, col, 0, 1.4, 0);
    const armL = part(0.3, 1.2, 0.3, col, -0.9, 1.6, 0), armR = part(0.3, 1.2, 0.3, col, 0.9, 1.6, 0), legL = part(0.4, 1, 0.4, col, -0.35, 0.5, 0), legR = part(0.4, 1, 0.4, col, 0.35, 0.5, 0);
    g.add(head, body, armL, armR, legL, legR); g.position.set((Math.random() - 0.5) * 70, 0, (Math.random() - 0.5) * 70); g.userData = { armL, armR, legL, legR, head, ph: Math.random() * 6 };
    lit.add(g); crew.push(g);
  }
  for (let i = 0; i < 40; i++) lit.add(Object.assign(part(3, 3 + Math.random() * 4, 3, 0xd9d2c3, (Math.random() - 0.5) * 80, 2, (Math.random() - 0.5) * 80), { receiveShadow: true }));
  r.shadowMap.enabled = true;
  const phases = [
    ['plain scene, 400 things', 400, false, false],
    ['lit scene, shadows, 24 animated characters', 0, true, false],
    ['the same, with camera tracking running', 0, true, true]
  ];
  for (const [label, n, isLit, camera] of phases){
    things.forEach((m, i) => { m.visible = !isLit && i < n; }); lit.visible = isLit; scene.background = new T.Color(isLit ? 0xbfdff2 : 0xe9f0f0);
    onStatus(label);
    let cameraNote = '';
    if (camera){ try { const ok = await pose.wake(); cameraNote = ok ? '' : ' (no camera found, so this is not a real camera test)'; } catch (e){ cameraNote = ' (camera failed)'; } }
    const ms = []; let last = performance.now(), t0 = last;
    await new Promise((done) => {
      const loop = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000); ms.push(now - last); last = now;
        if (camera) pose.update(now, dt);
        const k = (now - t0) / 1000;
        cam.position.set(Math.sin(k / 3) * 30, 12, Math.cos(k / 3) * 30); cam.lookAt(0, 1, 0);
        things.forEach((m, i) => { if (i % 3 === 0) m.rotation.y += 0.02; });
        crew.forEach((g) => { const u = g.userData, w = Math.sin(k * 6 + u.ph); u.armL.rotation.x = w; u.armR.rotation.x = -w; u.legL.rotation.x = -w; u.legR.rotation.x = w; u.head.rotation.y = Math.sin(k * 2 + u.ph) * 0.5; g.position.z += Math.sin(k + u.ph) * 0.02; });
        r.render(scene, cam);
        if (now - t0 < 5000) requestAnimationFrame(loop); else done();
      };
      requestAnimationFrame(loop);
    });
    lines.push(`${label}: ${stats(ms.slice(5))}${camera ? `; camera ${pose.fps.toFixed(0)} fps, ${pose.inferMs.toFixed(1)} ms per look` : ''}${cameraNote}`);
    if (camera) pose.sleep();
  }
  r.dispose(); cv.remove();
  return lines.join('\n');
}

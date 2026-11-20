/* The 3D check (owner only, key G): which graphics chip the page really uses, and how fast a plain 3D scene runs on it - boxes with
   painted sides and paper-like standees, nothing repainted per frame. It answers "can this machine do 3D?" apart from any game. */
import { loadThree } from './stage.js';
import { gpuName } from '../ui/perfreport.js';

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
  const phases = [['light scene (100 things)', 100], ['busy scene (400 things)', 400]];
  for (const [label, n] of phases){
    things.forEach((m, i) => { m.visible = i < n; });
    onStatus(label);
    const ms = []; let last = performance.now(), t0 = last;
    await new Promise((done) => {
      const loop = (now) => {
        ms.push(now - last); last = now;
        cam.position.set(Math.sin((now - t0) / 3000) * 30, 8, Math.cos((now - t0) / 3000) * 30); cam.lookAt(0, 1, 0);
        things.forEach((m, i) => { if (i % 3 === 0) m.rotation.y += 0.02; });
        r.render(scene, cam);
        if (now - t0 < 4000) requestAnimationFrame(loop); else done();
      };
      requestAnimationFrame(loop);
    });
    lines.push(`${label}: ${stats(ms.slice(5))}`);
  }
  r.dispose(); cv.remove();
  return lines.join('\n');
}

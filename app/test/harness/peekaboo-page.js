/* Browser side of the Peekaboo TV tests and pictures (plan package K4): drives the real game object with fake phones and fake hands, and draws it
   on a canvas of its own over the 3D garden. Loaded by the dev server as /test/harness/peekaboo-page.js (see peekaboo-tv.node.mjs). */
import game from '/src/games/peekaboo.js';
import { pose } from '/src/tracking/pose.js';
import { screenPoint } from '/src/games/peekaboo/camera.js';

const LOOKS = {
  mia: { colour: 'pink', face: { eyes: 'happy', mouth: 'grin' }, top: 'bob', outfit: 'stripes', outfitColour: 'ui.gold', extra: 'none' },
  sam: { colour: 'orange', face: { eyes: 'dot', mouth: 'smile' }, top: 'cap', outfit: 'plain', outfitColour: 'shade.card', extra: 'glasses' },
  ola: { colour: 'green', face: { eyes: 'wink', mouth: 'o' }, top: 'tuft', outfit: 'dots', outfitColour: 'touch.skyBlue', extra: 'none' }
};

export function setup() {
  /* only the garden: hide the rest of the shell */
  const st = document.getElementById('stage');
  for (const el of document.body.children) if (!el.dataset.pk && !el.contains(st)) el.style.display = 'none';
  for (const el of st.parentNode.children) if (el !== st.parentNode) el.style.display = 'none';
  const cv = document.createElement('canvas'); cv.dataset.pk = '1'; cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:5;pointer-events:none';
  document.body.appendChild(cv);
  const dpr = window.devicePixelRatio || 1, W = window.innerWidth, H = window.innerHeight;
  cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
  const c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
  const handlers = {}, sent = [], states = [];
  const pads = {
    seats: [
      { n: 0, kind: 'tracked', who: 'mia', name: 'Mia', avatar: LOOKS.mia, colour: 'pink' },
      { n: 1, kind: 'tracked', who: 'sam', name: 'Sam', avatar: LOOKS.sam, colour: 'orange' },
      { n: 2, kind: 'pad', who: 'ola', name: 'Ola', avatar: LOOKS.ola, colour: 'green' }],
    on(name, fn) { (handlers[name] || (handlers[name] = [])).push(fn); return () => { handlers[name] = handlers[name].filter(f => f !== fn); }; },
    send(to, m) { sent.push({ to, m }); }, state(s) { states.push(s); }
  };
  const api = { W, H, c, pads, sent, states, inst: null };
  api.fire = (name, arg) => (handlers[name] || []).forEach(f => f(arg));
  api.start = () => { sent.length = 0; states.length = 0; api.inst = game.create(2, { pads }); return api.inst; };
  api.hands = (list) => {                    /* list: [{ seat, x, z }] floor points; every other seeker is out of the picture */
    for (let i = 0; i < 4; i++) { const p = pose.players[i]; p.present = false; }
    for (const l of list) {
      const p = pose.players[l.seat], s = screenPoint(l.x, l.z, 0, W / H);
      p.present = true; for (const h of [p.hands.left, p.hands.right]) { h.x = s.x; h.y = s.y; h.speed = 1; }
    }
  };
  api.stick = (x, y) => api.fire('input', { seat: 2, who: 'ola', m: { t: 'in', stick: { x, y } } });
  api.act = (a) => api.fire('input', { seat: 2, who: 'ola', m: { t: 'in', act: a } });
  api.step = (secs, each) => { for (let i = 0, n = Math.round(secs * 60); i < n && !api.inst.over; i++) { if (each) each(i / 60); api.inst.step(1 / 60, W, H); } };
  api.frames = async (n = 4) => { for (let i = 0; i < n; i++) { api.inst.draw(c, W, H); await new Promise(r => requestAnimationFrame(r)); } };
  /* keep drawing every frame (the 3D layer hides itself when the shell stops drawing it) */
  api.loop = () => { const f = () => { if (api.inst) api.inst.draw(c, W, H); requestAnimationFrame(f); }; f(); };
  api.look = () => {                         /* what the 3D view shows right now, for the tests */
    const v = api.inst.view; if (!v) return null;
    return { lanterns: v.lanterns.filter(l => l.disc.visible).length, hider: v.hider.visible, hiderOpacity: v.hider.material.opacity,
      rustling: Object.values(v.places).filter(p => p.rustle > 0).length, dim: api.inst.dim, phase: api.inst.round.state.phase };
  };
  return api;
}

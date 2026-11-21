/* The pad program for the pad lab (plan package S1): a stick on the phone that moves a dot on the TV.
   Pad programs are plain ES modules the hub serves at /pads/<game>/pad.js; the pad page calls the default export with
   { send, onState, onEvent, colour, seat, root, ... } (docs/specs/pad-protocol.md, "The pad page's side").
   It sends { x, y } (each -1 to 1) when the stick moves, and at least every 100 ms while it is held. */
export default function start(api) {
  const root = api.root;
  root.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;touch-action:none;user-select:none;-webkit-user-select:none';
  const pad = document.createElement('div');
  pad.className = 'labstick';
  const R = Math.min(window.innerWidth, window.innerHeight) * 0.36;
  pad.style.cssText = `position:relative;width:${R * 2}px;height:${R * 2}px;border-radius:50%;background:#fffdf8;border:4px solid #2f2b45;box-shadow:0 8px 0 rgba(52,40,96,.18);touch-action:none`;
  const knob = document.createElement('div');
  knob.className = 'labknob';
  const K = R * 0.5;
  knob.style.cssText = `position:absolute;left:50%;top:50%;width:${K}px;height:${K}px;margin:${-K / 2}px 0 0 ${-K / 2}px;border-radius:50%;background:${api.colour || '#3da9ff'};border:4px solid #2f2b45;transition:transform .08s`;
  pad.appendChild(knob);
  root.appendChild(pad);

  let held = false, x = 0, y = 0, timer = 0;
  const post = () => api.send({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
  function at(e) {
    const r = pad.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = (e.clientX - cx) / R, dy = (e.clientY - cy) / R;
    const len = Math.hypot(dx, dy); if (len > 1) { dx /= len; dy /= len; }
    x = dx; y = dy;
    knob.style.transform = `translate(${dx * R * 0.5}px,${dy * R * 0.5}px)`;
    post();
  }
  pad.addEventListener('pointerdown', (e) => {
    held = true; try { pad.setPointerCapture(e.pointerId); } catch { /* fine */ }
    at(e); clearInterval(timer); timer = setInterval(() => { if (held) post(); }, 100);
  });
  pad.addEventListener('pointermove', (e) => { if (held) at(e); });
  const up = () => { if (!held) return; held = false; clearInterval(timer); x = y = 0; knob.style.transform = ''; post(); };
  pad.addEventListener('pointerup', up); pad.addEventListener('pointercancel', up);
  return { stop() { clearInterval(timer); } };
}

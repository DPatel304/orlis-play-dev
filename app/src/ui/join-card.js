/* The TV join card (plan package P5; mockup docs/pads-mockup.html; decision 0032).
   Shown before a game that uses phones: a QR that only opens the pad page (no secret), the three pictures the phone has to tap, the faces
   of the phones that have joined (a tick when ready), and Start (wave, remote or mouse; never a phone). With no phone after 90 s, one calm
   line about Wi-Fi.

     const card = joinCard({ rt, onStart });     // rt: the pads runtime (session/pads.js); a scene: { tick, draw, leave }          */
import { button, onPick } from './cursor.js';
import { screen, h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { assets } from '../games/assets/index.js';
import { qrMatrix, drawQR } from '../session/qr.js';
import { WIFI_HINT_AFTER } from '../session/pads.js';
import { faceChip } from './pad-faces.js';
import { color, alpha } from '../games/assets/palette.js';

const dpr = () => Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
const sidePx = () => Math.max(96, Math.round((typeof innerHeight === 'number' ? innerHeight : 720) * 0.24 * dpr()));

/* a painted picture from the library, centred on a square canvas */
function pictureCanvas(id) {
  const cv = document.createElement('canvas'); cv.width = cv.height = sidePx(); cv.dataset.id = id;
  const c = cv.getContext('2d');
  if (c) { try { assets.draw(c, id, cv.width / 2, cv.height / 2, cv.width * 0.8); } catch { /* a blank card */ } }
  return cv;
}

export function joinCard({ rt, onStart }) {
  const game = rt.game, session = rt.session;
  const s = screen('joinscreen');
  const card = h('div', 'joincard');
  card.append(h('div', 'jk', 'Join with a phone'));

  /* the QR (opens the pad page only), then the three pictures */
  const row = h('div', 'jrow');
  const qrBox = h('div', 'jqr'); const qc = document.createElement('canvas'); qc.width = qc.height = sidePx();
  const url = rt.padUrl;
  if (url) { try { drawQR(qc.getContext('2d'), qrMatrix(url), 0, 0, qc.width); } catch { /* no QR: the pictures still work from the pad page */ } }
  qc.dataset.url = url || '';
  qrBox.append(qc, h('span', '', 'Scan'));
  const pics = h('div', 'jpics');
  for (const id of session.join.pictures) pics.appendChild(pictureCanvas(id));
  row.append(qrBox, h('div', 'jthen', 'then tap'), pics);
  card.appendChild(row);

  /* who has joined */
  const faces = h('div', 'jfaces');
  card.appendChild(faces);
  const hint = h('div', 'jwifi hide');
  const bulb = document.createElement('canvas'); bulb.width = bulb.height = Math.round(60 * dpr());
  try { assets.draw(bulb.getContext('2d'), 'lightbulb', bulb.width / 2, bulb.height / 2, bulb.width * 0.8); } catch { /* no icon */ }
  hint.append(bulb, h('span', '', 'Phone can’t connect? It needs the same Wi-Fi as Orlis. Some guest Wi-Fi blocks this.'));
  card.appendChild(hint);
  s.appendChild(card);

  const start = onPick(button('Start', 'big go joinstart'), () => {
    if (!session.canStart) { start.classList.remove('nope'); void start.offsetWidth; start.classList.add('nope'); return; }
    sfx.select?.(); onStart();
  });
  s.appendChild(start);
  start.classList.add('focus');

  let everJoined = false, age = 0;
  const slots = Math.max(1, Math.min(8, (game.seats && game.seats.pads && game.seats.pads[1]) | 0));
  function render() {
    const pad = session.seats.filter(q => q.kind === 'pad');
    if (pad.some(q => q.state !== 'empty')) everJoined = true;
    faces.replaceChildren();
    const px = Math.round((typeof innerHeight === 'number' ? innerHeight : 720) * 0.11);
    for (let i = 0; i < slots; i++) {
      const q = pad[i], slot = h('div', 'jslot');
      slot.dataset.slot = String(i);
      if (q && q.state !== 'empty') {
        const chip = faceChip({ avatar: q.avatar, colour: q.colour }, px);
        slot.dataset.who = q.who; slot.dataset.state = q.state;
        slot.classList.add('full'); if (q.ready) slot.classList.add('ready'); if (q.state === 'away') slot.classList.add('away');
        slot.appendChild(chip);
        if (q.ready) slot.appendChild(h('i', 'jtick', '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'));
      } else { slot.classList.add('empty'); slot.style.width = slot.style.height = px + 'px'; }
      faces.appendChild(slot);
    }
    start.classList.toggle('wait', !session.canStart);
    updateHint();
  }
  function updateHint() {
    const on = age >= WIFI_HINT_AFTER && !everJoined;
    hint.classList.toggle('hide', !on); card.classList.toggle('small', on);
  }
  const off = session.on('change', render);
  render();

  return {
    get age() { return age; }, set age(v) { age = v; updateHint(); },
    tick(dt) { age += dt; updateHint(); },
    /* a calm sky behind the card (the mockup puts it over the game's first picture) */
    draw(c, W, H) {
      try { assets.scene(c, W, H, 'meadow', { t: age }); } catch { c.fillStyle = color('sky.low'); c.fillRect(0, 0, W, H); }
      c.fillStyle = alpha('shade.paper', 0.55); c.fillRect(0, 0, W, H);
    },
    leave() { off(); }
  };
}

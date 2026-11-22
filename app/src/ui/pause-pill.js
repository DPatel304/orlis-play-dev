/* "Waiting for Sam's phone" (plan package S1/P5; mockup docs/pads-mockup.html): the paper pill with the face of the phone the game needs.
   The shell shows it while the session is paused and takes it away on resume; after 120 s it adds "End the game" (the session's offerEnd).

     const pill = padWaitPill({ rt, onEnd });     // rt: the pads runtime; pill.refresh() after a change; pill.remove()                  */
import { button, onPick } from './cursor.js';
import { screen, h } from './screens.js';
import { faceChip } from './pad-faces.js';
import { waitingText } from '../session/pads.js';

export function padWaitPill({ rt, onEnd }) {
  const s = screen('padwait');
  const pill = h('div', 'waitpill');
  const text = h('span', 'wt', ''), faceBox = h('span', 'wf');
  pill.append(faceBox, text);
  s.appendChild(pill);
  let endBtn = null;
  function refresh() {
    const w = rt.pause.waiting; if (!w) return;
    const seat = rt.session.seats.find(q => q.kind === 'pad' && q.who === w.who);
    text.textContent = waitingText(w.name);
    faceBox.replaceChildren(faceChip({ avatar: seat ? seat.avatar : null, colour: seat ? seat.colour : null }, Math.round((typeof innerHeight === 'number' ? innerHeight : 720) * 0.09)));
    if (rt.pause.offered && !endBtn) {
      endBtn = onPick(button('End the game', 'setbtn go'), () => onEnd());
      endBtn.classList.add('waitend');
      s.appendChild(endBtn);
    }
  }
  refresh();
  return { el: s, refresh, remove() { s.remove(); } };
}

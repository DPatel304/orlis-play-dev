/* The screen as a light (Settings > Testing > "Brighten the screen in dark rooms"; off unless the owner turns it on, and then only
   while the room looks dark to the camera: tracking/lighting.js Lift decides).

   What it does: a soft white veil over the whole screen, at low opacity, eased in and out over about two seconds, so the TV gives out a
   little more light on the players' faces and hands. The veil is one fixed element moved only by its opacity (the compositor does it: far
   cheaper than a CSS filter over the whole canvas). Menus, Create and the camera check get up to MAX.menu of it (their paper
   backgrounds just go lighter); a game gets up to MAX.play, a subtle lift that leaves the picture and its text readable. It is held back
   (eased out) during a cutscene (the story and an outro) and while a game is covering the screen (`blocked`), and `hold(seconds)` lets
   anything that draws a full-screen flash ask for the same.

   Only a number goes in (the room's brightness, from the tracker's small picture copy); the veil shows nothing of the camera.            */
import { Lift } from '../tracking/lighting.js';
import { switchOn } from '../tracking/switches.js';
import { color } from '../games/assets/palette.js';

export const MAX = { menu: 0.2, play: 0.08 };
export const BLOCKED_MODES = new Set(['outro', 'starting']);
const lift = new Lift();
let el = null, held = 0, shown = -1;

export const screenLight = {
  lift,
  /* the veil's opacity now, for a mode */
  opacity(mode){ return lift.level * (mode === 'play' ? MAX.play : MAX.menu); },
  hold(seconds){ held = Math.max(held, seconds); },
  /* once a frame: dt seconds, the current mode, the room's brightness from the camera (null when the camera is off or cannot read) */
  step(dt, mode, lum, doc = typeof document !== 'undefined' ? document : null){
    try {
      if (!switchOn('screenlight')){
        if (lift.level > 0 || lift.dark){ lift.reset(); this._paint(0, doc); }
        return 0;
      }
      held = Math.max(0, held - dt);
      lift.step(dt, lum, { blocked: held > 0 || BLOCKED_MODES.has(mode) });
      const o = this.opacity(mode);
      this._paint(o, doc);
      return o;
    } catch (e){ try { this._paint(0, doc); } catch (e2){} return 0; }
  },
  _paint(o, doc){
    if (!doc) return;
    if (Math.abs(o - shown) < 0.002 && !(o === 0 && shown !== 0)) return;
    shown = o;
    if (!el){
      if (o === 0) return;
      el = doc.createElement('div'); el.id = 'screenlight'; el.setAttribute('aria-hidden', 'true');
      Object.assign(el.style, { position: 'fixed', left: 0, top: 0, right: 0, bottom: 0, pointerEvents: 'none', zIndex: 9990, background: color('earth.snow'), opacity: 0 });
      (doc.body || doc.documentElement).appendChild(el);
    }
    el.style.opacity = String(o);
  },
  /* for the tracking details: 'dark, screen lifted' / 'dark' / 'ok' / null (switch off) */
  state(){ return !switchOn('screenlight') ? null : lift.dark ? (lift.level > 0.05 ? 'dark, screen lifted' : 'dark') : lift.lum == null ? 'looking' : 'ok'; }
};

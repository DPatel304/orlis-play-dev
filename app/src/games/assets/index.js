/* The asset library: everything a creator's game may draw with, in one place. A game made with Create doesn't draw its own
   art - it asks for a piece by name and the library draws it, in the house style, the same in every game:

     Orlis.assets.draw(c, 'giraffe', x, y, size, { flip: true })   a piece, centred on (x, y), `size` pixels tall
     Orlis.assets.scene(c, W, H, 'meadow', { t })                  a whole background, behind everything
     Orlis.assets.text(c, 'Go!', x, y, size, { color, align })     a few words, in Orlis's lettering (through the words check)
     Orlis.assets.list(kind?)                                      what there is: [{ id, name, kind, tags, aspect, poses, faces }]
     Orlis.assets.has(id)

   kinds: 'character' (Cubo, with his moves and faces), 'animal', 'food', 'nature', 'thing' (props, vehicles, places...),
   'effect', 'scene'. Options for draw: pose and face (Cubo), t (seconds, for the ones that move; 0..1 for the effects),
   color (the ones that take one), flip, rotate, alpha, shadow. A name that isn't in the library draws a friendly "?" box
   and is noted in `missing`, so a game still runs and the check can say what to ask for.

   The library is why a game made in Create always looks like an Orlis game, and why it can't show anything that hasn't been
   looked at: new pieces are added here (by request, approved by the Orlis owner), and games only ever name them. */
import { color as paletteColor } from './palette.js';
import { POSE_NAMES, FACE_NAMES } from '../figure.js';
import { cuboFigure } from '../../ui/avatar-art.js';
import { PROPS } from './props.js';
import { ICONS } from './icons.js';
import { SCENES, drawScene } from './scenes.js';

const ASSETS = {};
const add = (a) => { ASSETS[a.id] = { aspect: 1, tags: [], poses: null, faces: null, ...a }; };

/* Cubo: the one Orlis cube character (decision 0042), drawn with the avatar art. size is his height. */
add({ id: 'cubo', name: 'Cubo', kind: 'character', tags: ['person', 'cube'], aspect: 0.8, poses: POSE_NAMES, faces: FACE_NAMES,
  /* (this centres the whole of him, head to feet, on the point asked for) */
  draw(c, s, o){ cuboFigure(c, 0, s * 0.5, s * 0.95, o.pose || 'freeze', o.t || 0, o.face || null); } });

/* the pieces drawn in code */
for (const [id, [name, tags, aspect, draw]] of Object.entries(PROPS)){
  const t = tags.split(' '), kind = t[0] === 'effect' ? 'effect' : t[0] === 'nature' || t[0] === 'animal' ? t[0] : 'thing';
  add({ id, name, kind, tags: t, aspect, draw });
}

/* the painted icons (icons.js): animals, food, nature and things, so the HUD, the hint words and Create's hints never show a system emoji */
for (const [id, [name, tags, aspect, draw]] of Object.entries(ICONS)){
  const t = tags.split(' '), kind = t[0] === 'effect' ? 'effect' : t[0] === 'nature' || t[0] === 'animal' || t[0] === 'food' ? t[0] : 'thing';
  add({ id, name, kind, tags: t, aspect, draw });
}

export const missing = new Set();

/* ---------- the canvas a creator's game is given ----------
   A game made in Create never gets the real canvas. It gets a handle that can only move, turn, scale and fade what the library
   draws (save, restore, translate, rotate, scale, globalAlpha) - anything else says, plainly, to use the library. The library
   draws on the real canvas inside (unwrap). So a game can't draw a shape, a picture or a letter of its own. */
const REAL = new WeakMap();
const ALLOWED = new Set(['save', 'restore', 'translate', 'rotate', 'scale']);
export function lock(ctx){
  if (!ctx || REAL.has(ctx)) return ctx;
  const handle = new Proxy({}, {
    get(_, k){
      if (typeof k === 'symbol') return undefined;
      if (ALLOWED.has(k)) return (...a) => ctx[k](...a.map(Number));
      if (k === 'globalAlpha') return ctx.globalAlpha;
      throw new Error(`c.${String(k)} isn't available: games draw with Orlis.assets (scene, draw, text), not their own shapes. See the skill's Pictures section.`);
    },
    set(_, k, v){
      if (k !== 'globalAlpha') throw new Error(`c.${String(k)} can't be set: games draw with Orlis.assets, not their own shapes.`);
      ctx.globalAlpha = Math.max(0, Math.min(1, Number(v) || 0)); return true;
    }
  });
  REAL.set(handle, ctx);
  return handle;
}
export const unwrap = (c) => REAL.get(c) || c;

/* a name that isn't in the library: a "?" box, so the game still runs */
function placeholder(c, s){
  { const g = c.globalAlpha; c.globalAlpha = g * 0.7; c.fillStyle = paletteColor('earth.snow'); c.beginPath(); c.roundRect(-s / 2, -s / 2, s, s, s * 0.14); c.fill(); c.globalAlpha = g; }
  c.setLineDash([s * 0.1, s * 0.07]); c.lineWidth = s * 0.04; c.strokeStyle = paletteColor('shade.ink'); c.stroke(); c.setLineDash([]);
  c.fillStyle = paletteColor('shade.ink'); c.font = `800 ${Math.round(s * 0.6)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, s * 0.04);
}

export const assets = {
  has: (id) => !!ASSETS[id] || !!SCENES[id],
  /* a colour from the master palette, by name: assets.color('touch.mint'); its shade or highlight by rule: assets.color('touch.mint', 'shade' | 'light') (palette.js, decisions 0040, 0041) */
  color: (name, tone) => paletteColor(name, tone),
  /* a piece, centred on (x, y), size pixels tall. */
  draw(c, id, x, y, size, o = {}){
    c = unwrap(c);
    const a = ASSETS[id], s = Math.max(1, Number(size) || 1);
    if (!a) missing.add(String(id).slice(0, 40));
    c.save();
    c.translate(x, y);
    if (o.rotate) c.rotate(o.rotate);
    if (o.flip) c.scale(-1, 1);
    if (o.alpha != null) c.globalAlpha *= Math.max(0, Math.min(1, o.alpha));
    if (o.shadow){ const g = c.globalAlpha; c.globalAlpha = g * 0.16; c.fillStyle = paletteColor('shade.shadow'); c.beginPath(); c.ellipse(0, s * 0.5, s * (a ? a.aspect : 1) * 0.45, s * 0.07, 0, 0, 7); c.fill(); c.globalAlpha = g; }
    (a ? a.draw : placeholder)(c, s, o);
    c.restore();
  },
  /* a whole background */
  scene(c, W, H, id, o = {}){
    c = unwrap(c);
    if (!drawScene(c, W, H, id, o)){ missing.add(String(id).slice(0, 40)); c.fillStyle = paletteColor('sky.low'); c.fillRect(0, 0, W, H); }
  },
  /* a few words: o.color, o.align ('center' by default), o.outline (a colour behind them, for reading over anything). Short, and always
     through the words check (the runtime guards fillText). */
  text(c, str, x, y, size, o = {}){
    c = unwrap(c);
    const t = String(str == null ? '' : str).slice(0, 40), px = Math.max(8, Math.min(400, Number(size) || 24));
    c.save(); c.font = `800 ${Math.round(px)}px "Segoe UI Variable Display","Segoe UI",-apple-system,Inter,system-ui,sans-serif`;
    c.textAlign = o.align === 'left' || o.align === 'right' ? o.align : 'center'; c.textBaseline = 'middle'; c.lineJoin = 'round';
    if (o.outline){ c.lineWidth = px * 0.2; c.strokeStyle = o.outline; c.strokeText(t, x, y); }
    c.fillStyle = o.color || paletteColor('earth.snow'); c.fillText(t, x, y); c.restore();
  },
  list(kind){
    const rows = Object.values(ASSETS).map(a => ({ id: a.id, name: a.name, kind: a.kind, tags: a.tags, aspect: a.aspect, poses: a.poses, faces: a.faces }));
    for (const [id, s] of Object.entries(SCENES)) rows.push({ id, name: s.name, kind: 'scene', tags: s.tags.split(' '), aspect: 16 / 9, poses: null, faces: null });
    return kind ? rows.filter(r => r.kind === kind) : rows;
  },
  missing
};
export default assets;

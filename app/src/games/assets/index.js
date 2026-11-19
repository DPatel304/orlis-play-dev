/* The asset library: everything a creator's game may draw with, in one place. A game made with Create doesn't draw its own
   art - it asks for a piece by name and the library draws it, in the house style, the same in every game:

     Orlis.assets.draw(c, 'giraffe', x, y, size, { flip: true })   a piece, centred on (x, y), `size` pixels tall
     Orlis.assets.scene(c, W, H, 'meadow', { t })                  a whole background, behind everything
     Orlis.assets.list(kind?)                                      what there is: [{ id, name, kind, tags, aspect, poses, faces }]
     Orlis.assets.has(id)

   kinds: 'character' (Cubo, with his moves and faces), 'animal', 'food', 'nature', 'thing' (props, vehicles, places...),
   'effect', 'scene'. Options for draw: pose and face (Cubo), t (seconds, for the ones that move; 0..1 for the effects),
   color (the ones that take one), flip, rotate, alpha, shadow. A name that isn't in the library draws a friendly "?" box
   and is noted in `missing`, so a game still runs and the check can say what to ask for.

   The library is why a game made in Create always looks like an Orlis game, and why it can't show anything that hasn't been
   looked at: new pieces are added here (by request, approved by the Orlis owner), and games only ever name them. */
import { drawFigure, POSE_NAMES, FACE_NAMES } from '../figure.js';
import { EMOJI } from './emoji.js';
import { PROPS } from './props.js';
import { SCENES, drawScene } from './scenes.js';

const ASSETS = {};
const add = (a) => { ASSETS[a.id] = { aspect: 1, tags: [], poses: null, faces: null, ...a }; };

/* Cubo: the Orlis cube, flat like a sticker. size is his height (about 2.3 of his body units). */
add({ id: 'cubo', name: 'Cubo', kind: 'character', tags: ['person', 'cube'], aspect: 0.8, poses: POSE_NAMES, faces: FACE_NAMES,
  /* (his drawing is centred on his middle; this centres the whole of him, head to feet, on the point asked for) */
  draw(c, s, o){ drawFigure(c, o.pose || 'freeze', 0, 0.44 * (s / 2.3), s / 2.3, o.t || 0, o.face || null, !!o.marks); } });

/* the emoji pieces, by their kind */
const KIND = { animal: 'animal', food: 'food', nature: 'nature' };
for (const [id, ch, name, tags] of EMOJI){
  const t = tags.split(' '), kind = KIND[t[0]] || 'thing';
  add({ id, name, kind: t[0] === 'effect' ? 'effect' : kind, tags: t, aspect: 1,
    draw(c, s){ c.fillStyle = '#000'; c.font = `${Math.round(s * 0.86)}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ch, 0, s * 0.04); } });
}

/* the pieces drawn in code */
for (const [id, [name, tags, aspect, draw]] of Object.entries(PROPS)){
  const t = tags.split(' '), kind = t[0] === 'effect' ? 'effect' : t[0] === 'nature' || t[0] === 'animal' ? t[0] : 'thing';
  add({ id, name, kind, tags: t, aspect, draw });
}

export const missing = new Set();

/* a name that isn't in the library: a "?" box, so the game still runs */
function placeholder(c, s){
  c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.roundRect(-s / 2, -s / 2, s, s, s * 0.14); c.fill();
  c.setLineDash([s * 0.1, s * 0.07]); c.lineWidth = s * 0.04; c.strokeStyle = '#2b2275'; c.stroke(); c.setLineDash([]);
  c.fillStyle = '#2b2275'; c.font = `800 ${Math.round(s * 0.6)}px sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('?', 0, s * 0.04);
}

export const assets = {
  has: (id) => !!ASSETS[id] || !!SCENES[id],
  /* a piece, centred on (x, y), size pixels tall. */
  draw(c, id, x, y, size, o = {}){
    const a = ASSETS[id], s = Math.max(1, Number(size) || 1);
    if (!a) missing.add(String(id).slice(0, 40));
    c.save();
    c.translate(x, y);
    if (o.rotate) c.rotate(o.rotate);
    if (o.flip) c.scale(-1, 1);
    if (o.alpha != null) c.globalAlpha *= Math.max(0, Math.min(1, o.alpha));
    if (o.shadow){ c.fillStyle = 'rgba(58,51,96,.16)'; c.beginPath(); c.ellipse(0, s * 0.5, s * (a ? a.aspect : 1) * 0.45, s * 0.07, 0, 0, 7); c.fill(); }
    (a ? a.draw : placeholder)(c, s, o);
    c.restore();
  },
  /* a whole background */
  scene(c, W, H, id, o = {}){
    if (!drawScene(c, W, H, id, o)){ missing.add(String(id).slice(0, 40)); c.fillStyle = '#cfe9f3'; c.fillRect(0, 0, W, H); }
  },
  list(kind){
    const rows = Object.values(ASSETS).map(a => ({ id: a.id, name: a.name, kind: a.kind, tags: a.tags, aspect: a.aspect, poses: a.poses, faces: a.faces }));
    for (const [id, s] of Object.entries(SCENES)) rows.push({ id, name: s.name, kind: 'scene', tags: s.tags.split(' '), aspect: 16 / 9, poses: null, faces: null });
    return kind ? rows.filter(r => r.kind === kind) : rows;
  },
  missing
};
export default assets;

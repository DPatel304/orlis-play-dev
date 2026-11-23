/* The avatar maker (decision 0042): a child makes the one cube character that is them in every game by choosing five things - their
   colour (a favourite, which is also their player colour), their face, something on top (hair pieces too), an outfit with a second colour,
   and one extra - with big picture choices, a "Surprise me", and a live preview that waves back. Saved on their profile on the family's
   Orlis server, so it's theirs on any PC. Colours are palette names (0040).

     openMaker(profile, { onDone })   a card over the page; onDone(look) after it's saved
     faceOf(profile, size)            an element for their face: their character's portrait, or (while making is off) their old picture */
import { iconHTML } from './icons.js';
import { button, onPick } from './cursor.js';
import { screen, h } from './screens.js';
import { sfx } from '../audio/sound.js';
import { account, AVATARS } from './account.js';
import { body, head, portrait } from './avatar-art.js';
import { PARTS, normalizeLook, storable, surprise } from './look.js';
import { color } from '../games/assets/palette.js';
import { assets } from '../games/assets/index.js';

/* Making your own avatar is off for now: everyone plays as the two
   generic crew avatars (crew.js GENERIC), and profiles keep their pictures.
   Turn this on to bring the maker back (Family, Add a kid). */
export const MAKING = true;

/* a small canvas, sharp on any screen, drawn by fn(c, size) */
function pic(size, fn, cls = 'avpic'){
  const cv = document.createElement('canvas'); cv.className = cls;
  const k = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
  cv.width = cv.height = Math.round(size * k);
  const c = cv.getContext && cv.getContext('2d');
  if (c){ c.scale(k, k); fn(c, size); cv.redraw = (...a) => { c.clearRect(0, 0, size, size); fn(c, size, ...a); }; }
  return cv;
}

/* opts.bare: no cream paper edge, only the black outline. The canvas has redraw(face) to show an expression (see avatar-art.js head), redraw() for the rest face. */
export function faceOf(profile, size = 48, { tile = true, bare = false } = {}){
  if (MAKING && profile) return pic(size, (c, s, face = null) => portrait(c, s / 2, s / 2, tile ? s : s * 1.2, normalizeLook(profile.look), 1.3, { tile, bare, face }), 'avface');
  const span = document.createElement('span'); span.className = 'av';
  span.innerHTML = iconHTML(AVATARS[profile && profile.avatar] || AVATARS.cube, 128);
  return span;
}
/* put their face in place of an element's emoji picture (.av) */
export function withFace(el, profile, size){
  const av = el.querySelector('.av');
  if (MAKING && av && profile) av.replaceWith(faceOf(profile, size));
  return el;
}

const TABS = [['colour', 'Colour'], ['face', 'Face'], ['top', 'On top'], ['outfit', 'Outfit'], ['extra', 'Extra']];
const NAMES = {
  eyes: { dot: 'Dots', happy: 'Happy', wide: 'Wide', wink: 'Wink', sleepy: 'Sleepy', star: 'Stars' },
  mouth: { smile: 'Smile', grin: 'Big grin', o: 'Oh!', cat: 'Kitty', tongue: 'Silly' },
  top: { none: 'Nothing', tuft: 'Tuft', bob: 'Bob', cap: 'Cap', beanie: 'Beanie', bow: 'Bow', crown: 'Crown', phones: 'Headphones', ears: 'Bunny', flower: 'Flower' },
  outfit: { plain: 'Plain', stripes: 'Stripes', stars: 'Stars', dots: 'Spots', overalls: 'Overalls', hoodie: 'Hoodie' },
  extra: { none: 'Nothing', glasses: 'Glasses', scarf: 'Scarf', cape: 'Cape', freckles: 'Freckles', cheeks: 'Rosy cheeks' }
};

export function openMaker(profile, { onDone = () => {} } = {}){
  sfx.select?.();
  let look = storable(profile.look);
  let tab = 'colour', t = 0, raf = 0, wave = 0;
  const s = screen('dim setscreen avmaker'); s.style.zIndex = 7;
  const card = h('div', 'avcard');
  const left = h('div', 'avleft'), right = h('div', 'avright');
  const stage = document.createElement('canvas'); stage.className = 'avstage';
  left.append(stage, h('div', 'avname', '')); left.lastChild.textContent = profile.name;
  const tabs = h('div', 'avtabs'), opts = h('div', 'avopts'), foot = h('div', 'avfoot');
  right.append(tabs, opts, foot);
  card.append(left, right); s.appendChild(card);

  /* the preview: the whole avatar, breathing; a wave each time it changes */
  function paint(){
    const r = stage.getBoundingClientRect(), k = Math.min(2, devicePixelRatio || 1);
    const w = Math.max(1, Math.round(r.width * k)), hh = Math.max(1, Math.round(r.height * k));
    if (stage.width !== w || stage.height !== hh){ stage.width = w; stage.height = hh; }
    const c = stage.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0); c.clearRect(0, 0, r.width, r.height);
    body(c, r.width / 2, r.height * 0.93, r.height * 0.8, look, t, wave > 0 ? 'wave' : 'stand');
  }
  const loop = (now) => { t = now / 1000; wave = Math.max(0, wave - 1 / 60); paint(); raf = requestAnimationFrame(loop); };
  raf = requestAnimationFrame(loop);
  const set = (k, v) => { look = { ...look, [k]: v }; wave = 1.2; sfx.pop?.(); fill(); };
  const setFace = (k, v) => { look = { ...look, face: { ...look.face, [k]: v } }; wave = 1.2; sfx.pop?.(); fill(); };

  /* a choice: a picture, picked */
  const tile = (draw, label, on, fn) => {
    const b = onPick(button('', 'avtile' + (on ? ' on' : '')), fn);
    b.insertBefore(pic(118, draw), b.firstChild);
    b.querySelector('.lbl').textContent = label;
    return b;
  };
  /* a colour: a round swatch of the colour itself */
  const swatches = (list, current, pick, title) => {
    const row = h('div', 'avswatches');
    for (const name of list){
      const b = onPick(button('', 'avswatch' + (current === name ? ' on' : '')), () => pick(name));
      b.style.setProperty('--sw', color(name)); b.setAttribute('aria-label', name); row.appendChild(b);
    }
    return [h('div', 'avlabel', title), row];
  };
  const grid = (list, names, current, pick, draw) => {
    const g = h('div', 'avgrid');
    for (const v of list) g.appendChild(tile((c, sz) => draw(c, sz, v), names[v], current === v, () => pick(v)));
    return g;
  };
  const headPic = (c, sz, l) => head(c, sz / 2, sz * 0.5, sz * 0.3, l, 1.3);
  const bodyPic = (c, sz, l) => body(c, sz / 2, sz * 0.97, sz * 0.9, l, 1.3, 'stand', { still: true });
  const favs = PARTS.colour.map(n => 'fav.' + n);

  function fill(){
    tabs.innerHTML = '';
    for (const [id, name] of TABS) tabs.appendChild(onPick(button(name, 'avtab' + (tab === id ? ' on' : '')), () => { tab = id; sfx.nav?.(); fill(); }));
    opts.innerHTML = '';
    if (tab === 'colour') opts.append(...swatches(favs, 'fav.' + look.colour, (n) => set('colour', n.slice(4)), 'Your colour - in every game'));
    if (tab === 'face'){
      opts.append(h('div', 'avlabel', 'Eyes'), grid(PARTS.eyes, NAMES.eyes, look.face.eyes, (v) => setFace('eyes', v), (c, sz, v) => headPic(c, sz, { ...look, face: { ...look.face, eyes: v }, top: 'none', extra: 'none' })),
        h('div', 'avlabel', 'Mouth'), grid(PARTS.mouth, NAMES.mouth, look.face.mouth, (v) => setFace('mouth', v), (c, sz, v) => headPic(c, sz, { ...look, face: { ...look.face, mouth: v }, top: 'none', extra: 'none' })));
    }
    if (tab === 'top'){
      opts.appendChild(grid(PARTS.top, NAMES.top, look.top, (v) => set('top', v), (c, sz, v) => headPic(c, sz, { ...look, top: v, extra: 'none' })));
      opts.append(...swatches(PARTS.outfitColour, look.outfitColour, (n) => set('outfitColour', n), 'Its colour'));
    }
    if (tab === 'outfit'){
      opts.appendChild(grid(PARTS.outfit, NAMES.outfit, look.outfit, (v) => set('outfit', v), (c, sz, v) => bodyPic(c, sz, { ...look, outfit: v, top: 'none', extra: 'none' })));
      opts.append(...swatches(PARTS.outfitColour, look.outfitColour, (n) => set('outfitColour', n), 'Outfit colour'));
    }
    if (tab === 'extra') opts.appendChild(grid(PARTS.extra, NAMES.extra, look.extra, (v) => set('extra', v), (c, sz, v) => bodyPic(c, sz, { ...look, extra: v, top: 'none' })));
  }
  fill();

  const close = () => { cancelAnimationFrame(raf); s.remove(); removeEventListener('keydown', esc, true); };
  const esc = (e) => { if (e.key === 'Escape'){ e.preventDefault(); sfx.back?.(); close(); } };
  addEventListener('keydown', esc, true);
  const say = h('span', 'avsay', '');
  /* Surprise me: a painted star from the asset library (no emoji) */
  const surpriseBtn = onPick(button('Surprise me', 'setbtn avbig'), () => { look = surprise(); wave = 1.2; sfx.select?.(); fill(); });
  surpriseBtn.insertBefore(pic(30, (c, sz) => { try { assets.draw(c, 'star', sz / 2, sz / 2, sz * 0.95); } catch (e){ /* a blank icon, never a broken maker */ } }, 'avicon'), surpriseBtn.firstChild);
  foot.append(
    surpriseBtn,
    say,
    onPick(button('Cancel', 'setbtn avbig'), () => { sfx.back?.(); close(); }),
    onPick(button('Done', 'setbtn go avbig'), async () => {
      say.textContent = 'Saving…';
      try {
        const p = await account.call('PATCH', `/api/profiles/${encodeURIComponent(profile.id)}`, { look: storable(look) });
        account.set({ profiles: (account.state.profiles || []).map(x => x.id === profile.id ? { ...x, look: p.look } : x) });
        sfx.gold?.(); close(); onDone(p.look);
      } catch (e){ say.textContent = e.message || 'That didn’t save. Try again.'; }
    })
  );
  return { close };
}

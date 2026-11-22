/* The Story Player: Storytime. A passive game - nobody has to do anything; the TV tells a story and the family watches (the shell
   knows `passive`: the camera is off, there's no clock, score or 3-2-1, and the end is "The end", not "Well played").

   The look is a scrolling storybook: the whole story is one long page. Cubo stays at the same spot on the screen and the world slides
   past behind him as the story is told - still where nothing has ever moved, rolling when he starts to. Words stay on a fixed plate
   (moving words are hard to read), the one being said lit. A moon in the corner shows how much story is left.

   A story (stories/*.js) is a list of beats; this reads them aloud with the app's voice (a recording, or the computer's), moves the
   world, plays the sounds, and ends when the last beat does. A beat finishes when the voice finishes (or, with no voice - the sound's
   off - after the time the words would take to read). */
import { color, alpha } from './assets/palette.js';
import { voice } from '../audio/voice.js';
import { sfx } from '../audio/sound.js';
import { body, cuboFigure } from '../ui/avatar-art.js';
import { CUBO } from '../ui/look.js';
import { hud as hudState, spoken } from './hud.js';
import { PLAYER_COLORS } from '../tracking/pose.js';
import { MEADOW, AHEAD, PLACES } from '../stories/cubions-long-way-home.js';

const FONT = '"Segoe UI Variable Display","Segoe UI",-apple-system,Inter,system-ui,sans-serif';
const GROUND = 500, UNIT = 720;                 /* the world is drawn 720 high, scaled to the screen */
const CUBO_AT = 0.48;                            /* where Cubo stands across the screen */
const byte = (v) => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0');
const css = (a) => '#' + byte(a[0]) + byte(a[1]) + byte(a[2]);
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
/* a palette colour (with its tone) as the [r, g, b] the sky and ground mixing works in */
const pal = (name, t) => { const h = color(name, t); return [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)); };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SKY = { planet: [pal('night.sky'), pal('night.dusk')], day: [pal('sky.high'), pal('sky.sunGlow')], dusk: [pal('night.dusk'), pal('earth.peach')] };
const GRND = { planet: pal('night.farHills'), day: pal('meadow.fresh'), dusk: pal('meadow.fresh', 'shade') };
/* the meadow hills, far then near: by day, and at dusk */
const HILL_DAY = [pal('meadow.grass'), pal('meadow.leaf')], HILL_DUSK = [pal('meadow.leaf', 'shade'), pal('meadow.deep', 'shade')];
/* the Animal Gym animals, and where each stands (in front of Cubo at his stop) */
const ANIMALS = [
  { id: 'giraffe', e: '🦒', at: PLACES.giraffe + AHEAD, size: 230, y: 14, off: -600 },
  { id: 'bunny', e: '🐰', at: PLACES.bunny + AHEAD, size: 120, y: 14, off: -430 },
  { id: 'bird', e: '🐦', at: PLACES.bird + AHEAD, size: 100, y: -250, off: -120 },
  { id: 'frog', e: '🐸', at: PLACES.frog + AHEAD, size: 110, y: 14, off: -270 }
];
/* the children in the window: the same character, each a different favourite */
const KIDS = [{ colour: 'orange', top: 'tuft', outfit: 'stripes' }, { colour: 'pink', top: 'bow', face: { eyes: 'happy', mouth: 'grin' } },
  { colour: 'green', top: 'cap', outfit: 'dots' }, { colour: 'yellow', top: 'beanie', face: { eyes: 'wide', mouth: 'smile' } }]
  .map(k => ({ ...CUBO, face: { eyes: 'happy', mouth: 'smile' }, ...k }));
const readTime = (text) => text.trim().split(/\s+/).length * 0.4 + 0.7;

export function makeStory(story){
  return {
    id: story.id, name: story.name, unit: 'stories', stars: 1, accent: color('fav.purple'), secs: 180, endless: true, passive: true,
    moves: ['reach', 'jump', 'flap', 'squat'], store: { blurb: story.blurb },
    create(n){ return new Story(story, n); }
  };
}

class Story {
  constructor(story, players){
    this.story = story; this.players = players; this.beats = story.beats;
    const total = this.beats.reduce((a, b) => a + (b.t ? readTime(b.t) : 1.5) + (b.hold || 0), 0);
    this.total = total;
    this.i = -1; this.age = 0; this.t = 0; this.done = 0;     /* the beat, seconds in it, seconds in the story, seconds of story finished */
    this.pos = PLACES.planet; this.from = this.pos; this.speed = 0;
    this.over = false; this.heard = false; this.spoke = false; this.wait = 0; this.thumped = false;
    this.flash = 0; this.shake = 0; this.wob = 0; this.gather = 0; this.cardPose = null;
    this.ax = ANIMALS.map(a => a.at);               /* the animals' places in the world */
    /* ?beat=N in the address starts the story at beat N (for looking at a scene without sitting through the rest) */
    const skip = typeof location !== 'undefined' ? Number(new URLSearchParams(location.search).get('beat')) : 0;
    if (skip > 0 && skip < this.beats.length){
      for (let k = 0; k < skip; k++){ const b = this.beats[k]; if (b.to != null) this.pos = b.to; if (b.gather) this.gather = 1; if (b.wobble != null) this.wobTarget = b.wobble; }
      this.gathering = this.gather > 0; this.i = skip - 1;
      this.done = this.beats.slice(0, skip).reduce((a, b) => a + (b.t ? readTime(b.t) : 1.5) + (b.hold || 0), 0);
    }
    this.next();
  }
  get beat(){ return this.beats[this.i] || null; }
  /* on to the next beat: say it, plan the walk */
  next(){
    this.done += this.beat ? this.est : 0;
    this.i++; this.age = 0; this.heard = false; this.spoke = false; this.wait = 0; this.jumped = false; this.thumped = false;
    const b = this.beat;
    if (!b){ this.over = true; return; }
    this.est = (b.t ? readTime(b.t) : b.jump ? 1.6 : 1) + 0;
    this.from = this.pos; this.end = b.to != null && !b.jump ? b.to : this.pos;
    this.cardPose = b.card || null;
    if (b.t){ voice.say(b.say || b.t, 'nova'); }
    if (b.gather) this.gathering = true;
  }
  step(dt){
    if (this.over) return;
    this.t += dt; this.age += dt;
    const b = this.beat; if (!b) return;
    /* sounds */
    if (b.fx) for (const [at, name, arg] of b.fx){ if (at >= this.age - dt && at < this.age && sfx[name]) sfx[name](arg); }
    /* the flash: a beat of its own, Cubo is somewhere else when it's whitest */
    if (b.jump){
      this.flash = Math.sin(clamp(this.age / this.est, 0, 1) * Math.PI);
      if (!this.jumped && this.age >= this.est / 2){ this.jumped = true; this.pos = b.to; this.end = b.to; this.snap = true; }
      if (this.age >= this.est){ this.flash = 0; this.next(); }
      return;
    }
    if (b.shake && !this.thumped && this.age >= (b.fx ? b.fx[0][0] : 0)){ this.shake = 1; this.thumped = true; }
    this.shake = Math.max(0, this.shake - dt * 2.2);
    /* is it being said? Heard once the voice has begun; done once it stops. No voice: the reading time. */
    if (b.t){
      if (voice.speaking){ this.heard = true; this.spoke = true; }
      else if (this.heard && this.age > 0.8) this.spoke = false;
    }
    const sayDone = !b.t || (this.heard ? !this.spoke : this.age >= this.est) || this.age > this.est * 2.6 + 3;
    /* the walk: spread over the words; if the voice runs long Cubo waits, if it's short he hurries */
    const left = this.end - this.pos;
    if (left > 0.5){
      const want = sayDone ? 420 : left / Math.max(0.6, this.est - this.age + 0.4);
      const accel = 380 * dt, goal = Math.min(want, 330);
      this.speed += clamp(goal - this.speed, -accel, accel);
      this.pos = Math.min(this.end, this.pos + this.speed * dt);
      if (this.end - this.pos < 60) this.speed *= 0.93;       /* ease in to the stop */
    } else this.speed *= 0.8;
    const there = this.end - this.pos <= 0.5;
    this.wob += ((b.wobble != null ? b.wobble : this.wobTarget || 0) - this.wob) * Math.min(1, dt * 2);
    if (b.wobble != null) this.wobTarget = b.wobble;
    /* the animals come to Cubo, once */
    if (this.gathering){ this.gather = Math.min(1, this.gather + dt * 0.45); }
    if (sayDone && there){
      this.wait += dt;
      if (this.wait >= (b.hold || 0) + 0.35) this.next();
    }
  }
  /* the moves in the story are shown on the shell's card, the same as in every game */
  card(){ return this.beat && this.beat.card && this.age > 0.2 && this.age < this.est + (this.beat.hold || 0) + 1.5 ? this.beat.card : null; }
  hud(){ return { score: Array(Math.max(2, this.players)).fill(0), showLives: false, hideScore: true, hideClock: true, panel: [] }; }
  tally(){ return Array.from({ length: this.players }, (_, i) => ({ label: `Player ${i + 1}`, value: 0, color: PLAYER_COLORS[i] || color('earth.snow') })); }
  winner(){ return this.players >= 2 ? 0 : null; }
  value(){ return 0; }
  summary(){ return null; }
  get mood(){ return 0.08; }

  /* ---------- the picture ---------- */
  draw(c, W, H){
    const s = H / UNIT, vw = W / s, pos = this.pos;
    const cam = pos - CUBO_AT * vw;
    const meadow = pos >= MEADOW, dusk = clamp((pos - (PLACES.frog + 400)) / 900, 0, 1) * (this.gatheredEnough() ? 1 : 0.6);
    const k = this.beat && this.beat.refrain ? 1 : 0;
    c.save();
    if (this.shake > 0) c.translate((Math.random() - .5) * 14 * this.shake * s, (Math.random() - .5) * 14 * this.shake * s);
    c.scale(s, s);
    /* sky */
    const base = meadow ? 'day' : 'planet';
    const top = mix(SKY[base][0], SKY.dusk[0], dusk), bot = mix(SKY[base][1], SKY.dusk[1], dusk);
    const gr = c.createLinearGradient(0, 0, 0, UNIT * 0.72); gr.addColorStop(0, css(top)); gr.addColorStop(1, css(bot));
    c.fillStyle = gr; c.fillRect(-40, -40, vw + 80, UNIT + 80);
    const starA = meadow ? dusk * 0.7 : 1;
    if (starA > 0.02){ c.fillStyle = color('earth.snow'); for (let i = 0; i < 40; i++){ const x = (((i * 173) % 1400) - cam * 0.05 + 1400 * 3) % 1400 - 60, y = (i * 61) % 280 + 10;
      c.globalAlpha = starA * (0.4 + 0.4 * Math.sin(i + this.t * 1.4)); c.fillRect(x, y, 3, 3); } c.globalAlpha = 1; }
    /* hills: square on the Cube Planet, round on Earth */
    const hills = (par, off, col, amp, y0, blocky) => {
      c.fillStyle = col; c.beginPath(); c.moveTo(-20, UNIT);
      for (let x = -20; x <= vw + 20; x += blocky ? 20 : 20){
        let wx = x + cam * par + off; if (blocky) wx = Math.floor(wx / 120) * 120;
        c.lineTo(x, y0 - amp * (Math.sin(wx / 260) + 0.5 * Math.sin(wx / 97 + 2)));
      }
      c.lineTo(vw + 20, UNIT); c.fill();
    };
    if (!meadow){ hills(0.15, 0, color('night.hills'), 60, 520, true); hills(0.35, 900, color('night.farHills'), 46, 590, true);
      /* the clouds sit in neat little stacks */
      c.fillStyle = alpha('shade.light', 0.4);
      for (let i = 0; i < 5; i++){ const x = ((i * 380 - cam * 0.2) % (vw + 300) + vw + 300) % (vw + 300) - 100, y = 90 + (i % 2) * 70;
        for (let r = 0; r < 3; r++) for (let q = 0; q < 3 - r; q++){ c.fillRect(x + q * 34 + r * 17, y - r * 30, 30, 26); } }
    } else {
      hills(0.15, 400, css(mix(HILL_DAY[0], HILL_DUSK[0], dusk)), 50, 540);
      hills(0.35, 900, css(mix(HILL_DAY[1], HILL_DUSK[1], dusk)), 46, 590);
    }
    /* ground */
    const gc = mix(GRND[base], GRND.dusk, dusk);
    c.fillStyle = css(gc); c.fillRect(-20, GROUND, vw + 40, UNIT - GROUND + 20);
    c.fillStyle = css(mix(gc, pal('shade.shadow'), 0.15)); c.fillRect(-20, GROUND, vw + 40, 8);
    if (!meadow) this.planet(c, cam, vw);
    else this.meadow(c, cam, vw, dusk);
    /* the animals */
    if (meadow) this.animals(c, cam, vw);
    /* the home window, at the end (Cubo stands in front of it) */
    if (meadow) this.house(c, cam, vw, dusk);
    /* Cubo */
    this.cubo(c, vw);
    /* streaks, when the world is rolling fast */
    if (this.speed > 150){ c.strokeStyle = alpha('earth.snow', 0.33); c.lineWidth = 3; for (let i = 0; i < 6; i++){ const x = (((i * 211 - cam * 1.2) % vw) + vw) % vw, y = 300 + i * 50; c.beginPath(); c.moveTo(x, y); c.lineTo(x + 60, y); c.stroke(); } }
    c.restore();
    this.moon(c, W, H);
    this.plate(c, W, H, k);
    if (this.flash > 0){ c.fillStyle = alpha('earth.snow', this.flash); c.fillRect(0, 0, W, H); }
  }
  gatheredEnough(){ return this.i >= this.beats.length - 7 || this.pos > PLACES.frog + 100; }
  planet(c, cam, vw){
    for (let i = 0; i < 20; i++){
      const wx = i * 120 - cam; if (wx < -120 || wx > vw + 60) continue;
      c.fillStyle = color('space.rock'); c.beginPath(); c.roundRect(wx, GROUND + 18, 86, 86, 8); c.fill();
      c.fillStyle = color('shade.light'); c.beginPath(); c.roundRect(wx + 9, GROUND + 27, 68, 10, 4); c.fill();
    }
    /* the Cube Elders: a row of tall, stern cubes that click */
    for (let i = 0; i < 3; i++){
      const wx = 620 + i * 120 - cam; if (wx < -80 || wx > vw + 80) continue;
      c.save(); c.translate(wx, GROUND + 4);
      c.fillStyle = color('shade.mid'); c.beginPath(); c.roundRect(-34, -250, 68, 250, 6); c.fill(); c.strokeStyle = color('shade.ink'); c.lineWidth = 5; c.stroke();
      c.fillStyle = color('shade.ink'); c.fillRect(-20, -205, 16, 5); c.fillRect(6, -205, 16, 5); c.fillRect(-12, -170, 24, 5);
      c.fillStyle = color('night.shade'); c.fillRect(-18, -196, 10, 9); c.fillRect(8, -196, 10, 9);
      const b = this.beat, clicking = b && b.fx && b.fx.some(f => f[1] === 'tick') && this.age < 1.4 && Math.floor(this.age * 4 + i) % 2 === 0;
      if (clicking){ c.fillStyle = color('earth.snow'); c.font = `700 24px ${FONT}`; c.textAlign = 'center'; c.fillText('click', 0, -268); }
      c.restore();
    }
  }
  meadow(c, cam, vw, dusk){
    for (let i = 0; i < 60; i++){
      const wx = MEADOW + 200 + i * 130 + ((i * 53) % 60) - cam; if (wx < -80 || wx > vw + 80) continue;
      this.emoji(c, i % 3 === 0 ? '🌳' : i % 3 === 1 ? '🌼' : '🌿', wx, GROUND + (i % 3 === 0 ? 6 : i % 3 === 1 ? 30 : 24), i % 3 === 0 ? 110 : 44);
    }
  }
  emoji(c, e, x, y, size, rot = 0, flip = false){
    c.save(); c.translate(x, y); if (rot) c.rotate(rot); if (flip) c.scale(-1, 1);
    c.font = `${size}px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",serif`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillText(e, 0, 0); c.restore();
  }
  animals(c, cam, vw){
    const b = this.beat, ease = this.gather * this.gather * (3 - 2 * this.gather);
    ANIMALS.forEach((a, i) => {
      const x = a.at + (this.pos + a.off - a.at) * ease;                      /* gathered, they stand around Cubo */
      const sx = x - cam; if (sx < -200 || sx > vw + 200) return;
      const bob = a.id === 'bird' ? Math.sin(this.t * 3 + i) * 10 : 0;
      const w = this.wob * (0.22 * Math.sin(this.t * 5 + i * 1.7)), hop = this.wob * Math.abs(Math.sin(this.t * 4 + i)) * 24;
      this.emoji(c, a.e, sx, GROUND + a.y - bob - hop, a.size, w, a.id !== 'frog' && a.id !== 'bunny' ? false : false);
    });
  }
  /* Cubo, the flat sticker, on the shell's own figure */
  cubo(c, vw){
    const b = this.beat, moving = this.speed > 12;
    let pose = b && (b.card || b.pose) || (moving ? (this.speed > 240 ? 'run' : 'march') : 'freeze');
    if (b && b.card && !(this.age > 0.2)) pose = 'freeze';
    const x = CUBO_AT * vw + (b && b.wobble ? Math.sin(this.t * 14) * 3 * this.wob : 0), h = 210;
    cuboFigure(c, x, GROUND + 22, h, pose, this.t, b && b.face || null);
  }
  house(c, cam, vw, dusk){
    const hx = PLACES.home + 400 - cam; if (hx < -400 || hx > vw + 400) return;
    c.save(); c.translate(hx, GROUND); c.scale(0.8, 0.8);
    c.fillStyle = color('shade.line'); c.fillRect(-240, -330, 480, 330);
    c.fillStyle = color('earth.brick'); c.beginPath(); c.moveTo(-280, -330); c.lineTo(0, -470); c.lineTo(280, -330); c.closePath(); c.fill();
    /* the warm window, with a TV and children who wobble */
    const glow = c.createRadialGradient(0, -170, 20, 0, -170, 330); glow.addColorStop(0, alpha('sky.sunGlow', 0.55 * dusk)); glow.addColorStop(1, alpha('sky.sunGlow', 0));
    c.fillStyle = glow; c.fillRect(-340, -420, 680, 560);
    c.fillStyle = color('sky.sunGlow'); c.fillRect(-150, -270, 300, 200);
    c.fillStyle = color('night.sky'); c.fillRect(-80, -240, 160, 100); c.fillStyle = alpha('sky.high', 0.6 + 0.3 * Math.sin(this.t * 3)); c.fillRect(-72, -232, 144, 84);
    [-105, -35, 35, 105].forEach((kx, i) => { const w = Math.sin(this.t * 4 + i * 1.3) * 7; body(c, kx + w, -22 + Math.abs(w) * 0.5, 150, KIDS[i], this.t + i, 'stand'); });
    /* the sill hides them from the waist down: the wall's own colour, drawn over their legs */
    c.fillStyle = color('shade.line'); c.fillRect(-160, -70, 320, 70); c.fillStyle = color('earth.path'); c.fillRect(-160, -76, 320, 8);
    c.restore();
  }
  /* the moon in the corner: how much story is left */
  moon(c, W, H){
    const r = H * 0.05, x = W * 0.93, y = H * 0.12, left = 1 - clamp((this.done + (this.beat ? Math.min(this.age, this.est) : 0)) / this.total, 0, 1);
    c.save(); c.beginPath(); c.arc(x, y, r, 0, 7); c.clip();
    c.fillStyle = alpha('earth.snow', 0.28); c.fillRect(x - r, y - r, r * 2, r * 2);
    c.fillStyle = color('sky.sun'); c.fillRect(x - r, y - r, r * 2 * left, r * 2); c.restore();
  }
  /* the plate: a soft low plate with the words, the one being said lit */
  plate(c, W, H, refrain){
    const b = this.beat; if (!b || !b.t || this.stillMode) return;      /* (not in a cover's still: the title is painted on it) */
    const size = Math.round(H * (refrain ? 0.054 : 0.044)), lh = size * 1.3, maxW = W * 0.58;
    c.save(); c.font = `600 ${size}px ${FONT}`; c.textBaseline = 'middle';
    const words = b.t.split(/\s+/), sp = c.measureText(' ').width, lines = []; let cur = [], w = 0;
    for (const word of words){ const ww = c.measureText(word).width; if (cur.length && w + sp + ww > maxW){ lines.push(cur); cur = []; w = 0; } w += (cur.length ? sp : 0) + ww; cur.push({ word, w: ww }); }
    if (cur.length) lines.push(cur);
    const ph = lines.length * lh + size * 0.9, pw = Math.min(W * 0.6, Math.max(...lines.map(l => l.reduce((a, x) => a + x.w + sp, -sp))) + size * 2.2), py = H * 0.96 - ph, px = W * 0.5 + W * 0.02 - pw / 2;
    c.fillStyle = alpha('night.shade', 0.62); c.beginPath(); c.roundRect(px, py, pw, ph, size * 0.8); c.fill();
    const count = words.length, shown = this.heard || !voice.speaking ? clamp(this.age / Math.max(0.5, this.est - 0.5), 0, 1) : clamp(this.age / this.est, 0, 1);
    const cur2 = Math.min(count - 1, Math.floor(shown * count)); let n = 0; c.textAlign = 'left';
    lines.forEach((ln, li) => {
      let x = W * 0.5 + W * 0.02 - (ln.reduce((a, o) => a + o.w + sp, -sp)) / 2; const y = py + size * 0.45 + lh * (li + 0.5);
      for (const o of ln){
        const now = n === cur2 && this.age < this.est + 0.6, past = n < cur2;
        if (now){ c.fillStyle = color('ui.gold'); c.shadowColor = color('ui.gold'); c.shadowBlur = size * 0.4; } else { c.shadowBlur = 0; c.fillStyle = past ? color('earth.snow') : alpha('earth.snow', 0.55); }
        if (b.refrain && past) c.fillStyle = color('ui.gold');
        c.fillText(o.word, x, y); x += o.w + sp; n++;
      }
    });
    c.restore();
  }
}

/* The living pictures on the menu tiles: a small window into each game, so a
   child picks by what they see rather than by a name they can't read yet.

   Each poster is painted with the game's own scenery, so it looks like what
   you get, with a few of the game's things moving in front: balloons bobbing
   for Pop Party and the castle. A game without a poster gets a soft wash of its accent colour. */
import { Scene } from '../games/pop-party-scene.js';
import { glow } from './backdrop.js';
import { drawKid, KID_SKINS } from './kids.js';
import { P as lkpP, RUN as LKP_RUN, drawCorridor, drawBeam, drawCrystal, drawCrew as drawSpaceCrew, setPalette as setLkpPalette } from '../games/lkp-art.js';
import { LEVELS } from '../games/lkp-levels.js';
import { finish as finishLkp } from '../games/lkp-world.js';
import { head } from './avatar-art.js';
import { GENERIC } from './crew.js';
import { PLAYER_COLORS } from '../tracking/pose-shared.js';
import { PADS as CASTLE_PADS, along as castleAlong, PATHS as CASTLE_PATHS, drawMeadow, drawCastle, drawTower, drawMonster, drawTree as drawCastleTree, TREES, drawTent, inked } from '../games/castle-art.js';

const hash = (i, k = 1) => (((i + 1) * 2654435761 * k) % 4294967296) / 4294967296;

function popParty(){
  const scene = new Scene();
  const HUES = ['#ff6b9d', '#4aa8ff', '#ffd24a', '#53e59a', '#b06bff', '#ff9f45', '#4ad6d6'];
  const balloons = Array.from({ length: 9 }, (_, i) => ({
    x: 0.08 + (i / 8) * 0.84 + (hash(i, 3) - 0.5) * 0.06, y: 0.2 + hash(i, 5) * 0.42,
    r: i === 4 ? 0.17 : i === 7 ? 0.05 : 0.08 + hash(i, 7) * 0.04, col: HUES[i % HUES.length], ph: hash(i, 11) * 6.28
  }));
  return (c, W, H, t) => {
    scene.step(1 / 60, { t, p: 0.35, storm: false, wind: 0, joy: 0.3, look: 0.5, rainbow: false });
    scene.drawBack(c, W, H);
    scene.drawFront(c, W, H);
    for (const b of balloons){
      const x = (b.x + Math.sin(t * 0.7 + b.ph) * 0.015) * W, y = (b.y + Math.sin(t * 1.1 + b.ph) * 0.03) * H;
      const r = b.r * H;
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = Math.max(1, H * 0.005);
      c.beginPath(); c.moveTo(x, y + r);
      c.quadraticCurveTo(x + r * 0.4 * Math.sin(t + b.ph), y + r * 2, x, y + r * 3); c.stroke();
      c.fillStyle = b.col;
      c.beginPath();
      c.moveTo(x, y - r);
      c.bezierCurveTo(x + r * 1.1, y - r, x + r * 1.1, y + r * 0.45, x, y + r);
      c.bezierCurveTo(x - r * 1.1, y + r * 0.45, x - r * 1.1, y - r, x, y - r);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,.45)';
      c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.4, r * 0.16, r * 0.26, -0.4, 0, 6.2832); c.fill();
    }
  };
}

function lastKnownPosition(){
  /* the painted look: level 1's world, the two crew running in their
     glass helmets, crystals ahead */
  return (c, W, H, t) => {
    setLkpPalette(LEVELS[0].palette);
    const z = t * 0.3;
    drawCorridor(c, W, H, z, t, 0);
    drawBeam(c, W, H, 0.34, t);
    for (const k of [-1, 0, 1]){ const p = lkpP(k * 0.45, 0.2, W, H); drawCrystal(c, p.x, p.y - H * 0.11 * p.k, H * 0.022 * p.k, t + k); }
    const hop = Math.max(0, Math.sin(t * 2.2)) * H * 0.08;
    [[0, -0.45], [1, 0.45]].forEach(([i, lane]) => {
      const p = lkpP(lane, LKP_RUN, W, H);
      drawSpaceCrew(c, p.x, p.y, H * 0.3, t + i * 0.4, PLAYER_COLORS[i], { air: i === 1 ? hop : 0, duck: 0, lean: 0, run: 1, runPh: t * 9 + i * 1.7, avatar: GENERIC[i] },
        (x, y, r) => head(c, x, y + r * 0.08, r * 0.86, GENERIC[i], t + i));
    });
    finishLkp(c, W, H, LEVELS[0].palette.world);
  };
}

function castleDefense(){
  return (c, W, H, t) => {
    drawMeadow(c, W, H);
    for (const tr of TREES) drawCastleTree(c, W, H, tr, Math.sin(t * 1.2 + tr.seed) * 0.025);
    inked(c, H * 0.0024, () => drawTent(c, W, H, t));
    const things = [];
    for (const [i, kind, lvl, col] of [[4, 'archer', 5, '#3da9ff'], [7, 'frost', 2, '#ff8a3d'], [9, 'cannon', 3, '#3fcf7f']]){
      const pad = CASTLE_PADS[i]; things.push({ y: pad.y, f: () => drawTower(c, W, H, pad, kind, lvl, -0.6 + Math.sin(t) * 0.3, col, t) });
    }
    for (const [k, kind] of [[0, 'slime'], [1, 'goblin'], [2, 'slime'], [3, 'bat'], [4, 'slime'], [5, 'goblin']]){
      const p = castleAlong((t * 0.03 + k * 0.15) % 1 * CASTLE_PATHS[0].total, 0);
      things.push({ y: p.y, f: () => drawMonster(c, p.x * W, p.y * H, H * 0.065, kind, t + k, p.dir, 0, false, 1) });
    }
    things.push({ y: 0.88, f: () => drawCastle(c, W, H, t, 15, 15, 3, 0, 0, 6) });
    inked(c, H * 0.0024, () => things.sort((a, b) => a.y - b.y).forEach(th => th.f()));
  };
}

function plain(accent){
  return (c, W, H) => {
    const g = c.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, accent); g.addColorStop(1, '#1b1636');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
  };
}

const POSTERS = { 'pop-party': popParty, 'last-known-position': lastKnownPosition, 'castle-defense': castleDefense };

export function poster(game){
  return (POSTERS[game.id] || (() => plain(game.accent)))();
}

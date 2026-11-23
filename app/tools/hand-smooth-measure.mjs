/* Before and after: a hand moving across the screen, seen by a camera at 18 samples a second, drawn at 165 a second.
   Run: cd app && node --import ./test/harness/register.mjs tools/hand-smooth-measure.mjs */
import { simulate, jumps } from './hand-smooth-sim.mjs';

const sweep = (speed) => (t) => { const u = (speed * t / 0.6) % 2; return { x: 0.2 + 0.6 * (u < 1 ? u : 2 - u), y: 0.5 }; };   /* back and forth, screen widths a second */
const wave = (t) => ({ x: 0.5 + 0.15 * Math.sin(2 * Math.PI * 1.5 * t), y: 0.5 });  /* a wave: 1.5 swings a second */
const rest = () => ({ x: 0.5, y: 0.5 });
const cases = [['sweep 0.3 screens/s', sweep(0.3)], ['sweep 0.8 screens/s', sweep(0.8)], ['wave 1.5 Hz', wave], ['holding still', rest]];
const fmt = (n) => n.toFixed(2).padStart(7);
console.log('18 Hz camera, 165 Hz screen, 1920 px wide. Pixels.');
console.log('case                    | mode   | max jump | mean jump | frames not moving | mean distance from the true hand');
for (const [name, path] of cases){
  for (const mode of ['held', 'smooth']){
    const j = jumps(simulate({ path, mode }));
    console.log(`${name.padEnd(23)} | ${mode.padEnd(6)} | ${fmt(j.maxJump)} | ${fmt(j.meanJump)}   | ${(j.still * 100).toFixed(0).padStart(5)}%            | ${fmt(j.meanLag)}`);
  }
}

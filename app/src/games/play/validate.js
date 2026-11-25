/* Checks a game description against the vocabulary, and says what's wrong in plain words (and what was meant, when it can tell). */
import { stripEmoji } from '../assets/legacy-emoji.js';
import { PALETTE } from '../assets/palette.js';
import { MOVES, TRIGGERS, RESULTS, SOUNDS, FROM, COLORS, GAME_KEYS, THING_KEYS, LIMITS } from './vocabulary.js';

/* a name from the master palette: 'touch.mint' */
export const isPaletteName = (c) => { const [g, k, t] = String(c).split('.'); return !!(PALETTE[g] && k && PALETTE[g][k]) && (t === undefined || t === 'shade' || t === 'light'); };

/* the closest of some names to one that isn't there, if any is close */
export function didYouMean(name, options){
  const s = String(name).toLowerCase(); let best = null, far = 99;
  const dist = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
    for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
  for (const o of options){ const k = dist(s, o.toLowerCase()); if (k < far){ far = k; best = o; } }
  return best && far <= Math.max(2, Math.floor(best.length / 3)) ? best : null;
}
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const words = (text) => stripEmoji(text).trim().split(/\s+/).filter(Boolean).length;

/* env: { has(id): is it a piece in the library, scenes: [ids], poses: [names] } */
export function validate(spec, env){
  const out = [];
  const bad = (msg) => out.push(msg);
  const unknown = (what, name, options, where) => bad(`${where}: "${name}" isn't a ${what}` + (didYouMean(name, options) ? ` - did you mean "${didYouMean(name, options)}"?` : ` (choose from: ${options.join(', ')})`));
  const num = (v, key, where) => { const [lo, hi] = LIMITS[key] || [-Infinity, Infinity]; if (!isNum(v) || v < lo || v > hi) bad(`${where}: "${key}" must be a number from ${lo} to ${hi}.`); };

  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return ['Orlis.play needs an object: Orlis.play({ "secs": 90, "scene": "meadow", "things": [ ... ] }).'];
  for (const k of Object.keys(spec)) if (!(k in GAME_KEYS)) unknown('game setting', k, Object.keys(GAME_KEYS), 'the game');
  if (spec.endless !== true) num(spec.secs ?? 90, 'secs', 'the game'); else if (!spec.goal) bad('the game: an endless game needs a goal, or it can never end.');
  if (spec.scene !== undefined && !env.scenes.includes(spec.scene)) unknown('scene', spec.scene, env.scenes, 'the game');
  if (spec.hint !== undefined){ if (typeof spec.hint !== 'string' || !spec.hint.trim()) bad('the game: "hint" is a few words, like "Catch the stars!" (with "hintIcon": "glowstar" for the picture).'); else if (words(spec.hint) > 4) bad(`the game: the hint "${spec.hint}" is more than four words - up to four words, and a painted icon from the library in "hintIcon".`); }
  if (spec.hintIcon !== undefined && (typeof spec.hintIcon !== 'string' || !env.has(spec.hintIcon))) unknown('icon in the library', spec.hintIcon, env.pieceNames || [], 'the game: "hintIcon"');
  if (spec.hintFor !== undefined) num(spec.hintFor, 'hintFor', 'the game');
  if (spec.health !== undefined && spec.health !== true && spec.health !== false) bad('the game: "health" is true or false.');
  if (spec.card !== undefined && !env.poses.includes(spec.card)) unknown('move', spec.card, env.poses, 'the game: "card"');
  if (spec.cardFor !== undefined) num(spec.cardFor, 'cardFor', 'the game');
  if (spec.goal !== undefined){ if (!spec.goal || !isNum(spec.goal.score) || spec.goal.score < 1) bad('the game: "goal" is { "score": a number }.'); }
  if (!Array.isArray(spec.things) || !spec.things.length) bad('the game: "things" is a list with at least one thing in it.');
  else {
    if (spec.things.length > 12) bad('the game: no more than 12 things.');
    const names = spec.things.map(t => t && t.name).filter(Boolean);
    spec.things.forEach((t, i) => {
      const where = `thing ${i + 1}` + (t && t.name ? ` ("${t.name}")` : '');
      if (!t || typeof t !== 'object' || Array.isArray(t)) return bad(where + ' must be an object.');
      for (const k of Object.keys(t)) if (!(k in THING_KEYS)) unknown('thing setting', k, Object.keys(THING_KEYS), where);
      const pieces = Array.isArray(t.piece) ? t.piece : [t.piece];
      if (t.piece === undefined || !pieces.length) bad(where + ': it needs a "piece" from the library.');
      for (const p of pieces) if (typeof p !== 'string' || !env.has(p)) unknown('piece in the library', p, env.pieceNames || [], where);
      if (t.color !== undefined) for (const c of (Array.isArray(t.color) ? t.color : [t.color])) if (!(c in COLORS) && !isPaletteName(c) && !/^#[0-9a-f]{6}$/i.test(String(c))) bad(`${where}: colour "${c}" is a palette name like touch.mint (or one of ${Object.keys(COLORS).join(', ')}).`);
      if (t.size !== undefined) num(t.size, 'size', where);
      if (t.speed !== undefined) num(t.speed, 'speed', where);
      if (t.sway !== undefined) num(t.sway, 'sway', where);
      if (t.count !== undefined) num(t.count, 'count', where);
      const moves = t.moves ?? 'stay';
      if (!(moves in MOVES)) unknown('movement', moves, Object.keys(MOVES), where + ': "moves"');
      if (t.each !== undefined && t.each !== true && t.each !== false) bad(where + ': "each" is true or false.');
      if (t.each === true && moves !== 'bounce') bad(where + ': "each" is for a ball (moves: "bounce"): one for every player.');
      if (t.at !== undefined && !(t.at && isNum(t.at.x) && isNum(t.at.y) && t.at.x >= 0 && t.at.x <= 1 && t.at.y >= 0 && t.at.y <= 1)) bad(where + ': "at" is { "x": 0 to 1, "y": 0 to 1 }.');
      if (t.appears !== undefined){
        const a = t.appears;
        if (!a || typeof a !== 'object') bad(where + ': "appears" is { "every": seconds, "from": "top" }.');
        else {
          for (const k of Object.keys(a)) if (!['every', 'everyEnd', 'from', 'max', 'wait'].includes(k)) unknown('appears setting', k, ['every', 'everyEnd', 'from', 'max', 'wait'], where);
          num(a.every, 'every', where + ': appears');
          if (a.everyEnd !== undefined) num(a.everyEnd, 'every', where + ': appears "everyEnd"');
          if (a.max !== undefined) num(a.max, 'max', where + ': appears');
          if (a.wait !== undefined) num(a.wait, 'wait', where + ': appears');
          if (a.from !== undefined && !FROM.includes(a.from)) unknown('place for things to appear from', a.from, FROM, where + ': appears');
        }
      }
      if (t.appears === undefined && t.at === undefined && t.count === undefined && moves !== 'bounce') bad(`${where}: it needs "appears" (more keep coming) or "count"/"at" (it's there from the start).`);
      if (t.rules !== undefined && !Array.isArray(t.rules)) bad(where + ': "rules" is a list.');
      (t.rules || []).forEach((r, j) => {
        const rw = `${where}, rule ${j + 1}`;
        if (!r || typeof r !== 'object') return bad(rw + ' must be an object like { "when": "touched", "then": ["pop", "score", "vanish"] }.');
        if (!(r.when in TRIGGERS)) unknown('trigger', r.when, Object.keys(TRIGGERS), rw + ': "when"');
        if (r.when === 'age' && !isNum(r.after)) bad(rw + ': "age" needs "after": seconds.');
        if (!Array.isArray(r.then) || !r.then.length) return bad(rw + ': "then" is a list of what happens.');
        r.then.forEach((res) => {
          const key = typeof res === 'string' ? res : res && typeof res === 'object' ? Object.keys(res)[0] : null;
          if (!(key in RESULTS)) return unknown('result', key, Object.keys(RESULTS), rw + ': "then"');
          const v = typeof res === 'object' ? res[key] : undefined;
          if (typeof res === 'string' && RESULTS[key].value && !['score', 'grow', 'stack', 'hurt'].includes(key)) bad(`${rw}: "${key}" needs a value, like { "${key}": ... }.`);
          if (key === 'become' && !env.has(v)) unknown('piece in the library', v, env.pieceNames || [], rw + ': "become"');
          if (key === 'sound' && !SOUNDS.includes(v)) unknown('sound', v, SOUNDS, rw + ': "sound"');
          if (key === 'say'){ const t = v && typeof v === 'object' ? v.text : v; if (typeof t !== 'string' || words(t) > 4) bad(rw + ': "say" is up to four words ({ "say": "Well done!" }).'); else if (v && typeof v === 'object' && v.icon !== undefined && (typeof v.icon !== 'string' || !env.has(v.icon))) unknown('icon in the library', v.icon, env.pieceNames || [], rw + ': "say" icon'); }
          if (key === 'spawn' && !names.includes(v)) unknown('thing (give it a "name")', v, names, rw + ': "spawn"');
          if ((key === 'score' || key === 'grow') && typeof res === 'object' && !isNum(v)) bad(rw + `: "${key}" is a number.`);
          if (key === 'hurt' && typeof res === 'object' && !(isNum(v) && v > 0 && v <= 4)) bad(rw + ': "hurt" is a number from 1 to 4 (how many chunks).');
          if (key === 'stack' && typeof res === 'object') num(v, 'tower', rw + ': "stack"');
          if (key === 'kickUp' && moves !== 'bounce') bad(rw + ': "kickUp" is for a ball (moves: "bounce").');
        });
      });
    });
  }
  return out;
}

/* A creator's game.js is Orlis.play( ...the description, as JSON... ) with nothing but comments before it - no code at all, so there is
   nothing in it but the vocabulary. Returns { spec } or { error }. */
export function parseGame(text){
  const m = /^\s*(?:(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*)\s*)*Orlis\.play\(([\s\S]*)\)\s*;?\s*$/.exec(String(text));
  if (!m) return { error: 'game.js must be Orlis.play({ ... }) - a description of the game made of the ready-made words in the skill - with nothing but comments before it.' };
  try { return { spec: JSON.parse(m[1]) }; }
  catch (e){ return { error: `The game inside Orlis.play( ... ) must be valid JSON: names in "double quotes", no comments, no trailing commas, no code (${String(e.message).slice(0, 80)}).` }; }
}

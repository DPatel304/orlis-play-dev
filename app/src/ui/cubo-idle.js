/* Cubo's idle faces (owner, 2026-11-23): the head in the top right of Home is alive but calm. After ~8 s with no key or mouse input,
   every 4 to 9 s (random) he does ONE small expression for about a second, then goes back to his normal face. Any input returns him at
   once and restarts the idle timer. With reduced motion he only blinks.

   Pure part (tested): EXPRESSIONS, planNext(from, rand, reduced), tick(state, now, lastInput, rand, reduced).
   Live part: startIdleFace({ redraw, reduced, rand, now, timer, listen }) - redraws only when the face changes; stop() ends it. */

/* what each expression changes on the face (the drawing is avatar-art.js head's `face` option: eyes, mouth, brow, blink, look) */
export const EXPRESSIONS = {
  blink: { face: { blink: true }, dur: [0.18, 0.18], weight: 40 },
  lookleft: { face: { look: [-2.4, 0] }, dur: [1, 1.4], weight: 10 },
  lookright: { face: { look: [2.4, 0] }, dur: [1, 1.4], weight: 10 },
  smile: { face: { mouth: 'grin', eyes: 'dot' }, dur: [1.1, 1.5], weight: 12 },
  wink: { face: { eyes: 'wink', mouth: 'smile' }, dur: [1, 1.3], weight: 10 },
  oh: { face: { eyes: 'wide', mouth: 'o' }, dur: [1, 1.4], weight: 8 },
  squint: { face: { eyes: 'happy', mouth: 'smile' }, dur: [1.1, 1.5], weight: 10 }
};
export const IDLE_AFTER = 8, GAP = [4, 9];

/* which expression: weighted by how often; blinks only with reduced motion */
export function pick(rand, reduced = false){
  if (reduced) return 'blink';
  const names = Object.keys(EXPRESSIONS), total = names.reduce((n, k) => n + EXPRESSIONS[k].weight, 0);
  let r = rand() * total;
  for (const k of names){ r -= EXPRESSIONS[k].weight; if (r < 0) return k; }
  return 'blink';
}
/* the next one to play: starts `gap` seconds after `from` */
export function planNext(from, rand, reduced = false, gap = null){
  const name = pick(rand, reduced), d = EXPRESSIONS[name].dur;
  const g = gap == null ? GAP[0] + rand() * (GAP[1] - GAP[0]) : gap;
  const dur = d[0] + rand() * (d[1] - d[0]);
  return { name, start: from + g, end: from + g + dur };
}
/* One step. state: { plan: { name, start, end } | null }. Returns { state, playing: name | null }.
   Input in the last IDLE_AFTER seconds: nothing plays and the plan is dropped. Otherwise the first expression comes when the idle time
   reaches IDLE_AFTER, and each next one 4 to 9 s after the last one ended. */
export function tick(state, now, lastInput, rand, reduced = false){
  if (now - lastInput < IDLE_AFTER) return { state: { plan: null }, playing: null };
  let plan = state.plan || planNext(lastInput + IDLE_AFTER, rand, reduced, 0);
  for (let k = 0; now >= plan.end && k < 1000; k++) plan = planNext(plan.end, rand, reduced);   /* (catch up if ticks were missed) */
  return { state: { plan }, playing: now >= plan.start && now < plan.end ? plan.name : null };
}

/* ---- live ---- */
const INPUTS = ['keydown', 'mousemove', 'mousedown', 'pointerdown', 'touchstart', 'wheel'];
export function startIdleFace({ redraw, reduced = false, rand = Math.random, now = () => performance.now() / 1000,
  timer = { every: (f, ms) => setInterval(f, ms), cancel: (id) => clearInterval(id) },
  listen = (ev, f) => { addEventListener(ev, f, true); return () => removeEventListener(ev, f, true); } } = {}){
  let lastInput = now(), state = { plan: null }, shown = null, stopped = false, forcedUntil = 0;
  const show = (name) => { if (name === shown) return; shown = name; redraw(name ? EXPRESSIONS[name].face : null); };
  const onInput = () => { forcedUntil = 0; lastInput = now(); state = { plan: null }; show(null); };
  const offs = INPUTS.map(ev => listen(ev, onInput));
  const id = timer.every(() => { if (stopped) return; if (now() < forcedUntil) return; const r = tick(state, now(), lastInput, rand, reduced); state = r.state; show(r.playing); }, 100);
  return {
    /* a debug hook: play one expression now */
    play(name){ if (!stopped && EXPRESSIONS[name]){ forcedUntil = now() + 3; show(name); } },
    get stopped(){ return stopped; },
    stop(){ if (stopped) return; stopped = true; timer.cancel(id); offs.forEach(f => f()); shown = null; redraw(null); }
  };
}

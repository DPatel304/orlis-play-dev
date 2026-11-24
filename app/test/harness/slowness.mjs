/* How slow this machine is right now, for the browser tests' waits (the Peekaboo pair and tablet tests, the pad rigs).

   Those tests wait for real things (a page to draw, a game to react, a tablet to rejoin) with a deadline. The deadlines were fixed numbers, tuned on a
   quiet machine; with another test run or a build going they ran out for no fault of the game. A wait still ends the moment its thing happens - the
   deadline only matters when it does not - so the deadline is what scales: T(ms) is ms times how much slower than a quiet machine we are now.

   Measured, not guessed: a short busy loop is timed on the wall clock and on this process's own CPU time. On a quiet machine they are the same (ratio 1);
   when the machine is shared, the process waits for its turn and the wall clock runs ahead of its CPU (ratio 2 when it gets half the time). The ratio is
   re-measured on every call, and the worst seen so far is kept (load comes in waves), up to a cap so a really stuck test still ends. Below 1.2 nothing
   scales (a quiet machine keeps the original deadlines exactly). */
const CAP = 12, QUIET = 1.2;
let worst = 1;

function measure(){
  const c0 = process.cpuUsage(), w0 = performance.now();
  let x = 0; while (performance.now() - w0 < 30) for (let i = 0; i < 20000; i++) x += Math.sqrt(i);
  const c = process.cpuUsage(c0), cpu = (c.user + c.system) / 1000, wall = performance.now() - w0;
  return x < 0 || cpu < 1 ? 1 : wall / cpu;
}

/* how many times slower than a quiet machine, right now (1 when quiet) */
export function slowness(){
  const r = Math.max(measure(), measure());
  if (r >= QUIET) worst = Math.max(worst, Math.min(CAP, r * 1.5));
  return worst;
}
/* a deadline in ms, scaled to how busy the machine is */
export const T = (ms) => Math.round(ms * slowness());

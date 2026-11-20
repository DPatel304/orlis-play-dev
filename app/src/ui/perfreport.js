/* A performance report for one round, as plain text the owner can paste to the assistant: the build, the machine's graphics, the screen,
   the frame rate over time, and how bad the worst frames were. Nothing leaves the machine by itself. */
const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

export function buildReport({ build = 'dev', game = '', mode = '', frames = [], gpu = '', screen = '', pose = null, stagePerf = '' } = {}){
  const lines = [`Orlis performance report`, `build: ${build}`, `game: ${game}${mode ? ` (${mode})` : ''}`, `graphics: ${gpu || 'unknown'}`, `screen: ${screen || 'unknown'}`];
  if (pose) lines.push(`camera tracking: ${pose.fps.toFixed(0)} fps, inference ${pose.inferMs.toFixed(1)} ms, ${pose.people} player(s) tracked`);
  if (!frames || frames.length < 60){ lines.push('not enough frames to report (play a round first)'); return lines.join('\n'); }
  const sorted = frames.slice().sort((a, b) => a - b), n = frames.length, sum = frames.reduce((a, b) => a + b, 0), avg = sum / n;
  const over = (ms) => frames.filter(f => f > ms).length;
  lines.push(`frames: ${n} over ${(sum / 1000).toFixed(0)} s`);
  lines.push(`average: ${(1000 / avg).toFixed(0)} frames a second (${avg.toFixed(1)} ms)`);
  lines.push(`frame time: typical ${pct(sorted, 0.5).toFixed(1)} ms, slowest 5% over ${pct(sorted, 0.95).toFixed(1)} ms, slowest 1% over ${pct(sorted, 0.99).toFixed(1)} ms, worst ${sorted[n - 1].toFixed(0)} ms`);
  lines.push(`stutters: ${over(33.4)} frames slower than 30 fps, ${over(50)} slower than 20 fps, ${over(100)} over 100 ms`);
  /* the frame rate in 5-second slices, so a problem at one moment (the storm, a new colour) shows up */
  const slices = []; let t = 0, k = 0, cnt = 0;
  for (const f of frames){ t += f; cnt++; if (t >= 5000){ slices.push(Math.round(cnt / (t / 1000))); t = 0; cnt = 0; } }
  if (cnt > 10) slices.push(Math.round(cnt / (t / 1000)));
  lines.push(`frames a second, every 5 s: ${slices.join(' ')}`);
  if (stagePerf) lines.push(stagePerf);
  return lines.join('\n');
}

/* the graphics chip the page is really using, as the browser reports it (it can differ from the one Windows says it chose) */
export function gpuName(){
  try {
    const cv = document.createElement('canvas'), gl = cv.getContext('webgl') || cv.getContext('experimental-webgl');
    if (!gl) return 'no 3D graphics available';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  } catch (e){ return 'unknown'; }
}

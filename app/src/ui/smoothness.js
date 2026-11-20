/* How smoothly a round ran, from every frame's time in milliseconds. Shown to the owner on the results screen, so games and
   machines can be compared without any tools: the average rate, and how bad the slowest 5% of frames were (a stutter shows there). */
export function smoothness(ms, mode){
  if (!ms || ms.length < 60) return '';
  const sorted = ms.slice().sort((a, b) => a - b);
  const avg = ms.reduce((a, b) => a + b, 0) / ms.length;
  const p95 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
  return `Smoothness: ${Math.round(1000 / avg)} frames a second on average, the slowest 5% over ${Math.round(p95)} ms${mode ? ` (${mode})` : ''}`;
}

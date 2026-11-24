import test from 'node:test';
import assert from 'node:assert/strict';
import { rowX, colWidth, GAP, FIG } from '../src/ui/results-row.js';

/* The results screen puts each player in one column: a figure above, their chip below. With one to four players, at the sizes a TV
   and a laptop have, the columns are inside the picture, side by side, in seat order, and a figure is clear of its neighbours. */
for (const [W, H] of [[1920, 1080], [1280, 720], [1366, 768]]){
  test(`results row at ${W}x${H}: one to four columns, inside the picture, in order, figures clear of each other`, () => {
    const u = Math.min(H / 100, W * 0.005625);
    for (let n = 1; n <= 4; n++){
      const xs = Array.from({ length: n }, (_, k) => rowX(k, n, W, H));
      assert.ok(Math.abs(xs.reduce((a, b) => a + b, 0) / n - 0.5) < 1e-9, `${n}: the row is centred`);
      const half = colWidth(n) * u / 2 / W;
      assert.ok(xs[0] - half >= 0 && xs[n - 1] + half <= 1, `${n}: every chip is fully inside the picture`);
      for (let k = 1; k < n; k++){
        const pitch = (xs[k] - xs[k - 1]) * W;
        assert.ok(Math.abs(pitch - (colWidth(n) + GAP) * u) < 1e-6, `${n}: even pitch`);
        assert.ok(pitch > FIG.h * H * 0.62, `${n}: a figure (about 0.6 of its height wide) does not touch the next`);
      }
    }
  });
}

test('results row: the figures stand below the card (the card is centred at 33% and is at most about 45% tall)', () => {
  assert.ok(FIG.base - FIG.h * 0.97 >= 0.33 + 0.225 + 0.02, 'head of a figure under the card\'s lowest edge');
  assert.ok(FIG.base <= 0.9, 'feet above the chips');
});

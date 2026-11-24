/* The players on a results screen: each stands in their own place in one row along the bottom, with their chip (face, name, count)
   under them in the same column, so with one, two, three or four nobody overlaps anybody and nobody is behind the card.
   The chips are DOM (clean-screens.css, .gkids); the figures are drawn on the canvas by the game's ending. Both use these numbers:
   a column is colWidth(n) units wide with GAP between, the row is centred, and a figure stands over the middle of its column.
   (A unit, u, is min(1vh, .5625vw), as in the CSS.) */
export const GAP = 2;
export const colWidth = (n) => n <= 2 ? 38 : n === 3 ? 28 : 22;
/* how big and where the figures stand: height as a share of the picture's height, and the line their feet are on */
export const FIG = { h: 0.27, base: 0.865 };
/* the horizontal middle of place k of n, as a share of the picture's width */
export function rowX(k, n, W, H){
  const u = Math.min(H / 100, W * 0.005625);
  return 0.5 + (k - (n - 1) / 2) * (colWidth(n) + GAP) * u / W;
}

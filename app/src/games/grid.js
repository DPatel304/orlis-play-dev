/* The HUD grid: one invisible table over the whole screen, 20 columns by 11 rows of square cells. The shell keeps a frame
   around the edge (the top four rows, the bottom row, and a column on each side); the middle is the game's world.
   Every HUD piece sits in cells, so the same piece is always in the same place (see UI-STANDARD.md).

   The cells are square, sized to fit the screen (inset a little, for TV edges). A column on the left half hangs from the
   left edge, one on the right half from the right edge, and a piece that crosses the middle is centred, so on a very wide
   screen the HUD stays at the edges and the clock stays in the middle. Rows in the top half hang from the top and rows
   in the bottom half from the bottom. */
export const COLS = 20, ROWS = 11;

export function gridOf(W, H){
  const s = Math.round(Math.min(W, H) * 0.012), gw = W - 2 * s, gh = H - 2 * s;
  const C = Math.min(gw / COLS, gh / (ROWS + 0.25));
  return { s, gw, gh, C, pad: C * 0.14 };
}

/* the rectangle of a cell block (column, row, columns wide, rows tall), in pixels, without any inset */
export function block(W, H, col, row, cs = 1, rs = 1){
  const { s, gw, gh, C } = gridOf(W, H);
  const x = col + cs <= COLS / 2 ? s + col * C                               /* left half: from the left edge */
    : col >= COLS / 2 ? W - s - (COLS - col) * C                              /* right half: from the right edge */
    : s + (gw - COLS * C) / 2 + col * C;                                       /* across the middle: centred */
  const y = row + rs <= ROWS / 2 ? s + row * C : row >= Math.ceil(ROWS / 2) ? H - s - (ROWS - row) * C : s + (gh - ROWS * C) / 2 + row * C;
  return { x, y, w: cs * C, h: rs * C };
}

/* the same, a little smaller, for drawing a piece (so neighbouring pieces don't touch) */
export function cell(W, H, col, row, cs = 1, rs = 1){
  const b = block(W, H, col, row, cs, rs), p = gridOf(W, H).pad / 2;
  return { x: b.x + p, y: b.y + p, w: b.w - 2 * p, h: b.h - 2 * p, cx: b.x + b.w / 2, cy: b.y + b.h / 2 };
}

/* where the pieces the shell draws always go: [column, row, columns wide, rows tall] */
export const SLOTS = {
  clock: [8, 0, 4, 1],      /* the time, top centre */
  words: [7, 1, 6, 1],      /* the hint words, under the clock */
  goal:  [8, 2, 4, 1],      /* the goal bar, under the words */
  card:  [16, 0, 3, 3],     /* the move card, top right */
  badge: [14, 3, 5, 1],     /* the game's one badge, under the card, lined up with its right edge */
  panel: [1, 0, 6, 4],      /* the game's own corner, top left: scores in the first row, then chips and bars */
};
export const slot = (W, H, name) => cell(W, H, ...SLOTS[name]);
export const slotBlock = (W, H, name) => block(W, H, ...SLOTS[name]);

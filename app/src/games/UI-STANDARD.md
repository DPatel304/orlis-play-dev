# The Orlis game screen: a standard

Every game looks and behaves the same around its edges, so players learn the screen once and a new game never fights
the shell for space. The middle of the screen belongs to the game. The edges belong to this standard.

This is a standard, not a law: loosen it when a game needs it, but write the exception down (see the end).

All positions are shares of the screen, so they hold at any size. Code: `hud.js` (`hudZones`, `badge`, `sayBubble`,
`goalBar`), `figure.js` (the move card), `main.js` (`drawHUD`, `drawMoveCard`).

## The grid

One invisible table over the whole screen: **20 columns by 11 rows of square cells** (`grid.js`). The cells are sized to fit
the screen, inset a little for TV edges. Columns on the left half hang from the left edge, columns on the right half from
the right edge, and anything that crosses the middle is centred; rows in the top half hang from the top and rows in the
bottom half from the bottom. So on a very wide screen the HUD stays at the edges and the clock stays in the middle.

The shell keeps a frame: the **top four rows**, the **bottom row** and **one column on each side**. The middle (18 x 6 cells
on a 16:9 screen) is the game's world. A game gives back any of the frame it does not use: if it shows no clock, those cells are
its world.

```
col:  0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19
row 0   . [scores ....] . [ CLOCK  ] .  .  .  .  .  .  .
row 1   . [chips  ....] [ GOAL BAR (3 stars) ] .  .  .  .  .
row 2   . [bars   ....] [ HINT WORDS     ] .  .  .  .  .  .
row 3   . [chips  ....] .  .  .  .  .  .  .  .  .  .  .
rows 4-6: the sides (cols 0 and 19) and the game's world (cols 1-18)
row 7   . [CARD   ] .  .  .  .  .  .  .  .  .  .  .  .
row 8   . [ 3 x 3 ] .  .  .  .  .  .  .  .  .  .  .  .
row 9   . [       ] .  .  .  .  .  .  .  [ BADGE ....]
row 10: the bottom row
```

| Piece | Cells (col, row, wide, tall) | Who draws it | What a game does |
|---|---|---|---|
| Clock | 8, 0, 4, 1 (top centre) | shell | nothing: set the round length (`secs`); `hideClock` to give it back |
| Goal bar | 7, 1, 6, 1 | `goalBar` | only if there is something to fill; three stars light up on the way |
| Hint words | 7, 2, 6, 1 | `sayBubble` | a few words; the first ones of a round arrive big and dock; they fade after about 7 s |
| Move card | 1, 7, 3, 3 (bottom left); slides in from the left edge and out again | shell | answer `card()` with a move name, or `null` |
| Badge | 14, 9, 5, 1 (bottom right, right-aligned, as wide as its contents) | `badge` | optional: one streak, lives or combo |
| The game's corner | 1, 0, 6, 4 (top left) | shell, from `scorePill` / `chip` / `statusBar` | return `score` per player from `hud()` (or `hideScore: true`), and optionally `panel` rows (below) |
| Countdown, pause, results | centre, full screen | shell | nothing |
| The game's world | everything else | the game | everything |

`SLOTS` in `grid.js` is the table above in code, `cell(W, H, col, row, cols, rows)` gives a cell block's rectangle in pixels,
and `hudZones(W, H)` returns the shell's rectangles (`top`, `score`, `card`, `badge`) for `underHud(W, H, x, y)`, which says
whether a point is under one. Use them when placing targets. Move a piece by changing its cells in `SLOTS`; everything
(the zones, the badge, the card's slide-in) follows.

## The game's own corner (the one flexible part, for now)

Everything on the screen is the same in every game except this corner, the top left: cells 1 to 6 across, rows 0 to 3. The
scores take the first row, side by side, each in its player's colour; the game's own rows go under them, one per row,
three at most (`PANEL_ROWS`). It is built only from three shared pieces so it still looks like the same family:

| Piece | Look | Use it for |
|---|---|---|
| Score pill (`scorePill`) | a pill in the player's colour, big white number | a player's score; the shell draws these, first |
| Chip (`chip`) | cream pill, an emoji and a number | crystals, gold, lives, ammo |
| Bar (`statusBar`) | cream pill, an emoji and a filling track | XP, health, team progress |

A game asks for rows from `hud()`:

```js
hud(){ return { score: this.score, panel: [
  { icon: '\u{1F48E}', value: this.crystals },              // a chip
  { icon: '\u2B50', fill: this.xp / this.xpNeeded, color: 'gold' },  // a bar
] }; }
```

Rules for the corner: icons and numbers only (no words); bar colours come from `BAR_COLORS` (gold, rose, indigo), which are
never a player's colour or the arrows' orange; the shell stacks the rows, so a game does not position them (yet: placing a
piece in any cell, tall bars down the sides and wide ones along the bottom row are planned, see the backlog); numbers
bounce when they go up by themselves. A game with no per-player scores sets `hideScore: true` and uses only `panel`.

## Rules

1. **Keep targets out of the shell's areas.** Nothing a player has to touch, catch, pop or read goes under the clock, the
   words, the scores, the move card or the badge. The shell draws on top, so it would be hidden.
2. **Few words.** One hint at a time, under the goal bar, gone after about 7 seconds. The first words of a round arrive big in the middle and shrink into place (later ones just appear). No other text during play. Short words a
   six-year-old can read, or none: a picture does the job better.
3. **Two pill looks.** A player's score is a pill in their colour with a big white number. Information (the clock, the
   words, chips, bars, the badge) is a cream pill (`rgba(252,250,244,.96)`) with a bold dark number. Both have a shadow and
   the same bounce when the number changes. Anything the player can touch is never a pill.
4. **Colour means one thing.**
   - A player's colour is always theirs: blue, orange, green, purple (`PLAYER_COLORS`), for their score, hand marker and
     results row, in every game.
   - Orange arrows mean "move this way", and nothing else is that orange.
5. **A score is a number.** A whole number a child can follow, in the player's colour pill. A game whose count would climb into the hundreds
   (paint, distance) hides the score or shows progress instead (`goalBar`). A game with no winner can hide it too.
6. **The move card** shows the move being asked for, when it is asked for (the first seconds of a round, or each time the
   move changes). It slides in from the left edge and out again by itself; a game only says which move. It stays big enough
   to read from the sofa (3 cells, about 26% of the screen's height; not under 20%).
7. **One badge at most.** Bottom right, the cream pill as wide as its contents, an optional emoji and a number or word.
8. **Same motion.** Things slide in in about 0.45 s and out in about 0.3 s. Numbers bounce when they go up. Nothing flashes
   or strobes.
9. **Same sounds.** The same cheer, tick and whoosh for the same events everywhere.
10. **Results are the shell's.** A game gives `tally()`, `winner()` and optionally `summary()`; it draws nothing of its own
    while `hud.quiet` is on.

## Where the standard stops

- Last Known Position and Castle Defense (story games) have their own displays for crystals, gold, Nova and so on. They
  keep the clock and results, and stay out of the move card's box. Their displays count as their own world (Nova lives
  top left, where the scores would be).
- Pop Party shows no scores on purpose (nobody wins). Sky Painter hides its score (it counts painted cells).

## Loosening it

A game can break a rule if it has to. Do it on purpose and say so:
- add a line under "Where the standard stops" with the game, the rule, and why;
- keep the shell's areas readable (a game can move its own world, not the shell's pieces);
- if many games need the same exception, change the standard instead.

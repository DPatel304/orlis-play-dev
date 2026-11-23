# The Orlis game screen: a standard

Every game looks and behaves the same around its edges, so players learn the screen once and a new game never fights
the shell for space. The middle of the screen belongs to the game. The edges belong to this standard (decision 0034, built in
plan package U3).

This is a standard, not a law: loosen it when a game needs it, but write the exception down (see the end).

A game never places or sizes a HUD piece. It answers `hud()` with what it wants **in each dock**, and the shell
(`drawShellHud` in `hud.js`, called from `main.js`) lays the pieces out on the grid, draws them in the UI kit's look, bounces what
changes and dims what has been still. Code: `grid.js` (the cells and the anchors), `hud.js` (the pieces, the docks, `layoutDocks`,
`drawShellHud`, `hudZones`), `figure.js` (the move card and when it tucks away), `assets/icons.js` (the painted icons).

## The grid

One invisible table over the whole screen: **20 columns by 11 rows of square cells** (`grid.js`). The cells are sized to fit
the screen, inset **5%** from every edge (TVs can crop the edges). Columns on the left half hang from the left edge, columns on
the right half from the right edge, and anything that crosses the middle is centred; rows in the top half hang from the top and
rows in the bottom half from the bottom. So on a very wide screen the HUD stays at the edges and the clock stays in the middle.

A game gives back any dock it does not use: those cells are its world, and the keep-clear zones (`hudZones(W, H, hud())`) come
only from what is drawn.

```
col:  0 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 19
row 0   . [CORNER: scores  ] . [ CLOCK  ] . [ TOP RIGHT   ]
row 1   . [chips and bars  ] . [ GOAL    ] . [ (3 x 3 portrait,  ]
row 2   . [(rows left)     ] [ HINT WORDS     ] [ or 3 badges)    ]
row 3   . [                ] . . . . . . . . . . . .
rows 4-6: LEFT RAIL (col 0) .  the game's world (cols 1-18)  .  RIGHT RAIL (col 19)
row 7   . [CARD   ] .  .  .  .  .  .  .  .  .  .  .  .
row 8   . [ 3 x 3 ] .  .  .  .  .  .  .  .  .  .  .  .
row 9   . [       ] .  .  .  .  .  .  .  [ BADGE ....]
row 10    .  .  .  .  [ BOTTOM RAIL: one wide bar, or faces ]
```

## Fixed anchors (the same place in every game)

A game may give an anchor back (no clock) but never move it. Anchors never dim.

| Anchor | Cells (col, row, wide, tall) | What a game does |
|---|---|---|
| Clock | 8, 0, 4, 1 | nothing: set the round length (`secs`); `hideClock: true` to give it back. Numbers beside a thin sun-coloured ring that empties. |
| Hint words | 6, 2, 8, 1 (row 1 when there is no goal); drawn at most 6 cells wide, centred | `words: { icon, text, t, until }`: a painted icon and at most four words, e.g. `{ icon: 'balloon', text: 'Pop the balloons!' }`. The first words of a round arrive big, dock, and are said aloud once; they fade after about 7 s. |
| Move card | 1, 7, 3, 3 | answer `card()` with a move name, or `null`. A paper card with the strongest ink border and the block-limb Cubo. It tucks away by itself: the first time a move is asked it stays 6 s, the same move asked again 3 s, and it comes back only for a different move. |

## Docks (a game chooses what goes; each has a cap)

| Dock | Cells | Holds | `hud()` key |
|---|---|---|---|
| Goal | 8, 1, 4, 1 | one bar with three stars (the clock's width) | `goal: 0..1` |
| Corner | 1, 0, 6, 4 | score pills, two to a row (one row for 1 to 2 players, two rows for 3 to 4), then chips (two to a row) and bars (a row each) in the rows left of the four | `score` (the shell draws the pills), `corner: [...]` |
| Top right | 13, 0, 6, 3 | up to three badges, or one portrait with a notice (3 x 3 while it talks, 2 x 2 when quiet) | `top: { badges: [...] }` or `top: { portrait, pose, notice }` |
| Left rail, right rail | 0, 4, 1, 3 and 19, 4, 1, 3 | one tall meter each (three cells tall, a gap above the move card) | `left`, `right`: `{ icon, fill, color }` |
| Bottom rail | 5, 10, 10, 1 | one wide bar, or the players' faces | `bottom: { icon, fill, color }` or `{ faces: true }` |
| Badge | 14, 9, 5, 1 | one badge, right-aligned, as wide as its contents | `badge: { icon, value, bump }` |

```js
hud(){ return {
  score: this.score,                                     // a pill per player, in the corner's first row
  scoreStyle: 'face',                                    // 'face' (face and number), 'big' (big face, small number: four in a row), 'faces' (faces only)
  hideScore: false, hideClock: false,
  goal: this.pile / 120,
  words: { icon: 'fallenleaf', text: 'Sweep to the pile!', t: this.say.t, until: 7 },
  corner: [ { icon: 'gem', value: this.crystals },       // a chip
            { icon: 'glowstar', fill: this.xp, color: 'gold' } ],   // a bar
  left:   { icon: 'heartfull', fill: this.health, color: 'rose' },
  top:    { portrait: 'cubo', pose: 'wave', notice: 'Follow the glow' },
  bottom: { icon: 'glowstar', fill: this.team, color: 'gold' },
  badge:  { icon: 'firework', value: this.streak }
}; }
```

A piece a game does not ask for is not drawn. What goes beyond a dock's cap is dropped. Explicit cells stay for the shell's own use,
not for games or Create. `layoutDocks(W, H, hud(), { players })` is the pure layout (no canvas); `hudZones(W, H, hud())` gives the rectangles
to keep targets out of (`underHud(W, H, x, y, hud())` says whether a point is under one).

## The six piece types, in the kit look

Paper (`shade.card`), **one ink border** (`shade.ink`; thin on the small pills, the strongest on the move card), one flat soft shadow, Fredoka,
painted icons. No second tone, no emoji.

| Piece | Look | Use it for |
|---|---|---|
| Score pill (`scorePill`) | paper pill, the child's **avatar face** (their own character; a guest is Cubo) in a tile ringed in their player colour, and the number. Greys out while the camera cannot see them. | a player's score; the shell draws these, first |
| Chip (`chip`) | paper pill, a painted icon and a number | crystals, gold, lives |
| Bar (`statusBar`) | paper pill, a painted icon and a filling track (`BAR_COLORS`: gold, rose, indigo) | XP, health, team progress |
| Meter (`meter`) | the bar stood on its end | a side rail |
| Badge (`badge`) | paper pill, a painted icon and a word or number | one streak, lives or combo |
| Portrait with notice (`noticePortrait`) | a character on a paper card, with a short words pill beside it while it talks | a guide character (the top-right dock) |

Dock pieces **dim to 70% after 3 s without a change** and come back (with a bounce for a number going up) when they change. The anchors never dim.

## Icons

Every picture on the HUD, in hint words, toasts, buttons and Create's hints is a **painted icon from the asset library**, named by id
(`assets/icons.js`: animals, nature, food, things; `Orlis.assets.draw` for games, `iconHTML('id')` from `ui/icons.js` for the shell's
screens). There are **no emoji anywhere on screen** (they look different on every device); `test/no-emoji.test.mjs` fails if one comes back.
If no icon fits, add a small painted one to `icons.js` in the same style (flat fill, one shade tone, a thin ink edge, square).
An old-style hint that starts with an emoji still shows: `assets/legacy-emoji.js` turns the common ones into the icon that says the same.

## Rules

1. **Keep targets out of the docks in use.** Nothing a player has to touch, catch, pop or read goes under the clock, the
   words, the scores, the move card or a dock the game fills. The shell draws on top, so it would be hidden.
2. **Few words, and a picture.** One hint at a time, under the goal bar (or in its row when there is no goal), gone after about 7 seconds:
   a painted icon and at most four words (`spoken()` is the voice). The first words of a round arrive big in the middle,
   shrink into place, and are said aloud once; later ones just appear. No other text during play. Short words a
   six-year-old can read, or none: a picture does the job better.
3. **One piece style.** Every piece is paper with one ink border and a soft shadow (above). Anything the player can touch is never a piece.
4. **Colour means one thing.**
   - A player's colour is always theirs: blue, orange, green, purple (`PLAYER_COLORS`), as the ring round their face, their hand marker and
     results row, in every game.
   - Orange arrows mean "move this way", and nothing else is that orange. Bar colours are never a player's colour.
5. **A score is a number.** A whole number a child can follow, in the player's pill. A game whose count would climb into the hundreds
   (paint, distance) hides the score or shows progress instead (`goal`). A game with no winner shows the **faces-only row**
   (`scoreStyle: 'faces'`, `hideScore: true`): who is playing and whether the camera sees them, no numbers.
6. **The move card** shows the move being asked for (see above). It stays big enough to read from the sofa (3 cells, about 26% of the
   screen's height; not under 20%).
7. **Dock caps are the guard against clutter.** The busiest allowed screen is in `docs/hud-grid.html`; do not ask for more than a dock holds.
8. **Same motion.** Things slide in in about 0.45 s and out in about 0.3 s. Numbers bounce when they go up. Nothing flashes
   or strobes. Pop-up messages ("Star earned") drop in at the top right (the toast), never over the clock or the hint words.
9. **Same sounds.** The same cheer, tick and whoosh for the same events everywhere.
10. **The cover, pause and results show Cubo.** The cover that opens from the tile carries the how-to card and counts 3, 2, 1
    once the camera is ready (Cubo marches while it starts); pause shows him frozen; results show him cheering (`ui/cubo.js`).
11. **Results are the shell's.** A game gives `tally()`, `winner()` and optionally `summary()`; the HUD goes away on the results screen,
    so nothing from the game sits behind "Well played!".
12. **Player pills stay in a fixed order** (player 1 first); they are not re-ordered by where children stand.

## Games made in Create

A game made in Create (or with the `orlis` tool) follows the same standard. The creator kit gives its Claude the layout in
`CLAUDE.md` and the `orlis-game` skill, the starter game uses it, and the sandbox runtime offers the helpers as `Orlis.ui`
(`say`, `goal`, `badge`, `zones`, `under`). A game made from `Orlis.play` says `hint` and `hintIcon` (a library icon), `card` and `goal`;
a hand-written game answers `hud()` with the docks above, and Orlis Play draws them; the first hint is said aloud once, after the same words
check. If you change this file, change `kit/creator/template/` (CLAUDE.md, the skill, game.js) to match and run `node kit/build-creator.mjs`;
a test checks the skill still lists every move card.

## Where the standard stops

- Last Known Position (a story game) uses the corner for the team's level and XP (`hud().panel`, with old emoji icons the shell turns into
  library icons), but has its own boss health, floor pips, Nova and a lesson card, which count as its own world; it is not moved onto the docks
  yet (the owner may delete it). Castle Defense shows how it is doing in the world (hearts, pennants) and has no HUD to move.
- Pop Party shows the faces-only row on purpose (nobody wins). Sky Painter hides its score (it counts painted cells) and shows the sky painted as its goal.
- The Cubion story (`story-player.js`) shows no score and no clock; its captions are its own world.
- The pad lab (`labs/pad-lab.js`) is an experiment: it asks for hint words only.

## Loosening it

A game can break a rule if it has to. Do it on purpose and say so:
- add a line under "Where the standard stops" with the game, the rule, and why;
- keep the shell's areas readable (a game can move its own world, not the shell's pieces);
- if many games need the same exception, change the standard instead.

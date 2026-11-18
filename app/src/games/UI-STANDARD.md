# The Orlis game screen: a standard

Every game looks and behaves the same around its edges, so players learn the screen once and a new game never fights
the shell for space. The middle of the screen belongs to the game. The edges belong to this standard.

This is a standard, not a law: loosen it when a game needs it, but write the exception down (see the end).

All positions are shares of the screen, so they hold at any size. Code: `hud.js` (`hudZones`, `badge`, `sayBubble`,
`goalBar`), `figure.js` (the move card), `main.js` (`drawHUD`, `drawMoveCard`).

## The map (16:9)

```
+-----------------------------------------------------------------+
| BADGE        |        CLOCK                          |  SCORES  |
| (top left,   |        hint words                      |  (top    |
|  optional)   |        goal bar                        |  right,  |
|              |                                        |  column) |
|                                                       |          |
| MOVE CARD            THE GAME'S WORLD                            |
| (left, middle)       (everything else)                           |
|                                                                  |
+-----------------------------------------------------------------+
```

| Piece | Where | Who draws it | What a game does |
|---|---|---|---|
| Clock | top centre, `y` 3% of height | shell | nothing: set the round length (`secs`) |
| Hint words | top centre, `y` 19% | `sayBubble` | a few words; they fade after about 7 s |
| Goal bar | top centre, `y` 25%, 20% of width | `goalBar` | only if there is something to fill |
| Scores | top right, one column, first player on top | shell | return `score` per player from `hud()`, or set `hideScore: true` |
| Move card | left, middle: centre at (14% of width, 50% of height), side 30% of height | shell | answer `card()` with a move name, or `null` |
| Badge | top left, one pill | `badge` | optional: one streak, lives or combo |
| Countdown, pause, results | centre, full screen | shell | nothing |
| The game's world | everything else | the game | everything |

`hudZones(W, H)` returns the shell's rectangles (`top`, `score`, `card`, `badge`) and `underHud(W, H, x, y)` says whether a
point is under one. Use them when placing targets.

## Rules

1. **Keep targets out of the shell's areas.** Nothing a player has to touch, catch, pop or read goes under the clock, the
   words, the scores, the move card or the badge. The shell draws on top, so it would be hidden.
2. **Few words.** One hint at a time, under the clock, gone after about 7 seconds. No other text during play. Short words a
   six-year-old can read, or none: a picture does the job better.
3. **One pill look.** Information is a cream pill (`rgba(252,250,244,.96)`), a bold number, a shadow, and the same bounce
   when it changes. Anything the player can touch is never a cream pill.
4. **Colour means one thing.**
   - A player's colour is always theirs: blue, orange, green, purple (`PLAYER_COLORS`), for their score, hand marker and
     results row, in every game.
   - Orange arrows mean "move this way", and nothing else is that orange.
5. **Scores are stars with a count.** Whole numbers a child can follow. A game whose count would climb into the hundreds
   (paint, distance) hides the score or shows progress instead (`goalBar`). A game with no winner can hide it too.
6. **The move card** shows the move being asked for, when it is asked for (the first seconds of a round, or each time the
   move changes). It slides in and out by itself; a game only says which move.
7. **One badge at most.** Top left, the cream pill, an optional emoji and a number or word. Not a second row.
8. **Same motion.** Things slide in in about 0.45 s and out in about 0.3 s. Numbers bounce when they go up. Nothing flashes
   or strobes.
9. **Same sounds.** The same cheer, tick and whoosh for the same events everywhere.
10. **Results are the shell's.** A game gives `tally()`, `winner()` and optionally `summary()`; it draws nothing of its own
    while `hud.quiet` is on.

## Where the standard stops

- Last Known Position and Castle Defense (story games) have their own displays for crystals, gold and so on. They keep
  the clock and results, and stay out of the move card's box. Their displays count as their own world.
- Pop Party shows no scores on purpose (nobody wins). Sky Painter hides its score (it counts painted cells).

## Loosening it

A game can break a rule if it has to. Do it on purpose and say so:
- add a line under "Where the standard stops" with the game, the rule, and why;
- keep the shell's areas readable (a game can move its own world, not the shell's pieces);
- if many games need the same exception, change the standard instead.

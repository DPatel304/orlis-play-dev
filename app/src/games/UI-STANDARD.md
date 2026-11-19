# The Orlis game screen: a standard

Every game looks and behaves the same around its edges, so players learn the screen once and a new game never fights
the shell for space. The middle of the screen belongs to the game. The edges belong to this standard.

This is a standard, not a law: loosen it when a game needs it, but write the exception down (see the end).

All positions are shares of the screen, so they hold at any size. Code: `hud.js` (`hudZones`, `badge`, `sayBubble`,
`goalBar`), `figure.js` (the move card), `main.js` (`drawHUD`, `drawMoveCard`).

## The map (16:9)

```
+-----------------------------------------------------------------+
| SCORES      |        CLOCK                        |  MOVE CARD   |
| (top left,  |        hint words                   |  (top right, |
|  one        |        goal bar                     |   26%)       |
|  column)    |                                     |   BADGE      |
|             |                                     |  (under the  |
|                                                   |   card)      |
|                    THE GAME'S WORLD                              |
|                    (everything else)                             |
+-----------------------------------------------------------------+
```

| Piece | Where | Who draws it | What a game does |
|---|---|---|---|
| Clock | top centre, `y` 3% of height | shell | nothing: set the round length (`secs`) |
| Hint words | top centre, `y` 19% | `sayBubble` | a few words; they fade after about 7 s |
| Goal bar | top centre, `y` 25%, 20% of width | `goalBar` | only if there is something to fill |
| Status panel | top left, one column, up to 22% of the width and 55% of the height | shell, from `scorePill` / `chip` / `statusBar` | return `score` per player from `hud()` (or `hideScore: true`), and optionally `panel` rows (see below) |
| Move card | top right: centre at (85.5% of width, 19% of height), side 26% of height; slides in from the right | shell | answer `card()` with a move name, or `null` |
| Badge | under the move card, its right edge lined up with the card's | `badge` | optional: one streak, lives or combo |
| Countdown, pause, results | centre, full screen | shell | nothing |
| The game's world | everything else | the game | everything |

`hudZones(W, H)` returns the shell's rectangles (`top`, `score`, `card`, `badge`) and `underHud(W, H, x, y)` says whether a
point is under one. Use them when placing targets. The card's size and place are `CARD` in `figure.js`; change them there
and everything (the zones, the badge, the slide-in) follows.

## The status panel (the one flexible corner)

Everything on the screen is the same in every game except this corner, the top left. It is a single column, up to 22% of the
width and 55% of the height, with at most five rows (`PANEL_ROWS`), built only from three shared pieces so it still
looks like the same family:

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

Rules for the panel: icons and numbers only (no words); bar colours come from `BAR_COLORS` (gold, rose, indigo), which are
never a player's colour or the arrows' orange; the shell stacks the rows, so a game never positions them; numbers bounce
when they go up by themselves. Scores come first, then the game's rows. A game with no per-player scores sets
`hideScore: true` and uses only `panel`.

## Rules

1. **Keep targets out of the shell's areas.** Nothing a player has to touch, catch, pop or read goes under the clock, the
   words, the scores, the move card or the badge. The shell draws on top, so it would be hidden.
2. **Few words.** One hint at a time, under the clock, gone after about 7 seconds. No other text during play. Short words a
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
   move changes). It slides in from the right and out again by itself; a game only says which move. It stays big enough to
   read from the sofa (about 26% of the screen's height; not under 20%).
7. **One badge at most.** Under the move card, the cream pill, an optional emoji and a number or word. Not a second row.
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

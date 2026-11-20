# 0034: The HUD: fixed anchors and flexible docks on the 20 x 11 grid
Status: Accepted
Date: 2026-11-20

## Context
The owner wants a HUD that is consistent across games but flexible in layout, which is why the invisible grid exists (20 x 11 square
cells, `app/src/games/grid.js`, `UI-STANDARD.md`). Step 1 (fixed slots) is built; "place a piece by cell" (step 2) was decided but not
built. The UI kit (U1) gives every piece one ink border and the paper look. Mockup: `docs/hud-grid.html`.

## Decision
- **The grid stays** (20 x 11, 4% inset, left half from the left edge, right half from the right, the middle centred).
- **Fixed anchors**, the same place in every game: the clock (8,0,4,1), the hint words (6,2,8,1) and the move card (1,7,3,3). A game
  can give an anchor back (no clock) but never move it.
- **Docks**, where a game chooses what goes, each with a cap:
  goal (7,1,6,1: one goal bar), corner (1,0,6,4: score pills two to a row, then up to three rows of chips and bars), top right
  (13,0,6,3: up to three badges, or one portrait with a short notice), left and right rails (0,4,1,4 and 19,4,1,4: one tall meter each),
  bottom rail (5,10,10,1: one wide bar, or the players' faces), badge (14,9,5,1: one).
- **Games ask by dock, not by cell or pixel**: `hud()` returns `score`, `goal`, `corner`, `top`, `left`, `right`, `bottom`, `badge`;
  the shell places, sizes and spaces the pieces. Explicit cells stay possible for the shell's own use, not for games or Create.
- **Six piece types only**: score pill, chip, bar (horizontal), meter (vertical), badge, portrait-with-notice. All in the kit look
  (one ink border, paper, painted icons, Fredoka).
- **Give back:** a dock a game leaves empty is its world; the keep-clear zones come only from what is drawn.
- Still held back (from the backlog): dimming the HUD when idle, and a HUD size setting.

## Consequences
- Last Known Position's own boss health, Nova and lesson card can move into the rails and the top-right dock; Peekaboo's found meter
  goes in a rail and the seekers' faces in the bottom rail.
- `UI-STANDARD.md`, the creator kit and Create's vocabulary change with it (plan package U3).
- The busiest allowed screen is already near full (see the mockup); the caps are the guard against clutter.

## Replaces
Extends the HUD grid "version 3" in BACKLOG.md and the fixed-slot table in `UI-STANDARD.md`; the "two pill looks" rule there is
replaced by the kit's one piece style (player colour as a swatch).

## Owner's changes (2026-11-20)
The owner accepted the docks and the paper score pills, and asked for all seven refinements:
1. **Rails are 3 cells tall** (0,4,1,3 and 19,4,1,3), leaving a gap above the move card.
2. **The goal bar is the clock's width** (8,1,4,1), so the top centre is one column.
3. **No goal, no goal row:** the hint words move up into row 1.
4. **Score pills carry the child's avatar face** with their colour as a ring, not just a dot.
5. **The portrait is 3 x 3 with a notice while the character talks, 2 x 2 when quiet.**
6. **Dock pieces dim to 70% after 3 s without a change** and come back when they change; anchors never dim.
7. **The edge margin is 5%** (was 4%).
**The corner stays 4 rows** so four players fit: scores take one row for 1 to 2 players and two rows for 3 to 4; the game's chips and
bars fill the rows left (three or two).

## Owner's answers (2026-11-20, later)
- **Pop-up messages** ("Star earned") drop in at the **top right**, never over the clock or the hint words.
- **Player pills stay in a fixed order** (player 1 first); they are not re-ordered by where children stand (too confusing as people move).
- **A player who steps out of the camera's view greys out** in their pill and comes back in colour when seen.
- **No pause control on screen** for now; how to pause during camera play is an open question.
- **The clock** and **the pill style** are being chosen from options (`docs/clock-pills.html`).

## Owner's choices (2026-11-20): clock and pills
- **The clock is numbers with a thin sun-coloured ring** that empties as time runs out (option B in `docs/clock-pills.html`).
- **Player pills: face and number by default** (option A); a game may choose **big face with a small number on it** (option B) to save
  corner rows (four fit in one row). Both share the face, the colour ring and the grey-out.
- **Faces are each child's own avatar** from the avatar maker; a guest (seen by the camera, no profile picked) shows as Cubo in their colour.
- **Games without a winner** (Pop Party) show a **faces-only row** in the corner: who is playing and whether the camera sees them, no numbers.

## Approved (2026-11-20)
The owner approved the HUD as written here, with all refinements and answers above.

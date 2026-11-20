# 0020: The stage is built; existing flat games are not migrated yet
Status: Proposed
Date: 2026-11-20
## Context
M1 of the Phase 1 plan called for a reusable paper stage layer, with Pop Party rebuilt on it. The stage is built (`app/src/stage/`) and
a lab game, Pop Party's core loop on the stage, runs inside the app (`?game=pop-party-stage`, or the menu for the owner). Reading the
real Pop Party showed it is large (balloon kinds, giants, a parade, animals, a bouquet ending) and draws balloons with its own code.
For a flat game, drawing through the stage adds a copy (painter to a texture to 3D and back to the canvas) and brings no visible gain
to the player; the gain is for games with a moving camera and for pad views.
## Decision (recommended)
- Keep the existing flat games on the 2D painter, as they are.
- Use the stage for new games that need it (pad views, 3D worlds such as Peekaboo Garden) and for the lab game.
- Decide whether to migrate Pop Party only after measuring the lab game against the real one on the owner's laptop and on weaker devices.
## Consequences
M1 no longer means "port Pop Party"; it means a working, tested stage, a lab game to measure, and a measurement. The stage falls back to
drawing on the canvas when 3D is not available, so a game always draws.

## Owner's note (2026-11-20)
The owner's aim is one style for all games, so porting everything may be inevitable, and the final call comes after testing. Two jobs are
kept apart: (1) **restyling** each game onto the shared look (the asset library, the palette, the painter), which is inevitable and
already planned; (2) **moving its drawing onto the stage**, which is optional and becomes mostly mechanical once a game's pictures are
named library actors. If the measurements show the stage costs nothing noticeable, the simplest end state is one renderer for all games;
if not, flat games stay on the 2D painter and only 3D games use the stage. The style is the same either way.

## Measurements (2026-11-20, the owner's Legion 5, RTX 3070 Laptop, 2039x1275 canvas)
- Original Pop Party: 71 frames a second on average, typical frame 12.2 ms, slowest 5% over 18.2 ms, 16 frames slower than 30 fps in 181 s.
- Stage lab (default, light settings): 52 frames a second, typical 18.1 ms, slowest 5% over 36.4 ms, 368 frames slower than 30 fps in 70 s
  (about 1 in 10). Steady, no slowdown over time. The stage's own timing is tiny (backdrop 0.1 ms, 3D drawing 0.3 ms, copy 0.0 ms), so the
  extra cost is on the graphics card or in the page's compositing of a large picture.
- Canvas variant and the light settings were judged close to the original by the owner; the full-quality settings lagged.
- Recommendation: keep flat games on the 2D painter; use the stage for games that need 3D or pad views. A layered 3D canvas (no per-frame copy)
  is the next experiment, to be built when a 3D game needs it.

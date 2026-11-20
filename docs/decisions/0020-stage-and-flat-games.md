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

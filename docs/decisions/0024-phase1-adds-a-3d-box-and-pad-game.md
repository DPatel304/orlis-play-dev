# 0024: Phase 1 also ships one perfected 3D game, on the Box and pads with no camera
Status: Proposed (which game, and the date, to confirm)
Date: 2026-11-20

## Context
0022 limited Phase 1 to one perfected game, Pop Party. 0023 proposed that the Box draws 2D only because camera tracking and 3D
drawing compete for the same machine. The owner now wants Phase 1 to include a 3D game that uses the Box and the pads and
**no camera**, and wants the 3D look perfected as well as the 2D one.

## Decision
- **Two perfected games in Phase 1:** Pop Party (2D painted, camera) and one 3D game (Box on the TV plus pads, no camera).
- **The Box may draw 3D when the game does not use the camera.** A game declares whether it uses the camera. Camera games stay
  on the 2D painter (0023 still holds for them); no-camera games may use 3D on the TV, on the pads, or both.
- **The 3D look is perfected in Phase 1:** paper cutouts in a real 3D world, shapes plus painted skins, one palette (0020, 0023).
- **Which game:** to choose. Peekaboo Garden (0015) fits the world and the pads, but its seekers are tracked by the camera, so it
  would need a no-camera seeker (for example a pad-driven lantern). Decide before M3.

## Consequences
- The 3D animation problem must be solved for this game: cached paper cutouts cannot animate their drawing, so it needs posed or
  rigged parts (see BACKLOG "stage lab lag").
- The Box's 3D speed must be measured on the target hardware (the stage lab was slow even on the owner's laptop).
- The March 27, 2027 target is at risk; the 3D game, its look and the measuring add real work. Re-plan milestones before accepting.
- Wherever 0023 says the Box draws 2D only, read it as "for camera games".

## Replaces
Part of 0022 (one game only) and part of 0023 (Box 2D only).

# 0023: The Orlis Box draws 2D only; 3D lives on the pads
Status: Proposed
Date: 2026-11-20
## Context
The owner measured the stage lab (paper cutouts in 3D on a locked camera) on the Box's stand-in laptop: close to the original only with the light
settings, still choppy at times, with animation that does not match the original's (0020). The owner proposed: the Box draws 2D only, and the
iPad (and phone) can draw both 2D and 3D.
## Decision (recommended)
- **The Box and the TV draw 2D**, with the painted 2D painter and the asset library, as the games do today. Flat games are unchanged.
- **3D is a pad-side renderer:** a pad can draw a 3D world (paper cutouts from the same asset library, with real ground, walls and buildings from the
  stage set) for its player: first-person or third-person. This works in the Phase 1 browser pad page and in the later native apps.
- **A 3D game's TV view is 2D:** a painted top-down map, an overview or scores. Example: Peekaboo Garden shows the seekers a 2D painted map with the lantern,
  while the hider's pad shows the 3D garden.
- A game that needs a 3D view declares pads as required (the store badge, 0004).
## Consequences
- The Box needs no 3D, which lowers its hardware requirements and removes the 3D cost from the TV.
- The stage code (`app/src/stage/`) and the paper-cutout work move to the pad side when pads are built; the lab entries in the app stay owner-only experiments for now.
- 3D worlds on the TV itself are not possible. A painted pseudo-3D road (like Last Known Position's) remains available for 2D games that want depth.
- Cutout animation (squash and stretch, frames) is still to be built when a pad game needs it.
## Replaces
The plan to use the stage for flat games on the Box (0020), which becomes final: flat games stay on the painter.

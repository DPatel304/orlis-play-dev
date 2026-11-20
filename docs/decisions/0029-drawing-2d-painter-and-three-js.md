# 0029: Drawing: flat games on the 2D painter, 3D games on three.js, on the TV and on pads
Status: Accepted
Date: 2026-11-20

## Context
0020 and 0023 were proposals made before the measurements. Since then: plain and lit 3D with animated characters ran at the screen's
165 fps on the owner's laptop; camera tracking on the main thread cost the most (67 fps with it on); the old stage lab was slow because
it repainted 2D pictures into textures every frame. Phase 1 now has a 3D game with camera seekers on the TV (0026).

## Decision
- **Flat games stay on the 2D painter** (the asset library on a canvas). Pop Party stays as it is. Flat games are not moved onto a 3D
  layer, and the stage lab approach (painting 2D into textures each frame) is not used for them.
- **3D games use three.js**, on the TV (the Box) and on pads, built from: the stage set (boxes, gables, cones and slabs wearing painted
  skins, as in `spike3d/spike7.html`), paper cutouts from the same asset library (painted once, never per frame), and **paper puppets**
  for characters that move (cutout parts on a simple skeleton, animated by code).
- **One look in both:** one palette, the same paper edge, a shared soft light (hemisphere plus a three-step cel ramp, as in
  `spike3d/spike8.html`), and the look check page as the test.
- **Camera tracking runs in its worker whenever a 3D game runs on the TV**, so drawing and tracking stop competing. Measured first (M1).
- **Budgets:** TV 60 fps with tracking on, on the owner's laptop and later on the Box hardware; pads 30 fps minimum on the minimum
  phone (0030), 60 where possible; about 150 draw calls on the TV, 100 on a pad (merge and instance static pieces).
- **Fallback for the TV**, if 3D plus tracking misses its budget on the Box hardware: a painted 2D overview of the same world (the
  `spike7` map). Pads keep 3D either way.

## Consequences
- Two renderers to keep consistent; the look check is run at every look milestone.
- The existing Stage layer (`app/src/stage/`) is the starting point for the 3D side; its "paint into a texture each frame" path is dropped.

## Replaces
0020 and 0023 (both Proposed, superseded before being accepted).

## Owner's answer (2026-11-20)
Accepted, with the intent made explicit: **most Orlis games will be purely 2D.** The ecosystem must also be able to make 3D games that
look consistent with the 2D ones. In Phase 1 the 3D game is a **trial**: its gameplay may stay a work in progress; what must be true is that
it **looks consistent with the 2D games and runs well** (see 0033).

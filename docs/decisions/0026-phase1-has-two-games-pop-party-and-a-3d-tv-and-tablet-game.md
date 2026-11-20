# 0026: Phase 1 has two games: Pop Party, and one 3D game for the TV and an Android tablet
Status: Accepted
Date: 2026-11-20

## Context
0025 made Phase 1 2D only. The owner changed course again: Phase 1 should show both sides of Orlis, a perfected 2D camera game and
a 3D game that uses the TV together with an Android tablet. The measurements since 0023 help: plain and lit 3D with animated
characters ran at 165 fps on the owner's laptop (BACKLOG "3D check result"); camera tracking is what costs frames.

## Decision
- **Phase 1 ships two perfected games:** Pop Party (2D painted, camera) and **one 3D game that uses the TV and an Android tablet.**
- **The tablet is a pad** (0004, 0019): the browser page on an Android tablet (any recent Chrome), joining by QR or code. A native
  Android app stays a stretch. The tablet is the "full-view tier" (0003, VISION): it draws its own 3D view; the TV shows the shared world.
- **The 3D game is real 3D** (shapes plus painted skins, paper cutouts, rigged parts, soft light), in the house look. Pop Party stays on the 2D painter.
- **Which game:** to choose. Peekaboo Garden (0015) fits (a tablet player hides and sees a private first-person view; the TV shows the
  overview). Whether the TV side uses the camera is open: with no camera it needs nothing new; with the camera the tracking worker
  (see the 3D check) and a measurement on the Box hardware are needed first.
- **Revisited:** 0020 and 0023 come back into play for the 3D game (the Stage layer, 3D on the pad, 3D on the TV only when the budget allows).

## Consequences
- The 3D game, its look and the tablet view are new work inside Phase 1. The March 27, 2027 target is at risk; the milestones in
  `plan-phase1.md` are re-planned, and the cut order protects Pop Party and the pad basics first.
- Needs a real Android tablet to test (the owner will buy one), and a 3D animation approach (rigged parts, not baked cutouts).
- The look check (spike7) becomes a regular tool for keeping the 2D and 3D games consistent.

## Replaces
0025 (Phase 1 2D only) and the one-game limit in 0022.

## Update (2026-11-20, later)
**The 3D game is Pop Party 3D**, so Phase 1 is Pop Party and Pop Party 3D.
Why: one rule set to tune and perfect; the private lab (`spike3d/spike8.html`) already exists; it makes the best consistency test
(the same game in 2D and 3D, same look); a smaller scope than a new game.
Still open: what the tablet does (candidates: each tablet is a player who aims and pops in a first-person view of the meadow while
the TV shows the wide overview; or the tablet is a controller only), whether the TV side uses the camera, and whether the two games
are listed as two games or as one game with two modes.

## Update (2026-11-20, final)
**The 3D game is Peekaboo Garden** (0015), not Pop Party 3D. Phase 1 is Pop Party and Peekaboo Garden. The "Pop Party 3D" idea above is dropped;
`spike3d/spike8.html` stays a private look experiment. Peekaboo Garden is back in Phase 1 (this reverses the note in 0022 and 0015 that
moved it to after the release).
Design as in 0015: tablet players hide among paper bushes and see a private first-person view; one or two seekers on the TV see the
overview. Still open: whether the TV seekers are tracked by the camera (the original 0015 idea) or use a no-camera control, how many
tablets (start with one), and the date.

## Update (2026-11-20, answers)
- **One hider tablet** in Phase 1 (more tablets later).
- **The TV seekers are tracked by the camera** (one or two), so the TV runs real 3D and camera tracking together. This needs the tracking
  worker (Shift+G in the 3D check) and a measurement on the Box hardware early (M1). Fallback if it will not run well: draw the TV overview
  in 2D (the same world, a painted top-down map as in `spike3d/spike7.html`) and keep 3D on the tablet only. The decision stands either way.

## Update (2026-11-20, date)
The target moves to **late May 2027** (May 28), quality first, because Pop Party is redrawn in the toon look (0036).

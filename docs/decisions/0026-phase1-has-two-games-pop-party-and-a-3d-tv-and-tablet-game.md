# 0026: Phase 1 has two games: Pop Party, and one 3D game for the TV and an Android tablet
Status: Accepted (which game, camera use and the date to confirm)
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

# 0025: Phase 1 is 2D only; 3D is private experiments for now
Status: Accepted
Date: 2026-11-20

## Context
0024 proposed adding a perfected 3D no-camera game to Phase 1. Measurements since then are encouraging (plain and lit 3D run at
165 fps on the owner's laptop; camera tracking is what costs frames; see BACKLOG "3D check result"), but the owner decided to keep
Phase 1 small and to explore 3D privately.

## Decision
- **Phase 1 ships 2D only.** The release gate is 0022 as written: Pop Party perfected, and the platform done.
- **3D is private experiments** by the owner: the 3D check (key G), the spikes in `spike3d/`, the shapes-and-skins demo and its look
  check, and the Stage layer stay in the repository but are not in any Phase 1 game, menu or promise.
- **0020 and 0023** remain Proposed and are not needed for Phase 1; revisit them when 3D comes back.
- **The look still has to work in 2D and 3D later** (one asset library, one palette, paper edge), so nothing in Phase 1 should
  make 3D harder: the kit keeps games saying what, not how.

## Replaces
0024 (superseded before it was accepted). The March 27, 2027 target and the 0022 milestones stand.

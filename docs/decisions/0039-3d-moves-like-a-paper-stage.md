# 0039: 3D games move like a paper stage; true 3D later; the FPS is the owner's own store game
Status: Accepted (2026-11-21); the new release date is Proposed
Date: 2026-11-21

## Context
After seeing how Paper Mario handles 3D (a real 3D stage, flat characters that flip like cards, a guided camera, small stage-like areas),
the owner chose that kind of movement for Orlis's 3D games. The owner also wants an FPS one day, but not as something anyone can build in
Create, and asked whether true 3D could be added later.

## Decision
- **3D games move like a paper stage.** A guided camera, side-on or slightly from above, follows the player through small stage-like
  areas. Characters and most props are painted pieces that flip like a card when they turn (a quick squash, then the mirror image). Real 3D
  only for the ground, walls and things you go around (0038). No free camera, first-person view or open worlds in the kit for now.
- **Peekaboo Garden stays in Phase 1 as the 3D trial (0026, 0033 stand), in this style.** The TV keeps its fixed high view. The hider's
  phone view becomes a guided camera behind and beside the bunny, not first person (changes the phone view in 0031 and plan item K5).
- **The pads stay in Phase 1** (0027, 0028, 0030, 0032 stand): the hider's phone, and extra hands in Pop Party.
- **True 3D is a later phase.** To keep that door open at no cost now: the camera is one swappable piece of code (each game picks fixed or
  guided, later free), and game logic works in world positions, never screen positions.
- **The FPS is a game the owner makes with Claude's help and puts on the store.** It stays family-safe: a splat, foam or water blaster,
  not weapons (recommended). Other people can copy it and change a few parts (the map from kit pieces, colours, rules, targets) but not the
  camera, controls or core feel. Creating a new FPS from scratch is not in Create. "Copy a store game and change some parts" is a new
  Create feature for a later phase.
- **Release date (Proposed): April 30, 2027, quality first.** The May 28 date was set for the toon redraw of Pop Party, which 0037
  dropped, and the guided phone camera is less work than first person. The date moves back before the quality bar moves.

## Consequences
- Peekaboo's phone view is simpler (no look controls) and kinder to small hands; the painted pieces are never seen edge-on.
- Every 3D game needs a camera that the designer plans; games that need a free camera wait for the later phase.
- The FPS is the owner's project, outside the Phase 1 plan.

## Replaces
The first-person phone view in 0031 (rest of 0031 stands). BACKLOG's note that first-person pad views need a free camera now applies to the
later phase only.

## Owner's note (2026-11-21): Peekaboo is a proof of concept
Peekaboo Garden's job in Phase 1 is to prove two things: tablets and phones work as pads, and 3D games work on Orlis (the look, and the
speed on the TV with tracking and on the minimum phone). It must play start to finish without bugs; gameplay depth, polish beyond the look,
and extras are not required, and they are the first things cut if the plan slips. Pop Party remains the one perfected game (0033).


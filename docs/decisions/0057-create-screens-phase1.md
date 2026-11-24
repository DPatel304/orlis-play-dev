# 0057: Create's screens for Phase 1; kids can create; voice commands paused
Status: Accepted (2026-11-24)
Date: 2026-11-24

## Context
0056 set Create for Phase 1 (picture-built, no AI). The owner then chose how the screens behave. The recipes are built
(`app/src/create/recipe.js`).

## Decision
- **Kids can create.** Create's main audience is kids 6+ with their families, so kids' profiles get the Play and Create tabs too.
  Create for everyone is the picture builder; Create Pro (grown-up creators, Claude Code) stays paused and hidden.
- **Layout:** every building step shows the live game on the left and the picture choices on the right, with a strip of the six steps
  on top and the one-line sum-up under the game (as in `docs/create-mockup.html`).
- **Rules can be skipped:** sensible defaults are used.
- **No "Surprise me".**
- **Slots full:** when the family's 3 slots are used, Create says so ("Your slots are full") and shows how to remove one; it does not
  offer to replace one.
- **Voice commands are paused** until the rest of Create is finished (the phrase map in recipe.js stays, unused). Changing a game is by
  redoing a step, or Play again.
- **No subscription in Phase 1** (more slots for a subscription is a Phase 2 idea).

## Replaces
From 0055: "Profiles that may not create (kids) see no tabs bar". From 0056: simple voice commands in Phase 1.

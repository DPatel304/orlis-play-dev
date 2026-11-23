# 0054: The handheld controller is the "Orlis PlayPad"; in the app it is "PlayPad"
Status: Accepted (2026-11-23)
Date: 2026-11-23

## Decision
- The official name of the tablet-in-a-controller-grip is **Orlis PlayPad**. On screen, in games and menus, it is just **PlayPad**
  ("PlayPad", "PlayPad optional", "Join with a PlayPad").
- Phase 1 testers see the same name, even though they use an ordinary tablet or phone.
- **Its icon:** the two-tone tablet in a grip from `docs/icon-mockups.html` (option 3): solid grips, a lighter tablet frame, and a
  see-through screen. Flat, one colour, no coloured buttons. The people icon is option A (solid, the one behind lighter).
- Code keeps calling these devices "pads" (`pads.js`, `usesPads`); only what people read changes.

## Replaces
0052's label "Tablet" / "Tablet optional" and its tablet-in-grip icon drawing (sticks and coloured buttons).

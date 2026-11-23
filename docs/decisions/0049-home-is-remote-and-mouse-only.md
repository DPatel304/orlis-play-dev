# 0049: Home is remote, keyboard and mouse only; no camera on home
Status: Accepted (2026-11-23)
Date: 2026-11-23

## Context
Home had a hand mode (point to move, wave to choose, a "Wave to play" bubble, row-edge strips, a hand dot, the camera looking lightly).
The owner wants the home menu driven by keyboard/remote and mouse only.

## Decision
- **No motion navigation on home.** Arrows and OK on the remote or keyboard, and the mouse (hover and click), pick everything.
  No pointing, waving, "Wave to play" bubble, row-edge strips, hand dot or taking-over logic.
- **No camera on home.** Home does not start or keep pose tracking, whatever the build (Big Picture) or address (`?hand=1` does nothing).
  The camera starts only for games, their scores and the camera check, as before.
- Games keep everything: pose tracking, the cursor in pause, results and join cards, the hands-on-screen modes, the H key.
- Dead code is removed (`ui/hand.js`, `pose.lite`, `pose.pointing`, `cursor.map`, `cursor.gate`, `cursor.skin`, the hand-mode CSS).

## Replaces
From 0045: the line "Hand mode: point to move along a row or between rows, wave to choose". The hand dot of 2026-11-23, and the
light camera mode on home (`docs/notes-for-opus.md`, "Light mode"). The rest of 0045 stands.

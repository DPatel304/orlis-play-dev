# 0032: Joining without typing: scan the QR, or match three pictures
Status: Proposed
Date: 2026-11-20

## Context
0028 used a 4-letter code for a phone's first join. The owner wants something else. Players are kids, often too young to read.

## Decision
- **Scan the QR on the TV** (the phone's camera app opens the pad page). The QR carries a one-time secret, so there is nothing to type.
- **Fallback: a picture code.** If the QR cannot be scanned (a phone already on the page, a camera that will not focus), the TV shows
  three pictures in a row from the asset library (for example balloon, cat, star) and the phone shows a grid of nine; the player taps the
  same three in order. 9 x 9 x 9 = 729 combinations, a new set each session, five wrong tries and the phone waits a minute: plenty on a
  home network.
- **After the first join** nothing changes from 0028: the phone keeps its token, the Box trusts it, and it rejoins by itself.
- Not chosen: the grown-up confirms each new phone on the TV (adds a step every time a cousin visits); a wave at the camera to let a
  phone in (fun, but it makes joining depend on the camera, and pads must work without it).

## Consequences
The pad protocol's `hello.code` becomes `hello.join`: either the QR secret or the three picture ids. The TV join card shows the QR big,
and the three pictures beside it, small.

## Replaces
The 4-letter code in 0028 and in `docs/specs/pad-protocol.md`.

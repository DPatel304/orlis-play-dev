# 0043: Pop Party stays camera-only
Status: Accepted (2026-11-22)
Date: 2026-11-22

## Context
0028 gave Pop Party phone seats ("pads 0 to 4, a pad player drags a finger to move a mitt"), for more than four players, for people who
can't play in front of the camera, and as a first real game for the phone link. It was built (plan package S2) and the owner looked at it.
Phone play lets a child play a movement game sitting down, and it puts a QR code in the corner of the game made for the youngest players.
The phone link is already proven by the pad test game, and Peekaboo Garden is the game that needs a phone.

## Decision
- **Pop Party has no phone seats.** It stays a camera-only game: tracked 1 to 4, pads 0.
- The built work is kept, not merged: `docs/shelved/s2-pop-party-phones.patch` (Pop Party mitts, its pad program, the corner join chip for
  games whose phones are optional, phones counting as present) with its pictures in `docs/shelved/s2-pictures/`.
- Phones in Phase 1 are for games that need them (Peekaboo Garden's hider).

## Replaces
The Pop Party line of 0028 ("Pop Party: tracked 1 to 4, pads 0 to 4"). The rest of 0028 stands.

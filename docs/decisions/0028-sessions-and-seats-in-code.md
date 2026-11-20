# 0028: Sessions and seats in code
Status: Accepted (except the join code, see 0032)
Date: 2026-11-20

## Context
0004 set the rules (up to 8 players, up to 4 tracked, any mix; games declare what they need). M3 needs this as a real model that
Pop Party and Peekaboo Garden both use, plus a pause rule for phones that drop, and the kid profiles that 0011 moves onto the Box.

## Decision
- **A session** (in the host's JavaScript) has: the game, a join code (4 letters, new for each session), the TV's role, and **seats**.
- **A seat** is `{ n, kind: 'tracked' | 'pad', who (a kid or grown-up profile on the Box), colour, state: 'live' | 'away' | 'empty', device }`.
  Games only ever see seats, never "the person at the camera" or "the phone".
- **The game manifest says what it needs:** tracked seats `[min, max]`, pad seats `[min, max]`, the pad program, and what the pad must
  draw (`controller` or `view3d`). Pop Party: tracked 1 to 4, pads 0 to 4 (a pad player drags a finger to move a mitt). Peekaboo Garden:
  tracked 1 to 2 (seekers), pads exactly 1 (the hider, `view3d`).
- **Joining:** first time, the phone shows the code from the TV (or scans the QR, which carries it); the phone then keeps a device token
  and the Box remembers it (trusted, listed in Settings, removable). After that, rejoining is automatic, to the same seat.
- **Dropping:** a seat a game cannot do without (Peekaboo's hider) pauses the game with a friendly "Waiting for Mia's phone"; it resumes
  by itself on rejoin; after 2 minutes the TV offers to end the round. Seats a game can do without (Pop Party's extra pads) just go quiet.
- **Who is who:** a phone picks a profile from the Box's own list of kids and grown-ups (pictures, no typing).
- **Kid profiles move to the Box** (0011): a name or nickname, avatar and progress stored by Orlis Play; the server keeps only grown-up
  accounts and what the family owns. Existing kid profiles are moved once, then deleted from the server.

## Consequences
- Existing games keep working unchanged (tracked seats only). Pads are added to a game by a manifest entry and a pad program.
- The migration of kid profiles touches the server and the app; it must be done before the testers' children use the beta.

## Replaces
Implements 0004, 0011 and the pause note in 0019.

## Owner's answer (2026-11-20)
Everything accepted except the 4-letter code, which the owner wants replaced. Proposed instead (see 0032): scan the QR on the TV as the
main way in (it carries a secret, so nothing to type), and a **picture code** as the fallback: the TV shows three pictures (a balloon, a
cat, a star) and the phone taps the same three from a grid of nine. No reading needed, so kids can do it.

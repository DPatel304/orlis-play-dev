# 0031: How Peekaboo Garden is built
Status: Accepted; the phone view is a guided camera, not first person (0039)
Date: 2026-11-20

## Context
Peekaboo Garden (0015, 0026) is the first game where the TV, the camera and a phone play together in one 3D world. It sets the pattern
for later games.

## Decision
- **One world, written once:** `games/peekaboo/world.js` holds the garden as data (ground, hedges, the shed, hiding places of three
  kinds: bush, big flower pot, tall grass), plus collisions and "is this point hidden". The host, the TV view and the phone view all
  import it, so the two screens cannot disagree.
- **The host (on the Box) holds the truth:** the round clock, the lanterns, the hider's hiding state, and "found". The hider's phone moves
  its own player at once (it feels instant) and sends position and heading 20 times a second; the host checks it against the world
  (speed, walls) and is the one that decides found. Loose on cheating, strict on fairness for kids.
- **The seekers:** each tracked seeker's hand points at the TV; the host turns that screen point into a spot on the ground (a ray from
  the TV camera onto the garden floor). That spot is a lantern. This is how a tracked hand targets a 3D world, for overview views.
- **Found:** the hider is found when inside a lantern's light for about 0.6 seconds while not fully hidden. Hiding places lower how
  quickly that fills; moving near a bush makes it rustle on the TV (a fair, kid-friendly hint).
- **What each screen shows:** the TV shows the whole garden from a fixed, high three-quarter view, the lanterns and the rustles, never the
  hider unless lit or found. The phone shows the hider's first-person view, including the lantern light sweeping across the garden,
  so hiding is tense and fun. In Phase 1 there is one pad, so the host sends the same state to it; per-seat filtering comes with more pads.
- **Messages:** phone to host: move (position, heading, crouch), hide or leave a hiding place. Host to phone, 15 to 20 times a second:
  the lanterns, the clock, the hiding meter, found. Events: found, round over.
- **Characters:** the hider appears on the TV only when found, as their avatar made into a paper puppet (a short reveal: pops out,
  waves). Seekers are shown as lantern lights and their avatars at the garden's edge. This keeps Phase 1's character animation small.
- **Round:** 90 seconds a round; the hider wins by not being found; then roles can swap. Gentle: no fail sounds, a giggle and a wave.

## Consequences
- The first game that needs pads, seats, the pad link, 3D on both screens and tracking in its worker. Each piece is proven alone first.
- Avatars must be splittable into puppet parts (head, body, arms, legs). Checked early in the look work.

## Replaces
Extends 0015's design; uses 0027 to 0030.

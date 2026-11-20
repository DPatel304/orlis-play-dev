# 0004: Seats
Status: Accepted
Date: 2026-11-20
## Context
Games should work with one person in front of the TV, with many people on iPads, or any mix.
## Decision
- A game has up to **8 players**. Up to **4** can be **tracked** by the single webcam. Everyone else plays through an iPad or
  phone. Any mix is allowed: 1 tracked + 7 on pads; 8 on pads with the TV unused; the TV showing a map or the scores.
- The TV has a role chosen by the game: the play surface, a map or scoreboard, or nothing.
- Games declare what they need, like Steam's VR tags: no pad, pads optional, or pads required (and how many), and how many
  tracked seats.
- Motion is the selling point, but no game or player is required to use it. There is one webcam for everyone.
## Consequences
The platform API describes players as seats (tracked or pad), never as "the person at the camera". 16 players is a dream, not
a promise; the architecture should not forbid it.
## Replaces
The "16 players" and "up to 4 pads" figures in earlier notes.

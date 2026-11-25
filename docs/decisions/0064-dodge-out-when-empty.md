# 0064: In Dodge, an empty health bar means you are out; hits take half as much
Status: Accepted (2026-11-25)
Date: 2026-11-25

## Context
0063 gave Dodge games made in Create a health bar, with an empty bar meaning a few dizzy seconds and a refill to half. Tuned that way, a bar
emptied about five times in a two-minute round. The owner (2026-11-25): hits should take half as much, and when a player is out, they are out.

## Decision
- As 0063: a Dodge game has no score; each player has a health bar where their score would be, full at the start; a hit takes a chunk with
  a flash, a wobble and an "ouch", then a short safe moment; things drift toward where people stand.
- A hit takes half the chunk 0063 started with (0.1 of the bar instead of 0.2: ten hits to empty).
- **An empty bar puts that player out for the rest of the round.** Their chip shows "Out", their hands grey and stop counting, and things
  no longer drift toward them. There is no refill and no dizzy spell.
- The round ends when time runs out or when everyone is out, whichever comes first.
- Results show, for each player, their bar as it ended or "Out" with how long they lasted; the last ones standing are named. Still no number
  score.
- Games that mix Dodge things with other kinds keep points (a Dodge thing costs a point), as built.

## Consequences
- Replaces 0063.
- Children can be out before grown-ups; the chunk size, safe time and drift are tuned with the playtest rig so a child in a family and an
  adult last about as long, and so standing still runs out sooner than moving.

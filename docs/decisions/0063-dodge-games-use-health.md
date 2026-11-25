# 0063: Dodge games made in Create use a health bar, not points
Status: Superseded by 0064
Date: 2026-11-25

## Context
0059 made a Dodge thing cost a point when touched, and the engine gave every player a point for each thing that went past. Playtest 2
(docs/playtest2/REPORT.md, finding 3) measured that standing still won. The owner (2026-11-25): no points in Dodge; show a health bar that
goes down whenever you get hit.

## Decision
- A Dodge game has no score. Each player has a health bar, shown where their score would be, full at the start.
- A hit (a Dodge thing touching any part of the player the game watches) takes a chunk off that player's bar, with a flash, a wobble and a
  short "ouch" sound. A player is safe for a moment after a hit, so one thing can't take several chunks.
- An empty bar never puts a child out of the game: the player goes dizzy for a few seconds (no hits count), then their bar refills to half
  and they play on. The bar shows how many times it has emptied as small stars lost.
- Things drift toward where people are standing, so moving is the game; standing still is not safe.
- The round ends on time, as before. Results show each player's bar as it ended and how many times it emptied, not a number score.
- This replaces 0059's Dodge rule ("touching one costs a point") and the engine's "a point to everyone for each thing that passes".

## Consequences
- Dodge results are not comparable to Collect, Keep up or Stack scores; weekly challenges and round reports treat a Dodge round as "played",
  not by score.
- The chunk size, safe time, dizzy time and how strongly things drift toward people are starting guesses, tuned with the playtest rig so a
  child in a family and an adult empty their bars about as often.

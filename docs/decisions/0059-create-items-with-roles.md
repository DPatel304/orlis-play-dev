# 0059: Create builds a game from up to five things, each with a job
Status: Accepted (2026-11-24)
Date: 2026-11-24

## Context
0056 and 0057 set Create's Phase 1 flow: How it plays (one of catch, pop, dodge, collect, keep up), What (one thing), Where, Your move,
Rules, Name & play. Working through it, the owner (2026-11-24) asked for a simpler start, real move cards, and games that mix things.

## Decision
- **The start screen is the "Make a game" banner, filling the screen** (with the family's games row below it). No "How it works" card
  and no Pick / Play / Change a step tiles.
- **The steps are: Where, What, Your move, Rules (skippable), Name & play.** "How it plays" goes: what a game is now comes from its things.
- **What: pick up to five things, and give each one a job**, chosen right next to it:
  - **Collect** - touch it to score.
  - **Dodge** - keep away from it; touching one costs a point (never below zero).
  - **Keep up** - bat it back up whenever it falls; each bat scores, a drop pops it and it floats back in.
  - **Stack** - touch it and it flies onto your tower; a full tower blasts off (as in Stack It High).
  A thing can be picked once. The live game on the left shows the mix as it is built.
- **Your move shows the real move cards** (the indigo cards with Cubo the games use), not stick figures.
- **Names are goofier and 3 to 5 words long** ("The Great Wobbly Banana Bonanza", "Super Sneaky Bee Dodge").

## Replaces
From 0056 and 0057: the "How it plays" step and its five recipes as the first choice; one thing per game; the start screen's "How it
works" card and three tiles; the stick-figure move pictures; two-word names.

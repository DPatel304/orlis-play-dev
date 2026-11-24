# 0058: Featured opens with the last game played, then three slots the owner picks
Status: Accepted (2026-11-24)
Date: 2026-11-24

## Context
0055 made Play's first row "Featured": three featured games from Discover that are not yet on this PC, then a Discover tile, with
"Your games" below. The owner (2026-11-24) wants Home to open on Featured with the next row ("My library") peeking in below, and wants
Featured to be the same for every family on a given day, whether or not they already have the games.

## Decision
- **Featured, left to right:** the family's **last game played** (tagged **"Play again"**), then **the owner's slots #1, #2 and #3**,
  then the **Discover** tile.
  - The first tile is skipped when nothing has been played on this PC yet, or when the last game played is already in a slot (no
    game twice).
  - "Play again", not "Continue": rounds are short and do not save progress. A game that saves progress may later say "Continue".
- **The owner picks the three slots** on the management page, in order. Any game can go in a slot: a built-in game (for example
  Sleepy Bear) or a Discover game. Every family sees the same slots, in the same order, the next time they open Orlis.
  - **Already on this PC:** the tile plays it. **Not yet:** the tile shows **Get**, as before.
  - **A slot left empty** fills from the weekly rotation, so the row is never short.
- **Home opens on Featured** (its first tile), with **My library** (was "Your games") peeking in below, cropped by the screen's bottom
  edge. Coming back from a round returns focus to the game just played.

## Replaces
From 0055: Featured holding only games "not yet on this PC", and the server's on/off "featured" pins (they become numbered slots).
"Your games" is renamed "My library".

# 0046: A calmer home and HUD: the picture on the right, no hero title, the clock top right
Status: Accepted (2026-11-23)
Date: 2026-11-23

## Context
On the TV the owner found the home page and the HUD's top centre busy. The home hero (0045) filled the screen with the game's picture,
with a big outlined title, two white chips (players, time) and the next row peeking in. The HUD (0034) stacked the clock in a paper pill
over the hint words in another, all round. Options were shown on the real app (home A: the picture dimmed; home B: the picture on the right
only; a HUD with the words gone after the start and the clock without a pill).

## Decision
- **Home hero: the picture on the right only** (option B). It fades into a plain dark area on the left, where the words sit.
- **No hero title.** The tile already shows the game's name in its own lettering and is the lit one.
- **Players are an icon by the description**, not a chip. The time ("3 min") is not shown.
- **One row at a time** in the top view (the next row does not peek in). Play is a white button.
- **HUD: the hint words go after the start.** They arrive big and dock as now, then ease away; they come back only when they change.
- **HUD: the clock has no pill** (the thin sun ring and the numbers only) and **moves to the top right**.

## Replaces
From 0045: the big hero title (owner's answer 1, plain outlined Outfit), the players-and-time chips, and the picture filling the hero.
From 0034: the clock's place top centre (8,0,4,1) and the hint words staying for the whole round. The rest of 0034 and 0045 stands.

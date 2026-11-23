# 0050: The intro sound is "soft bloom", and the name comes in a little later
Status: Accepted (2026-11-23)
Date: 2026-11-23

## Context
The app's intro (the two squares) played a kalimba do-mi-sol with a high note as the squares landed, then a separate "wink" note 0.75 s
later, which the owner heard as a random extra ding. Ten options were tried on `docs/intro-sounds.html` (round one: five sounds; round
two: five beginnings, all ending with option 5's two sparkles).

## Decision
- **Soft bloom:** a warm chord swells while the squares come together and settles as they land, one soft note on the landing, and **two
  little sparkles as the name "Orlis Play" comes in**. Nothing at the wink (the squares still squash; it is silent).
- **The name comes in later:** 1.6 s after the start (was 1.15), so there is a short pause between the landing and the name. The intro
  is about 3 s (was 2.5).

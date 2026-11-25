# 0062: Players' hands are glow orbs, smoothed, with a trail, impact, pull, hover glow and sound
Status: Accepted (2026-11-25)
Date: 2026-11-25

## Context
The owner felt hand movement in a commercial motion-game console looked more polished than ours. Today games draw a white disc with a
player-colour ring and a twinkle (`ui/avatars.js` `drawMitts`) and menus draw a thin ring (`ui/cursor.js`). The tracker is noisy and a
little late. The Hand Feel Lab (`docs/hand-feel-demo.html`) put seven ideas side by side through a simulated tracker. The owner
(2026-11-25) liked all of them except the mitten, compared four hand looks (glow orb, avatar bubble, Cubo hand, Ring+) and chose the glow
orb.

## Decision
- **Look:** each hand is a glow orb in the player's colour: a bright core and a softly breathing halo that stretches into a short comet
  along fast motion. It is the same in every game, on menus and in Cubo's Create. A hold-to-pick ring fills around the orb where a hold
  is needed.
- **Smoothing:** a One Euro filter on what is drawn (steady when still, quick when fast), tuned with the tracker's own filter so the two
  do not add lag.
- **Trail:** a short fading ribbon behind fast moves only.
- **Impact:** when a hand pops, catches or hits something, the orb squashes and stretches, and a burst of sparks and a ring wave play
  where it happened. There is no hit-pause in games: game time is never frozen.
- **Pull:** near a target the drawn orb eases toward it. What counts as a hit is unchanged; only the drawing moves.
- **Hover glow:** targets a hand can touch grow a little and glow when a hand is near.
- **Sound:** a soft whoosh on fast moves, and each game's own pop on impact.
- Smoothing, look, trail and whoosh are shared and cost nothing per game. Impact, pull and hover glow need each game to say where its
  targets are and when something is hit.

## Consequences
- The old ring and mitt drawings go; the testing choices "body outline" and "glow" in Settings > Testing stay as alternatives.
- Pull and hover make it look easier than it is; hit rules stay honest, so scores do not change.
- Every number (filter, pull radius and strength, trail speed) is a starting guess, to be tuned at home on a real webcam.

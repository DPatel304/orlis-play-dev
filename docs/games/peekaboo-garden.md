# Peekaboo Garden: the design (plan package K2)

Draft for the owner to approve. Architecture in decision 0031; Phase 1 bar in 0033 (a trial: same look as Pop Party, runs well,
plays start to finish). Visual mockup: `docs/games/peekaboo-design.html` (also published as a private page).

## The round (about 1.5 minutes)
1. **Join.** The hider's phone scans the TV's QR (or taps the three pictures, 0032) and picks who they are. Seekers wave at the camera.
2. **Hide, 10 s.** The TV dims: "Seekers, cover your eyes! Count to ten together", the numbers filling in. The hider runs (seen from a guided camera behind the bunny, 0039)
   and walks into a hiding place (no button: being inside is hiding).
3. **Seek, 60 s.** Each seeker's hand is a lantern on the garden (a ray from the TV camera onto the floor). Holding a lantern over the
   hider fills a "found" meter; how fast depends on the hiding place. Moving near a bush makes it rustle on the TV.
4. **Found, or time's up.** The hider pops out on the TV as their own avatar (a paper puppet), waves and giggles; or "You stayed hidden!".
   Both are wins. "Pass the phone" to the next hider.

## Hiding places (three kinds, three of each)
| Place | Lantern time to be found | Notes |
|---|---|---|
| Out in the open | 0.4 s | |
| Tall grass | 0.8 s | quiet when you move |
| Bush | 1.2 s | rustles when you move nearby |
| Big flower pot | 2 s | you can't move while inside; step out to move |

## The garden
About 30 by 30 steps inside a hedge: a shed (hide behind it, not inside), a winding path, nine hiding places, trees along the back and
sides only (so nothing blocks the TV view), dusk light, fireflies, crickets, soft music; a lantern hum when one is close to the hider.

## The screens
- **TV:** a fixed, high three-quarter view of the whole garden (the K1 test's camera). Lanterns as warm pools of light, rustles, the
  seekers' avatars at the bottom edge. Never the hider unless lit or found.
- **Phone:** a guided camera behind and beside the bunny (0039), like a paper stage; it turns by itself. A stick to move, no look controls; the bunny flips like a card when it turns. Leaves (three) show how hidden you are; the
  lantern light glows on the screen edges as it comes close; a sun sliding down an arc is the clock (no numbers).

## What the renders taught
Paper bushes look right from the TV's height but flat and huge up close on the phone. So hiding places are **3D shapes wearing the
same painted skin** (a bush is a few soft lumps with the painted leaf texture), which match in both views. Trees and flowers far away
stay paper cutouts.

## Not in the Phase 1 trial (0033)
Scores, more than one hider, more gardens, the seekers' own phones. Welcome later.

## Open for the owner
1. Does "count to ten together" fit, or should hiding time be silent?
2. "Pass the phone" between rounds, or keep one hider and swap seekers?
3. Seekers' lantern: the hand that moves most (as in the K1 test), or always the right hand?

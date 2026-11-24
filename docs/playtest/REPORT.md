# Playtest report: ten Home games (2026-11-24)

Scripted bodies (a child about 60% of an adult's height, quick but twitchy with attention lapses; an adult tall, slower and steady) went
through the real tracker (`pose._assign`) and played each real game at 30 fps. 10 games x 4 line-ups (1 child, 1 adult, 4 children, a family
of 2 adults + 2 children) x 3 seeds = 120 rounds, plus runs with the tracker's real admission rules. Tool: `app/tools/playtest.mjs`
(header says how to run it; the bodies are in `app/tools/playtest/rig.mjs`). Raw numbers: `results.json`. Pictures: `<game>-<1c|4m>-<early|mid|end>.png`.

**Measured** = a number the rig produced. **Judged** = a reading of the numbers or a screenshot. All body sizes, speeds and lapses are
assumptions (no real children or camera); the "grown-ups never hold back" assumption matters for Stack It High and Keep It Up.

## Across games
1. **Children next to grown-ups mostly aren't players (measured).** `CLOSE = 0.6` (`tracking/pose.js:49`) needs a torso at 60% of the biggest;
   a child's is 49-60% of an adult's, so they drift in and out and are dropped after `WATCH_AFTER = 4` s. Share of the round the children were in
   (family, real rules): Pop Party 62%, Sky Painter 41%, Stack It High 17%, Animal Gym 31%, Keep It Up 28%, Ptero 23%, Sleepy Bear ~80%, Leaf Pile ~90%.
   Four children together: all in.
2. **Only two can play today (measured).** `PLAYING = 2` (`tracking/pose-shared.js:25`). In the family only the two adults really play.
3. **Hops rarely count unless big (measured).** `JumpWatch({rise:0.08, speed:0.5})` (`jump.js`): a child's 20 cm hop counts 31%, 30 cm 96%;
   an adult's 22 cm 22%, 33 cm 78%. Used by Animal Gym, Leaf Pile, Save the Harvest. Squat needs ~24/36 cm drop (child/adult).
4. **Sleepy Bear's grace is shorter than a reaction (measured).** `GRACE = 0.7` s (`sleepy-bear.js:28`): stars per freeze, child 28%, adult 5%.
5. **Tall wins when things fall, short wins when things rise (measured).** Pop Party: child 129/min vs adult 80. Stack It High blocks: child 1 vs
   adult 10. Keep It Up: child 0 vs adult 74.
6. **The results screen overflows with 3-4 players (measured).** Player chips run off the right edge (`clean-screens.css:39-40`, `screens.js:182-190`);
   avatars overlap and the card hides one.
7. **Scores aren't comparable across body sizes (measured).** Sky Painter adult ~1000/min vs child 480-680; Animal Gym child 61 vs adult 38.
8. **No game draws the player's body (judged).** Only a ~75 px star hand marker; Save the Harvest draws none; with four, markers overlap.

## Summary (median of 3 seeds)
| Game | Line-up | Score/min | Child/adult | Longest no points (s) | On target % | Round (s) |
|---|---|---|---|---|---|---|
| Pop Party | 1 child / 1 adult / 4 children / family | 136 / 147 / 73 / c129 a80 | 1.69 | 8 / 7 / 14 / 18 | 71-89 | 120 |
| Sky Painter | " | 611 / 1073 / 335 / c683 a1007 | 0.68 | 12 / 5 / 35 / 9 | 56-89 | 180 |
| Sleepy Bear | " | 1 / 0 / 2 / 1 | 1.75 | 94 / 129 / 134 / 107 | 87-98 | 180 |
| Leaf Pile | " | 55 / 50 / 22 / c18 a19 | 0.95 | 36 / 15 / 102 / 51 | 86-98 | 163-168 |
| Stack It High | " | 8 / 22 / 4 / c1 a10 | 0.05 | 60 / 6 / 70 / 174 | 37-91 | 180 |
| Animal Gym | " | 65 / 36 / 59 / c61 a38 | 1.62 | 10 / 20 / 18 / 26 | 84-95 | 180 |
| Keep It Up | " | 31 / 130 / 11 / c0 a74 | 0.01 | 5 / 3 / 58 / 179 | 83-97 | 180 |
| Ptero Flight | all | 4 wonders/min, shared | 1 | 19 | 87-97 | 180 |
| Save the Harvest | " | 20 / 8 / 15 / c17 a10 | 1.88 | 8 / 38 / 16 / 20 | 28-58 | 76 / **330 cap** / 70 / 77 |
| Cubion's story | all | no score | - | - | - | 238 (no voice) |

No NaN, negative score or score while absent in 120 runs. Stuck: adult alone in Save the Harvest (never ends), lone child in Sky Painter (stalls).

## Top three issues per game
| Game | 1 | 2 | 3 |
|---|---|---|---|
| Pop Party | Top third out of a child's reach (35% of balloon time) | Balloons rise from `by: 1.15` (`:260`): lowest hands win | Results chips off the edge, avatars overlap |
| Sky Painter | Child stalls under `SPREAD_FROM = 0.25` (`:27`); top unreachable | Child finishes mostly by watercolour spread | Move card covers paper; raw "bits of sky" scores |
| Sleepy Bear | `GRACE 0.7` s < reaction (28% / 5% stars) | Lapses (standing still anyway) are rewarded | One shared "Wobble!" pill |
| Leaf Pile | Adults bent 63-84% of the round (leaves at 70-90% height, `:42`) | Lone jump doesn't register (pile bursts after `JUMP_WAIT`) | Ends at 163-168 s, not 180 |
| Stack It High | 8th block needs a hand above 46% (`:102`): child must hop | Grown-ups take blocks from above | Child alone leaves blocks in the grass |
| Animal Gym | Hops often don't count | 15-20 s dead time per stretch; comment (`:3`) vs code (`:128`) | Adult squat needs a 36 cm drop |
| Keep It Up | Grown-ups take every ball | Low bounce after a drop (`:98`): adults stoop | Scores inflate with more players |
| Ptero Flight | Nothing can go wrong | Arms out 87-97% of 3 min | One resting child drags the pitch (`:133`) |
| Save the Harvest | Adult hop for pears fails; `endless` round can run for ever (`:38`) | 40-60% waiting | No hand marker at all |
| Cubion's story | 70 s before the first move | ~4 minutes long | End card over Cubo |

## Could not test
Real children, camera and TV distance; the story's real voice length; sound; a "polite parent"; line-ups that aren't side by side; camera
rates of 15-25 fps.

# Playtest 2: every game and every screen (2026-11-25)

The same scripted bodies as docs/playtest/REPORT.md (a child about 60% of an adult's height; an adult tall and steady) through the real tracker,
plus the games made with Cubo's Create (one per job, through the Orlis.play engine), LKP, Tower Defense and Peekaboo Garden. 459 rounds:
line-ups 1 child (1c), 1 adult (1a), 4 children (4c) and a family of 2 adults + 2 children (4m), 3 seeds, real admission rules. Screens
driven with Playwright by remote, mouse and body at 1920x1080 and 1280x720; the server's management page walked at both sizes.

Tools (app/tools/): `playtest.mjs` (now with `--games made`, orb stats, a points-for-an-empty-place check and a reachability probe for made
games; `--out` is relative to app/tools/), `playtest/made.mjs`, `playtest2-compare.mjs` (before/now tables), `playtest2-screens.mjs`,
`playtest2-server.mjs`, `playtest2-remote.mjs`. Raw numbers: `results.json`, `screens.json`, `server.json`. Pictures: `<area>-<what>.png`.

**Measured** = a number the rig produced. **Judged** = a reading of a number or a screenshot. Body sizes and behaviour are assumptions.

## Findings (blocks the beta 0, should fix 7, polish 12)
| # | Sev | Finding | Where | Reproduce | Suggested fix |
|---|---|---|---|---|---|
| 1 | Should | Made Collect/Stack/Dodge: things spend 25-37% of their life under the clock, goal bar and score (measured) | `games/play/engine.js` `_make` (spawns at y -0.06), `games/hud.js` `hudZones` | `node tools/playtest.mjs --games made-collect,made-stack --lineups 1c --seeds 1 --fresh --out /tmp/x.json`: `underHudShare` 0.26-0.35 | Spawn below the HUD, or ignore touches in its zones |
| 2 | Should | Made Keep Up: family children get 0-1 hits (adults 169-337); 4 children get 109 s gaps (measured) | `engine.js:11` (`CEIL` 0.2), `create/recipe.js` | `--games made-keepup --lineups 4m` | A ball each in "together", or a lower ceiling |
| 3 | Should | Made Dodge gives every player a point for each thing that passes, so standing still wins (measured) | `engine.js:159` `_points` with `who=-1` | `made-dodge`, any line-up | Score time survived or near-misses |
| 4 | Should | Made Collect/Stack: in a family a child reaches a falling thing for 1-2% of its time on screen (30% alone); 6-7 things a round are out of a child's reach (measured) | `engine.js` `HAND_REACH` | `made-collect --lineups 1c,4m` | Size and speed by the smallest player |
| 5 | Should | The remote can't change the Volume slider (only Mute) (measured) | `ui/menu.js:202` | `node tools/playtest2-remote.mjs`: Down goes Mute, then Full screen | Left/Right steps, or Quieter/Louder buttons |
| 6 | Should | Camera check says "Two people can play." but four can (judged) | `ui/screens.js:36` | `camera-check-*.png` | "Up to four people can play" |
| 7 | Should | LKP's star chip and gem bar sit over Nova's portrait and "SIGNAL WEAK"; an empty dark bar bottom left (judged) | `lkp-ui.js` / `lkp-game.js` | `last-known-position-4m-mid.png` | Move the chips right of the portrait; hide the empty bar |
| 8 | Polish | Bursts and "+1" hang frozen over the pause card (judged) | pause card | `pause-4.png` | Clear effects on pause |
| 9 | Polish | Two orbs within 4% of screen height for 20-29% of the time (Pop Party 29, Stack 27, Leaf 23, Keep It Up 20, made keep-up 76) (measured) | `ui/handfeel.js` | orb table in `playtest2-compare.mjs` | Nudge overlapping orbs apart |
| 10 | Polish | LKP, Peekaboo and the story draw no glow orbs; 0062 says "same in every game" (judged) | those games | any 4-player round | Add orbs, or record the exemption |
| 11 | Polish | Tower Defense and LKP never end on their own: castle 7+ min in 3 of 6 child rounds, LKP 24 of 24 (measured) | `castle-defense.js:264`, `lkp-game.js:264` | `--games castle-defense,last-known-position` | A "Still there?" card after a minute with nobody moving |
| 12 | Polish | "balloons popped" sits 10 px from the results card's right edge (judged) | `clean-screens.css:12` `.gbig` | `results-4p.png` | Padding or wrap |
| 13 | Polish | Stack It High, one adult: 22 -> 4 a minute, 34 s with no point (was 6) (measured) | Stack It High block rules (the sandbox change) | `--games stack-it-high --lineups 1a` | Check against the freestyle design |
| 14 | Polish | The owner's My library shows "Peekaboo Garden (3D test)" and "Phone stick (pad test)" (judged) | `ui/home.js:86` | `home-library.png` | Only with the Testing switch on |
| 15 | Polish | Settings > Testing names are unclear ("Glow orb / Body outline / Glow", "Player / Creator") (judged) | `ui/menu.js` | `settings-testing.png` | Plainer names |
| 16 | Polish | The Create hero runs 9 px past the screen edges, cutting its focus ring (judged) | Create home | `create-*.png` | Inset it |
| 17 | Polish | Server page: jargon (Funnel, SMTP, allowlist, p95), mixed 12/24 h times, 3 values cut with "..." at 1280, a 13x13 checkbox (judged) | `server/src/manage-page.js` | `server-*.png` | Plainer words, one time format, bigger targets |
| 18 | Polish | The `peekaboo-pair` browser test flakes under load ("paused" instead of "playing"); passes alone (measured) | `app/test/peekaboo-pair.test.mjs` | full `npm test` on a busy machine | Wait for the state, not a fixed time |
| 19 | Polish | A point goes to an empty slot in 9 of 90 Leaf Pile / Stack It High runs, credit for a player who has left (measured) | `leaf-pile.js:230`, `stack-it-high.js:275` | `--games leaf-pile,stack-it-high --lineups 4m` | Credit only present players |

## Better or worse since the last playtest (measured, medians of 3 seeds)
**Better.** Children are now players in the family for 100% of the round (was 58-92%). Family child/adult ratio: Stack It High 0.05 -> 1.33,
Keep It Up 0.01 -> 0.84, Sky Painter 0.68 -> 1.31. Longest stretch with no points: Keep It Up family 179 -> 4 s, Sleepy Bear 94-134 -> 28-57 s,
Stack It High family 174 -> 48 s, Leaf Pile 4 children 102 -> 59 s. Save the Harvest, one adult: never ended (330 s cap) -> 74 s. Leaf Pile ends
at 180 s (was 163-168). The results screen fits 4 chips. No NaN or negative score in 459 rounds; no two players share an orb colour.

**Worse or changed.** Stack It High one adult 22 -> 4 a minute (on target 91% -> 69%). Pop Party on target: 4 children 63% -> 42%, family
78% -> 51%. Pop Party and Sky Painter scores per minute changed scale (Pop Party 136 -> 552, Sky Painter adult 1073 -> 535), so they are not
comparable. Cubion's story is 150 s (was 238), still with nothing to do.

## Games
- Family child/adult ratio, real rules: Pop Party 1.28, Sky Painter 1.28, Sleepy Bear 0.75, Leaf Pile 1.63, Stack It High 1.29, Animal Gym 1.82,
  Keep It Up 0.84, Ptero 1, Save the Harvest 1.48. Made games: collect 0.06, dodge 0.41, keep up 0, stack 0.04. All made games end on time (2 min).
- Glow orbs, 4 players: 8 orbs at once; 7-21% of orb time under the HUD (Leaf Pile 21, made keep-up 16, Sleepy Bear 13), none seen hidden
  behind a chip; up to 111 sparks alive at round end (Pop Party), none on the results screen.
- LKP: 24 of 24 rounds to the 420 s cap, as expected for an endless game; no crash. Tower Defense: 1 adult and the family end at about
  107-109 s; child rounds hit the cap in 3 of 6. Peekaboo: the 74 s round ends; it draws lanterns, not orbs.

## Screens
Remote focus never lost (Who's playing, Home, Discover, Create, Profile, Pause); Escape goes Home from Discover, Create, Settings and the
camera check, and resumes from Pause. No page errors; 3 resource 404s a run. Warm screen changes: Home 0.2-0.5 s, Discover 0.5-0.8 s,
Create 0.1-0.3 s, Settings and Profile under 0.15 s. First load (dev server, busy machine): sign-in 4.3-5.8 s, Who's playing 5.2-6.2 s.

## Server management page
Every page at both sizes (Overview, Queue, Families with detail and search, Games with detail, Activity, Settings, keyboard): no console or
HTTP errors, no horizontal scroll, no overlaps. Polish in finding 17.

## Could not test
Real people, camera, TV distance and sound; the real camera check (the tracker model does not load here); LKP, Tower Defense and Peekaboo
with real play (standing bodies only); body control on Home, Discover and Who's playing (camera off there by design); waving on Pause and
Results; updates; made games as a played screen. The older `rehearsal-*.mjs` scripts use old Home selectors and are probably stale.

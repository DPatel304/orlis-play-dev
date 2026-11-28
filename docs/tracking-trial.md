# Home trial: the camera helpers

Nine Testing switches for the camera, all **off** until you turn them on. With all of them off nothing changes. They could not be tried with a
real camera where they were built, so this trial is how we find out whether they help. Takes about 30 minutes with a real webcam and, ideally,
a child and a grown-up (two children is better still).

## The switches

Settings > Testing (owner only). Each row is On / Off, in this order:

| Row | What it does |
|---|---|
| **Recognise players by clothes** | Learns the colours of each player's top, so two players who cross or stand close keep their own place and colour. A player who leaves and comes back within 5 seconds gets their own place back (30 seconds with *Tell players apart better*). |
| **Look closer at small players** | Takes a second, closer look at a child who is small or far away, or who just went missing. Costs a little speed. |
| **Tell players apart better** | Learns each player's body shape (height, shoulders, arms, legs, as shares of the torso), pairs everyone with the best whole arrangement instead of one at a time, holds both players still while their bodies overlap and decides who is who once when they come apart, and remembers a player who left for 30 seconds (by clothes and/or shape). Works with or without clothes; with clothes it is better still. |
| **Steadier hands** | Smooths less-sure points harder, ignores one-look spikes and impossible arm stretches, and draws the glow orb a touch ahead of the hand (hits and scores use the honest position). |
| **Lighting tips** | In the camera check ("get ready"), a short card when the room is too dark ("Turn on a light near you") or a bright window is behind you ("A bright window behind you makes you hard to see"). |
| **Brighten the screen in dark rooms** | When the camera finds the room dark, the screen gives out a little more light (a soft white veil, eased in over about 2 seconds): more on menus and the camera check, a subtle lift in games. Held back in cutscenes. |
| **Sharper camera** | Asks the camera for 60 pictures a second and, if the camera has the controls and the room is bright, a shorter exposure (less blur). Takes effect when the camera next starts (start a game). |
| **Record tracking (points only)** | While a round plays, keeps the body points of everyone the camera saw (never the picture) for the last 10 minutes. **Save recording** (same row) writes a file. |
| **Show tracking details** | A small box in the top-right corner (below). |

**Show tracking details.** The first lines say whether zoom is on (and how many ms a closer look takes), which of clothes / apart / steady are on, then one line
per player: `P1 body 41% Z+ 0.93 S 0.97 HOLD` means player 1, body 41% of the picture's height, the closer look found them (`Z+`; `Z` = looked, found
nothing new; blank = not looked), clothes match 0.93 (1.00 is exactly the colours it learned; under 0.6 means a different top), shape match 0.97 (1.00 is
the same build; under 0.8 is a different build), and `HOLD` while that player is overlapping someone and the tracker is holding both places. Then `rec on 3:12` (recording time),
`camera 60 fps, exposure short` (what Sharper camera got; `no controls` if the camera has none), and `room: dark, screen lifted` (or `dark`, `ok`).

## Record every trial round

Switch on **Record tracking (points only)** before you play. After each trial round, open Settings > Testing and press **Save recording**: it writes
`orlis-track-<date>.json.gz` (your Downloads folder). Note what you did and which switches were on. Then, on any PC:

    cd app
    node tools/replay.mjs <file> --compare

feeds the same round through the tracker with each switch alone and together and prints dropouts, jumps and suspect swaps around crossings, wrist jitter,
lag and join time. `--switches=steady,apart` runs one combination. (Recordings hold only body points. If *Recognise players by clothes* was on while recording,
they also hold each player's torso colour counts - 26 small numbers - so the clothes switch can be replayed; no picture can be made from them.)

## What to compare

Play Pop Party or any game for about a minute each time, with **Show tracking details** on and **Record** on. Rounds to play, and save a file after each:

| Round | Switches on |
|---|---|
| 1 | none (the baseline) |
| 2 | Tell players apart better |
| 3 | Recognise players by clothes |
| 4 | Tell players apart better + Recognise players by clothes |
| 5 | Steadier hands |
| 6 | Everything above, plus Look closer at small players |
| 7 | Sharper camera (alone), in a bright room, then in a dim one |
| 8 | Lighting tips, then Brighten the screen: lights off, a lamp on, a bright window behind you |

The recordings let you compare 1 to 6 afterwards on one set of moves; rounds 7 and 8 have to be played live (they change the camera and the screen).
Press P as well to see the frame rate and inference time.

## What to try

1. **Kids beside adults.** A child standing next to a grown-up, then a child behind or half hidden by the grown-up. Does the child stay a
   player, with their own colour, the whole time? (Closer look.)
2. **Crossing over.** Two people walk past each other and swap sides quickly, a few times. Try different tops, then the same top. Does each keep
   their own colour? (Clothes in different tops; *Tell players apart better* in the same top if one is bigger, longer-legged or broader than the other.)
3. **Hugging and ducking.** Two players stand very close, lean together, one ducks behind the other for a second, then they part. The `HOLD`
   label should show; nobody should swap or drop out. (Tell players apart better.)
4. **Walking away and back.** Walk out of the picture, come back after 2 to 3 seconds, then after 10 seconds, then after 25 seconds, while someone
   else walks in at the same time. You should get your own place and colour back; the newcomer takes a free place. Clothes alone: up to 5 seconds. With
   Tell players apart better: up to 30 seconds. (Memory.)
5. **Lamp light.** Switch a lamp on or off, or close the curtains, mid-game, then cross over again. The match number may dip a little but players
   should not swap. Try one very strong coloured light if you have one (that can fool it: note it). (Clothes.)
6. **Far away.** A child standing at the back of the room, near the edge of the picture. Do they join and stay in? (Closer look.)
7. **Quick hands.** Hold a hand still, then swing it fast across the screen, then a flick. Is the hand steadier at rest, and not left behind in the
   swing? (Steadier hands. Note whether the orb feels ahead of your hand, and whether anything you hit felt different.)
8. **Dark room.** Lights off, TV on. Does the tip come up in the camera check? Does the screen lift gradually, not suddenly? Do games stay readable? Does
   tracking get any better? (Lighting tips, Brighten the screen.)

## What to note

- Which switches were on, and the game, and the name of the recording file.
- Did anyone swap colour, drop out, or fail to join? When, and who was near whom?
- The frame rate and inference time (P) with each setting. Closer look should not push inference above about 24 ms; if the box says
  `zoom paused (slow)` the machine was already struggling and the closer look backed off by itself.
- The `body %` for the smallest player and whether `Z` showed beside them.
- Tops: plain, patterned, black or white, and whether two players wore similar colours (similar colours are the weak spot for clothes; similar builds
  for shape).
- With Sharper camera: the `camera` line (did you get 60 fps? did the exposure change? `no controls` means this camera has no exposure controls).
- With Brighten the screen: how much brighter the faces look to you, and whether it flickered on and off.
- Anything that looked worse than with the switches off. Switch everything off to compare: with them off nothing changes.

If a game feels slow, turn **Look closer** off first.

## Good to know

- The camera picture is only used to read the colours of a top (a few numbers), the brightness of the room (a few numbers) and to cut out a closer look
  for the body tracker. It is never shown, sent or kept. Recordings hold body points only.
- No face is ever recognised. Shape means the proportions of the body's points; clothes means colour counts of the top.
- Closer look runs only on the main thread. With "Camera tracking: separate worker" on (Shift+G), it stays off (the box says `off (worker)`).
- All of them are safe to fail: if anything goes wrong in one, that frame is tracked the old way.
- Command-line numbers (no camera): `cd app && node tools/playtest.mjs --track` (who is who, steadiness, exact swap counts on the test rig's bodies, for each
  switch alone and together), `node tools/playtest.mjs --crossing` (children crossing, the clothes switch), `node tools/tracking-bench.mjs --browser` (cost per
  frame).

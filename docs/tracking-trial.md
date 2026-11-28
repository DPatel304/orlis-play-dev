# Home trial: two camera helpers

Two new things for the camera, both **off** until you turn them on. They could not be tried with a real camera where they were built, so this
trial is how we find out whether they help. Takes about 20 minutes with a real webcam and, ideally, a child and a grown-up.

## What to switch on

Settings > Testing (owner only). Three rows, each On / Off:

| Row | What it does |
|---|---|
| **Recognise players by clothes** | Learns the colours of each player's top, so two players who cross or stand close keep their own place and colour. A player who leaves and comes back within 5 seconds gets their own place back. |
| **Look closer at small players** | Takes a second, closer look at a child who is small or far away, or who just went missing. Costs a little speed. |
| **Show tracking details** | A small box in the top-right corner. One line per player: `P1 body 41% Z+ 0.93` means player 1, body 41% of the picture's height, the closer look found them (`Z+`; `Z` = it looked but found nothing new; blank = not looked), clothes match 0.93 (1.00 is exactly the colours it learned; under 0.6 means a different top). The first two lines say whether zoom is on, how many ms a closer look takes, and whether clothes is on. |

Turn on **Show tracking details** every time. Then compare three rounds of the same thing: both off, only clothes, only closer look
(then both). Press P as well to see the frame rate and inference time.

## Record every trial round

Switch on **Record tracking (points only)** before you play. While a round is playing the app keeps the body points of everyone the camera
saw (never the picture) for the last 10 minutes. After each trial round, open Settings > Testing and press **Save recording**: it writes
`orlis-track-<date>.json.gz` (your Downloads folder). Put a note of what you did in the file name or a message. Then, on any PC:
`cd app && node tools/replay.mjs <file> --compare` feeds the same round through the tracker with each switch alone and together, and
prints dropouts, slot jumps and suspect swaps around crossings, wrist jitter, lag and join time.

## What to try

Play Pop Party or any game for about a minute each time.

1. **Kids beside adults.** A child standing next to a grown-up, then a child behind or half hidden by the grown-up. Does the child stay a
   player, with their own colour, the whole time? (Closer look.)
2. **Crossing over.** Two people in different coloured tops walk past each other, and swap sides quickly, a few times. Does each keep their own
   colour? Try the same in the same colour top: it should be no worse than with the switches off. (Clothes.)
3. **Walking away and back.** Walk out of the picture, come back after 2 to 3 seconds, then once after 10 seconds. Within about 5 seconds you
   should get your own place and colour back; after that you are a newcomer. (Clothes.)
4. **Lamp light.** Switch a lamp on or off, or close the curtains, mid-game, then cross over again. The match number may dip a little but
   players should not swap. Try one very strong coloured light if you have one (that can fool it: note it). (Clothes.)
5. **Far away.** A child standing at the back of the room, near the edge of the picture. Do they join and stay in? (Closer look.)

## What to note

- Which switches were on, and the game.
- Did anyone swap colour, drop out, or fail to join? When, and who was near whom?
- The frame rate and inference time (P) with each setting. Closer look should not push inference above about 24 ms; if the box says
  `zoom paused (slow)` the machine was already struggling and the closer look backed off by itself.
- The `body %` for the smallest player and whether `Z` showed beside them.
- Tops: plain, patterned, black or white, and whether two players wore similar colours (similar colours are the weak spot).
- Anything that looked worse than with the switches off. Switch both off to compare: with them off nothing changes.

If a game feels slow, turn **Look closer** off first.

## Good to know

- The camera picture is only used to read the colours of a top (a few numbers) and to cut out a closer look for the body tracker. It is never
  shown, sent or kept.
- Closer look runs only on the main thread. With "Camera tracking: separate worker" on (Shift+G), it stays off (the box says `off (worker)`).
- Both are safe to fail: if anything goes wrong in either, that frame is tracked the old way.
- Command-line numbers: `cd app && node tools/playtest.mjs --crossing` (children crossing, synthetic pictures) and
  `node tools/tracking-bench.mjs --browser` (cost per frame).

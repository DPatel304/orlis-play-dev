# Home trial: the camera helpers

Eleven Testing switches for the camera, all **off** until you turn them on. With all of them off nothing changes. They could not be tried with a
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
| **Track coloured wristbands** | Wear a bright band on each wrist (the same colour on both; a different colour for each player; a hair tie, a sweatband or a strip of coloured tape will do). In the camera check it says "Raise your hands for a second" and learns each player's band colour in this room's light. Then, every look, it finds the band near each wrist: it nudges the wrist toward it, finds a wrist the camera lost in a fast swing, and uses it to keep players in their own places (a body wearing player 2's band is player 2's). A player with no band (or two different colours) is marked "none" and nothing happens for them. |
| **Exact hands** | Asks the hand model about at most two wrists a look (hands that move or are near a target first, the rest in turn) and finds the **palm centre** and whether the hand is **open, closed or pointing**. The glow orb and everything a hand hits then sit on the palm, a little further on than the wrist the body tracker reports. Needs the hand model file (see *The hand model file*, below); costs a little speed. |
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

With the two new switches there is a line `bands on 0.6ms, hands on 4.1ms` (each says `off`, `on`, `paused (slow)` when the machine was skipping looks, `off (worker)` in worker mode, or for hands `loading` / `unavailable`; the ms are the smoothed cost of one look), and per player
`P1 band ✓  hand: open 0.87 / point 0.62`: **band ✓** the player's band was seen on their body this look, **band ✗** they have one but it was not seen this look (hidden, or the colour was not found), **band none** no band was learnt for them, `band ...` still learning;
**hand: open 0.87** the left hand's grip and how sure the hand model was (0 to 1; `-` = no recent run, or the grip was unclear), then the right hand's.

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
| 9 | **Bands.** One game, three or four times, everyone wearing their bands: (a) no switches, (b) Track coloured wristbands, (c) Tell players apart better, (d) Tell players apart better + Track coloured wristbands. Do the "raise your hands" at the start of (b) and (d) |
| 10 | **Exact hands.** The same game, Exact hands off, then on (alone, then with Steadier hands) |

The recordings let you compare 1 to 6 afterwards on one set of moves, and, if Record was on, the bands too: a recording made with Track coloured wristbands on
holds each player's learnt colour range (numbers) and where each band was found at each look (a centre and a size), so `node tools/replay.mjs <file> --compare` also shows
`bands` and `apart + bands`. Rounds 7, 8 and 10 have to be played live (they change the camera, the screen and what is hit). Press P as well to see the frame rate and inference time.

**Round 9, the bands round.** Each player wears a band on each wrist, different colours (pink, light blue, lime and orange are the easiest; avoid your skin colour and
the colour of your shirt). Do the same thing every time: line up, raise both hands for a second at the camera check, play a minute of a game with fast arms (Pop Party), then
cross over two or three times. Do (a) to (d) in turn: with the switch on, **Show tracking details** shows `band ✓` while the band is seen. Try the harder things after the normal minute:
(1) wear a shirt the colour of one band, (2) put something in a band colour in view (a cushion, a toy), (3) one player with no band at all, (4) swap a band onto the other player,
(5) change the lamp (warm light against daylight), (6) cross with your arms crossed, (7) the very fastest swing you can do.

**Round 10, Exact hands.** Press **P** first to note the frame rate and inference time with it off. Switch it on and wait until the readout says `hands on` (the hand model loads in the
background, a few seconds the first time). Hold an open hand, a fist, then point with one finger in front of the camera, one hand at a time and then both: the readout should say
`open`, `closed`, `point` for that hand. Play a game where you hit things (Pop Party, Leaf Pile): does the glow orb sit on your hand rather than a bit behind it? Is it steady (not
jumping between the wrist and the palm)? Do hits feel more exact, or less? Sweep your hand quickly: the palm is only measured on two hands a look and carried forward between, so check the orb
does not wobble in fast moves.

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

9. **Bands.** (Round 9.) Crossing in the *same* shirts with different bands: does each keep their colour? Fast swings: does the hand stay with the band instead of being
   left behind or lost? A cushion or a toy in a band colour near your hands, or a shirt in a band colour: does anything jump to it? Hands together, or arms crossed:
   does each band stay on its own arm (never left and right swapped because of colour)? A warm lamp: still found? One player without a band: no harm to the others?
10. **Exact hands.** (Round 10.) Open, fist, point, both hands, a hand turned sideways, a hand held up high or close to the camera, a child's small hand: what does the readout
    say, and how sure is it? Does a second person's hand ever get taken for yours (the orb jumping to someone else)?

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
- With bands: what each player wore (colour, material: shiny bands blow out in bright light), the `bands` line (ms and `paused (slow)`), how often `band ✗` showed while a
  band was in plain view, and anything that jumped to a band-coloured object. The frame rate and inference time (P) with and without.
- With Exact hands: the frame rate and inference time (P) on and off, the `hands` ms, whether it ever said `loading` for long or `unavailable` (no hand model file and no
  internet), the grip the readout gave for each pose you made (open / closed / point, and how sure), and whether the orb sat on the palm. Hands of children are the most interesting.
- Anything that looked worse than with the switches off. Switch everything off to compare: with them off nothing changes.

If a game feels slow, turn **Look closer** off first, then **Exact hands**, then **Track coloured wristbands** (bands cost at most 8 small cut-outs a look and back off by
themselves above 6 ms; the hand model runs on at most two hands a look and only when the full look has time to spare).

## Good to know

- The camera picture is only used to read the colours of a top (a few numbers), the brightness of the room (a few numbers), to cut out a closer look
  for the body tracker, and to cut out small squares around the wrists (bands: 56 pixels a side; hands: about 208 pixels a side, for the hand model). It is never shown, sent or kept.
  Recordings hold body points, and, with the bands switch on, the learnt band colour (a hue range) and where bands were found (a centre and a size) - never a pixel.
- No face is ever recognised. Shape means the proportions of the body's points; clothes means colour counts of the top.
- Closer look, bands and Exact hands run only on the main thread. With "Camera tracking: separate worker" on (Shift+G), they stay off (the box says `off (worker)`).
- Exact hands and Track coloured wristbands do no face recognition and keep no picture: the hand model gets a square around a wrist, the answer is 21 points of a hand, and the square is dropped.
- All of them are safe to fail: if anything goes wrong in one, that frame is tracked the old way.
- Command-line numbers (no camera): `node tools/playtest.mjs --bands` (the wristbands: swings with the wrist lost, crossing in the same shirts, a cushion and a shirt in a band
  colour, a warm lamp, one player with no band; off and on, alone and with Tell players apart better) and `node tools/playtest.mjs --palm` (games with the hand a palm's length past the
  wrist, Exact hands off and on). Both draw their pictures and hands from the rig's own bodies, so they only show that the logic works. Also: `cd app && node tools/playtest.mjs --track` (who is who, steadiness, exact swap counts on the test rig's bodies, for each
  switch alone and together), `node tools/playtest.mjs --crossing` (children crossing, the clothes switch), `node tools/tracking-bench.mjs --browser` (cost per
  frame).

## The hand model file

Exact hands needs MediaPipe's hand model, `hand_landmarker.task` (the float16 model; **7,819,105 bytes**, about 7.5 MB; sha256
`fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1`; it holds a palm detector and a hand landmark model). It is shipped like the body model:

- **Easiest:** from `app/`, run `npm run offline` (`node fetch-assets.mjs`): it now also downloads the hand model to `app/public/models/hand_landmarker.task` (that folder is not in the repository,
  as for the body model; `npm run client:web` and the Windows app build copy it in with the rest of `public/`).
- **By hand:** download
  `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`
  and save it as `app/public/models/hand_landmarker.task`. It does not have to be unpacked.
- **Without the file:** when the app runs from its own files (`/wasm/...` is there) it looks for `/models/hand_landmarker.task` first and, if that is missing or will not load, asks the CDN
  for the URL above the first time Exact hands is on (a few seconds; needs the internet). If neither works the readout says `hands unavailable` and nothing else changes.
- The app tries the graphics chip first and falls back to the processor, as the body model does.

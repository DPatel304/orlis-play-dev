# Decision records

One short file per decision. They are the authoritative record of what Orlis has decided, and why.

**Authority order when documents disagree:** tests and code (for what is built), then these records, then
`ARCHITECTURE.md`, then `VISION.md`, then `BACKLOG.md` (ideas and to-dos).

**Statuses:** *Accepted* (decided), *Proposed* (the assistant's recommendation, waiting for the owner), *Open* (a question
with options, not decided), *Superseded by NNNN* (replaced; kept, never deleted).

**To add one:** copy the shape below, take the next number, and add it to the index. To change a decision, write a new record
that supersedes the old one.

```
# NNNN: Title
Status: Accepted | Proposed | Open | Superseded by NNNN
Date: YYYY-MM-DD
## Context      (what forced the decision)
## Decision     (what we do)
## Consequences (what it costs, what it enables)
## Replaces     (earlier decisions or backlog sections, if any)
```

## Index
| # | Decision | Status |
|---|---|---|
| 0001 | The phases: family beta first, then a sold dev kit | Accepted |
| 0002 | The platform runs on any operating system (web stack); Windows first | Accepted |
| 0003 | The Orlis Box: a ready-made console, eventually | Accepted |
| 0004 | Seats: up to 8 players, up to 4 tracked, any mix of devices | Accepted |
| 0005 | A session is hosted by any one device; the Box by default | Accepted |
| 0006 | Pairing: automatic discovery on the home network, a confirmation code the first time | Accepted |
| 0007 | Accounts and data: sign in once online; offline after; kid data on the owner's server | Accepted (beta sign-in via the owner's server) |
| 0008 | Publishing and guardrails | Accepted |
| 0009 | Watches as controllers | Shelved |
| 0010 | How Orlis makes money | Open (deferred to after Phase 1) |
| 0011 | Children's profiles stay in the house | Replaced by 0044 (camera pictures still never leave the device) |
| 0012 | Two ways games are made: Create and premium | Accepted |
| 0013 | A safety floor for every game; age fit is separate | Accepted |
| 0014 | No online play | Accepted |
| 0015 | The first 3D game is Peekaboo Garden | Accepted |
| 0016 | An Android app first, for Phase 1 | Accepted |
| 0017 | Phase 1 is a closed beta; in Phase 2 the platform is sold only as a kit | Accepted (beta note approved) |
| 0018 | Apple support is deferred to Phase 2 | Accepted |
| 0019 | Phase 1 pads are a browser page; a native app follows if time allows | Accepted |
| 0020 | The stage is built; existing flat games are not migrated yet | Superseded by 0029 |
| 0023 | The Orlis Box draws 2D only; 3D lives on the pads | Superseded by 0029 |
| 0021 | The games roadmap (six core, three added) | Accepted as roadmap; Phase 1 scope superseded by 0022 |
| 0022 | Phase 1 ships one perfected game and a finished platform | Accepted (gate confirmed, hand mode added) |
| 0024 | Phase 1 also ships one perfected 3D game, on the Box and pads with no camera | Superseded by 0025 |
| 0025 | Phase 1 is 2D only; 3D is private experiments for now | Superseded by 0026 |
| 0026 | Phase 1 has two games: Pop Party, and one 3D game for the TV and an Android tablet | Accepted; Peekaboo Garden (one hider phone, camera seekers); target late May 2027 |
| 0027 | The pad link: a small local hub in Orlis Play; the game host is its client (spec: `docs/specs/pad-protocol.md`) | Accepted |
| 0028 | Sessions and seats in code; kid profiles move to the Box | Accepted (join code replaced, see 0032; Pop Party phones dropped, see 0043; profiles stay on the server, see 0044) |
| 0029 | Drawing: flat games on the 2D painter, 3D games on three.js on the TV and pads (supersedes 0020 and 0023) | Accepted (the 2D painter part stands again: 0036 superseded by 0038) |
| 0030 | Phase 1 pads are the testers' own phones, with a minimum (replaces 0026's "Android tablet") | Accepted: minimum iPhone 15 or equivalent |
| 0031 | How Peekaboo Garden is built | Accepted |
| 0032 | Joining without typing: tap the three pictures shown on the TV | Accepted |
| 0033 | Phase 1's 3D game is a trial: consistent and smooth, gameplay may be unfinished | Accepted |
| 0034 | The HUD: fixed anchors and flexible docks on the 20 x 11 grid | Accepted |
| 0035 | The Orlis look: cozy, playful, handmade paper, for every kind of game | Accepted in part; material and edge set by 0038 |
| 0036 | The look is toon-shaded 3D, drawn flat for 2D games | Superseded by 0038 |
| 0037 | Pop Party stays painted for Phase 1; the toon look is tested fairly before it is final | Accepted |
| 0038 | Two looks, one family: painted 2D for 2D games, a painted-style 3D sibling for 3D games | Accepted |
| 0039 | 2.5D: 3D games move like a paper stage (guided camera, flipping painted characters); true 3D later; the FPS is the owner's own store game | Accepted |
| 0040 | The master palette: one named list of colours for 2D and 2.5D; games use names, never raw codes | Accepted |
| 0041 | Style rules: one base colour per object, shade and highlight by rule; gradients only in backgrounds; chunky shapes for 3D | Accepted |
| 0042 | One character, many kids: every avatar is the same cube character; colour, face, topper, outfit, one extra | Accepted |
| 0043 | Pop Party stays camera-only (replaces the Pop Party line of 0028) | Accepted |
| 0044 | Everyone's profiles stay on the owner's server (nickname and avatar only; replaces 0011 and the profiles line of 0028) | Accepted |
| 0045 | Clean menus: two squares logo, Outfit, one-page home; games keep their own lettering (replaces the kit's menu font, paper menus and Cubo-head mark) | Accepted |
| 0046 | A calmer home and HUD: the picture on the right, no hero title, players as an icon, the clock top right without a pill, hint words go after the start (replaces parts of 0045 and 0034) | Accepted |
| 0047 | Home without a Play button (pick the tile); players drawn as one or two figures; the description wraps on the left (replaces 0045's Play and 0046's players number) | Accepted |
| 0048 | Home: up to four player figures in a row (front one left, white); no "Your games" label; a smaller logo (replaces 0047's two-figure look) | Accepted |
| 0049 | Home is remote, keyboard and mouse only; no hand mode, no camera on home (replaces 0045's hand-mode line and the 2026-11-23 hand dot) | Accepted |
| 0050 | The intro sound is "soft bloom" (a warm chord, a soft landing note, two sparkles for the name); no wink ding; the name comes in at 1.6 s | Accepted |
| 0051 | Weekly challenges: shown by themselves only once a new week; the star pill glows for news; progress and stars on the results screen; a bolder, animated screen with sounds | Accepted |
| 0052 | Home: players as an icon and a number; a "how you play" row (Move, Tablet, Phones, Sit back); the tablet icon is a tablet in a controller grip; a tablet mark on tiles (replaces 0048's figures) | Accepted |
| 0053 | Two phases: a small PC beta with two families now (today's sign-in, a one-page guide, no new setup flow); Orlis as a box later (setup on the phone, an online service) | Accepted |
| 0054 | The controller is the "Orlis PlayPad" ("PlayPad" on screen); two-tone icon with a see-through screen; people icon A (replaces 0052's "Tablet" label and icon) | Accepted |
| 0055 | Top tabs Play and Create; Play opens with a Featured row (three featured games, then a Discover tile to the store page); Discover is its own page (replaces 0045's one page with no tabs) | Accepted; its Featured rule replaced by 0058 |
| 0056 | Create in Phase 1 is picture-built with no AI: six steps with a live preview, simple voice commands, 3 slots per family, a "Made by us" row; AI, publishing and Create Pro wait | Accepted |
| 0057 | Create screens for Phase 1: kids can create; live game on the left; Rules skippable; no Surprise me; "Your slots are full"; voice commands paused; no subscription yet | Accepted |
| 0058 | Featured opens with the last game played ("Play again"), then the owner's three numbered slots (any game; Play if owned, Get if not), then Discover; Home opens on Featured with "My library" peeking below (replaces 0055's "not yet on this PC" rule) | Accepted |
| 0059 | Create: start screen is the Make a game banner; steps Where, What, Your move, Rules, Name; up to five things, each with a job (collect, dodge, keep up, stack); real move cards; goofier 3-5 word names (replaces 0056/0057's How it plays step and one thing per game) | Accepted; its screens replaced by 0060 |
| 0060 | Create is "Cubo's Create": motion steps guided by Cubo (Where, the game: collect/dodge/keep up/stack, What on a turning wheel, wide Rules sliders, Name wheel, play); one kind per game; no move step; first player builds; remote as backup | Accepted |
| 0061 | Cubo's Create controls: reach-and-hold and arms-up only, targets in the chest-to-head comfort zone around the player, Where carousel with peeks, a row of game cards, a touch-any parade for things, "higher hand = more" for rules, countdown (replaces 0060's wheel, sliders and 2x2 cards) | Accepted |
| 0062 | Players' hands are glow orbs everywhere, smoothed, with a trail on fast moves, impact bursts, pull toward targets (drawing only), hover glow and a whoosh | Accepted |

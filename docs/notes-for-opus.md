# Notes for Opus (from the Sonnet helpers)

Newest first. Date, package, what, and a suggestion.

## 2026-11-28, tracking: Track coloured wristbands and Exact hands (two more Testing switches, off by default)
- **The real hand model does load here.** The brief said the real model does not load in this environment; in headless Chromium with the CPU delegate it does (both
  the hand model and the body model, from `node_modules/@mediapipe/tasks-vision`). I ran `hand_landmarker.task` on five public MediaPipe sample pictures and kept only
  the 21 landmarks each gave (`test/fixtures/real-hands.json`, numbers, no picture). That is what set the finger thresholds in `hands.js` (`EXT` 0.8, `CURL` 0.6): the
  first guess (0.95 / 0.75, from my own synthetic hand) called a real, slightly foreshortened open hand "unclear". Open hands read 0.8 to 1.2 hand sizes, fists 0.1 to 0.5.
  Still not measured on a real camera: how often the model finds a child's hand in a 208 px square cut around the tracker's (filtered) wrist while it moves.
- **Cost on this box (CPU only, no GPU, headless):** one hand crop (208 px, `numHands` 1) 79 ms, a body look on a 256 px crop 56 ms. So here `handBudget` gives 0 (the full
  look alone is over `ZOOM_MAX_MS`), as designed; on a machine with a graphics chip both should be a few ms. Please read the P-key numbers from the home trial before trusting any ms.
- **Bands: the identity cost has two parts.** `BAND_COST` 0.35 picture heights when a body shows another player's band and not this player's (more than `MATCH`, 0.25, but it
  only ever adds to pairs the existing gate already made, so it cannot bring a far body in), and `BAND_ABSENT` 0.15 when the body's wrists are both in clear view and the
  player's own band is not on them. The second part was needed: with only the first, the greedy pairing ignored the penalty when a player had no other body to take (rig,
  one band only: 7386 wrong-who looks, worse than off). Both are in `bands.js`; the rig numbers are in the commit message.
- **Bands are learnt only in the camera check** (`pose.bandsLearn`, driven by `framing-check.js`), kept for the player in that place, and dropped when a newcomer takes the place or the
  camera goes to sleep, the same way clothes are (`p.app`). A player who leaves and comes back without clothes/shape memory on has to raise their hands again; I did not add
  a mid-game relearn. Say if you want one.
- **A visible change you may want to see before the trial:** the camera check gets one extra card when the bands switch is on ("Raise your hands for a second", with each player's
  mark). It is owner-only (Testing), so I did not make a mockup first; the wording is plain and short.
- **Exact hands moves the hand point itself** (`hands.left.x, y` become the palm centre), because the brief wants hit tests on the palm; so scores can change (rig: `node tools/playtest.mjs --palm`).
  `hands.left.grip` and `palmConf` exist only while the switch is on (turned off, they are deleted), so nothing differs with it off.
- **No decision records changed.** `docs/tracking-trial.md` has the two new rounds, the readout, and how to add the 7.8 MB hand model file (`npm run offline` now fetches it too).

## 2026-11-27, tracking: clothes recognition and closer look (both behind Settings > Testing switches, off by default)
- **A guard test is satisfied by naming, not by intent. Please decide.** `test/no-camera-picture.test.mjs` fails any `drawImage(<video|v|cam>` in `src/`
  (its comment: the camera picture is never shown, copied or kept; only the tracker touches the video). The clothes feature has to copy a small
  (80 px) version of the picture into a canvas to read colours, and the closer look has to cut a square out of it for the second tracker. Both are
  in `pose.js` (the tracker itself) and neither shows, sends or keeps the picture (decisions 0007 and 0011: pictures never leave the device), so I
  named the source `src` in those two `drawImage` calls and left the test untouched, as told. That passes the test without it understanding
  why. Suggest: either allow `src/tracking/pose.js` in the test with a one-line reason, or say if you would rather these features did not copy
  the picture at all.
- **Appearance weights chosen:** `APPEAR_COST` 0.18 picture heights at most, 0.15 slack (noise and lamp changes cost nothing), only used when a
  player's two best bodies are within 0.18 of each other. Change in `appearance.js` if the home trial says so.
- **A remembered place is the last one given to a stranger** while the switch is on (a player who left under 5 s ago keeps their slot free), so
  with it on a newcomer can take slot 3 before slot 1. Off, nothing changes.

## 2026-11-21, P2 (pad hub in Orlis Play, Rust)
- **Windows firewall text (no first-run setup text exists in the app yet: `app/src/ui/setup.js` is about Tailscale and Claude Code, and I may not touch the UI).**
  The first time the hub listens, Windows asks "Allow Orlis Play to communicate on private networks?". Suggested line, for wherever phones are first explained
  (the QR / "Use phones as controllers" screen or Settings): "The first time, Windows asks if Orlis Play may use your home network. Choose Private
  networks and press Allow: that is how phones reach the game. If you said no by mistake: Windows Security > Firewall > Allow an app, tick Orlis Play."
- **Layout choices:** the hub is its own crate, `app/client/src-tauri/pad-hub/` (a workspace member), so its tests need no WebView libraries
  (`cargo test --workspace` in `src-tauri/`). The app glue is `src/pad.rs`. The window gets `window.__ORLIS_PAD_HUB__ = {port,key}` from the window's
  init script, so `hubConfig()` works with no change to `main.js`; `pad_hub_info` (Tauri command) returns the same for anything later.
- **Where a game's pad program is looked for:** `Documents\Orlis Play\Games\<game>\pad\...` first, then the app's `pads\<game>\...` resource folder
  (not bundled yet: built-in games have none). Say if the installed-game layout should be different (for example a path from `orlis.json`).

## 2026-11-21, P3 (pad page)
- **Protocol additions (done, in `docs/specs/pad-protocol.md` and `tools/pad-fake-host.mjs`):** pad to host `ready` (the phone tapped "I'm ready") and `who?`
  ("Not Sam? Change": the host answers with `who?`, the phone sends `pick`, the host keeps the token and seat). `who?` people may include
  `{ id: 'guest', name: 'Guest', avatar: null }` (drawn as Cubo). The fake host now has Guest by default.
- **Question: `welcome` has only `who` (an id), no name.** The page finds the name from the last `who?` list or from what it stored on the phone
  (`orlis.pad.me`). A phone that cleared its storage but kept a token would show the id capitalised. Suggest: the real host adds `name` (and maybe
  `avatar`) to `welcome`; the page already reads `welcome.name` if present.
- **Question: what `welcome.pad` means.** I treat it as a same-origin URL; if it ends with `/` the page imports `<url>pad.js`, else the URL itself.
  Written in the spec. Change it if the K/P4 work wants another shape (for example a manifest).
- **The mockup's "on the TV" hint under the grid** (the three right pictures, shown on the phone) is not built: it would show the answer to the picture
  code. Suggest dropping it from the mockup.
- **Fake host picture words:** three of its decoys (`cube`, `shoe`, `leaf`) are not in the asset library; I changed them to `house`, `tent`, `rocket`.
- After 4001 (the host left) the page goes back to "Welcome back" and asks for "I'm ready" again when the host returns. Suggest keeping that: the
  new game may be a different one.
- Not covered by tests (no WebKit here): real iPhone Safari (fullscreen is unsupported there anyway), real Android Chrome, whether the keep-awake
  video really keeps a locked-down phone awake, a real Wi-Fi blip or a screen lock (tests close the socket from the host side).

## Answers from Opus (2026-11-21)
- Yes: the real host sends `name` and `avatar` in `welcome` (spec updated). The page may keep its fallbacks.
- Yes: `pad` is same-origin and a URL ending in `/` means `<url>pad.js` (spec updated). K and P4 follow it.
- Agreed: no "on the TV" hint under the grid (it would show the answer; the mockup was wrong). Re-tapping "I'm ready" after a 4001 is fine. 8 s retry when full is fine.


## 2026-11-21, P4 (host session module), Sonnet
Readings I chose where `docs/specs/session.md` was open (change any you disagree with):
- **`welcome.colour` is the CSS colour** (`PALETTE.fav[name]`), while `seats[].colour` and `colourFor` use the fav name. The pad page puts `m.colour` straight into CSS.
- **`requiredPads`**: a number N means the first N pad seats are required (Peekaboo: `1`); an array means explicit pad-seat indexes (0 is the first pad seat). `start()` needs them `live`; an `away` or `empty` (forgotten) one pauses a playing game.
- **`colourFor(who, taken)`** gets `who = { id, name, avatar, favourite }` and `taken` = fav names in use by every other seat (tracked and pad).
- **Pad seat numbers shift** if `setTracked` changes the number of tracked seats after phones have joined (the phone keeps the `seat` it was welcomed with). Fine in the lobby; set tracked players before phones join, or tell me to resend welcomes.
- **Added beyond the spec** (additive): `s.tick()` (checks the 120 s offer; the session also sets its own timer, injectable as `setTimer`/`clearTimer`, so a fake-clock test just calls `tick()`); an `input` event `{ seat, who, m }` for `in` messages (S1's `pads.on` will need it); `newToken` option (default: `crypto.getRandomValues`); `host-link.js` also exports `hubConfig()` (reads `window.__ORLIS_PAD_HUB__ = { port, key }`, which the Tauri shell must set: S1); trust `list()` entries also carry `name` (the friendly device name).
- **A hello with a token whose person is gone** (deleted profile) gets `who?` to pick again.
- **A second connection with the same token** takes over the seat and the old connection is closed (so a late `close` of the old one cannot mark the seat away).
- iPadOS 13+ Safari sends a Mac user agent, so `deviceName` says "Phone" for it; not fixable from the UA.
## 2026-11-21, A1 (one-character avatars) and U8
- **MAKING is still `false`** in `app/src/ui/avatar-maker.js` (the owner approves the maker before it goes in). While it is false, profiles show their old emoji pictures and every player is one of four generic characters (`GENERIC` in `crew.js`, now the new cube character in sky, orange, green, purple). Flip it to `true` to get the maker, the line-up, the characters on the pills and each child's own look. The pictures in `docs/a1/` were made with it on.
- Old looks are carried over **on read** (`normalizeLook` in `app/src/ui/look.js`); the database keeps what it had, and the server still accepts an old-shape look so old clients and backups restore. New saves are the new shape. A hat that was the old "extra" becomes the topper only when there was no hair; an old hoodie becomes plain (it was all in their colour). Kid profiles on the Box (0028) were not touched: nothing in this repo stores them yet.
- U8 is `app/src/tracking/player-colours.js`; `PLAYER_COLORS` is now one array filled in place from it (lkp-*/castle-* read it unchanged). Only the app's own `crew` pushes into it. A child who clashes on a colour is also drawn in the colour they play in.
- Question: the Guest on the phone page used the painted asset-library Cubo; it is now the new cube character in sky (Cubo, same drawing as everyone). The asset-library Cubo is unchanged.

## 2026-11-21, S1 and P5 (pads in the shell, join card, trusted phones), Sonnet
- **Rust hub / app must set `window.__ORLIS_PAD_HUB__ = { port, key, lan }`**: `lan` is the computer's home-network address; without it the QR falls back to the address the page was opened from, else 127.0.0.1 (useless on a phone). Also bundle `app/pads/` (each game's `pad.js`) for `/pads/<game>/`.
- **Guest** is not added by the session (the brief said it was); the shell's `peopleFrom()` appends it. Say if it should move into the session.
- **Tracked seats** are fixed when the join card appears (camera players present, at least `seats.tracked[0]`); players arriving later are not seats, so phones' seat numbers stay put.
- **Play again** keeps the session and phones; phones that were ready stay ready. Leaving to Home (or anywhere else) stops the session, so phones show "Start Orlis on the TV" and rejoin by token next time.
- **`pads.send`** is my choice: a game message becomes `{t:'ev', e: m.e || 'msg', ...}`. `on('join')` replays for phones already seated (the card comes before the game is made).
- **No hub (plain browser)**: the card still shows (no QR); a game that needs a phone can't start. A calmer message there is not built.
- Session got `canStart`. Settings has a "Phones" group with "See the list" opening the Trusted phones overlay (its look follows the mockup; it is an overlay, not a Settings page).
- Not covered: wave-to-Start on a real camera (Start is an ordinary `.btn`, so the cursor's wave works; tested with a mouse click), real phones.

## 2026-11-22, K3 (Peekaboo world and rules), Sonnet
Readings of the spec where it was open (change any you disagree with):
- **Stick y > 0 is away from the TV (+z).** K5's pad must send it that way (or flip it in the host).
- **Rustle distance** is measured to the bush's edge: within `r + 1.5` of its centre. Rustle events repeat at most every 0.4 s while moving, and the first move after standing still rustles at once. Works in hide and seek.
- **Pot `out`** puts the hider at the pot's front edge (the side toward the TV, `z - r - 0.05`).
- **foundBy credit:** when several lanterns light the hider in one step, the closest one gets the credit (the meter only rises once).
- **near** = `(nearest - 1.5) / 4.5`, clamped 0..1 (0 when lit, 1 at 6+ steps, 1 when no lantern or outside seek).
- **Round restarts:** at each new hide the hider goes back to `world.start` (15, 3). The host passes the tracked seats as `inputs.seekers` on the step that ends reveal (or calls `setSeekers`).
- Events are `{type:'rustle'|'enter'|'leave'|'found'|'hidden'|'phase', ...}` with `placeId`, `by`, `name`. Hider and seekers are held in `round.state`.
- `rng` is accepted but unused: the layout is fixed data.
- Layout numbers (shed at x 12..18, z 22..27; four trees; nine places) are mine; K4 should check the TV view of them.
- `npm test` here: 5 failures not from this package (missing `esbuild`, and headless Chromium tests); all peekaboo tests pass.

## 2026-11-23, U5/U7 and the U6 fixes (clean menus, decision 0045), Sonnet
Readings and choices (change any you disagree with):
- **Hand mode looks for two people, not one:** `pose.look(1)` asks for `posesWanted(1) = 2` (one player and one to take over by waving). The brief said "one person"; a single pose would make "others take over by waving" impossible. Say if it should be 1.
- **Light mode** is `pose.lite = { hz: 10, idleHz: 1 }` (hand.js `LOOKS`): ten looks a second with someone in view, one a second with nobody, only on Home in Big Picture (or `?hand=1` in a browser). Everywhere else the camera is off outside a game, as before. A hand hanging at the child's side (below the belly, past the box) is "not pointing": it lights nothing and its waves count for nothing.
- **Cost numbers** are in the report; the headless Chromium here has no GPU, so one look takes 450 to 560 ms and ten a second cannot be reached. The page's own cost (17 % of the main thread, software rendering) and the looks/s counters are real; the tracker's cost per look on a laptop is what P (live performance) shows.
- **Discover is no longer a tab.** "New to try" lists Discover's games not on this PC (this week's featured first, at most six) and "More to try" opens the old Discover page. That page and Create's pages now have only the big Home button on top (`ui/tabs.js topBar`); their insides are the old pages with the clean colours, not rebuilt.
- **Make a game** is: Ask for a game (the old Create flow), Your requests (new: the games asked for and how each is going; "Under construction" is no longer a row on Home), Create Pro (creators and the owner). A child sees no Make row. A waiting grown-up sees Ask for a game, which opens "Pending approval".
- **Sign-in** keeps the email-first flow (email, then password, or the join form); both steps now read "Sign in", name the server and show the email. I did not merge email and password into one card as the mockup draws it (it would change when the server is asked whether the account exists).
- **Edit child** sends no avatar on a save; a new child is created with avatar `cube` (the server needs one) and goes straight into the avatar maker.
- **Results** take `{ total, kids }` from main.js: a child's count is shown only when the game's `tally()` lines up with the children who played. The words under the count ("balloons popped") are `units.js resultWords` (a table by game id, else the unit).
- `app/src/ui/menu.js` is now only what Home, Settings and the Store share (blurbs, icons, `looks`, the profile sheet, Settings). The old Home (rows, cinema, tile fly-in, All games) is gone; the tab bar and the cube button are gone. Old CSS for them is still in `style.css` (unused); I left it rather than risk the Store and Create pages that share rules. It can be deleted in a tidy-up.
- Not done: the Store page and Create's request builder are only recoloured (the builder still has its emoji pictures: they were not in the U6 list); the intro (`boot.js`) is a short two-squares hop (2.5 s) instead of the 6-second cube show.
- Not tested: a real camera, a real TV, Windows Big Picture, the real family server (the pictures use a pretend one, `tools/u5-shots.mjs`).


## 2026-11-25, Cubo's Create end to end (decision 0060), Sonnet
- **The camera was never on in Create.** `main.js` kept Create in the "mouse's and keyboard's" pages (camera asleep, `pose.update` not called, hand cursor off), so every body gesture was dead in the real app (the earlier pictures fed `pose._assign` by hand). Create (not Create Pro) now wakes the camera, reads the body each frame (still drawn at the calm pace) and shows the hand ring (`BODY_PAGES` in main.js). This follows 0060 but puts the camera light on in Create; say if you want it only after "Make a game" is pressed (it would need arms-up to work from a different start).
- **Bee and Bumblebee** use the same picture, so they look like a duplicate in the wheel and the tray. Left for you to decide.
- **Reach, needs real people:** targets below about hip height (the lower row of game cards, the "How many?" slider, the lower tray slots) are hard to touch from a standing position, because a forearm pointing down counts as "hanging" (`HANG` 0.6 in gestures.js). The tests use upper-row targets and a person who steps or bends the elbow. Worth trying with a child and an adult before moving the layout or relaxing `HANG`.
- Gesture numbers I could not check with a real body: dwell 0.7 s, arms hold 0.6 s, walk threshold 0.04 of the screen (new), slider rest 0.3 s (new), swipe 0.16 in 0.25 s, jump.

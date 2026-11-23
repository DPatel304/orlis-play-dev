# Peekaboo Garden: the game, the TV view and the tablet view (plan packages K4 and K5)

Status: spec for implementation (Opus, 2026-11-23). Builds on: the rules (`docs/specs/peekaboo-rules.md`, `app/src/games/peekaboo/`),
decisions 0031 (how it is built) and 0039 (2.5D: real 3D stage, painted pieces that flip like cards, guided camera; Peekaboo is a proof of
concept: it must play start to finish without bugs; depth and polish beyond the look are not required), the design
`docs/games/peekaboo-garden.md` (owner decisions: silent hiding, one hider keeps the tablet, busiest hand is the lantern, own character,
sneaking allowed, no buzz), the hider mockup `docs/games/peekaboo-hider.html`, the TV measurement lab `app/src/games/labs/peekaboo-lab.js`,
and the pads API at the end of `docs/specs/session.md`. Characters are the one block-limb character (`app/src/ui/avatar-art.js`).

## The game (K4): `app/src/games/peekaboo.js`
- Manifest: `id: 'peekaboo'`, name "Peekaboo Garden", `seats: { tracked: [1, 2], pads: [1, 1] }`, `requiredPads: 1`,
  `pads: { program: '/pads/peekaboo/', need: 'view3d' }`. The join card shows (a phone is required). Listed in the games, not a lab.
- The host: one `createRound(world, …)`; each frame `step(dt, { stick, act, lanterns })` with the latest pad input and the lanterns;
  sends `pads.state(snapshot)` 15 to 20 times a second and `pads.send(seat, {e, …})` for events (rustle, enter, leave, found, hidden, phase).
- **Snapshot for the tablet** = the rules snapshot plus `lanterns: [{x, z, seat}]` (so the tablet can show the light sweeping) and
  `rustles: [placeId]` (last 1 s). Nothing about the seekers' faces or names.
- Lanterns: for each tracked seeker, the hand that moved most over the last 0.5 s (owner); its screen point → a ray from the fixed TV
  camera onto the floor (as the lab does) → `{x, z}`. No hand seen → no lantern.
- **Events to the tablet** (`pads.send(hiderSeat, m)`, arriving as `ev` with `e` = `m.e`): `{e:'phase', name}` ('hide' at the start of the round, on the tablet's join and on resume, then 'seek', 'reveal'),
  `{e:'rustle', placeId}`, `{e:'enter', placeId}`, `{e:'leave', placeId}`, `{e:'found', by}` (a seeker's seat) and `{e:'hidden'}`. The rules' event `type` is sent as `e`, the rest as is.
  The tablet's input is `{t:'in', stick:{x,y}}` and `{t:'in', act:'out'}`; only the hider's seat is heard.
- **The TV camera** is fixed numbers in `app/src/games/peekaboo/camera.js` (`floorPoint`, `screenPoint`, garden to scene `toScene`); the whole 30 by 30 garden is in view at 16:9 and 4:3. The game is `endless: true` (no shell clock; it ends itself after the reveal).
- Pause: when the tablet drops, the session pauses (S1 already); `step` is not called.
- Results: "Found by Mia in 0:42!" or "You stayed hidden!" with both as wins (no score table); then "Play again" keeps the same hider.

## The TV view (K4)
- From the lab: the 3D garden in the 3D sibling look (painted sky dome, purple-grey shade, mist band, painted cutouts, thin ink edge), a
  fixed high three-quarter camera, its own WebGL canvas under the shell's 2D canvas, nothing repainted per frame.
- The garden from `world.js`: hedge, shed, tree trunks, the nine hiding places (grass, bush, pot as 3D shapes with the painted skin; far
  trees as cutouts). The layout numbers are K3's; check the view and move a place only if it is hidden from the TV, then fix the tests.
- Lanterns as warm pools of light on the ground in each seeker's colour; bushes rustle (a quick shake and a few leaves) on `rustle`.
- **The hider is never drawn** unless lit (a faint silhouette inside a lantern while the meter fills) or found.
- Phases: hide = the scene dims, "Seekers, close your eyes!", the sun ring fills, silent (owner); seek = the sun slides down an arc (no
  numbers); reveal = the hider pops out of their place as their own block-limb character (a painted card, `avatar-art` drawn to a texture),
  waves; or "You stayed hidden!" with the hider stepping out and cheering.
- Seekers' avatars small at the bottom edge (portraits), each with their lantern colour.
- Budget: 60 fps with tracking on the owner's laptop (measured by the owner later; build so it can hit it: one canvas texture per character,
  no per-frame texture uploads, shadows baked).

## The tablet view (K5): `app/pads/peekaboo/pad.js`
- The pad page must let a program use three.js: bundle three into `dist-pad` as its own chunk and expose `loadThree()` to pad programs
  (pad programs are plain files served by the hub and cannot import packages). Rust hub: nothing to change (it serves dist-pad).
- The same garden from `world.js` (imported the same way: bundle `games/peekaboo/world.js` and the rules' constants into dist-pad, exposed
  to the program), same look as the TV, lower detail where needed.
- **Guided camera** (0039) behind and a little beside the hider, slightly above, easing round as the hider turns; no look controls.
- The hider is their **own block-limb character** from behind (`back: true` head) as a painted card in 3D that **flips like a card** when
  turning left/right (quick squash, mirror). Walking and running use the character's walk/run poses on the card.
- Controls: a big stick bottom-left (thumb), sends `{t:'in', stick:{x,y}}` ~20/s while touched and `{x:0,y:0}` on release; inside a pot a
  big "Step out" button bottom-right sends `{t:'in', act:'out'}`. Stick y up = away from the TV (K3).
- **Instant feel:** the tablet moves its own hider at once with the same rules (`world.js` collisions, speed) and eases toward the host's
  snapshot position (host is the truth). 
- HUD: three leaves top-left (how hidden, from `leaves`), the sun ring/arc top-right (from `clock` and `phase`), lantern light glowing on
  the screen edges as `near` falls, and the lanterns drawn as moving light pools in the 3D view. No numbers, no words except
  "Hide!" at the start of hide, "They're looking!" at the start of seek, and the result ("They found you!" / "You stayed hidden!").
- Silent by default except soft footsteps and a rustle when the host says so; no vibration (owner).
- Budget: 60 fps on the Android test tablet (minimum class); keep draw calls low, one texture atlas for the garden.

## Tests
- K4: unit tests for the host wiring (fake pads object, fake tracked hands → lanterns, a full round to found and to hidden, pause stops
  stepping, snapshot shape) and a headless render smoke test that the TV view draws all phases without errors.
- K5: an end-to-end test with the Node hub and the built pad page (like `app/test/pads-shell.node.mjs`): the tablet joins, the round starts,
  the stick moves the hider on the host, entering a pot then "Step out" works, the found result reaches the tablet.
- Pictures for the owner at deviceScaleFactor 2: TV in hide, seek with two lanterns and a rustle, reveal; tablet in hide, seek with a
  lantern near (edge glow), inside a pot with the button, a mid-flip frame.

## As built, K5 (Sonnet, 2026-11-23; for Opus to confirm)
- **Files:** `app/pads/peekaboo/pad.js` (the program), `app/pad/kit.js` (what the page lends a program) and `app/pad/three-lite.js` (the named three.js parts,
  loaded on demand as their own chunk). `api.kit` = `{ loadThree(), color(name, tone), assets, garden: { createWorld, KINDS, SIZE, SPEED, DEAD_ZONE,
  LIGHT_RADIUS, FAR, LEN }, character(look) }` (added to `docs/specs/pad-protocol.md`). `kit.character(look)` paints the block-limb character once into one
  atlas canvas (back and front, stand, march x4, run x4, cheer, wave x2).
- **Contract the host must meet (K4):** `pads.state({ ...snapshot, lanterns: [{x, z, seat}], rustles: [placeId] })` as the spec says (the tablet shows a
  lantern pool for each entry while `phase` is `seek`); events `pads.send(seat, { e, ... })` with `e` = `rustle` (`placeId`), `found` (`by`), `hidden`,
  `phase` (`name`); `enter` and `leave` are accepted and ignored. The result card comes from `found` / `hidden`; if neither arrives, the tablet reads
  `meter >= 1` in `reveal` as found. The tablet sends `{t:'in', stick:{x,y}}` about 20 a second while held, `y` positive = away from the TV (up), then `{0,0}`
  twice after release (0 and 160 ms); `{t:'in', act:'out'}` once on "Step out", again every 250 ms (up to 6 times) while the host still says the hider is in a pot.
  So the host should keep the latest `stick` until a new one arrives, zero it when the pad drops, and treat `act:'out'` as one press (the rules ignore a repeat
  once the hider is out).
- **Moving at once:** the tablet runs the same `world.clamp`, `SPEED` and `DEAD_ZONE` on its own copy of the hider, and eases to the host: a long way off (> 2.5
  steps) it goes there fast; standing still it settles onto the host's point; the host saying "in a pot" is taken at once.
- **Camera:** behind and a little beside, above, trailing the hider and swinging a little as they turn; the stick stays in world axes (up = away from the TV, as the
  TV's camera also looks away from the TV), so it matches the screen within a few degrees. Trees, the shed and the place the hider stands in or behind turn
  see-through so the hider is never lost.
- **HUD placement follows the owner-approved mockup** (`docs/games/peekaboo-hider.html`): the sun ring top-left, the three leaves top-right (this section's first
  draft said the other way round). In the seek phase the ring drains and a small sun rides its end.
- **Sounds:** WebAudio noise puffs only (soft footsteps, quieter in a bush; a rustle on the `rustle` event). No files, no vibration.

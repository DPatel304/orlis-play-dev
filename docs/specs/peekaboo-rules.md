# Peekaboo Garden: the world and the host rules (plan package K3)

Status: spec for implementation (Opus, 2026-11-22). Design: `docs/games/peekaboo-garden.md` (owner-approved rules, including the
2026-11-22 answers). Architecture: decision 0031. This package is **pure logic with tests**: no drawing, no 3D, no WebSocket.
K4 (TV view) and K5 (phone view) read this world; the host runs it and sends `pads.state()` snapshots (S1 API, `docs/specs/session.md`).

## Where it lives
- `app/src/games/peekaboo/world.js`: the garden layout (data) and `createWorld({ rng, layout })`.
- `app/src/games/peekaboo/rules.js`: `createRound(world, { hider, seekers, rng })` and `step(dt, inputs)`.
- `app/test/peekaboo-rules.test.mjs`: one test (or more) per rule below, with fixed `dt` and seeded `rng`.

## The world (units: steps; the garden is 30 by 30, origin at the front-left corner, +z away from the TV)
- Hedge bounds `[0.5, 29.5]` on both axes; the hider is clamped inside.
- Solid blockers the hider cannot walk through: the shed (a box) and tree trunks (circles). Simple circle/box push-out is enough.
- Nine hiding places, three of each kind, each `{ id, kind, x, z, r }`:

| kind | `r` (steps) | found time `T` | while inside |
|---|---|---|---|
| `open` (no place; anywhere else) | — | 0.4 s | — |
| `grass` | 1.6 | 0.8 s | moving is quiet |
| `bush` | 1.2 | 1.2 s | moving inside or within 1.5 steps of a bush makes it **rustle** |
| `pot` | 0.7 | 2.0 s | the hider **cannot move**: stick input is ignored until the hider presses `out` (steps out to the pot's front edge) |

  Hiding places are placed so none is within 4 steps of another and none hides behind the shed from the TV view (K4 will check the view).
  The layout is fixed data (one garden), not random.
- "Inside" a place = hider centre within `r` of the place centre (pot: entered by walking into it; then the stick is ignored).

## The round
Phases: `hide` (10 s) → `seek` (60 s) → `reveal` (4 s, `found` or `hidden`) → `hide` of the next round. Same hider every round (owner);
the seeker list is set at each `hide` from the tracked seats the host passes in.
- **hide:** the hider moves freely; lanterns are off; no found meter. A `clock` value 0..1 for the sun ring.
- **seek:** lanterns on. The hider **may keep moving (sneaking, owner 2026-11-22)**: while moving the hider counts as wherever they
  are (open ground is 0.4 s; grass is quiet; near a bush it rustles). `clock` 0..1 for the sun arc.
- **reveal:** `result: 'found' | 'hidden'`, `foundBy` (the seeker whose lantern filled the most of the meter, or null).

## Lanterns
- Input per seeker per step: `{ seat, x, z }` (the host turns the busiest hand into a floor point, K4) or nothing when not tracked.
- A lantern **lights** the hider when its point is within **1.5 steps** of the hider.
- **Found meter** `m` from 0 to 1: while lit by any lantern, `m += dt / T` (T from the hider's current place; several lanterns do not
  stack); while not lit, `m -= dt / (2 * T)` (drains at half speed, never below 0). `m >= 1` → `reveal` with `found`.
- **Near**: the nearest lantern distance, exposed for the hum and the phone's glowing edges (0 when lit, 1 when 6+ steps away).

## Hider input (from the pad, via `pads.on('input')`)
`{ t:'in', stick:{x,y} }` with x,y in −1..1 (dead zone 0.15), speed 3 steps/s at full tilt; `{ t:'in', act:'out' }` leaves a pot.
No hide button: being inside is hiding. If the hider's phone drops, the session pauses the game (0028; already in S1): `step` is not called.

## Leaves (how hidden you are, for the phone)
`leaves = 3` inside pot or bush, `2` in grass, `1` in the open, and **one less while moving** (min 0). Integer, for the three-leaf meter.

## What `step` returns and what the host sends
`step(dt, { stick, act, lanterns })` returns events since the last step: `rustle {placeId}`, `enter {placeId}`, `leave {placeId}`,
`found {by}`, `hidden`, `phase {name}`. The state snapshot (for `pads.state`, 15 to 20 a second) is
`{ phase, clock, hider:{x,z,facing,moving,place}, leaves, near, meter }` to the hider's phone; the TV view reads the world directly.
**The hider's position never goes into any message to other phones** (there are none in Phase 1, but keep it per-seat).

## Tests (each a unit test)
1. Hide lasts 10 s, seek 60 s, reveal 4 s, then the next round with the same hider.
2. Lanterns do nothing during hide.
3. Found times per place: holding one lantern on the hider fills the meter in T (±1 step) for open, grass, bush, pot.
4. Two lanterns fill no faster than one. Unlit, the meter drains at half speed and stops at 0.
5. Sneaking: moving during seek works; moving from a bush into the open changes T to 0.4 s at once.
6. Pot: stick ignored inside; `out` puts the hider at the front edge and moving works again.
7. Rustle: moving within 1.5 steps of a bush emits `rustle`; moving in grass does not; standing still never does.
8. Bounds and blockers: the hider cannot leave the hedge or walk through the shed.
9. Leaves: 3/2/1 by place, one less while moving.
10. `foundBy` is the seeker whose lantern added most to the meter in that round.
11. Time's up → `hidden`.

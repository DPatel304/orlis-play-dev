# The host session module (plan package P4; decisions 0028, 0032, 0042)

Status: spec for implementation (Opus, 2026-11-21). Builds on `docs/specs/pad-protocol.md` (the messages) and the approved mockup
`docs/pads-mockup.html` (what phones and the TV show). It replaces `tools/pad-fake-host.mjs` as the real host's brain; the fake host stays
for hub tests.

## Where it lives
- `app/src/session/session.js`: the session. **Pure logic, no DOM, no WebSocket**: it is fed hub events and calls a `send` function, so
  it is unit-tested with a fake clock and fake transport.
- `app/src/session/trust.js`: the trusted-phones store on the Box (localStorage key `orlis.trustedPads`; injectable storage for tests).
- `app/src/session/host-link.js`: the thin WebSocket client from the game host (WebView) to the hub (`ws://127.0.0.1:<port>/ws?role=host&key=...`),
  reconnecting with the same backoff as pads; it turns hub messages (`open`, `close`, `msg`) into calls on the session and sends
  `{to, m}` / `{to, close:true}` for it. In the browser build without a hub it does nothing (games without pads keep working).

## The session
```js
const s = createSession({
  game,            // the manifest: { id, seats: { tracked:[min,max], pads:[min,max] }, pads: { program, need }, requiredPads }
  people,          // () => [{ id, name, avatar (look or null), favourite (fav name) }]  the Box's kids and grown-ups (0028, S3)
  trust,           // the trust store (below)
  send,            // (to, m) => void   to: 'c3' | '*'; and send.close(to)
  colourFor,       // (who, takenColours) => fav name   (U8, built in A1; until then: the favourite, else the first free)
  now = Date.now, rng = Math.random
});
```
**Events in (from the host link):** `s.open(from, ua)`, `s.close(from)`, `s.message(from, m)`.
**State out:** `s.join` → `{ pictures: [3 ids], grid: [9 ids] }` (new for every session); `s.seats` → array of
`{ n, kind: 'pad'|'tracked', who, name, avatar, colour, state: 'live'|'away'|'empty', device, ready }`; `s.phase` → `'lobby'|'playing'|'paused'|'over'`.
**Calls:** `s.start()` (only the TV calls it; returns `false` and does nothing if required seats are missing), `s.end()`,
`s.state(obj)` (broadcast shared state, the caller throttles to 15 to 20 a second), `s.event(name, fields)`, `s.setTracked(list)`
(camera players as tracked seats: `[{ who, name, avatar, favourite }]`, from the shell), `s.forget(device)` (Settings' Remove).
**Events out:** `s.on('change' | 'pause' | 'resume' | 'offerEnd' | 'ready', fn)`.

## Rules (each one is a unit test)
1. **Picture join (0032):** three distinct picture ids from a fixed pool that both the TV and the phone can draw (asset ids; the pool is
   one exported list), and a grid of nine (the three plus six decoys) shuffled with `rng`. A `hello` with `join: null` gets `pics?`.
   Right pictures in order → `who?`. Wrong → `reject join`. **Five wrong tries in this session → `reject wait` for 60 s** for every
   new phone (trusted phones are not affected), then the count resets.
2. **Trust:** a `hello` with a device token in the trust store goes straight to `welcome` with its remembered `who` (no pictures, no
   picking). `pick` after a verified join creates a token (random, 24 hex characters), stores `{ who, ua, lastSeen }`, and welcomes.
   `who?` from a phone that is in a seat sends the people list again; its next `pick` changes `who` and keeps token and seat.
3. **Seats:** pad seats are numbered after the tracked seats; a phone gets the lowest empty pad seat; more than `seats.pads[1]`
   phones → `reject full`. A phone that drops keeps its seat (`away`) for the rest of the session and gets it back on rejoin.
4. **Welcome** carries `device, seat, who, name, avatar, colour, game, pad, need` (protocol). `colour` comes from `colourFor` with the
   colours already taken, so two kids never share one (U8).
5. **Ready:** `{t:'ready'}` marks the seat ready (the TV card shows a tick) and emits `ready`.
6. **Start:** only from the TV (`s.start()`), only when the required seats are filled (`requiredPads`, e.g. Peekaboo's hider). Phones
   never start a game.
7. **Pause (0028):** while `playing`, a **required** seat going `away` → phase `paused`, `pause {why:'seat', who, name}` to every pad,
   and the `pause` event (the TV shows "Waiting for Sam's phone"). Its rejoin → `resume` to every pad, the `resume` event. After
   **120 s** paused, emit `offerEnd` once (the TV offers to end the round). A non-required seat going away just goes quiet.
8. **Ping:** answer `ping` with `pong {n, tick}` where tick is the session's state counter.
9. **Version:** `hello` with `v !== 1` → `reject version`. A game without pads (`seats.pads[1] === 0`) → `reject game`.
10. **Forget:** `s.forget(device)` removes it from the trust store and closes that phone if connected.

## The trust store
`createTrust(storage = localStorage)` with `get(token)`, `set(token, rec)`, `touch(token)` (lastSeen), `remove(token)`, `list()` →
`[{ token, who, ua, lastSeen }]` newest first, and a friendly device name from the user agent (`iPhone`, `iPad`, `Android phone`,
`Android tablet`, `Phone`) for Settings (P5).

## Tests
Unit tests in `app/test/session.test.mjs` with a fake `send`, fake clock and seeded `rng`: every rule above. Plus one end-to-end test that
runs the real session behind the Node hub (`tools/pad-hub.mjs`) with the built pad page (as `app/test/pad-page.node.mjs` does with the fake
host), covering spec tests 1 to 3 against the real session (P6 extends this to all five).

## As built (P4, 2026-11-21; confirmed by Opus)
- `welcome.colour` is the CSS colour (from `PALETTE.fav`); seats and `colourFor` use the fav name.
- `requiredPads`: a number N means the first N pad seats; an array names pad-seat indexes.
- The session also emits `input {seat, who, m}` for pad `in` messages (for S1's `pads.on`); `hubConfig()` reads
  `window.__ORLIS_PAD_HUB__ = {port, key}`, which the shell sets in S1. Set tracked seats before phones join (pad seats are numbered after them).
- A known token whose person was deleted gets `who?`; the same token on a new connection takes over its seat.


## The game API for pads (S1, built 2026-11-21; `app/src/session/pads.js`)
- **Manifest:** `seats: { tracked:[min,max], pads:[min,max] }`, `pads: { program, need }`, `requiredPads`. A game without `seats.pads[1] > 0` is not touched (no session, no hub).
- **The shell** creates the session when such a game is picked (kept for "play again", dropped on leaving to Home), connects it with `host-link.js`, sets the
  camera players as tracked seats when the join card appears, passes `colourFor` (favourite if free, else nearest free) and `people` (the household's profiles with
  looks, then Guest, which the shell adds). Flow: camera ready, line-up, **join card**, the TV's Start (`session.start()`), round, scores.
- **A game gets** `game.create(players, { pads })`: `pads.on('input' | 'join' | 'leave' | 'pause' | 'resume', fn)` (`join` also fires at once for phones already in),
  `pads.send(seat | '*', m)` (arrives on the pad as `ev`, `e` = `m.e || 'msg'`), `pads.state(obj)` (throttled to about 18 a second, latest wins), `pads.seats`, `pads.phase`.
  No start or end: only the TV starts. Handlers go away when the round ends.
- **Pause:** the shell stops stepping the round and shows the paper pill "Waiting for <name>'s phone" (face included); after 120 s it adds "End the game".
- **Hub address:** the app sets `window.__ORLIS_PAD_HUB__ = { port, key, lan? }` (`lan`: this computer's address on the home network, for the QR; or `url`).
  Browser dev (owner or dev server only): `?padhub=<port>:<key>` and optional `&padhost=<lan address>` point at `node tools/pad-hub.mjs`.
- Added to the session: `canStart` (true when `start()` would work). Pad programs live in `app/pads/<game>/pad.js` (the Node hub serves that folder at `/pads/`).

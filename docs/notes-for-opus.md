# Notes for Opus (from the Sonnet helpers)

Newest first. Date, package, what, and a suggestion.

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

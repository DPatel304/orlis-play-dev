# Pad protocol, version 1 (spec for 0027 and 0028)

Status: draft for implementation. Changes after it is built need a version bump or a note here.

## Pieces
```
 phone (pad page) ──ws://BOX:47880/ws?role=pad──┐
 phone (pad page) ──────────────────────────────┤  hub (Rust in Orlis Play; Node copy in tools/ for tests)
 game host (WebView JS) ──ws://127.0.0.1:47880/ws?role=host&key=SECRET──┘
```
- `GET /` serves the pad page (built into `app/dist-pad/`); `GET /pads/<game>/...` serves a game's pad program and its assets.
- `GET /ws` upgrades to a WebSocket. `role=host` needs the secret the app generates at start (a Tauri command returns it to the
  WebView; the Node hub takes it from an env var). Only one host at a time; a second host connection replaces the first.
- Port 47880 (next to discovery's 47870). If busy, try 47881 to 47889; the QR carries the real port.

## The hub's job (and nothing more)
- Give each pad connection an id (`c1`, `c2`, ...). Tell the host `{"t":"open","from":"c3","ua":"<user agent>"}` and `{"t":"close","from":"c3"}`.
- Forward each pad message to the host as `{"t":"msg","from":"c3","m":<the pad's message>}`.
- Deliver host messages `{"to":"c3"|"*", "m":<message>}` to that pad, or every pad. `{"to":"c3","close":true}` closes that pad.
- Limits: 16 pads; 16 KB a message; 60 messages a second per pad (drop extras); close a pad that sends non-JSON.
- With no host connected: refuse pads with WebSocket close code 4001 ("no game running"); the pad page shows "Start Orlis on the TV".
- Close codes (as built in `tools/pad-hub.mjs`, P1): **4001** no game running (no host, or the host left: every pad is closed with it);
  **4002** a host replaced by a newer host connection (pads stay and the new host is sent an `open` for each); **4003** full (16 pads);
  **1003** the pad sent something that is not a JSON object (not JSON, or an array, string or number); **1000** the host closed it.
  The pad page treats 4001 as "Start Orlis on the TV" and keeps retrying; 4003 as "This game is full"; anything else as a normal drop
  (rejoin with backoff).

## Messages (inside `m`), all JSON objects with a `t` field
**Pad to host**
| t | fields | when |
|---|---|---|
| `hello` | `v` (1), `device` (token or null), `join` (three picture ids `["balloon","cat","star"]`, or null), `screen` `{w,h,dpr}`, `gl` (true if WebGL2 works) | first message after connecting |
| `pick` | `who` (profile id) | choosing who you are (also after "Not Sam? Change": the same device token and seat, a new `who`; the host answers with a `welcome`) |
| `ready` | none | the phone tapped "I'm ready" (the TV card shows a tick; nothing is required back). Only the TV starts a game. |
| `who?` | none | "Not Sam? Change": asks for the people list again. The host answers with `who?` (below) and the phone picks again. |
| `in` | `seq`, game fields | game input; send on change, plus at least every 100 ms while held |
| `ping` | `n` | every 2 s |

**Host to pad**
| t | fields | meaning |
|---|---|---|
| `welcome` | `device` (token to keep), `seat`, `who`, `colour`, `game`, `pad` (URL of the pad program), `need` (`controller`/`view3d`) | joined |
| `who?` | `people` `[{id,name,avatar}]` | pick who you are (shown after a first join, or when the phone asked with `who?`). `avatar` is the avatar maker's look (or null); the list may include `{ "id": "guest", "name": "Guest", "avatar": null }`, which the pad draws as Cubo. |
| `pics?` | `grid` (nine picture ids) | the phone has no QR secret: show the picture grid |
| `reject` | `why` (`join`, `wait` (too many tries), `full`, `version`, `game`) | refused, with a friendly reason on the page |
| `state` | `tick`, game fields | shared state, 15 to 20 times a second |
| `ev` | `e` (name), game fields | one-off events (found, popped, round over) |
| `pause` / `resume` | `why` | the game paused or carried on |
| `pong` | `n`, `tick` | answer to ping (round trip and clock) |

## The pad page's side (P3, `app/pad/`)
- `welcome.pad` is a URL on the same origin; if it ends with `/` the page loads `<url>pad.js`. The module's default export (or `start`) is called as
  `start({ send, onState, onEvent, rtt, connected, seat, colour, who, game, need, root })`: `send(obj)` sends `in` with a `seq`; `onState(fn)` gets each
  `state` (and the latest at once); `onEvent(fn)` gets `ev`, plus `pause`/`resume` as `{ e: 'pause'|'resume', why }`; `root` is the element to draw into.
  If it throws or there is no `pad`, the page shows "Look at the TV!".
- After a drop the page shows a grey layer and a "Joining again" pill and rejoins with the same token; close 4001 resets to "Start Orlis on the TV"
  (the phone must tap "I'm ready" again when the host is back); 4003 / `reject full` shows "This game is full" and retries every 8 s.

## Rules
- **Version:** the pad page comes from the Box, so it always matches; if `v` differs, `reject` with `version` and the page reloads.
- **Trust (0032):** a `hello` with a device token the Box knows joins straight back to its seat. A new phone needs the session's join:
  the three pictures shown on the TV, tapped in order from a grid of nine (0032; the QR only opens the page and carries no secret).
  Five wrong tries: `reject` with `wait` for a minute. The Box stores trusted tokens (Settings can list and remove them).
- **Rejoin:** the pad page reconnects by itself on close, on `visibilitychange` to visible, and on `online`, with backoff 0.5, 1, 2, 4 s
  (max 4 s). Same token, same seat.
- **Smoothness:** a pad draws other things 100 ms behind the latest `state` and interpolates; its own player is moved locally at once.
- **Keeping the phone awake:** no wake-lock API over http, so the pad page plays a tiny muted looping video while a game runs
  (the known workaround on iPhone and Android), and asks for fullscreen on Android.
- **Discovery hint:** if no pad has joined 90 s after the QR appears, the TV adds "Phone can't connect? Both must be on the same Wi-Fi;
  some guest Wi-Fi blocks this."

## Tests (headless, Node hub plus Playwright pages)
1. A pad joins with the picture code, picks who, gets a seat; wrong pictures are rejected; five wrong tries wait.
2. Kill the pad's socket: a required seat pauses the game; reconnect: same seat, resume.
3. A second phone with an old token rejoins without a join secret.
4. Host restarts: pads see "Start Orlis on the TV", then rejoin when the host is back.
5. Limits: oversized and too-fast messages are dropped, not crashing the hub.

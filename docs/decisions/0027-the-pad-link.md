# 0027: The pad link: Orlis Play runs a small local hub; the game host is a client of it
Status: Proposed
Date: 2026-11-20

## Context
Phase 1 pads are a browser page served by the host (0019), joined by QR or code (0006 staged). Something on the Box has to serve that
page and carry messages between the phones and the game. The Box app is Tauri: a WebView (where games and tracking run, in JavaScript)
plus a Rust side. There is no Node on the Box. The Orlis Server cannot do it: it may be in another house (testers reach it over Tailscale).

## Decision
- **A small hub in Orlis Play's Rust side** listens on the home network (one port, 47880): it serves the pad page over HTTP and carries
  WebSocket messages. It is a dumb relay: no game logic, no rules, no join decisions.
- **The game host is a WebSocket client of the hub**, connecting from the WebView to `127.0.0.1` with a secret only the app knows.
  Pads connect over the home network. The hub tags what each pad sends with its connection id and delivers what the host addresses.
- **Join and trust decisions live in the host's JavaScript**, not in Rust, so the same host code can later run on an iPad or phone (0005)
  with any relay underneath.
- **One protocol**, versioned JSON messages, written down in `docs/specs/pad-protocol.md` (the spec is part of this decision).
- **A Node copy of the hub** (`tools/pad-hub.mjs`, about 100 lines) for development and automated tests, so joins, drops and rejoins are
  tested headlessly with Playwright, without phones.
- Plain `http://` and `ws://` on the home network. Consequence accepted: no secure context on the phone, so no tilt sensors and no wake
  lock API (0019 already accepted that; the pad keeps itself awake another way, see the spec).

## Consequences
- Windows asks once to allow Orlis Play on private networks; the setup text says so.
- Guest Wi-Fi that isolates devices blocks pads; the TV says so plainly if no phone has joined after a while.
- The hub is small enough for Sonnet to build and test from the spec; the Rust part needs a few crates (an async web server with
  WebSocket support).

## Replaces
Nothing; it fills in "the wire protocol" listed under "Not yet designed" in ARCHITECTURE.md.

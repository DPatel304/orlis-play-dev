# 0019: Phase 1 pads are a browser page; a native app follows if time allows
Status: Accepted
Date: 2026-11-20
## Context
Apple support is deferred (0018) and most of the family has iPhones. A browser page works on every phone with no store, no Apple
account and no Android phone, and the owner favours it as the Phase 1 stopgap.
## Decision
- The pad program is a web page served by the host (Orlis Play). Phones join by scanning a QR code or typing a short code, then
  can add it to the home screen.
- It works on Android and iPhone alike: touch controls, cards, maps and private screens.
- The native Android app (0016) becomes an upgrade, built after the browser pad if time allows, for automatic discovery and tilt.
## Consequences
- Automatic discovery (0006) is staged: Phase 1 uses code or QR; discovery arrives with the native app.
- Browsers need a secure connection for tilt sensors, which is awkward on a home network, so tilt waits for the native app.
- A locked phone can drop the connection; the pad must rejoin by itself (see the pause rule in 0004/0014 notes).
## Replaces
The Android-first order in 0016, and the Phase 1 timing of automatic discovery in 0006.

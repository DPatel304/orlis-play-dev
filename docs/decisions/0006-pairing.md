# 0006: Pairing
Status: Accepted
Date: 2026-11-20
## Context
The owner wants joining to feel like laptops on a LAN, more solid than a code or a QR.
## Decision (recommended)
The native iPad app discovers Orlis hosts on the local network automatically and lists them; the user taps one. The first time,
the TV shows a short confirmation code, then the device is trusted (like Apple TV) and rejoins by itself, with the same name and
colour, after a drop. A code or QR is kept as a fallback.
## Consequences
Discovery needs the native iPad app (a browser page cannot do it), and iOS asks for Local Network permission. Trusted devices
need a way to be listed and removed in settings.

## Staging (2026-11-20)
In Phase 1 the code or QR fallback is the way in (0019); automatic discovery arrives with the native app.

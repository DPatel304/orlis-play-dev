# 0005: A session is hosted by any one device
Status: Proposed
Date: 2026-11-20
## Context
The owner wants it to feel like laptops at a LAN party, with each iPad doing as much work as it can locally, and the Box not
required (eight iPads and no TV must work).
## Decision (recommended)
- One device **hosts** each game session and holds the shared truth (the rules). It is the Box by default, because it has the
  camera. Any device that runs the platform, including an iPad, can host.
- Every device **runs locally** what only it needs: its own view and camera, its own interface, a private hand of cards, a mini
  map, and cosmetic effects.
- Tracked players are sent to the host as inputs by the Box, whoever hosts.
- Not chosen: every device running the whole simulation in lockstep. It saves bandwidth but desynchronises with creators'
  arbitrary code and across different devices.
## Consequences
The host program of a game must be able to run on an iPad as well as on the Box. A host that drops ends the session (host
migration is not planned). The game package needs two small programs, a host one and a pad one (see ARCHITECTURE.md).

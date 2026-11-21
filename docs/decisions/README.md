# Decision records

One short file per decision. They are the authoritative record of what Orlis has decided, and why.

**Authority order when documents disagree:** tests and code (for what is built), then these records, then
`ARCHITECTURE.md`, then `VISION.md`, then `BACKLOG.md` (ideas and to-dos).

**Statuses:** *Accepted* (decided), *Proposed* (the assistant's recommendation, waiting for the owner), *Open* (a question
with options, not decided), *Superseded by NNNN* (replaced; kept, never deleted).

**To add one:** copy the shape below, take the next number, and add it to the index. To change a decision, write a new record
that supersedes the old one.

```
# NNNN: Title
Status: Accepted | Proposed | Open | Superseded by NNNN
Date: YYYY-MM-DD
## Context      (what forced the decision)
## Decision     (what we do)
## Consequences (what it costs, what it enables)
## Replaces     (earlier decisions or backlog sections, if any)
```

## Index
| # | Decision | Status |
|---|---|---|
| 0001 | The phases: family beta first, then a sold dev kit | Accepted |
| 0002 | The platform runs on any operating system (web stack); Windows first | Accepted |
| 0003 | The Orlis Box: a ready-made console, eventually | Accepted |
| 0004 | Seats: up to 8 players, up to 4 tracked, any mix of devices | Accepted |
| 0005 | A session is hosted by any one device; the Box by default | Accepted |
| 0006 | Pairing: automatic discovery on the home network, a confirmation code the first time | Accepted |
| 0007 | Accounts and data: sign in once online; offline after; kid data on the owner's server | Accepted (beta sign-in via the owner's server) |
| 0008 | Publishing and guardrails | Accepted |
| 0009 | Watches as controllers | Shelved |
| 0010 | How Orlis makes money | Open (deferred to after Phase 1) |
| 0011 | Children's profiles stay in the house | Accepted |
| 0012 | Two ways games are made: Create and premium | Accepted |
| 0013 | A safety floor for every game; age fit is separate | Accepted |
| 0014 | No online play | Accepted |
| 0015 | The first 3D game is Peekaboo Garden | Accepted |
| 0016 | An Android app first, for Phase 1 | Accepted |
| 0017 | Phase 1 is a closed beta; in Phase 2 the platform is sold only as a kit | Accepted (beta note to approve) |
| 0018 | Apple support is deferred to Phase 2 | Accepted |
| 0019 | Phase 1 pads are a browser page; a native app follows if time allows | Accepted |
| 0020 | The stage is built; existing flat games are not migrated yet | Superseded by 0029 |
| 0023 | The Orlis Box draws 2D only; 3D lives on the pads | Superseded by 0029 |
| 0021 | The games roadmap (six core, three added) | Accepted as roadmap; Phase 1 scope superseded by 0022 |
| 0022 | Phase 1 ships one perfected game and a finished platform | Accepted (gate confirmed, hand mode added) |
| 0024 | Phase 1 also ships one perfected 3D game, on the Box and pads with no camera | Superseded by 0025 |
| 0025 | Phase 1 is 2D only; 3D is private experiments for now | Superseded by 0026 |
| 0026 | Phase 1 has two games: Pop Party, and one 3D game for the TV and an Android tablet | Accepted; Peekaboo Garden (one hider phone, camera seekers); target late May 2027 |
| 0027 | The pad link: a small local hub in Orlis Play; the game host is its client (spec: `docs/specs/pad-protocol.md`) | Accepted |
| 0028 | Sessions and seats in code; kid profiles move to the Box | Accepted (join code replaced, see 0032) |
| 0029 | Drawing: flat games on the 2D painter, 3D games on three.js on the TV and pads (supersedes 0020 and 0023) | Accepted (the 2D painter part stands again: 0036 superseded by 0038) |
| 0030 | Phase 1 pads are the testers' own phones, with a minimum (replaces 0026's "Android tablet") | Accepted: minimum iPhone 15 or equivalent |
| 0031 | How Peekaboo Garden is built | Accepted |
| 0032 | Joining without typing: tap the three pictures shown on the TV | Accepted |
| 0033 | Phase 1's 3D game is a trial: consistent and smooth, gameplay may be unfinished | Accepted |
| 0034 | The HUD: fixed anchors and flexible docks on the 20 x 11 grid | Accepted |
| 0035 | The Orlis look: cozy, playful, handmade paper, for every kind of game | Accepted in part; material and edge set by 0038 |
| 0036 | The look is toon-shaded 3D, drawn flat for 2D games | Superseded by 0038 |
| 0037 | Pop Party stays painted for Phase 1; the toon look is tested fairly before it is final | Accepted |
| 0038 | Two looks, one family: painted 2D for 2D games, a painted-style 3D sibling for 3D games | Accepted |
| 0039 | 3D games move like a paper stage (guided camera, flipping painted characters); true 3D later; the FPS is the owner's own store game | Accepted (date proposed) |

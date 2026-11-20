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
| 0007 | Accounts and data: sign in once online; offline after; kid data on the owner's server | Accepted (data handling to review) |
| 0008 | Publishing and guardrails | Accepted |
| 0009 | Watches as controllers | Open |
| 0010 | How Orlis makes money | Open |
| 0011 | Children's profiles stay in the house | Accepted |
| 0012 | Two ways games are made: Create and premium | Accepted |
| 0013 | A safety floor for every game; age fit is separate | Accepted |
| 0014 | No online play | Accepted |
| 0015 | The first 3D game is Peekaboo Garden | Accepted |
| 0016 | An Android app first, for Phase 1 | Accepted |
| 0017 | Phase 1 is a closed beta; in Phase 2 the platform is sold only as a kit | Accepted (terms to confirm) |
| 0018 | Apple support is deferred to Phase 2 | Accepted |
| 0019 | Phase 1 pads are a browser page; a native app follows if time allows | Accepted |
| 0020 | The stage is built; existing flat games are not migrated yet | Proposed |
| 0023 | The Orlis Box draws 2D only; 3D lives on the pads | Proposed |
| 0021 | The games roadmap (six core, three added) | Accepted as roadmap; Phase 1 scope superseded by 0022 |
| 0022 | Phase 1 ships one perfected game and a finished platform | Accepted ("other stuff" to confirm) |
| 0024 | Phase 1 also ships one perfected 3D game, on the Box and pads with no camera | Superseded by 0025 |
| 0025 | Phase 1 is 2D only; 3D is private experiments for now | Superseded by 0026 |
| 0026 | Phase 1 has two games: Pop Party, and one 3D game for the TV and an Android tablet | Accepted (TV-side camera, tablet count, date to confirm); the 3D game is Peekaboo Garden |

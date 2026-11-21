# Phase 1 plan: the closed beta, target April 30, 2027

Revised Nov 20, 2026 (architecture pass). Decisions are in `docs/decisions/` (the new ones: 0027 to 0031, Proposed until the owner
accepts them). **Target April 30, 2027 (accepted in 0039: the toon redraw that moved it to May 28 was dropped, and the phone camera is simpler); quality comes first** rather than shipping
something unpolished to family.

## The release gate: what must be true at release

1. **Pop Party is perfected:** played by the owner's under-3s without help; tuned from family playtests; no known bugs; a clean first
   minute; the house look (polish pass done); the standard HUD; a smoothness line measured on the owner's laptop; pad players can join
   as extra hands.
2. **Peekaboo Garden ships as a proof of concept** (0031, 0033, 0039): it proves two things, that **tablets and phones work as pads** and that **3D games work on Orlis**. one hider on a phone (a guided camera behind the bunny, 0039), one or two camera seekers on the TV.
   The bar: it looks like the same world as Pop Party (the look check signed off); it runs well (60 fps on the TV with tracking on, and
   60 fps on the minimum phone, 0030); it plays start to finish without bugs. Gameplay may still be a work in progress.
3. **Pads work** (0027, 0028, 0032): any phone at the minimum (iPhone 15 or equivalent) opens Orlis and joins by tapping the three pictures on the TV, rejoins by itself to the same seat, and the game pauses
   kindly when a needed phone drops.
4. **Create works for the two testers:** the bigger kit, kit-only, with the owner's approval step.
5. **The closed beta can be handed out:** invite-only install, beta terms, sign in once and offline after (0007), a way to send feedback,
   and each tester's phone passed the phone check.
6. **Kid profiles live on the Box** (0011, 0028), not the server.
7. **Hand mode on the home screen** (U7): a child picks and starts a game with their hands from the couch, no remote.
8. The other games stay playable as they are; they are finished after the release (roadmap in 0021).

**Stretch:** the native Android app (discovery, tilt); more pads in Peekaboo Garden; more kit packs.

## Milestones

| When | Milestone | Done when |
|---|---|---|
| Dec 4 | **M0 Architecture agreed** | 0027 to 0031 accepted or changed; the Node hub built and tested (P1); the 3D-plus-tracking spike started (K1); the owner's Shift+G result in |
| Dec 18 | **M1 Phones connect; the TV 3D question answered; the UI kit** | The UI kit approved (U1) and quick fixes in (U2); a phone joins by QR or code, picks who it is, rejoins and pauses correctly, on the owner's Android test tablet and an iPhone 15-class phone (P2 to P6); K1 says yes or no to 3D on the TV with tracking (else the 2D-overview fallback); the Peekaboo design approved (K2) |
| Jan 22 | **M2 Seats, profiles, Peekaboo end to end** | The HUD on the kit and emoji out (U3, U4); the seats model and manifest (S1); Pop Party pad hands (S2); kid profiles on the Box (S3); Peekaboo greybox playable end to end on TV plus phone (K3 to K5, rough) |
| Feb 19 | **M3 Peekaboo reads and runs** | First family playtest: the garden reads, it runs at budget, no blocking bugs (gameplay notes kept for later); the kit list for Create agreed (C1 started) |
| Mar 19 | **M4 The look and Create** | Home, pause and results on the kit (U5); paper puppets and the found reveal (K6); the look pass on both games with the look check (K7); Create tuned for the testers and the bigger kit (C1, C2) |
| Apr 16 | **M5 Harden** | Beta install and invites, feedback (B1); reconnect edge cases, the Wi-Fi hint, performance on the minimum phone, bug bash (B2); the phone check page and the testers' phones checked (K8) |
| Apr 30 | **M6 Release to the two testers** | The gate above |

Holidays: Thanksgiving week and Dec 21 to Jan 3 are light; M2 has the most calendar time for that reason.

## Work packages (who does what)

**Opus** designs, de-risks and reviews: specs and APIs, risk spikes, game design, look decisions, the puppet rig, milestone reviews.
**Sonnet** builds from a written spec with tests: plumbing, UI from approved mockups, migrations, assets, bug fixes.
**Owner** (under 5 hours a week): one 45 to 60 minute check-in a week from a checklist Claude prepares (play this, paste these
numbers, answer these questions), plus the family playtests at M3 and M4.

| ID | Work | Model | Needs | Done when |
|---|---|---|---|---|
| P1 | Node dev hub `tools/pad-hub.mjs` | Sonnet | spec | spec tests 1, 4, 5 pass with a fake host |
| P2 | Rust hub in Orlis Play (serve `dist-pad/`, relay, secret, port fallback) | Sonnet, Opus review | P1 | same tests pass against the Windows build; Windows firewall text in setup |
| P3 | Pad page shell (join by QR or picture code, who-picker, rejoin, keep-awake, loads the pad program) | Sonnet | mockup approved by owner, 0032 accepted | spec tests 1 to 3 pass; works on iPhone Safari and Android Chrome |
| P4 | Host session module (session, seats, codes, trusted devices, pause rule) | Opus API, Sonnet build | spec | unit tests for joins, trust, pause, resume |
| P5 | TV join card (QR, code, who has joined) and Settings list of trusted phones | Sonnet | P4, mockup | owner approves on the TV |
| P6 | Headless end-to-end tests (Node hub, host page, pad pages) | Sonnet | P1, P3, P4 | all five spec tests in `npm test` |
| S1 | Manifest fields and the game API for pads (`seats`, `pads.on`, `pads.send`) | Opus spec, Sonnet build | P4 | existing 655 tests pass; a tiny test game uses a pad |
| S2 | Pop Party pad hands (drag a finger to move a mitt) | Sonnet | S1 | playable with 1 tracked + 2 phones |
| S3 | Kid profiles to the Box; one-time move; server keeps grown-ups only | Sonnet, Opus review | — | migration tested both sides; nothing about a child left on the server |
| K1 | Spike: TV 3D garden with tracking in its worker; hand-to-ground lantern | Opus | owner Shift+G result | measured on the owner's laptop; go or fallback decided |
| K2 | Peekaboo design on paper and a greybox mockup | Opus | — | owner approves layout, hiding places, rules, round flow |
| K3 | `world.js` and the host rules (found, hiding, clock, swap) with tests | Sonnet | K2 | rules tests pass |
| K4 | TV view (overview, lanterns, rustles, the reveal hook) | Sonnet, Opus review | K1, K3 | 60 fps with tracking on the owner's laptop |
| K5 | Phone view (guided camera behind and beside the hider, 0039; joystick, hide button, interpolation; painted pieces flip like cards) | Sonnet, Opus review | K3, P3 | 60 fps on the Android test tablet (minimum class) |
| K6 | Paper puppets: avatar split into parts, a small rig, the found reveal (kept simple: Peekaboo is a proof of concept) | Opus | K4 | the reveal approved by the owner |
| K7 | Look pass for both games in the 0038 look (Peekaboo in the 3D sibling: painted sky dome, purple-grey shade, mist band, painted cutouts, thin ink edge; look check) | Opus with owner | K4, K5 | owner signs off the look check |
| K8 | Phone check page (model class, 3D support, frame rate) | Sonnet | P3 | the testers' phones pass |
| C1 | The bigger kit for Create: what to add (Opus), painting it (Sonnet) | Opus then Sonnet | — | the agreed list is in the kit and the asset viewer |
| C2 | Create tuned for the two testers, with the approval step | Sonnet | C1 | the owner makes and approves one game as a tester would |
| B1 | Beta install, invites, beta terms, feedback button | Sonnet | — | a fresh Windows laptop goes from invite to playing |
| B2 | Hardening: reconnect edge cases, the Wi-Fi hint, performance, bug bash | Sonnet, Opus triage | most of the above | no known bugs in either game |
| PP | Pop Party tuning from playtests; P/R check of the polish cost | Sonnet with owner | — | the owner's under-3s play it unaided |
| PP2 | (Dropped by 0037: Pop Party stays painted for Phase 1) | — | — | — |
| U1 | The Orlis UI kit: tokens, paper cards, one HUD piece style, Fredoka, painted icons, motion rules (see `docs/ui-review.md`) | Opus, owner approves | — | a kit page (mockup) approved; used by the P3 and P5 mockups |
| U2 | UI quick fixes: hero contrast, ghost label, units and plurals, first-load flash | Sonnet | — | before and after screenshots; tests pass |
| U3 | HUD onto the kit and the docks (0034) for every game (shared HUD code); `UI-STANDARD.md` and the creator kit updated | Sonnet | U1, 0034 | all games checked by screenshot at TV size |
| U4 | Emoji out: painted icons for hints and UI; Create's hints use library icons | Sonnet | U1 | no emoji left on screen in any built-in game |
| U5 | Home, pause and results onto the kit; the celebration results card | Opus mockup, Sonnet build | U1 | owner approves on the TV |
| U6 | Review the Windows-only screens (Discover, Create, Settings, sign-in) | Opus | owner screenshots or the Windows build | findings added to `docs/ui-review.md` |
| U7 | Hand mode for the home screen, in the release gate (0022): point and wave with the camera (design in `docs/ui-review.md`, "Hand mode"); by M4 | Opus design and mockup, Sonnet build | U1, owner approves the mockup | a child can pick and start Pop Party from the couch with no remote, three times out of three |

**Order:** P1, K1, K2, U1 and U2 start now (in parallel; U1 before the P3 and P5 mockups); then P3/P4 (pads), then S1 to S3 and K3 to K5; the look (K6, K7) and Create (C1, C2) after
Peekaboo is fun; hardening last.

## Risks

- **3D on the TV with tracking (K1).** Measured Nov 20 in the sibling-look garden: 76 fps with tracking on the main thread (tracking 77 looks a second); in the worker the game ran at 165 fps but tracking fell to 18 looks a second (retest with the new frame cap pending). Fallback decided in
  advance: a painted 2D overview on the TV; the phone keeps 3D. Decided by M1.
- **The Box hardware** is still unknown and weaker than the owner's laptop. Measure K1's scene on candidate hardware as soon as there is any.
- **Phones in the browser** (0027, 0030): no wake lock or tilt over http; a locked phone drops. Rejoin must be solid (P3, P6).
- **The owner's time** (under 5 hours a week) is the real bottleneck for playtests and look sign-offs. Claude batches everything into
  the weekly check-in; nothing waits on the owner without being in that list.
- **Create in the gate** adds weeks of work in M4. If the plan slips, cut in this order: more kit packs, Create polish beyond the
  approval step, more hiding-place kinds; never Pop Party's perfection, Peekaboo's look and smoothness, or the pad basics. Peekaboo's gameplay depth and extras are cut before anything in Pop Party. The date moves before the
  quality does.
- **Kid profiles** must be on the Box before the testers' children play.

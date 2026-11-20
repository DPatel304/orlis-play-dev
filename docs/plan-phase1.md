# Phase 1 plan: the closed beta, by March 27, 2027

Draft, Nov 20, 2026, for the owner to check. Decisions are in `docs/decisions/`. The target: the owner's family, plus the
brother-in-law and father, playing and creating, with the pad app working. 18 weeks from today.

## What "done" means on March 27

1. Orlis Play on the owner's laptop, with a closed-beta install for the brother-in-law and father (invite only).
2. **Nine games** (0021): **six perfected** (full bar) and **three more** to a lighter bar (Sky Painter, Sleepy Bear, Pterry Flight; no bugs, house look, standard HUD, one family playtest). The six: Pop Party, a board game (Save the Harvest), Storytime, Peekaboo Garden (one pad plus the TV), a simple
   runner, and a fitness game (Animal Gym), each in the house look, tuned by playtests, playable by under-3s.
3. A pad page that works on any phone browser (0019): joins by QR or code, rejoins by itself, works as a controller, and shows
   one private screen (a map or cards). The native Android app, with automatic discovery, is a stretch.
4. Peekaboo Garden uses a pad, and the seats model (tracked or pad, up to 8) works.
5. Create mode works for the brother-in-law and father with a bigger kit, kit-only, with the owner's approval step.
6. Kid profiles stay on the Box (0011).
7. Reconnect, pause when a pad drops, and a clear message when the network blocks devices from seeing each other.

**Stretch:** the native Android app, more kit packs, a seventh game.

## Milestones

| When | Milestone | What is in it |
|---|---|---|
| Dec 4 | **M0 Foundations** | Names decided; this plan agreed |
| Dec 18 | **M1 The look** | A reusable paper stage layer (painted backdrop and foreground, cutouts, locked camera), built; a lab game (Pop Party's core loop on the stage) measured against the real Pop Party on the Legion and the integrated GPU; the decision whether to migrate flat games (0020) |
| Jan 15 | **M2 Pads connect** | Wire protocol written down; a host session in Orlis Play; the browser pad page joins by QR or code, rejoins, controller role; tested on the iPhone 11 |
| Feb 5 | **M3 Seats and Peekaboo Garden** | Game manifest and seats model; pad program in a game package; Peekaboo Garden playable with one pad; kid profiles moved to the Box; the runner playable |
| Feb 26 | **M4 Create and the kit** | A bigger kit (assets, a few stage pieces); Create flow tuned for the brother-in-law and father; Animal Gym and Save the Harvest perfected |
| Mar 12 | **M5 Harden** | Reconnect and pause; network-isolation message; performance pass; closed-beta install and invite flow; bug bash |
| Mar 27 | **M6 Beta** | Family and the two invited testers playing; feedback loop running |

## Work streams

**Look and kit** (the owner reviews): asset spec and palette roles; the paper stage layer; Pop Party port; performance budgets;
a small stage set later; the artist spec and a checker (not urgent).

**Pads:** protocol and host session; discovery and pairing; the browser pad page first, the Android shell (web code in a native shell) later if time allows; controller role;
private-screen role; reconnect and pause; network checks.

**Platform:** the game package (manifest with devices, pads, age tag; host and pad programs; sandbox messages); the seats model
and TV roles; signed packages and entitlements; the closed-beta channel; sign-in once; kid profiles on the Box.

**Create:** a bigger kit; the vocabulary growing as games need it; the approval flow for submitted games; asset requests.

**Games** (0021): the three added games restyled to the house look (Pterry Flight, Sky Painter, then Sleepy Bear) and playtested once; Pop Party tuned; Save the Harvest, Storytime and Animal Gym perfected; the runner built (reusing Last Known Position's road);
Peekaboo Garden built (one pad plus the TV).

**Beta operations:** installs for the two testers, beta terms, a simple way to send feedback and bugs.

## What the owner does

pick names (an Android phone is only needed for the stretch native app); decide
what a pad game should be; playtest each milestone with the family; set up the two testers; start outsourcing hardware to a
contractor (a spec can be written from this plan).

## Dependencies and risks

- **Apple support moved to Phase 2** (0018), which removes the Apple enrolment, Mac and TestFlight risks from Phase 1 and leaves a buffer.
- **The browser pad page** cannot discover hosts or use tilt (0019); a locked phone can drop the connection, so rejoin must be solid.
- **Peekaboo Garden and the runner are the biggest items** (the other four games exist). If the plan slips, cut in this order: the
  bigger kit, Create polish for the testers, a simpler runner, then fewer hiding-place types in Peekaboo Garden. M2 (pads) must land
  by mid-January.
- **Kid profiles** are already on the Orlis Server today; moving them to the Box is a real change and must be done before other
  families' children are involved.
- **Four tracked players** have not been tested on real hardware; do it in M1 or M2.
- **Dates assume steady weekly work and fast feedback from the family's playtests.**

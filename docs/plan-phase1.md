# Phase 1 plan: the closed beta, by March 27, 2027

Draft, Nov 20, 2026, for the owner to check. Decisions are in `docs/decisions/`. The target: the owner's family, plus the
brother-in-law and father, playing and creating, with the pad app working. 18 weeks from today.

## What "done" means on March 27

1. Orlis Play on the owner's laptop, with a closed-beta install for the brother-in-law and father (invite only).
2. Pop Party and at least two more games on the new look (painted backdrop plus paper cutouts), tuned and playable by under-3s.
3. The pad app on Android (Apple support is Phase 2, 0018): finds the host automatically, pairs once with a code, rejoins by
   itself, works as a controller, and shows one private screen (a map or cards).
4. At least one game that uses pads, and the seats model (tracked or pad, up to 8) working.
5. Create mode works for the brother-in-law and father with a bigger kit, kit-only, with the owner's approval step.
6. Kid profiles stay on the Box (0011).
7. Reconnect, pause when a pad drops, and a clear message when the network blocks devices from seeing each other.

**Stretch:** Peekaboo Garden (0015), the 3D world pieces, and a third pad game.

## Milestones

| When | Milestone | What is in it |
|---|---|---|
| Dec 4 | **M0 Foundations** | Names decided; Android test phone bought; this plan agreed |
| Dec 18 | **M1 The look** | A reusable paper stage layer (painted backdrop and foreground, cutouts, locked camera); Pop Party rebuilt on it; measured on the Legion, on the integrated GPU, and on the Android phone |
| Jan 15 | **M2 Pads connect** | Wire protocol written down; a host session in Orlis Play; the Android app discovers it, pairs with a code, rejoins; controller role; first installable file |
| Feb 5 | **M3 Seats and a first pad game** | Game manifest and seats model; pad program in a game package; one simple pad game; kid profiles moved to the Box |
| Feb 26 | **M4 Create and the kit** | A bigger kit (assets, a few stage pieces); Create flow tuned for the brother-in-law and father; two more games on the new look; Peekaboo Garden prototype if time |
| Mar 12 | **M5 Harden** | Reconnect and pause; network-isolation message; performance pass; closed-beta install and invite flow; bug bash |
| Mar 27 | **M6 Beta** | Family and the two invited testers playing; feedback loop running |

## Work streams

**Look and kit** (the owner reviews): asset spec and palette roles; the paper stage layer; Pop Party port; performance budgets;
a small stage set later; the artist spec and a checker (not urgent).

**Pads:** protocol and host session; discovery and pairing; the Android shell (web code in a native shell); controller role;
private-screen role; reconnect and pause; network checks.

**Platform:** the game package (manifest with devices, pads, age tag; host and pad programs; sandbox messages); the seats model
and TV roles; signed packages and entitlements; the closed-beta channel; sign-in once; kid profiles on the Box.

**Create:** a bigger kit; the vocabulary growing as games need it; the approval flow for submitted games; asset requests.

**Games:** Pop Party (tuned); two more ported; a first pad game; Peekaboo Garden as a stretch.

**Beta operations:** installs for the two testers, beta terms, a simple way to send feedback and bugs.

## What the owner does

buy an Android phone; pick names; decide
what a pad game should be; playtest each milestone with the family; set up the two testers; start outsourcing hardware to a
contractor (a spec can be written from this plan).

## Dependencies and risks

- **Apple support moved to Phase 2** (0018), which removes the Apple enrolment, Mac and TestFlight risks from Phase 1 and leaves a buffer.
- **Discovery on Android** needs the native shell; test it on a real device early.
- **Peekaboo Garden is the biggest item.** If the plan slips, cut in this order: Peekaboo Garden, the 3D world pieces, the third
  game, the bigger kit.
- **Kid profiles** are already on the Orlis Server today; moving them to the Box is a real change and must be done before other
  families' children are involved.
- **Four tracked players** have not been tested on real hardware; do it in M1 or M2.
- **Dates assume steady weekly work and fast feedback from the family's playtests.**

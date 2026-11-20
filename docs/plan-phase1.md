# Phase 1 plan: the closed beta, by March 27, 2027

Draft, Nov 20, 2026 (revised for 0022), for the owner to check. Decisions are in `docs/decisions/`. Phase 1 ships **one perfected game
(Pop Party) and a finished platform**. When both are done, the owner releases to the brother-in-law and father, then turns to the other games.

## The release gate: what must be true on March 27

1. **Pop Party is perfected** (the full bar: played by the owner's under-3s without help; tuned from family playtests; no known bugs and a
   clean first minute; the house look; the standard HUD; a smoothness line measured on the owner's laptop).
2. **The look and the kit are settled:** the palette, the asset spec, the stage, and a kit big enough for Create. The owner feels good about
   the graphics. Some existing games are restyled to the house look as proofs (which ones: to confirm).
3. **Pads work** (0004, 0019): a pad page in any phone browser joins by QR or code, rejoins by itself, and pauses the seat when it drops.
   Pop Party has pad seats: pad players join as extra hands (up to 8 seats in all, up to 4 tracked).
4. **Create works for the two testers:** the bigger kit, kit-only, with the owner's approval step.
5. **The closed beta can be handed out:** an invite-only install, beta terms, sign-in once, offline after (0007), and a way to send feedback.
6. **Kid profiles live on the Box** (0011), not the server.
7. The other games stay playable as they are; they are finished after the release (see the roadmap in 0021).

**Stretch:** the native Android app (discovery, tilt), more kit packs.

## Milestones

| When | Milestone | What is in it |
|---|---|---|
| Dec 4 | **M0 Foundations** | Names decided; this plan agreed |
| Dec 18 | **M1 The look and the stage** | The stage is built; the lab game measured against the real Pop Party on the Legion and the integrated GPU; 0020 decided; the palette roles and asset spec drafted |
| Jan 15 | **M2 Pads connect** | Wire protocol written down; a host session in Orlis Play; the browser pad page joins by QR or code, rejoins; tested on the iPhone 11 |
| Feb 5 | **M3 Seats and Pop Party on pads** | Game manifest and seats model; Pop Party with pad seats; pause on drop; kid profiles moved to the Box |
| Feb 26 | **M4 Create and the kit** | A bigger kit (assets, a few stage pieces); Create flow tuned for the two testers; a few games restyled as proofs; Pop Party's tuning pass |
| Mar 12 | **M5 Harden** | Closed-beta install and invite; reconnect; network-isolation message; performance pass; bug bash |
| Mar 27 | **M6 Release to the two testers** | Pop Party perfected and the platform done; handed to the brother-in-law and father |

## Work streams

**Look and kit:** palette roles; asset spec; the stage (done); a bigger kit; a small stage set later; the artist spec and a checker (not urgent).

**Pads:** protocol and host session; the browser pad page; seats; reconnect and pause; a message when the network blocks devices from seeing
each other; the native Android shell later if time allows.

**Platform:** the game manifest and seats model; signed packages and entitlements; the closed-beta channel; sign-in once; kid profiles on the Box.

**Create:** a bigger kit; the vocabulary growing as games need it; the approval flow for submitted games; asset requests.

**Pop Party:** tuning from family playtests; pad seats; the smoothness check; the final polish.

**Beta operations:** installs for the two testers, beta terms, a simple way to send feedback and bugs.

## What the owner does

Pick names; run the smoothness test on the laptop (stage lab versus the real Pop Party, with and without the integrated GPU); playtest each
milestone with the family; say which games to restyle as proofs; set up the two testers; start outsourcing the Box hardware to a contractor.

## Dependencies and risks

- **The pad protocol (M2)** is now the main schedule risk. It must land by mid-January.
- **The browser pad page** cannot discover hosts or use tilt (0019); a locked phone can drop the connection, so rejoin must be solid.
- **Kid profiles** are on the Orlis Server today; moving them to the Box is a real change and must be done before other families' children
  are involved.
- **Four tracked players** have not been tested on real hardware; do it in M1 or M2.
- **If the plan slips,** cut in this order: the bigger kit, restyling proofs, Create polish for the testers; never Pop Party's perfection or the pad basics.
- **Dates assume steady weekly work and fast feedback from family playtests.**

# Orlis architecture (draft)

How the pieces fit together. Decisions live in `docs/decisions/`; this file describes the shape they add up to. Where a
decision is only *Proposed* or *Open*, that is marked. Status: first draft, Nov 20, 2026.

## The pieces

```
  webcam ─┐
          ▼
  ┌──────────────┐   LAN (home Wi-Fi)    ┌────────────────────┐
  │  Orlis Box   │◄─────────────────────►│  iPads / phones    │  up to 8 players in all
  │ (or a laptop)│                       │  (the Orlis app)   │  up to 4 tracked by the camera
  │  platform +  │                       └────────────────────┘
  │  tracking    │
  └──────┬───────┘
         │ TV (HDMI)                Internet (sign-in, Store, updates)
         ▼                                       │
        TV                              ┌────────┴────────┐
                                        │  Orlis Server   │  accounts, kid profiles, Store, submissions
                                        └─────────────────┘
```

- **The platform** (the Tauri app, `app/`): menu, games, Store, Create, body tracking, drawing the TV.
- **The Orlis Server** (`server/`): accounts, kid profiles, the Store, submissions and approval. Needed for sign-in, the Store
  and updates; not needed to play an installed game.
- **The pad** (not built): in Phase 1 a web page served by the host, opened by QR or code on any phone (0019). Later a native app
  (Android first, then iPad and iPhone in Phase 2, 0018) that can discover hosts and use tilt.
- **The kit** (`app/src/games/assets`, the creator kit): the closed library of pictures, behaviours and stage pieces that every
  game draws from.

## Seats and roles (0004)

- A game has up to 8 **players**; each is a *tracked seat* (from the one webcam, up to 4) or a *pad seat* (an iPad or phone).
- The TV has a role chosen by the game: the play surface, a map or scoreboard, or off.
- Tracking always runs on the Box, because it has the camera; tracked players reach the host as **inputs**, like any controller.

## A session (0005, 0006: proposed)

- One device **hosts** the session and holds the shared truth (the rules). It is the Box by default; an iPad can host, so eight
  pads with no TV works.
- Every other device **runs locally** what only it needs: its own camera and view of the world, its interface, private
  information (a hand of cards), a mini map, cosmetic effects.
- Messages are the same whatever the link is (the Box itself, the home network, or, much later, the internet).
- Joining: the iPad app discovers hosts on the network; the first time a confirmation code appears on the TV; afterwards the
  device is trusted and rejoins by itself.

## The home network

- Pads and the Box talk over the family's own Wi-Fi. For small homes that is enough; for many pads, a small dedicated router
  connected to the Box by cable is more reliable than a PC's own hotspot. Some guest networks block devices from reaching each
  other ("client isolation"); the app should detect this and say so plainly.

## A game package

A game is a package with two small programs, both sandboxed (no network, no storage of their own, only the kit):
- a **host** program: the rules, which run on whichever device hosts;
- a **pad** program, optional (most early games have none): what an iPad or phone shows and does (controller, map, private hand,
  a view of the world);
- plus a manifest: its name, age band, what devices it needs (none / optional / required, how many pads, how many tracked
  seats), and which view it uses.

## Drawing

*Proposed (0023): the Box and the TV draw 2D only; 3D is drawn on the pads. The text below describes the earlier plan and will be updated when 0023 is accepted.*

- **Flat games (about 80%):** the painted 2D backdrop and foreground behind paper cutouts, on a locked camera.
- **3D games:** the same paper cutouts in a 3D world made of a small **stage set** (ground, walls, ramps, buildings, water),
  with a free camera: an overview on the TV, third- or first-person on a pad.
- Games say *what* they want (names and meaning), never *how* it is drawn, so the look can be upgraded without touching games.
- One palette; costs are kept to a budget (few draw calls: merge and instance) set by the weakest supported device.

## Safety by construction

- Creators can only use what is in the kit; they cannot make assets, so nothing visually questionable can appear.
- Games are checked (words, kit-only) and approved by the owner before they reach anyone outside the family.
- Every game works offline once installed.

## Pads and the Box

A game may run with no Box at all (pads only), and most early games use no pads. Build Box-hosted sessions first; keep the host program portable so an iPad or phone can host later (0005).

## Licensing and distribution (0017)

Game packages are signed and tied to an account's entitlements, and the runtime checks them. In Phase 1 builds go only to invited people; in Phase 2 the platform runs on the sold kit and on the iPad/phone app, not as a general Windows download.

## Not yet designed

- The wire protocol between devices (messages, rates, reconnect) and the game package format as a precise spec.
- How a tracked hand targets something in a true 3D world.
- The Box's hardware and operating system (outsourced); the router for many pads.
- The 3D vocabulary creators use, and how Create describes 3D games.
- Age bands and parental controls; the privacy and consent work before other families' children's data is stored.
- Money (0010) and watches (0009) are open.

# Orlis architecture (draft)

How the pieces fit together. Decisions live in `docs/decisions/`; this file describes the shape they add up to. Where a
decision is only *Proposed* or *Open*, that is marked. Status: first draft, Nov 20, 2026; brought up to date with the built app, Nov 25, 2026.

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
- **The pad** (built for Phase 1, `app/pad/`; the "PlayPad", 0054): a web page served by the Box, opened by QR or code on any phone (0019, 0030). A small hub in
  Orlis Play's Rust side serves it and relays messages; the game host is a client of that hub (0027, spec in `docs/specs/pad-protocol.md`).
  Later a native app (Android first, then iPad and iPhone in Phase 2, 0018) that can discover hosts and use tilt.
- **Create** (`app/src/create/`, `app/src/ui/cubo-create.js`): Cubo's Create, a game made with your body, guided by Cubo (0060, 0061): reach-and-hold to pick, arms up to go on,
  in the comfort zone. What is picked becomes a *description* of a game (`create/recipe.js`) that the one shared Play engine runs (`app/src/games/play/`), so a made game is data,
  not code (0056, 0057, 0059).
- **Hands on screen** (`app/src/ui/handfeel.js`, `avatars.js`): each hand is a smoothed glow orb with a trail, impact burst, pull toward targets and hover glow (0062).
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

*Accepted (0029, with 0038 and 0039): flat games stay on the painted 2D painter (the asset library on a canvas; Phase 1 is 2D only, 0025); 3D games, later, use a
painted-style 3D sibling that moves like a paper stage (three.js on the TV and on pads, with camera tracking in its worker; a painted 2D overview is the TV fallback).
Characters that move are paper puppets (cutout parts on a skeleton). Colours come by name from the master palette (0040, 0041).*

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

- The game package format as a precise spec (the wire protocol is now in `docs/specs/pad-protocol.md`).
- How a tracked hand targets a 3D world from a moving camera (overview views are solved: a ray from the TV camera to the ground, 0031).
- The Box's hardware and operating system (outsourced); the router for many pads.
- The 3D vocabulary creators use, and how Create describes 3D games.
- Age bands and parental controls; the privacy and consent work before other families' children's data is stored.
- Money (0010) and watches (0009) are open.

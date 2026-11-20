# Orlis: the vision (draft)

Written from the conversation of Nov 19-20, 2026, for the owner to edit. This file says **what Orlis is and why**.
`BACKLOG.md` keeps the decisions, plans and to-dos. Names marked *(working name)* are unofficial and still to be decided.

## In one sentence

A free, family-safe game platform for the living room, where kids play by moving, and anyone in the family can make
and share games.

## What matters most

- **Motion is the identity.** Body tracking through a webcam is what makes Orlis different. It is the main way to play,
  but a game does not have to use it.
- **Same room.** Everyone plays together in one room. Online play is not wanted for now (it goes against kid-friendly,
  family play); it stays possible, much later.
- **Family-safe by construction.** The visuals are what we guard. Creators can only use what is in the kit, so nothing
  visually questionable can appear. No ads to kids, no selling data, no loot boxes.
- **A community that makes and shares games.** Games are free to play. Creators work on gameplay and camera angles; they
  never make assets. Only the owner (with Claude) adds to the kit.
- **One consistent look.** One palette and one design language across every game, in 2D and 3D (see "The look").

## The family of products

| What | Working name | What it is | Official name |
|---|---|---|---|
| The platform software on the TV | Orlis Play (exists) | The app: menu, games, store, create | to decide |
| The family server | Orlis Server (exists) | Accounts, kid profiles, the Store | to decide |
| The console | Orlis Box *(working name)* | A ready-made box the owner sells, plus a webcam, plugged into the TV | to decide |
| The controller | Orlis Pro *(working name)* | A gamepad-style grip that holds an iPad | to decide |
| The iPad and phone app | "the Orlis iPad app" *(working name)* | Runs on an iPad or phone; its job depends on the game | to decide |
| The mascot | Cubo / Cubion (decided) | The cube character | decided |

Naming notes: "Orlis Pro" next to "iPad" can be confused with Apple's "iPad Pro". Names need a trademark and app-store
search before they are final.

## A living room

```
   webcam ─┐
           ▼
  TV ◄── Orlis Box ◄──── home Wi-Fi ────► iPads / phones (up to 4 first; 16 is the dream)
```

- **Pads:** each iPad or phone is a controller and a private screen. What it does depends on the game: a controller,
  a map, a private hand of cards, a drawing pad, or a first- or third-person view of the shared world (like Zelda:
  Four Swords Adventures, with iPads in place of the Game Boy Advances).
- **Games say what they need,** like Steam's VR tags: no pad, pads optional (1 to 4), or pads required (up to 4, later
  16). The store shows it as a badge.
- **Two device tiers:** a *controller tier* (any phone or tablet with a modern browser: buttons, tilt, private text and
  cards, so mom or dad's old iPhone works) and a *full-view tier* (a newer chip, A14 or newer, for a private 3D view or
  a map). The official Orlis Pro target is the iPad mini class, from the iPad mini 6 up.
- **Up to 16 pads on one box** is the dream. Four boxes together (LAN-party style) is a later option.
- **Local network only.** It keeps family data in the house and keeps strangers out.

## Games

- **Flat games (about 80%):** the game's painted 2D backdrop and foreground behind paper cutouts on a locked camera.
- **3D games:** the same paper cutouts in a real 3D world (ground, walls, buildings from a small "stage set"), with a free
  camera: third person, first person, an overview on the TV, a private view on each iPad.
- **Creating games:** creators describe a game; Claude builds it from the kit. They cannot create new assets. A missing
  picture or behaviour can be requested.
- **Body tracking in 3D** (how a tracked hand targets something in a 3D world) is still to be designed.

## The look

- **The painted house style is the look.** Last Known Position and Pop Party are its reference; the inspiration is Untitled
  Goose Game and Katamari Damacy (soft, chunky, simple, readable).
- **Paper:** the painted 2D assets stand in the 3D world as cutouts (Paper Mario-style) that always face the camera.
  Painted 2D and 3D games feel like one universe.
- **One palette** (sampled from Last Known Position), with a small set of more saturated accents for things you touch.
- **The kit** is the closed library everything draws from: the painted assets, plus a small stage set. It must be able to
  take ready-made model files and be upgraded (a new look, a new renderer) without touching games. Games say *what*,
  never *how*.
- **An artist can be hired later:** the kit has an artist spec, a checker and a viewer for that day.
- **One HUD** (the invisible-rows grid) in every game; Last Known Position still has to move onto it.

## Where this vision changes earlier decisions

Settled in `docs/decisions/` (see the index there):

1. **Own console:** the Orlis Box is a ready-made product, eventually (0003). Phase 1 uses the owner's laptop (0001).
2. **Watches as controllers:** open, recommended to shelve (0009).
3. **Money:** open. Games are free; ideas include an optional family plan and premium kit packs free for a week (0010).
4. **Operating system:** open, Windows first (0002).
5. **Accounts and the internet:** an account is required, one online sign-in, offline after; the Store and updates need the
   internet (0007).

## The six-month goal

Orlis runs on an Orlis Box with a webcam, and Pop Party plays on it; the look and the kit are finalised; an Orlis iPad app
works alongside the box, with a role that depends on the game. Draft milestones are in `BACKLOG.md`.

## Open questions

- The official names (above), and a trademark search.
- How a tracked hand works in a true 3D world.
- Which box (hardware, operating system, price) and a router for up to 16 pads.
- Apple's rules for selling an iPad accessory, and for kids' apps.
- Whether four boxes share one world or run separate games with a shared scoreboard.
- The Store and creator marketplace rules once games are free.

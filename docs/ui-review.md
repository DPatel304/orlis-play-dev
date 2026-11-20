# UI review (2026-11-20)

Visual version with screenshots: `docs/ui-review.html` (also a private page). Reviewed in the browser build at 1600 x 900; Discover,
Create, Settings and sign-in as they look in the Windows app are not reviewed yet.

## Fix now (plan package U2, Sonnet)
1. **Hero blurb unreadable:** white text on the light fade under the home banner. Put it on the dark part or darken the fade; 4.5:1 contrast.
2. **Ghost label:** a plain caption shows faintly behind a tile's painted title. Hide it visually once the painted title draws.
3. **"You got 1 points":** Pop Party has no `unit`; plurals are wrong. Every game gets a unit; one/many forms ("1 balloon", "12 balloons").
4. **First-load flash:** tiles fly in as placeholder gradients and a blurred hero, then swap to the covers. Hold the row until covers decode, or
   show paper cards with the twirling Cubo head.

## One look (U1, Opus designs, owner approves)
5. **Two visual languages:** painted, warm games vs cool grey menus with system type and glassy pills. Make one **Orlis UI kit**: warm paper
   background (#f6f1e6 family), cards with the paper edge and one soft shadow tone, Fredoka (already bundled) for titles and HUD with Inter
   for small text, palette roles shared with the games, motion rules (the existing `--t-*` and `--ease*` tokens).
6. **Three Cubos:** glossy 3D logo cube, flat painted Cubo in games, a third launch head. Use the painted Cubo head everywhere.
7. **Emoji in the game screen** (hint bubbles: balloon, leaves, bricks): different on every device. Painted icons from the asset library; no
   emoji in the UI or in Create's hints.
8. **The Discover tile** is a gradient with a sparkle next to painted covers. Paint it like a cover.

## HUD (U3, Sonnet from U1)
9. **Four HUD styles** (white clock pill, blue outlined score pills, heavy navy move card, soft goal bar and hints). One HUD piece style:
   paper white, thin ink outline, one soft shadow; the player's colour as a fill swatch. Sizes checked at TV distance.
10. **The move card** is too heavy and stays too long: smaller paper card with Cubo; tucks away after the first move.

## Screens (U5, Opus mockup, Sonnet build, in M4)
11. **Results** are quiet: make a celebration card (the count big with the game's painted icon, each player's avatar and count, the bouquet,
    then the buttons).
12. **Pause** works; move it onto the kit (paper panel, Fredoka, painted Cubo), keep the big buttons and hand-hover.

## Motion and loading (keep)
13. The launch (tile grows into the cover, the name card at once, the twirling head, the game starts under it) works. Make the twirling head
    the one loading pattern everywhere (the 3D test still says "Planting the garden..." in plain text).

## Why now
The phone join page, the TV join card, the phone check and Peekaboo's HUD are about to be built (P3, P5, K8, K4/K5). They should be born
in the kit, so U1 comes before those mockups.

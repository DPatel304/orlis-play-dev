# UI review (2026-11-20)

Visual version with screenshots: `docs/ui-review.html` (also a private page). Reviewed in the browser build at 1600 x 900; Discover,
Create, Settings and sign-in as they look in the Windows app are not reviewed yet.

## Fix now (plan package U2, Sonnet) - done 2026-11-21
1. **Hero blurb unreadable:** white text on the light fade under the home banner. Put it on the dark part or darken the fade; 4.5:1 contrast.
2. **Ghost label:** a plain caption shows faintly behind a tile's painted title. Hide it visually once the painted title draws.
3. **"You got 1 points":** Pop Party has no `unit`; plurals are wrong. Every game gets a unit; one/many forms ("1 balloon", "12 balloons").
4. **First-load flash:** tiles fly in as placeholder gradients and a blurred hero, then swap to the covers. Hold the row until covers decode, or
   show paper cards with the twirling Cubo head.

U2 notes (Sonnet, 2026-11-21):
1. Hero blurb: the "cinema" (first view) banner put the words on the light fade. The text now sits higher (37vh), the light fade is shorter
   and lower, the dark side scrim is stronger, and the blurb has a soft text shadow. Measured: the brightest pixel behind the blurb gives
   at least 4.5:1 with white for every game, in both the big and the shrunk banner.
2. Ghost label: not the caption. A story's cover still included the story's own caption plate (small words behind the painted title). A still
   now sets `stillMode` and the plate leaves itself out (`ui/trailer.js`, `games/story-player.js`; test in `trailer.test.mjs`).
3. "You got 1 points": `ui/units.js` (`countText`): "1 balloon", "12 balloons"; irregular words listed. Pop Party already had a unit
   ("points", since it also scores bonuses), so it now reads "1 point". Every game's unit is tested at 1 and 2.
4. First-load flash: a tile with no cover yet is a calm paper card (no gradient, no icon) and the cover fades in over it. The banner
   already holds its picture until painted. Not done: the twirling Cubo head as a loader (needs the UI kit's loader; left for U5).

## One look (U1, Opus designs, owner approves)
5. **Two visual languages:** painted, warm games vs cool grey menus with system type and glassy pills. Make one **Orlis UI kit**: warm paper
   background (#f6f1e6 family), cards with the paper edge and one soft shadow tone, Fredoka (already bundled) for titles and HUD with Inter
   for small text, palette roles shared with the games, motion rules (the existing `--t-*` and `--ease*` tokens).
6. **Three Cubos:** glossy 3D logo cube, flat painted Cubo in games, a third launch head. Use the painted Cubo head everywhere.
7. **Emoji in the game screen** (hint bubbles: balloon, leaves, bricks): different on every device. Painted icons from the asset library; no
   emoji in the UI or in Create's hints.
8. **The Discover tile** is a gradient with a sparkle next to painted covers. Paint it like a cover.

## HUD (U3, Sonnet from U1)
9. **Four HUD styles** (white clock pill, blue outlined score pills, heavy navy move card, soft goal bar and hints). One HUD piece style (owner, 2026-11-20: every piece has one ink border, no second tone; thinner on small pills, strongest on the move card):
   paper white, thin ink outline, one soft shadow; the player's colour as a fill swatch. Sizes checked at TV distance.
10. **The move card** stays too long: a paper card with Cubo that tucks away after the first move. It has the strongest single ink border (owner, 2026-11-20), so it never blends into the background.

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

## Hand mode for the home screen (U7, proposed 2026-11-20)
Today the camera is off on the home screen (to keep the laptop cool), so only a mouse or remote works there. Games already use "point and
wave" (`app/src/ui/cursor.js`: sticky pointing, a wave clicks). Proposal: bring the same to home, in Big Picture.
1. **Camera on at home, lightly:** one person, about 10 looks a second, and only while someone is in view (measure the heat).
2. **A reach box, not the camera frame:** a comfortable box in front of the player's own shoulders maps to the whole screen, so a child
   points at every tile without stretching or walking.
3. **Big targets:** one row of four or five big tiles and three big tabs; small things (settings, profile, sign-in) stay for the mouse
   and remote, behind one big Cubo button.
4. **Point, then wave to choose,** as in games (a wave is deliberate; holding still never starts anything). The lit tile lifts, ticks, and
   shows "wave to play"; a ring fills as the wave goes.
5. **Scrolling** by pointing at big paper arrows at the ends of a row (they page while pointed at). No swipes.
6. **One driver:** whoever raises a hand first drives, with the cursor in their colour; others take over by waving.
7. **Back:** one big Home button at the top left on every screen.


## The Windows-only screens (U6, reviewed by Opus 2026-11-23)
Screenshots: 183 shots of every Windows-only screen in Window mode and Big Picture, on the local branch `u6-screenshots` (`docs/u6/`,
78 MB, not merged); three contact sheets of the main ones in `docs/u6/sheet-{a,b,c}.jpg`. Findings, most important first:
1. **Two looks, again.** Sign-in, Who's playing?, Play, Discover, Settings and Create Pro still use system type, a purple accent
   (not the palette), soft gradient blobs and the glossy 3D cube logo in the top-right of every screen. Move them onto the kit (paper,
   Fredoka, one ink border, palette colours) and the chosen logo (U5 home options and logo, owner to pick).
2. **Big Picture is too small.** The sign-in card, Who's playing?, Settings and the top-bar chips are desktop-sized on a TV: text around
   12 to 14 px at 1080p, small avatars, lots of empty screen. In Big Picture: type and targets at TV size (the kit's TV scale), Who's playing?
   as big faces across the screen, Settings as a full-screen paper sheet.
3. **Play and Discover:** the dark navy hero with system type and the gradient-and-sparkle placeholder covers for Store games. Replaced by
   the chosen home option; Store games without art get a painted cover from their palette and icon, not a sparkle.
4. **Emoji left** (U4 converted the games, Create's steps and the request builder): the child picture picker in "Edit child" (rocket,
   star, cat...; drop it, the avatar maker is the picture), Create Pro's cards (link, hammer, TV), the "No game slots left" barrier.
5. **Bugs and words:** under-construction tiles all read "YOUR GAME" (show the game's name); "All 0 are used" (say "You have no game
   slots yet. Ask the owner."); the cube logo covers the game page's back button; Pending approval is a title on an empty screen (add one
   line on what happens next and a picture).
6. **Keep:** the avatar maker (already in the new look), the Create wizard's step card and its flow, the Settings groups, the error
   messages' wording.

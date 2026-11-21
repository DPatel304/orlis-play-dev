# 0040: The master palette: one named list of colours for 2D and 2.5D
Status: Accepted (2026-11-21)
Date: 2026-11-21

## Context
The look is settled (0038, 0039) but colours were picked game by game. The owner approved a master palette (`docs/palette.html`) and asked
how hard it would be to change colours a year from now, with many games using them.

## Decision
- **One master palette** in `app/src/games/assets/palette.js`, shown on `docs/palette.html`. Groups: touchables (8), favourites (8),
  sky and light, the meadow green ladder, warm earth, shade/ink/paper, interface accents, and the Phase 1 world sets.
- **Touchables are the brightest objects.** Scenery never uses them. Characters may wear their favourite colour (they stand on the ground
  with a shadow and the ink edge; touchables float, bob and glow). Warm accents (clay, brick, a planet) are for small props only.
  Shadows are purple-grey, never black. Ink is for the thin edge and text only. Dark worlds give touchables a soft glow.
- **Mint and Lagoon are softened** (Lagoon deeper and bluer) so the eight touchables feel like one set and Lagoon reads against water.
- **Your favourite colour is your player colour** (pills, hands, lanterns, score pops); a clash or a guest gets the nearest free colour.
- **Phase 1 world sets: meadow, night, space, under the sea.** Other worlds (evening, autumn, snow, beach, and the style board's other
  ideas) are added in Phase 2, when a game needs them, each as a sky and a few colours, previewed with the touchables on top.
- **Games use colour names, never raw codes,** so the palette can be tuned later in one place:
  1. Orlis supplies the palette while a game runs (`assets.color('touch.mint')`); store and Create games do not carry their own copy.
  2. Names never change once published: values may be tuned, colours added, old ones retired gently.
  3. Create's check rejects raw colour codes in made games; built-in games get a test that flags raw colours outside the palette.
  4. Profiles store the favourite by name, not code.
  5. After a palette change, a screenshot sweep of every game checks nothing clashes.
  6. Changes are small tweaks; colours children know (their player colour) are not swapped.

## Consequences
- Done now: `palette.js` with `assets.color()` (also in the creator kit), Pop Party's balloons read the palette, and a test keeps the
  page, the code and the brightness rule in step.
- Plan items: U8 (favourite colour as player colour) and U9 (move built-in games, backdrops and the avatar maker onto names; Create's
  check; favourites stored by name; the screenshot sweep tool).

## Replaces
The open "master palette" question in `docs/style-rulebook.md` (rule 8).

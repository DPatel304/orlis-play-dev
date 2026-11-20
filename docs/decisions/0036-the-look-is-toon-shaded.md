# 0036: The look is toon-shaded 3D, drawn flat for 2D games
Status: Superseded by 0038 (two looks, one family); the Pop Party redraw was dropped by 0037
Date: 2026-11-20

## Context
0035 set the feel (cozy, playful, handmade), cube-headed avatars, any genre and a fully 3D world, with paper as the material. A comparison
of five looks on one scene (paper cutouts, handmade toy, toy with dark outlines, toon-shaded, soft toon; `spike3d/look-compare.html`)
showed that paper cutouts struggle in 3D games where the camera moves around things (racing, first person, physics). The owner chose
**C, toon-shaded**, and did not want the soft, rounded variant.

## Decision
- **3D-first:** every asset is a simple 3D model. 2D games draw the same models with a flat, locked camera, so 2D and 3D always match.
- **Toon shading:** flat colour with crisp three-step shading (light, mid, shade); no shine, no realistic lighting.
- **A dark outline on everything** (characters, props, buildings), as in the sketch.
- **Bright, clear skies; no haze** by default (a world may add a little).
- **Shapes:** simple and crisp, as in look C (not the soft, pillowy variant).
- **Kept from 0035:** the feel, cube-headed avatars, any genre, a fully 3D world.
- **Replaced from 0035:** "paper only", the thin white edge, the paper-specific rules in `docs/style-rulebook.md` (layer shadows,
  "ink means touch me").

## Open
- **What marks a touchable** now that everything is outlined (a thicker outline, a gentle bob or sparkle, or brighter colours).
- **The master palette** and how much the shapes may be rounded without looking soft.
- **Phase 1:** Pop Party is a painted 2D game. 0033 asks Peekaboo Garden to look like the same world as Pop Party. Either Pop Party
  is redrawn in the toon look before the beta, or 0033's "same world as Pop Party" becomes "the Phase 2 look".
- **Speed:** outlines are drawn as a second, slightly bigger copy of each shape, which doubles the drawing work. Use instancing for
  repeated things and measure on the minimum phone and the Box hardware.

## Replaces
The material, edge and paper rules in 0035 (its other parts stand).

## Owner's answers (2026-11-20)
- **Pop Party is redrawn in the toon look before the beta**, so Phase 1 shows one look (0033's "same world as Pop Party" stands).
  Consequences: a new plan package (Pop Party's balloons, sky, meadow, animals and bouquet as toon models drawn with a flat camera);
  Pop Party then draws 3D with camera tracking on, so the tracking worker and the speed check (K1) matter for both games; the date is
  at more risk.
- **Touchables stand out by colour:** they use the brightest colours of the palette; scenery uses calmer ones. Outlines stay the same
  thickness everywhere.

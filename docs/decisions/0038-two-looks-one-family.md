# 0038: Two looks, one family: painted 2D for 2D games, a painted-style 3D sibling for 3D games
Status: Proposed
Date: 2026-11-20

## Context
The toon look (0036) lost what the owner loves in the painted 2D look (0037). The owner asked whether two looks would be bad: they want
to keep the finished 2D look and still make 3D games.

## Decision (recommended)
- **2D games use the painted look** (Pop Party's: painted skies, faceted mountains, haze, cel shading with one tone, soft highlights).
- **3D games use its 3D sibling,** built from the same rules: the same painted sky and sun as a backdrop, the same palette, haze that
  softens far things, faceted mountains and round bushes, one shade tone and soft matte highlights on objects, no dark outlines,
  touchables the brightest things. First test: `spike3d/siblings.html`.
- **What makes them one family:** Cubo and the cube-headed avatars, the palette and sky, the shapes, the UI kit and HUD (shared by both),
  the sounds and the motion.

## Consequences
- Two kinds of art to maintain (painted 2D pieces and simple 3D models), kept close by one palette and the shared skies.
- Peekaboo Garden is the first game in the 3D sibling look.
- The UI kit stays in its paper style (`docs/ui-kit.html`, with the single ink border), not the toon restyle (`docs/ui-toon.html`).

## Replaces
0036 (the toon look), if accepted. 0035's feel, cube-headed avatars, any genre and fully 3D world stand.

# 0038: Two looks, one family: painted 2D for 2D games, a painted-style 3D sibling for 3D games
Status: Accepted (2026-11-20); supersedes 0036
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

## Owner's addition (2026-11-20): 3D is "as little as needed"
3D games prefer painted 2D pieces and use real 3D only where it makes sense. The rule: **a thing is 3D only if the player walks on it,
goes around or inside it, bumps into it, or sees it turn** (ground, hills, walls, buildings, vehicles, things with physics, the
characters). Everything else stays a painted 2D piece standing in the world: the sky, sun and clouds, mountains far away, grass, flowers,
petals, distant trees, effects (confetti, sparkles), signs and decals. Far things can be painted even if near things are 3D.
Why: it keeps the painted charm, it is lighter to draw, and there is less 3D art to make. Care needed: painted pieces must be tinted by
the scene's light so they sit in it, and games whose camera looks steeply down should use 3D for what would otherwise look flat from above.
Each kit asset says whether it exists as a painted piece, a 3D model, or both, and the game uses the painted one unless the rule says 3D.


## Owner's addition (2026-11-20): what keeps the siblings close
Agreed rules for both looks:
1. **One avatar, drawn two ways.** Each cube-headed avatar is made once as a 3D model; 2D games use painted sprites rendered from it,
   3D games use the model.
2. **The same motion.** One shared motion file: squash and stretch, idle breathing, pop timing and easing curves, used by both.
3. **One palette.** 3D colours come only from the master palette that the 2D pieces use (palette still to be approved).
4. **The same light side.** The sun is upper left in both; shadows fall to the right and highlights sit upper left.

On trial, owner to judge in `spike3d/siblings.html` (buttons 4 to 7): a clearer light from the sun's side, paper texture printed on
3D surfaces, the thin ink edge around balloons and bushes (this would replace "no dark outlines" above if kept), and soft hand-made
wobble on shapes. The same effects, sounds, HUD, transitions and loading screen are shared as already stated.

## Owner's verdict on the trial (2026-11-20)
Keep **the thin ink edge** (button 6): 3D objects that matter (balloons, bushes, characters, touchables) get the same thin dark edge as
the 2D pieces, around their outline only. This replaces "no dark outlines" above. Dropped: the stronger sun-side light (button 4; rule 4,
the sun upper left in both looks, still stands), paper texture on surfaces, and the hand-made wobble.

## Owner's addition (2026-11-20): no grass on the floor
3D scenes do not scatter painted grass tufts on the ground: it looks too busy. The ground keeps its painted texture (soft patches, paths),
with a few flowers at most.

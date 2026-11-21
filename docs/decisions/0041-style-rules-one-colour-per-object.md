# 0041: Style rules: one base colour per object, shade and highlight by rule
Status: Accepted (2026-11-21)
Date: 2026-11-21

## Context
The owner asked whether to simplify the graphics and palette further, for versatility (Create, the AI maker, many worlds) and for the
later move to true 3D. Fewer colours or plainer art would lose the painted charm (the toon test, 0036, showed that), and Pop Party is the
one game being perfected, so its art stays. What helps is simpler rules.

## Decision
Five style rules, for every new piece of art in 2D and 2.5D, for Create and the AI maker, and for games as they are next worked on:
1. **One base colour per object, from the palette** (0040). Its shade and highlight are not picked by hand: they come from the base by
   a fixed rule (shade: mixed toward the palette's shadow purple-grey; highlight: mixed toward white). `palette.js` gives all three, so a
   creator names one colour. In 3D the light makes the shade, and the rule is tuned to match it.
2. **One shade tone and one soft highlight per object, flat fills.** Light from the upper left, shade on the lower right.
3. **Gradients, grain and haze only in the big background layers** (sky, mist, far hills), never inside objects.
4. **Simple, chunky shapes for anything that might become 3D** (round bushes, faceted mountains, cube heads, simple props). Fine
   detail belongs to painted pieces, which never need a 3D version (0038's "3D only where needed").
5. **The thin ink edge on characters and touchables only** (0038), never on scenery.

Not done: fewer palette colours (worlds would look alike), and no redraw of finished art (Pop Party and the other games stay as they are).

## Consequences
- `palette.js` gains the shade and highlight rule (`assets.color('touch.mint', 'shade')` and `'light'`), tuned against Pop Party's
  balloons; the creator kit and Create's docs teach the five rules; the maker's instructions follow them.
- The rules are written for creators in the kit (`kit/creator/`) and for the team in `docs/style-rulebook.md`.

## Owner's change (2026-11-21): rework the existing games too
The owner prefers the existing games reworked onto the palette and the five rules, rather than waiting until each is next touched. Plan
item U11, after U10 (the rule in code) lands: first the shared painted asset library (every game draws from it), then Pop Party (the rule is
tuned to its balloons, so it changes least; extra care, the owner approves before and after), then the small games (Sleepy Bear, Leaf Pile,
Stack It High, Sky Painter, Animal Gym, Keep It Up, Pterry Flight, Save the Harvest, the Cubion story), one game per step with before and
after pictures from the sweep tool. The two big ones (Last Known Position, about 680 hand-picked colours, and Tower Defense, about 140)
come after the Phase 1 release, when they are finished (0021). Raw colour codes removed this way lower the ratchet baseline.

# 0042: One character, many kids: every avatar is the same cube character
Status: Accepted (2026-11-21)
Date: 2026-11-21

## Context
The cube-headed avatars (0035, sketches in `docs/cube-avatars.html`) varied head size, hair, skin tone and face, so they read as
different people rather than one Orlis character. The owner asked for avatars that are customised but always clearly the same character,
the way a famous knitted game hero always looks like himself. Mockup: `docs/one-character.html`.

## Decision
- **Every avatar is the same cube character:** the same cube head (size, rounded corners, light top edge, shaded side), one body shape
  with stubby arms and legs, one painted face style (dot eyes, simple mouth), the thin paper edge and soft shadow.
- **A child chooses five things:** their **colour** (one of the eight favourites, 0040, which is also their player colour), their
  **face** (eyes and mouth from a small set in the same style), **something on top** (hair pieces such as a tuft or a bob, worn like a hat,
  are allowed; caps, beanies, bows, crowns, headphones, bunny ears, a flower), an **outfit** (plain, stripes, stars, dots, overalls, hoodie,
  in a second colour) and **one extra** (glasses, scarf, cape, freckles, rosy cheeks).
- **No skin tones or realistic faces:** it is a character, not a portrait.
- **Cubo is the blue one** with the default face (the all-blue Cubo the owner approved in U11).
- One 3D model later, colour swapped and toppers snapped on; the painted pictures come from it (0038's "one avatar, drawn two ways").

## Consequences
- The avatar maker and the avatar drawing (`app/src/ui/avatar-art.js`, `avatar-maker.js`, `avatars.js`) are rebuilt for the new
  character; existing kids' looks are carried over (their favourite colour, and the nearest face and topper).
- Everything that shows avatars (who's playing, pills, results, the phone page, the camera figures in games) shows the new character.
- U8 (favourite colour = player colour) becomes part of this work: the avatar's colour is the player colour.

## Replaces
The varied cube-headed figures in 0035 and `docs/cube-avatars.html` (0035's cube head and paper look stand).

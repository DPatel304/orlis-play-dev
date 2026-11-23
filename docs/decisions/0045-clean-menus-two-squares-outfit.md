# 0045: Clean menus: the two squares logo, Outfit, one-page home; games keep their own lettering
Status: Accepted (2026-11-23)
Date: 2026-11-23

## Context
The U5/U7 mockups put the menus in the painted kit look (warm paper, Fredoka, a Cubo-head logo). The owner found the home too empty,
the Cubo head logo too plain and the font wrong, and preferred a clean, modern menu close to the app's look before, with the game art
doing the colour (TV streaming apps as inspiration). Options: `docs/screens-mockup.html` (home options A to C), the logo-face and font
page, and the clean-look page (six logos, six fonts, four layouts).

## Decision
- **Menus are clean and modern; games are painted.** Menus, pause, results, sign-in, Settings and Create use a clean look: flat surfaces,
  soft shadows, no paper texture, the palette's colours. Game art (covers, worlds) is the colour on screen.
- **Logo: two squares**, one hopping onto the other, in today's blue to violet; the wordmark "Orlis Play" with "Play" in the gradient.
  No face in the logo. Cubo stays the game character, not the logo.
- **Font: Outfit** for everything you read or press, including the in-game HUD (clock, score pills, hints, move card labels).
- **Game titles keep their own lettering** (the five title styles on covers and the game's own title); the menu font is not used there.
- **Home: one page, no tabs.** The focused game's world fills the screen (option A's hero: big title in the game's lettering, one line,
  players and time, one big Play), then rows: your games, "New to try" (what Discover was), "Make a game" (Create). Scroll down for more.
  Grown-up things behind the profile button. Hand mode: point to move along a row or between rows, wave to choose.
- **Kept from the kit (U1):** the palette and its rules (0040, 0041), the one character (0042), painted icons (no emoji), the HUD anchors
  and docks (0034); the kit's paper texture and Fredoka now belong to the games' painted side only.

## Replaces
In the UI kit (U1, `docs/ui-kit.html`): Fredoka as the interface font, the paper look for menus, and the painted Cubo head as the one brand
mark (`docs/ui-review.md` items 5 and 6). The three tabs on top of the home screen.

# 0056: Create in Phase 1 is picture-built, with no AI
Status: Accepted (2026-11-23)
Date: 2026-11-23

## Context
Create is the main reason families would choose Orlis: kids (6+) and families making games together, excited about building games.
The old flow (`app/src/ui/request.js`: describe a game, send it, the owner builds it with Claude Code, wait) is slow, needs the owner,
and its free-text box is a way around the rules. The owner does not want to pay for families' AI use. Orlis.play's vocabulary
(`app/src/games/play/vocabulary.js`, `engine.js`, `validate.js`) already describes first-person games as data: moves, triggers, results,
pieces, scenes, sounds, the move card. Mockup: `docs/create-mockup.html`.

## Decision
- **No AI in Create for Phase 1.** A game is a description in the Orlis.play vocabulary, built on the TV from picture choices and run by
  the engine at once - no Claude Code, no API key, no server call to build or play.
- **Six steps, pictures first:** How it plays (Catch, Pop, Dodge, Collect, Keep it up), What (library pieces, by category), Where
  (existing worlds), Your move (existing move cards), Rules (speed, how many, together or who wins, specials: a golden one, a bomb to
  avoid), Name and play (suggested names). A live preview of the real game runs beside the choices and changes as kids pick.
- **Changing a game:** redo any step, Undo, and **simple voice commands** ("faster", "slower", "more", "make it night", "add a golden
  one"...) mapped to the same settings with no AI, using speech recognition on the PC if it works in the app (else voice waits).
  A grown-up turns the microphone on once.
- **Limits that keep it safe:** only library pieces, existing worlds and move cards; no drawing, no free text into a game.
- **First-person games only** (like Pop Party) in Phase 1.
- **3 slots per family.** Games stay in the family: a third row on Play, **"Made by us"**, with each maker's face on the tile.
- **Not in Phase 1:** AI ("say anything" to Cubo, Phase 2 inside a subscription), publishing to Discover (Phase 2, owner approves),
  creator credit and likes (Phase 2), submitting new assets (Phase 2), Create Pro (paused).
- **Later depth, still no AI:** levels in a row and win/lose rules (Phase 1.5); "when... then..." rules and placing things (Phase 2).

## Replaces
The request flow for kids and families ("Ask for a game" -> the owner builds it -> "Your requests"), which leaves the app's Create tab.

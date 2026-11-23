# 0051: Weekly challenges show up when there is news; a bolder, livelier challenges screen
Status: Accepted (2026-11-23)
Date: 2026-11-23

## Context
The challenges screen (0045-era home; the weekly challenges package) came up over home every time the app started, and the owner found
it annoying. It was also flat: three white cards, small icons, thin bars.

## Decision
- **When it comes up by itself:** only the first time the app is opened in a new challenge week (new challenges). Otherwise never.
- **The star pill** on home (beside the profile face, "1 of 3 this week") is the way in, any time. It **glows softly** when there is news
  (a new week not yet seen, or a challenge finished since it was last opened); opening it clears the glow.
- **The results screen:** after a round that moved a challenge, one progress line for it (its blocks ticking up); when a round finishes
  a challenge, the gold star stamps down with sparkles and the challenge's name (instead of a toast).
- **The look:** each card's top half in its own colour with a big icon; progress as chunky blocks you can count (capped to a readable
  number of blocks for big targets); a finished card turns gold with a big stamped star; a row of seven dots for the week, today marked.
- **Motion:** cards dealt in one by one with a bounce; blocks fill from empty with the numbers counting up; a finished star stamps with
  a sparkle burst; on close, the cards fly into the pill, which bumps and ticks.
- **Sound:** a soft whoosh as each card lands; little ticks rising in pitch as blocks fill; the intro's two sparkles (0050) when a star
  appears; a small happy chime on opening when one is done.

## Replaces
The challenges splash on every app start (the "once each time the app starts" rule in `app/src/ui/challenges.js`).

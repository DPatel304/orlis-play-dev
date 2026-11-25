# 0061: Cubo's Create is controlled by reach-and-hold and arms-up, in the comfort zone
Status: Accepted (2026-11-25)
Date: 2026-11-25

## Context
0060 built Cubo's Create with several gestures (hold, swipe, step sideways, push sliders, jump) and fixed screen layouts. Testing showed
low targets are hard to reach standing, and swipes and sliders need precision. The owner (2026-11-25) asked for the whole flow to be
easier with motion.

## Decision
- **Everywhere:**
  - Targets sit only between chest and just above head height, arranged around the first player's own position and reach
    (`reach.js`); nothing below the hips.
  - **Two gestures:** reach-and-hold to pick, both arms up for "done, next". No swipe.
  - **Holding feels good:** as a hand nears a target, the target grows and glows and gently pulls the hand marker toward it, a ring fills
    around the hand, a rising tone plays, and a pop plays on the pick.
  - Cubo demonstrates each gesture the first time it is needed.
  - "Arms up" always sits in the same place. "Back" is a big hold target in the top-left corner.
  - A strip of step dots across the top shows the progress.
- **Start:** arms up, or touch and hold Cubo.
- **Where:** a carousel. The current world fills 80% of the screen and comes alive; the previous and next worlds peek in at the sides.
  Reach toward a peek and hold to slide; stepping sideways still works. Arms up to choose.
- **The game:** one row of four tall cards at chest-to-head height. Near a card, its Cubo does the move and the voice says its name.
- **What:**
  - Five big group tiles in a row at shoulder height.
  - Then the things float slowly across in a parade at chest height; touch and hold any one to grab it.
  - Picks fly into the tray; hold on a tray item to put it back.
- **Rules: "higher hand = more".** One question at a time: raise a hand higher for faster (7 stops), then for more things (7 stops).
  The background shows the result live. Hold still to set it.
- **Name:** jump, or reach and hold the wheel, to spin it; arms up to keep the name.
- **Play:** a 3-2-1 countdown with Cubo.

## Replaces
From 0060: the swipe-to-spin wheel with a grab spot, the push sliders, the 2x2 game cards, the group chips at the top of the screen, and
choosing a world only by stepping sideways.

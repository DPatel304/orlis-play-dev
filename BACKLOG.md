# Orlis Play backlog

Ideas kept for later. Not promises, and not in order within a section.

## Decisions

What's been decided, so it isn't only in chat. Newest last within each part.

**Controllers and wearables** (Nov 15-16, 2026)
- **The camera comes first.** Everything works with the camera alone; watches
  and headbands are added later, and every game must still play fully without
  them.
- **The watch is the Bangle.js 2** (for building and for our family): tough,
  readable screen, programmed in JavaScript over Bluetooth, weeks of battery.
  Its screen has 8 colours, so two player colours (orange, purple) will need
  to change to ones it can show.
- **One Orlis watch protocol** (motion in; colour, pictures and buzz out), so
  the PineTime (about a quarter of the price, for other families) and our own
  band later work without the games changing.
- **The watch screen is for glances:** who you are (colour, avatar), your
  status, Nova on your wrist in LKP, secrets the TV can't keep (missions,
  roles, team puzzles), tap to choose. Icons over words; buzz first.
- Also explored, not chosen yet: light-up headbands in player colours, a
  sturdy dance pad, the four-player floor "team controller" (drawings
  committed), our own kid-friendly band (prototype on a Seeed XIAO nRF52840
  Sense; outsource the circuit board to a freelance engineer).

**The product** (Nov 16, 2026)
- **Starter Kit:** two watches, kid straps and a quick-start card; families
  download Orlis Play to their Windows laptop or MacBook (plug into the TV
  recommended). Needs first: watch setup in the app, a Mac version, and the
  Store and accounts online so it works without our laptop server.
- **Not building our own console box for now:** mini PC prices have roughly
  doubled with the 2026 memory shortage. Revisit when they settle.
- **Hosting: as much as possible on our laptop, no Tailscale for families.**
  Leaning towards a tiny relay (a $5 AWS Lightsail box that only forwards
  traffic and stores nothing), or Tailscale Funnel (on our laptop only).
  Not final.
- **Joining: no invite codes.** People sign up with email and password, verify
  their email with a code, and the owner approves them (or pre-approves
  emails). Email sent with Gmail first, Amazon SES later. Not built yet.

**Money** (Nov 16, 2026)
- **No subscriptions.** Buy once, keep what you buy.
- **Ways in:** the Starter Kit (about $129-149 with PineTimes; software
  forever), game packs ($5-15, kept forever), a Season Pass that doesn't
  renew by itself (games kept forever), a lifetime pass, and pay-as-you-go
  game-making credits (AI costs real money, so never unlimited).
- **No Steam.** Sell direct from our own website: Paddle or Lemon Squeezy
  for the software (they handle sales tax), Stripe for physical kits.
- **The order:** families (the kit and packs), then Kickstarter, then a
  classroom licence (pilot with a preschool or teacher), then a creator
  marketplace (a share of each sale, every game reviewed), then venues and
  therapy settings (no medical claims).
- **Never:** ads to kids, selling data, loot boxes, or purchases by kids.

**Ranks, the boot camp and the Dev Kit** (Nov 16, 2026)
- **Why:** an AI game dev boot camp is part of the product. Kids learn what
  working in the games industry is like, so ranks use real job words.
- **Rank is earned; tools are bought.** A title says what you've done; the
  paid Dev Kit says what you can use. Buying never changes a title.
- **Play-testers** (kids start here): Play-tester, II, III, IV, V, then Super
  Play-tester. **Each level-up needs a boot camp mission** ("learn, then do"),
  plus some practice. Missions so far: What's a play-tester?, Good feedback,
  Spot the bug, Fair testing, Graduation (test a new game first and write its
  first review). Nova teaches each one aloud in a short scene, and missions
  are played by moving, so kids who can't read can do them on their own.
- **Creators** (grown-ups start here; kids too, by making a game with a
  parent - the title, never the grown-up permissions): Creator, II, III, IV,
  V, then Super Creator. **Creators level up by milestones** (games made,
  games published, families playing them - the numbers are to be decided).
- **Badges:** stars for little kids (Creator ★★★), numerals in text. The owner
  can also give a rank.
- **The Dev Kit** (name not final): building games yourself with Claude Code,
  plus its boot camp lessons. A one-time unlock (no subscription); they bring
  their own Claude subscription. Grown-ups only, a small link in Create; the
  owner can give it free (to family). Claude Code stays out of sight without it.
- **Industry features that make the titles real:** play-test reports after a
  new game (too hard, too easy, loved it, found a bug) sent to its creator;
  credits at the end of games ("Play-tested by ..."); patch notes for each
  version; bug reports; families as studios ("Patel Studio"); a launch
  moment when a game is published.
- **Still open:** the Create tab's name and verb (ideas: a Studio tab, "Make a
  game"), and the Dev Kit's name.
- **Also:** every page should be less wordy - one short line at most,
  two-or-three-word buttons, explanations behind a "?".

## Creator mode

From the VibeBox concept (worked out together with a friend, who is doing
their own variant). Orlis keeps its own approach: the family PC, sealed
single-file `.orlis` games, and family accounts.

- **Try it on the TV.** A Creator-mode switch: a creator's laptop on the
  home Wi-Fi sends the game in progress to Orlis Play, which reloads it in
  the sandbox each time they save, so they can jump in front of the camera
  to test their own change.
- **Starter ideas.** A pack of kid-friendly game ideas in Create, each a
  short prompt plus a matching starter template ("two-player balloon pop",
  "jump-and-duck runner"...). A way in for kids: pick an idea, a parent runs
  it with Claude, the kids play-test it.
- **The body data, on one page.** A short, plain reference for what a game
  receives (players, hands, body points, 0-1 coordinates, what "present"
  means). It goes in the Creator Kit so Claude writes better games, and it
  is the promise that keeps older games working (the kit version).
- **Test without anyone moving.** Record the family moving once (body
  points only, never video) and replay the recordings: for creators, and in
  the Store's checks, which play each submitted game with, say, "two kids
  jumping" to catch games that crash or can't be won.
- **Say up front what a game needs.** In the manifest and on the tile:
  "hands only", "full body, needs space", "1-4 players", "good for little
  kids". The checker confirms it.

The plan for creating (decided):

- **Creators use their own Claude subscription, through Claude Code.**
  Orlis Play's Create makes a game folder with the Orlis kit (CLAUDE.md, an
  Orlis skill, permission rules, hooks that keep edits in the folder and run
  the checker), opens it in Claude Code, and live-previews the game in its
  sandbox as Claude saves. Check, then Submit.
- **Publishing happens on your Wi-Fi.** Submitted games wait on the
  creator's PC ("Waiting to send") and go to the server's approval queue
  the next time they're on your Wi-Fi; the owner approves them on the
  Family page. The server re-checks everything.
- Only grown-up accounts the owner made Creators see Create.
- Order: households and Creator roles (done); the approval queue (upload
  from the app, review on the Family page); Create in Orlis Play; the kit.
- Publishing gates, later: a minimum number of play hours before
  publishing, one published game first, more once it reaches a threshold.

## The app

- **Make the privacy promise visible.** In words a parent sees, on the
  Store page and in Settings: games get body points only, never camera
  pictures, and can't reach the internet. The sandbox already enforces it.
- **A launcher for Steam games.** Installed Steam games as tiles on Home,
  with their box art, on a shelf of their own. All of it comes from
  Steam's own files on the laptop (its library folders and app manifests,
  and the cover pictures it keeps), so there's no Steam login or API key.
  Play hands the game to Steam (`steam://rungameid/<id>`), so Steam's
  updates, cloud saves and controller settings all work. The camera is off
  while a game runs, since tracking already stops when Orlis isn't in front.
  - Who sees them: the shelf is for grown-up profiles by default, and the
    owner picks any games kids can see.
  - Coming back: Steam doesn't say when a game closes, so Orlis waits
    behind it and goes to Home when it's back in front.
  - Later: Epic, Xbox and other launchers the same way.
  - To test: on the real laptop with Steam (about 5 minutes); built here
    against sample Steam files.

## Store

- Upload games from the app; a Sync button; double-click a `.orlis` file
  to install it; an owner's invites page (taken out of Settings).

## Later

- **A living-room box**, if ever wanted: a dedicated device instead of the
  PC. VibeBox's board research (Orange Pi 5, about $108; Khadas VIM4, about
  $431) is the starting point.
- Not planned: native Godot/Unity games, and games loaded from web
  addresses. Both would break the sealed single-file `.orlis` sandbox.
- **Selling it: one Orlis service for many families.** Families only
  install Orlis Play; it connects to one server on the internet (AWS):
  a fixed address over HTTPS, self sign-up with email confirmation and
  password reset, payments, the owner as admin of the service, the
  database and game files (S3) backed up by AWS, COPPA work (parental
  consent, a privacy policy, deleting a family's data). Households are
  already in place for this. Until then the server stays on the laptop,
  home Wi-Fi only.
- At ship time: the fresh `orlis-play` repo (rename this one away first;
  same signing key), code signing, payments.
- Last Known Position and Pop Party release-ready; Nova re-record; finish
  the Orlis look once there's a third game (see `mockups/ORLIS-LOOK.md`).

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

**Paying, and keeping it free of spam** (Nov 16, 2026)
- **The Dev Kit** (Claude Code) is a one-time unlock. Dev Kit builds don't use
  slots (their own Claude). Free Dev Kit games are shared free (reviewed).
- **Premium games** (sold): a submission fee, paid upfront and refunded once
  the game is played by enough different families for real (not raw play
  counts, which can be faked). Amount to be decided ($25-50 to start, rather
  than Steam's $100); creators get a share of each sale.
- **Making games:** 3 slots to start (a slot is a game you keep; each comes
  with a few changes); more slots bought by parents, or earned with Creator
  ranks. Prices once we've measured what a made game really costs in AI.
- **Making is easy and private; reaching everyone is earned.** A new
  creator's games are for their own family; the Store for everyone comes with
  rank (Creator III+: the play-test shelf; Creator V+: the Store, after
  play-testing and the owner's OK).
- **The play-test shelf:** new public games are tried by Senior and Super
  Play-testers first; good reports move a game on to the Store.
- **Limits that loosen with trust:** a daily pace for Make a game and Change
  it, a duplicate catcher, and the owner's OK before any AI runs.
- **Quality decides what's seen:** the Store sorts by how many families played
  a game through; a creator's best few are shown first; a Report button.
- **AI misuse:** the word filter, the prompt guard, their words quoted as a
  description, a check for well-known game and character names, and no
  recreations of existing games.

- **Coming back each week (built):** Play's *Featured this week* is games
  from Discover, a new few every Monday (the owner can pin one to keep it
  there); three *family challenges* a week, reached together, a star for
  each, reset every Monday with nothing lost for a missed week; *Jump back
  in*; moving previews. Deliberately not: streaks that punish a missed day,
  random prizes, endless autoplay, countdowns aimed at kids.

## Following a creator (to think through)

The idea: follow someone who makes games, and their new ones come to you.
Open questions before building:

- **Who can be followed?** Only people in your own family's server today;
  later, with the one-service-for-many-families version, creators in other
  families too. Probably creators only (Creator rank), never children's
  profiles by name outside the family.
- **Who follows?** The account (a grown-up), or each profile (a kid follows
  their favourite)? Kids following kids across families needs a parent's
  OK and probably stays family-only.
- **What following gives you:** a *New from Mia* row on Play when there's
  something new; the newest game from each followed creator in Featured; a
  small note on the results screen ("Mia made 2 more games").
- **A creator's page:** their games, newest first, how many families
  played them; a Follow button. Reached from a game's page in Discover
  ("by Mia").
- **For creators:** how many follow them - kept gentle (no public
  follower counts for children?), and a reason to make another game.
- **Safety:** no messages, comments or chat between followers and
  creators; display names only; the owner can remove a follow; the word
  filter on names.
- **Ties in with:** Creator ranks (followers as a milestone?), Featured
  (followed creators' new games first), and the weekly rhythm (a Monday
  "new this week from people you follow").

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

- **One app, modes by install: Player and Creator (started).** Mode 1, *Player*, plays
  on the TV (Play, Discover, Create) and is what a hardware box would be locked to.
  Mode 2, *Creator*, is for a grown-up's laptop or phone: only Create and Create Pro, and it
  can't play games (no Try it - send the game, then try it on the TV). The build decides the
  mode (`ORLIS_MODE=player|creator`, read by `src/ui/mode.js`; `?mode=` in a browser), and
  nothing in the app switches it. **A build that is told its mode is locked to it; one that isn't (the Beta, a browser)
  has a Mode switch in Settings, for testing, and starts as `creator`.** Create Pro is the old Dev Kit (Claude Code connect, build, Check and send). Still to
  do:
  - **Phone sign-in.** A QR code on the "Sign in to Claude" step, so a grown-up can sign in on
    their phone. Check first what Claude Code's sign-in actually hands back (it may only return
    a code to type); keep the plain button as the fallback.
  - **A real Creator build.** Its own installer/workflow with `ORLIS_MODE=creator` (and a phone
    version - a web app or a native one - which can't run Claude Code locally, so it would use
    Claude's remote control or the web); its own update channel; Mac and Linux, since Play is
    Windows-only today.
  - **Lock Player.** The hardware build sets `ORLIS_MODE=player` (it can't be overridden).
  - **Try it from the Creator app.** Send to Orlis Play and try it on the TV (the owner's Try it
    flow exists); a local preview with the laptop's webcam later. Ties in with "Try it on the TV".
  - **Creator app details:** a profile screen for sign-out only (no "who's playing"); first-run
    setup for the Dev Kit.

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


## Create Pro: Test and Publish, local to the family (done) - and Phase 2 (on hold)

Creator app, Create Pro: code with Claude, then **Test on the TV** (the game goes to the
family's Orlis Server as a *draft*; the Player app on the TV shows it in Play's **Testing** row and
plays it without keeping it), then **Publish** (the server checks it again and stores it
family-only; the Player app downloads it by itself and it sits under Play). All between the
creator's laptop and the family's own server - the owner isn't involved. "Send" is gone from
Create Pro. Server: `drafts.js` (`/api/drafts`), `mine` flag on `/api/store`. App: `ui/tv.js`, `ui/tvwatch.js`.
The TV holds one request open (`/api/drafts/wait`); the server answers only on a Test, a removal, a publish, or a creator arriving/leaving (Create Pro sends "still here" every 10s while open). Idle costs nothing. Not done: starting the game on the TV by itself on a new Test.

**Phase 2 (on hold):** submit a game to the owner, and maybe into Discover for everyone.
Creator games have more freedom, so it'd need much more testing on the owner's side - perhaps
charge for it. Not started. (The old outbox/`/api/submissions` path is still there for it.)

## The TV box: which mini PC (to revisit)

The Player app runs on a Windows PC plugged into the TV (camera tracking + drawing the games). Not
measured on real hardware yet - see "real-hardware camera check" above. What it needs: Windows 11, a decent
integrated GPU (Radeon 780M or better is comfortable), 16 GB in two sticks, 512 GB SSD, HDMI 2.0+, Wi-Fi 6
or Ethernet, 2+ free USB ports. Plus a wide-angle (~90 degree) 1080p USB webcam under the TV.
Avoid: Mac mini (the app is Windows-only), single-stick memory, a Raspberry Pi (no Windows app; WebKitGTK
and slow tracking), phones (iOS/Android would be a separate Player build - see below).

Short list (prices are rough US figures from a web search in Nov 2026 - check before buying):

| # | Mini PC | Rough price | Notes |
|---|---|---|---|
| 1 | Beelink SER8 (Ryzen 7 8845HS) | $630-800 | All-rounder, runs cool |
| 2 | Beelink SER6 Pro | $350-500 (from memory) | Older, often best value |
| 3 | Minisforum UM780 XTX (Ryzen 7 7840HS) | $500-650 | Strong graphics |
| 4 | Minisforum UM890 Pro (Ryzen 9 8945HS) | $900-1,100 (32 GB / 1 TB) | More than needed |
| 5 | Geekom A7 / A8 | $640-710 (A8) | Quiet, good build and warranty |
| 6 | GMKtec K8 | from ~$360 | Cheapest, thinner support |
| 7 | ASUS NUC 14 Pro (Core Ultra) | $430-650 | Brand-name, good support |
| 8 | Geekom IT13 (Core i9) | $600-800 (from memory) | Fast, but hot and loud |
| 9 | Lenovo ThinkCentre Tiny / HP EliteDesk or Elite Mini | $250-600, cheaper refurbished | Quiet, reliable; check HDMI is 2.0+ |
| 10 | Beelink Mini S12 Pro / EQ14 (N100/N150) | $150-250 (from memory) | Cheapest; may be too slow for tracking + rendering - buy only if returnable |
Also seen: Beelink SER9 (Ryzen 9), about $600-750.

Intel vs AMD: AMD Ryzen has stronger integrated graphics, runs cooler, better value, but smaller brands with
variable support. Intel (NUC, ThinkCentre, EliteDesk) has reliable business machines and great Windows
drivers; the Core i9 minis run hot and loud, and the N100/N150 are the weakest.

Chosen direction so far: budget-friendly AND easy to buy again in two years. So either a refurbished business
mini PC (ThinkCentre Tiny / EliteDesk with Ryzen or Core i5/i7, 16 GB, 512 GB) or a Beelink SER6/SER8. The app
isn't tied to a model, so "buying again" just means any similar Windows mini PC. Keep a short setup
checklist (Windows, Player app, Orlis Server, camera position) so a new box takes ~20 minutes.

Other devices considered: Raspberry Pi (no, see above); iPhone or Android as the TV box (maybe one day - needs
a separate web/iOS/Android Player build, with the Library and sandbox reworked; Android is the better first
try; quickest test is the app's web page in the phone's browser with the camera on). Testing games on the
laptop with the mouse as hands was considered and dropped: testing on the TV is the only way.

## Phone as a Create Pro remote (idea)

Coding can't happen on a phone (Claude Code and the game folder need a computer). But a phone signed in to the
family's server could list the games being tested (`GET /api/drafts`) and press **Publish** / **Take it off the
TV** (routes exist already) - so you can play on the TV and publish from the couch. The Create picture flow
also only needs the server, so it'd work on a phone. Test stays on the laptop (it packs the laptop's folder).
Needs a phone build or a small web page served by the Orlis Server. Coding in the cloud (Claude's own app) and
getting the game home is a bigger design (needs a way in from outside the home network) - not started.

## The dev kit: everything on the TV box, creators use their own Claude Code (design agreed, not built)

Idea: a creator (e.g. a brother with Claude Code already) is given a TV box. It runs the Player app **and** its own
Orlis Server. The creator codes with Claude Code on their own laptop, says "test it" / "publish it", and the game
goes to the box over the home Wi-Fi. Nothing goes through the owner's server. Same Wi-Fi only (no internet door,
no tunnel) - keeps it simple and safe.

- Server on the box, started at boot: it checks games (kit rules, words), packs, keeps drafts and published games,
  tells the TV about a Test (the waiting request), and holds accounts. It is the hub; each box is its own island.
- No Creator app needed on the laptop: Claude Code plus a **Claude command file** (`/new-game`, `/test`, `/publish`,
  `/take-off`, `/status`) and a small upload command (could be plain `curl` + token) that sends the game's files to
  the box. Move **packing** to the server so the laptop only uploads source (manifest + game.js).
- **Onboarding on the TV:** first start shows a short pairing code and a QR; scanning opens a setup page served by
  the box (steps, the one-line connect command, the Claude command file). Pairing code: one use, expires in minutes,
  only for creators/owner. Also covers #64 (setup link / saved address) and the phone sign-in QR.
- Create Pro app shrinks to onboarding + a status view (or is dropped for creators); the step cards stay for those who
  want a friendlier path.
- Works from a phone too: if Claude Code runs on the laptop and the phone controls it, the phone is just the remote.
  Cloud-run Claude can't reach the home Wi-Fi - not in scope.
- Needs: real Creator/Player builds (`ORLIS_MODE`), server + Player packaged together and auto-starting on the box
  (Big Picture, camera), server updates, a one-page quick start.
- Open: the kit (starter, checker) packaged outside the app; sign-in/token storage for the command on the laptop;
  whether the Player and the server are one installer or two.

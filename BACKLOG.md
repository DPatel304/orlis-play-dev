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
  has a Mode switch in Settings, for testing, and starts as `player`.** Create Pro is the old Dev Kit (Claude Code connect, build, Check and send). Still to
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

### Orlis mode on the laptop: the permission design (agreed)

The game folder (template in `app/kit/creator/template/`: `CLAUDE.md`, `.claude/settings.json`, hooks, the
orlis-game skill) already locks Claude to `game.js` and `orlis.json`, and denies Bash/PowerShell completely. For
Claude to run test/publish itself:
- A deny rule beats an allow rule in Claude Code, so the blanket `Bash`/`PowerShell` deny comes out of
  `settings.json` and the **guard hook** (`guard.ps1`) becomes the one gatekeeper.
- The guard allows a shell command only if it is **exactly** `orlis check`, `orlis test`, `orlis publish`,
  `orlis take-off` or `orlis status` - no extra words, no options, no `&&`, pipes or redirects. Everything else
  is refused. (Decided: no options at all for now.)
- The `orlis` tool takes no option that changes where it sends things; works only on the current game folder
  (reads `game.js` and `orlis.json`); talks only to the box this laptop was paired with. The box address and token
  live in the creator's user profile, outside the game folder, so Claude can't read them (the guard already blocks
  reads outside the game).
- Publishing: the `/publish` command file makes Claude **ask the creator first** (a polite ask, not a hard lock;
  decided). Worst case if Claude goes off-script: it can run test, publish, take-off or status - nothing else.
- **Windows first** (the hooks are PowerShell; Mac/Linux would need a second guard and tool).
- Order: build the `orlis` tool (standalone, built in CI) -> add the command files and update `CLAUDE.md` -> change
  the guard and settings -> extend `test-hooks.mjs`.

**Built so far (Orlis mode):** server pairing (`server/src/pair.js`: a creator gets a one-use code good for 5 minutes,
the tool trades it for its own sign-in called "Orlis tool"; wrong tries are limited) and the `orlis` command
(`app/kit/cli/orlis.mjs`: connect, check, test, publish, take-off, status), tested end to end against a real server
(`app/test/orlis-cli.test.mjs`). It bundles to one 21 KB file with esbuild
(`npx esbuild kit/cli/orlis.mjs --bundle --platform=node --format=esm`). **Still to do:** a standalone Windows
`orlis.exe` built in CI (Node single-executable) and put on the creator's PATH; the code + address shown in the
app / on the TV (QR); the command files and `CLAUDE.md` changes; the guard hook and settings change; hook tests.

## Guardrails for creators' games: start strict, loosen as trust grows (plan)

Rule: every guardrail is a switch or a number in one place (`server/src/guardrails.js` so far), each with a test that
shows what it holds back, so loosening is a one-line change. All of these were chosen for the first version.

**Done**
- TV confirms publishing: the laptop tool (the "Orlis tool" sign-in) can only ASK; the TV shows "Publish?" on the
  Testing tile and a grown-up presses Publish (a kid profile is told to ask a grown-up). Switch: `tvConfirmPublish`.
  (A person using the Create Pro app can still publish directly.)
- Rates: tests a minute (6) and publish questions an hour (10), per family.
- The trail: tested, publish-asked, publish-declined, published and taken-off are written to History (tests with the
  file's fingerprint and whether the tool or the app did it).
- Only the laptop tool's exact commands (design agreed; guard hook not changed yet - see below).

**To do, in order**
1. Guard hook + settings: exact `orlis ...` commands only; tamper check (the hooks verify the guardrail files haven't
   changed since the folder was made); command files + `CLAUDE.md`; change summaries after each edit; prompt-injection
   check extended; hook tests (Windows CI).
2. Kit/server checks: stricter code allowlist (only documented `Orlis.*` calls and plain canvas to start), smaller size
   caps, no new files/symlinks, no text input or personal info, no ads/purchases/links (payment words, URL strings),
   photosensitivity rule (limits on rapid full-screen brightness changes), sound volume and length caps, age range
   declared in `orlis.json`, scary-content flag, play-area limits (no long spinning/jumping), same list in the app, kit
   and server with a test that they match.
3. Player runtime: frame-time watchdog (a freezing/slow game is stopped with a friendly message), memory/loop limits,
   round-length ceiling, crash isolation (a game that crashes twice is pulled from Play until fixed), break reminders
   from the Player (not the game), age gating by profile age, sandbox hardening tests (no network, storage, clipboard,
   fullscreen, popups).
4. Publishing: keep the last good version so one press rolls back; a published version is never edited in place; a
   minimum number of test plays before publish; the reviewer pass (a separate Claude pass reads the game for content and
   safety and writes a report kept with each version; advisory at first); owner alerts on publish or repeated check
   failures.
5. Reports and control: "Report a problem" from the Player hides the game at once until the owner looks; owner "pause
   all creator games"; reviewer report visible in History.

## Direction undecided: widen Create, or keep Create Pro (free coding) with a forced flow (thinking)

Where it stands: Create Pro (Claude Code on the creator's laptop -> `orlis test` -> the family's TV box -> a grown-up
presses Publish) is built, with guardrails stage 1. The owner is now leaning toward **expanding the existing Create
mode** instead of leaning on free coding. Nothing decided.

**Option A - widen Create (the guided picture flow)**
- More questions and choices (moves, themes, game types, looks); still made for them, you or the maker in the loop.
- Safest; nothing to install; works for kids and parents.
- Limit: only what the flow can express - no custom logic.
- Needs: more actions/things/looks in `request.js` + `server/src/requests.js` (kept in step), maker prompts for them.

**Option B - Create Pro with a forced flow (gated)**
- Stages the server enforces in order, each tied to the file's fingerprint: brief (picture questions) -> build ->
  check + reviewer pass -> test on the TV (a grown-up plays a full round, measured by the Player) -> grown-up preview
  (name, age range, reviewer notes) -> publish (grown-up presses it). Any edit sends the game back to build. A change to
  a published game restarts at build with a change note.
- Needs: a server state machine, play time measured by the Player, the reviewer pass, a brief screen.
- Cost: slower for experimenters; the reviewer must be dependable since a failed review blocks everyone.

**Option C - both**: Create for everyone; Create Pro only for trusted people (e.g. the owner's brother), at the strict
level, loosened as trust grows.

**Questions to settle:** what can't Create make today that matters? Who is the creator (child, parent, someone who
codes)? How involved should the owner stay? What play time counts as "tested" (20 seconds or a full round)? Does a
grown-up have to play it?

**What survives any choice:** the server checks, the History trail, rate limits, the TV "Publish?" step, the Testing
row, pairing codes and the `orlis` tool (optional). Guardrails stages 1-5 (above) apply to any game that reaches the TV.

## Families: what to build (from the UI review; to revisit)

Now: one grown-up account per family (the head of household) + kid profiles (a name and a picture only) + a family
name; Sign out on the profile screen; mode, creator role and Dev Kit granted by the owner (web management page).

**Do next (decided to wait, written here):**
1. **Grown-up PIN (important).** Any child can tap the grown-up's profile on the shared TV and get grown-up powers
   (Settings, Create, and **Publish on the TV** - the guardrail only checks "is this profile a kid", so it is not a real
   lock). A 4-digit PIN asked when opening the grown-up profile or doing a grown-up action (publish, Settings, Create).
   Held by the TV app (the server can't tell who is at the TV: it sees only the family's sign-in). Needs: set/change the
   PIN (on the profile screen), lock after a few wrong tries, forgot-PIN path (the account password), tests.
5. **Kid age bands** (3-5, 6-8, 9+) instead of a birth date - keeps the "nothing else is kept about a child" promise and
   makes age gating possible (games declare an age range; the Player only offers what fits the profile). Needs: a
   field on the kid profile (server `profiles` + editor), the age range in `orlis.json`, filtering in Play/Discover.

**Other gaps seen (not decided):**
- One grown-up only: a second parent has no account of their own. Options: share the sign-in (today), a second grown-up
  profile under the same account (same PIN), or bring invites back (removed on purpose).
- Family-level settings: quiet hours / daily play limit, a camera consent notice.
- Owner view in the app (who joined, who is a creator, remove a family) - today only the web management page.
- Data and recovery: delete a child's profile and scores completely (partly there), password reset, a list of signed-in
  devices with "sign out everywhere".

## Camera: no settings, it looks after itself (done)

Settings no longer has Re-calibrate, a camera picker, Camera detail or Smoother tracking (those stay at their defaults:
standard picture, tracking on the main thread; the first camera Windows offers is used). In their place the camera is
quietly started over (`pose.heal()`, at most every 30 s, players start again, the tracker stays loaded) when no new
picture has come for 4 s (a stuck or re-plugged camera), or when nobody has been seen for 20 s in a game. Not tried on a
real camera yet. Open: a way to choose between two cameras if a PC ever needs it.

## The mascot: Cubion (decided)
The Orlis cube with arms and legs, on the shared indigo move card (`app/src/games/figure.js`).
- Name: **Cubion**. Full name: **Cubion!#&-551**, from an alien planet (the symbols are the alien way of writing it).
  Nickname: **Cubo** (said KYOO-boh).
- Say the full name out loud as "Cubion five-five-one"; show the symbols only where it is for fun (a special moment,
  a name plate), never as the name a kid has to read. Day to day, the character is "Cubo" or "Cubion".
- Not built yet: the name is not in the app. Ideas for where it goes: a line on the results screen, the how-to cards,
  the avatar list, the loading screen.
- Before launch: search the exact name (and "Cubo") in the USPTO trademark database. A quick web search found no mascot
  or mark called Cubion, but it is not a real trademark search. Other cube mascots to stay clear of: Qubo (the kids'
  channel's teal cube with a face) and Nex Playground (a cube console). "Cubby" has marks and characters already
  (CUBBY CUBE, Cubby the Bear), so it is not used.

### The move card (Cubo): how it works now
`app/src/games/figure.js`: 14 moves (reach, flap, wave, clap, hug, jump, squat, march, lean, duck, run, dance, freeze,
side). Flat Cubo on a white card with a thick indigo border, a floating shadow, sliding in from the right (0.45 s) and out
(0.3 s). Stop-motion: exactly 4 drawings per move (locked, a test enforces it) at 5 a second, each with its own face. Orange arrows lead into each move and
go away while he holds the pose; orange is only ever used for "move this way". The shell draws it for every game (`drawMoveCard` in
`app/src/main.js`); a game just answers `card()` with a move's name, or null for none. Wired into Animal Gym (all round),
Pop Party, Stack It High, Keep It Up!, Ptero Flight, Sky Painter (first 8 s), Leaf Pile (when it says Jump in!) and
Sleepy Bear (dance / freeze). Not in Castle Defense or Last Known Position (their moves change with the story).
It lives on the left, so it stays clear of the scores and the bear's cave. All the numbers are in `CARD` and `MOTION`.

## The game screen standard (written)
`app/src/games/UI-STANDARD.md`: where the clock, hint words, goal bar, scores (top left, one column), move card (top right,
26%) and one optional badge (under the card) go, who draws each, and ten rules for new games. `hudZones` / `underHud` /
`badge` in `hud.js`, with a test that the shell's areas never overlap. The HUD sits on a 20 x 11 grid (`grid.js`); the top-left corner is the game's own: coloured score pills in the first
row, then its own chips and bars (`hud().panel`, three rows). Not yet used by Last Known Position or Castle Defense (they
could swap their own displays for it). It is a standard, not a law: exceptions are written
down at the end of the file. Next steps: tell the Create flow and the creator kit's instructions about it, so a game made
in Create follows it; and have the games that place targets use `underHud`.


## The HUD grid: step 1 done, the rest to do later (decided, not built)
**Done (step 1):** a 20 columns x 11 rows grid of square cells over the whole screen (`app/src/games/grid.js`), inset a little
for TV edges. Left columns hang from the left edge, right columns from the right, anything across the middle is centred,
top rows hang from the top, bottom rows from the bottom. The clock (cols 8-11, row 0), hint words (cols 7-12, row 1), goal
bar (cols 8-11, row 2), move card (a 3 x 3 block, cols 16-18, rows 0-2), badge (under the card, cols 14-18, row 3) and the
game's corner (scores row 0, cols 1-6; chips and bars rows 1-3) all sit in fixed cells. The keep-clear zones come from the grid.

**The rest of what was decided (to build when a game needs it, not before):**
- **The frame:** the top four rows, the bottom row and one column down each side. The middle (18 x 6 cells at 16:9) is the
  game's world. 20 columns looked right in the mockup.
- **Games give back everything they do not use.** A game declares which cells it uses; the rest is its world, and only the
  declared cells are kept clear of targets. A game with no clock hands those cells back; a game with no HUD gets the whole
  screen. The frame is a ceiling, not a fixed margin.
- **Step 2: place a piece by cell.** A piece with a column, a row and a span (columns wide x rows tall): a one-cell pill, a
  horizontal bar over several cells, a **vertical bar** (new) over several rows. Something like
  `panel: { cols, rows, pieces: [ { col, row, cols, rows, ... } ] }`. First user: Last Known Position (XP bar along the bottom
  row, crystals as chips, a tall health bar down a side column, a wide notice in the fourth top row).
- **Places not yet used:** the bottom row (a team or XP bar; keep it for things not read often, it is where hands and avatars
  often are), the side columns (tall meters such as health and boost), the fourth top row (a wide notice), cells beside the
  clock (a small badge) and the free cells in the top right (more badges).
- **Held back until a game runs into trouble:** caps on cells in use (ten top left, six top right), a test that pieces never
  overlap or touch the card's block, and rules for giving rows back in steps. The standard already says it can be loosened.
- **Watch:** more freedom means more chance of clutter. The story-game mockup was already near what counts as full. Hours
  spent on the HUD are hours not spent on games kids play.

### The layout we settled on (HUD grid, "version 3")
Scores top left (row 0), the clock top centre, the goal bar (fat, three stars that light as it fills, always gold) in row 1,
the hint words in row 2, the move card bottom left (3 x 3, slides in from the left edge and out again), the one badge bottom
right. Top right is left empty on purpose (room for a notice). The first words of a round arrive big and dock; later ones
just appear. Not done yet from the same round of mockups: **dim the scores, badge and goal bar when nothing has changed for
about 3 s** (Minecraft's idea); **pictures with the hint words** (an emoji and at most three words) and **speaking the hint
once** (the app has a voice); a **HUD size setting** for the grown-up; a wider safe edge for TVs (the grid insets 1.2%, the
common advice is about 5%); and checking the big hint never covers something a player has to catch.

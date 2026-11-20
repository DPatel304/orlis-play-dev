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

### HUD follow-ups done (after the layout settled)
Score pills: a white number with a dark edge (reads on any player colour), a mark on the left (avatar, or circle / triangle /
square / diamond), two to a row. First hints: an emoji and at most four words, said aloud once. The cover from the tile now
carries the how-to card and the 3-2-1 (Cubo marches while the camera starts); pause shows Cubo frozen, results show him
cheering. The grid insets 4% from every edge. Last Known Position's level and XP moved into the corner panel. Keep It Up!'s
ball no longer goes up behind the clock and the words.
Looked at, left as they are: Pop Party's balloons rise through the top and past the bottom-left card (they are only briefly
hidden); Stack It High's blocks fall through the top; Leaf Pile's leaves can lie behind the card while it shows a jump.
Still not done: dim the HUD when idle, a HUD size setting (both held back on purpose).

### The kit knows the standard now
The creator kit (CLAUDE.md, the orlis-game skill, the starter game) teaches the shared screen: `Orlis.ui.say / goal / badge /
zones / under`, `hud().panel`, `card()`, picture-and-few-words hints, and keeping targets out of the shell's areas. The sandbox
forwards `card()` and the first hint (said once, after the words check). Not done: nothing stops a creator's game drawing its own
score or clock (it is only asked not to); a check for that could go in the guard hook.

## Storytime: a passive "game" (design decided, not built)
Shows that Orlis is more than motion games: the TV reads a story, the children watch. Create-your-own-stories (Claude writes and
draws, a grown-up or grandparent can record the voice) is **on hold** until Create mode is thought through.
- **Look:** the "bedtime" mockup's layout for every story: the scene fills the screen, the words sit in a soft plate along the
  bottom with the word being read lit up, Cubo small in the bottom-left corner reacting (his faces), a moon showing how much
  story is left. No dimming mode, no switch; a story can be day or night.
- **Platform changes it needs:** a passive game type (no clock, no score, no move card, no results: "The end" with Again / Another
  story), camera off by default, remember where each child got to, pause by remote. Stories as data (pages: scene layers, words,
  narration, sound, Cubo's face), one Story Player. Voices: recorded for the flagship (the Nova pipeline), the computer's voice as
  the fallback. Three minutes, about 400 words, 8 or 9 pages.
- **First story, fixed (no kids in it): "Cubion's Long Way Home".** Funny, plain prose, one repeating line:
  **"Cubes don't do that. But Cubo does."** Cubion!#&-551 comes from the Cube Planet, where everything is perfectly square and
  still because moving would mess up the tidiness. The Cube Elders (a row of tall, stern cubes who click; the narrator translates)
  send him on purpose to Earth, where everything wiggles, to learn to move. He lands with a thud and is taught by the Animal Gym
  animals: giraffe (stretch), bunny (hop), bird (flap), frog (squat). Each lesson: the animal shows, Cubo tries, a slapstick fail,
  a tiny success, the refrain. He learns that everyone wobbles, and that is the fun of it. He decides to stay and live in the TV
  with the children; the last page has Cubo waving from the corner and a button into the games. The title pays off: it was a
  long way home, just not the way he planned.
- **Joining in:** gently, no camera needed: four moments (reach, jump, flap, squat) where the move card shows and Cubo does it;
  anyone can copy him, nothing is checked or scored.

## Storytime: built (first cut)
- **Story Player** (`app/src/games/story-player.js`) plus the first story as data (`app/src/stories/cubions-long-way-home.js`): a scrolling storybook. Cubo stays put on screen and the world slides behind him; words stay on a fixed plate with the current word lit; a moon shows how much story is left.
- **Passive game type** (`game.passive`): the shell keeps the camera off, skips the lost-player check, 3-2-1, score/clock/week report, and ends on "The end" with Cubo waving and Read again / Home.
- Narration uses the app's voice (the computer's, for now); a beat ends when the voice stops (or after reading time with sound off). Move cards at the four animal stops; anyone can copy, nothing is checked. The refrain gets a pause after it for the kids to say it.
- `?beat=N` in the address starts the story at beat N (for looking at a scene).
- Still to do: recorded voice for this story and "your own voice" (grandparent) option; Elders' clicks are the shell's tick for now; real hardware/TV check; more stories (pages format for room-bound stories, other formats from the ideas list). Create-your-own-stories stays on hold.

## Save the Harvest: built (first cut)
- Co-op, Orchard-style (`app/src/games/save-the-harvest.js`): spin a wheel (apple / pear / strawberry / raven's feather); everyone does the move that picks it (reach / hop / squat) and two fruit fly into the basket; a raven round hops him two steps closer and everyone flaps to shoo him back one. Nothing to lose: if he reaches the tree he nibbles one fruit back on and hops home. Ends when the basket is full (he gets the last apple).
- Uses the shell's standard pieces: move card, goal bar (the harvest), the corner panel (the raven's distance), the hint words. Moves come from Animal Gym's detectors (`triesOf`) and the jump watch; a fast hand counts with the mouse.
- `?game=<id>` in the address now goes straight into any game (for looking at one).
- Still to do: playtest on a real camera and TV (how many tries a round needs; whether a good effort should be required), recorded voice for the hints, the other board games from the mockups (Race to the Treasure with the lean vote is next), and a shared board kit once the second one exists.

## Leaf Pile: one slow, steady pile
- One pile for the whole game: it grows a little with every leaf (a small heap to a really big one, never quite full), and "Jump in!" only comes at the end (the last 24 seconds). The whole pile bursts and the leaves rain down for a few seconds, then it's over. Goal bar: three stars up to a 120-leaf pile; the hints cheer at a third, two thirds and the big one.
- To tune on a real camera: how fast the pile grows (`GROW`), how many leaves fall, and whether the last 24 seconds is the right time to jump in.

## Asset library for Create (step 1 of 4: built)
Decision: games made in Create are built only from a curated library (kids and families; the Orlis owner is the only approver of new pieces; no custom-art lane for now). Plan:
1. **Library and draw API** (done): `app/src/games/assets/` - 118 pieces drawn in code in the house style (Cubo with his 14 moves and faces, 38 animals, food, nature, things and places, props like a chest, basket and beach ball, effects, and 6 whole-background scenes). A game calls `Orlis.assets.draw(c, 'giraffe', x, y, size, opts)` and `Orlis.assets.scene(c, W, H, 'meadow', { t })`; a name that isn't there draws a "?" box and is recorded in `Orlis.assets.missing`. The creator skill lists every name (generated by `kit/build-creator.mjs`).
2. **Library only, enforced** (done): a game made in Create is given a locked canvas (only save/restore/translate/rotate/scale/globalAlpha; `c.fillRect` etc. throw "use Orlis.assets"), `Orlis.assets.text` for a few words, new `hand`, `dot`, `ring` pieces, the starter game rewritten on the library, and a static check (`kit/creator/drawing.json`) in the app's check, the creator hooks and the server that turns away raw-drawing calls and ways to a canvas of its own.
3. **Request a picture**: a button in Create, a queue entry (same queue as "Request a game"), the owner's approve screen, a status for the creator.
4. **Pin the runtime** (optional hardening): the lock lives in the runtime packed in front of the game's code, so a hand-made .orlis that carries its own runtime could skip it. The owner's try-before-approve is the real gate for those; to close it, the app would run its own runtime in front of the game's part (everything after `Orlis.manifest=`) instead of the file's, and the server would check that part only.

## Create games are descriptions, not code (behaviours, Phase 1: built)
Decision: games made in Create are built only from ready-made words - pieces from the asset library, movements, triggers and results - and are no longer programs. The admin builds games freely and adds words to the vocabulary as ideas need them.
- `Orlis.play({ ... })` (strict JSON) replaces `Orlis.run` for Create games. `game.js` is that one call; the check requires it, parses it, and validates every word with a "did you mean...?" (`app/src/games/play/`: `vocabulary.js` the words and their plain descriptions, `validate.js`, `engine.js`, `env.js`, `examples.js`).
- Vocabulary today: movements fall, rise, drift, bob, wander, bounce, stay; triggers touched, swiped, leftScreen, lands, age; results score, sparkle, pop, vanish, grow, become, sound, say, spawn, kickUp, celebrate; goal bar, team scoring, move card, hint words, appears-faster-over-time.
- Proved on three games: Catch (the new starter), Pop and Keep it up (`examples.js`, also in the creator skill, generated from the engine so the docs can't disagree).
- Code is turned away: `Orlis.run(`, `=>`, `function`, `class ` join the drawing checks (app, the creator hooks, server); the canvas is still locked. Built-in games (Pop Party, Leaf Pile, ...) are unaffected and stay code.
- **To add a word:** put it in `vocabulary.js` (with its `doc`), make the engine do it (`engine.js`), teach `validate.js` if it takes a value, add a test - then `node kit/build-creator.mjs` so the skill lists it (a test fails if the engine doesn't know a word the vocabulary has).
- Phase 2: "Request a behaviour" (same queue as "Request a picture"). Phase 3: widen the words - follow/chase a hand, timers and stages, lives-free progress, collecting into a basket or pile, music beats, unlocking pieces by playing.
- The creator hook (PowerShell) checks the shape and the JSON; the full word-by-word validation runs in Orlis Play's Check/Try it (and the maker). A later step could generate the word lists into the hook so Claude Code hears "did you mean" while it works.

## Orlis look: the style kit (planning only - nothing is built yet)
**Decision:** Last Known Position is the reference look (the style the owner has spent the most time on). Meadow games (Pop Party, Leaf Pile, Keep It Up, Stack It High, Sleepy Bear, Animal Gym) are on a shared flat scene; Save the Harvest, Ptero Flight, Castle Defense and Sky Painter each have their own plainer look. The plan is a shared style kit that creators and the asset library build from. It is designed and agreed on paper first; no kit code until the design is settled.

**Rules the kit must follow (so the graphics can be upgraded in three years):**
1. Games say what and never how: names and meaning (`scene('meadow')`, `draw('giraffe')`), never canvas drawing. Our own games move to this over time.
2. Every asset carries its own facts apart from its picture: size, ground point, hit area, colours by role (main / shadow / accent), plus a depth slot that v1 ignores.
3. The look is a swappable, versioned skin (palette, light direction, haze, outlines, HUD style); the renderer sits behind a small interface.
4. A game records the skin version it was made for; most upgrade automatically, a game that depends on the old layout can stay pinned.
5. Asset names are stable forever; only the picture changes (same idea as word versioning in the behaviour engine).
6. Reference screenshots per asset and scene per skin, so a skin change shows exactly what moved.
Limit: a move to true 3D is bigger than a repaint; games that compute from pixels (Last Known Position) are the last to move.

**Order of work:** (1) write the rules of the look from the real code and screenshots (palette, light, shape language, haze, outlines, HUD) as a one-page style sheet; (2) fix the rough spots in LKP first (oversized foreground tree and rock in the climbing scenes); (3) prove the rules by re-skinning Pop Party's scene (does it belong with LKP and still read for toddlers? a brighter second palette in the same style may be needed); (4) only then extract the kit, with tests.

**Open design questions:** how bright/saturated the party games may be; one skin or a "calm" and "party" palette in one style; how much of the faceted-prop language the asset library takes on; the HUD in one look; where the depth slot lives; how a creator's game picks a skin version; what is checked by screenshot.

### Style kit: owner's answers (planning)
- **Reference:** Untitled Goose Game and Katamari Damacy (soft haze, chunky rocks and trees, simple characters). LKP is already that look; it is a versatile look, not a toddler look.
- **One palette** for everything. Consistency comes from the palette (like Roblox / Fortnite); every view is welcome (side-on, top-down, perspective, third person).
- **Creators can never make new assets.** A description is only ever matched to what is in the kit; creators work on gameplay and camera angles. Only the owner (with Claude) adds to the kit, which may grow large. "Request a picture" stays the way a creator asks for a missing one.
- **Establish the look now and redraw every existing game from it** (Pop Party and the meadow games, Save the Harvest, Ptero Flight, Castle Defense, Sky Painter, the asset library's emoji pieces and free-hue balloons).
- **One HUD** (the invisible-rows one) in every game; Last Known Position has to be moved onto it.
- **A checker for the kit:** an asset using a colour outside the palette, or breaking the light direction, is rejected automatically.
- **Assets are shapes with colour roles**, not fixed colours; shading comes from the skin's light direction.
- **Next steps:** (1) extract and lock the palette; (2) settle the asset format (code, data shapes, or painted sprites); (3) move LKP onto the standard HUD.

## Orlis + iPads (the bigger vision) and the move to 3D - planning only
**Vision (owner):** Orlis today is one PC plus a webcam on the TV. Add an Orlis iPad/iPhone app: up to four iPads (in a gamepad-style grip) used as controllers with their own screens, like Zelda: Four Swords Adventures (GameCube + four GBAs) - a shared TV plus a private screen for each player. This is why 3D now makes more sense: the same world can be shown from a different camera on each device.
**Decisions so far:** go toward 3D, Roblox/Minecraft level of graphics (low-poly, flat-shaded, one palette, runs on many devices; higher-end devices are an acceptable target). A locked camera can still make 2D-style games. Existing games need not be kept as they are: only Pop Party is ported first, then new games. Creators only place kit assets by name and choose the camera; they never make assets.
**Architecture notes:**
- The game's rules run on the host (the Orlis PC); iPads send touches / buttons / (later) motion and render their own view of the shared world. The game contract already keeps `step` (rules) apart from `draw` (picture), and tests run `step` with no canvas, so this separation mostly exists.
- iPad app: build it with the same web code so the 3D kit and the sandbox are shared. Start as a web page opened in Safari (pairing by code or QR on the TV; MFi/USB-C controllers work through the Gamepad API), then wrap it (Capacitor) for the App Store / TestFlight when it's worth it. Local network only keeps family data in the house.
- 3D engine candidate: three.js (small, flexible, runs in the Tauri webview and in iPad Safari).
- Later: an iPad's own camera could track its own player (the "phone as camera" idea), lifting the single-webcam limit.
**Order of work:** (1) 3D spike - five flat-shaded assets (tree, rock, balloon, Cubo, one animal) and one hazy scene in the one palette; compare against the 2D look from two or three camera angles; measure performance on the PC with the pose model running and on a real iPad; (2) iPad as a controller prototype (pairing, a few buttons, a private screen); (3) port Pop Party to 3D, with a locked camera, as the proof; (4) one Four-Swords-style game (shared TV plus private iPad screens). Then the palette roles and the kit proper.

### Orlis Box, Orlis Pro, and the six-month goal (owner's answers)
- **Same room first.** Online play is not wanted for now (it cuts against kid-friendly, family play); keep it possible much later only. LAN-party style (4 boxes x 4 controllers = 16 players in one house) is a wanted possibility.
- **iPads are optional in general; a game declares what it needs**, like Steam's VR tags: no Pro controller, optional (1 to 4), or requires 4. The store shows it as a badge.
- **Orlis Pro:** the owner sells a controller grip (the picture: a gamepad shell around an iPad); people buy their own iPad and install the Orlis app. What the iPad does depends on the game: a controller, a map, a private place for cards, a drawing pad, and so on.
- **Orlis Box:** a ready-made box the owner sells, plus a webcam. Hardware not chosen (Windows PC likely; not necessarily Windows). Body tracking stays the identity of Orlis and a must.
- **Artists:** not planned, not ruled out; the kit should accept model files (glTF) from the start.
- **Six-month goal:** Orlis runs on an Orlis Box with a webcam; Pop Party plays on it; the look and the asset kit are finalised; an Orlis iPad app complements the box with a role that depends on the game.
- **Design notes:** a game package has two small programs, one for the TV (host) and one for the iPad (pad), both sandboxed, talking through the host; game messages must not care whether the link is the same box, the home network, or (much later) the internet; do not hard-code "one box, one host" so four boxes can join; hardware choice waits for measurements (3D plus body tracking on candidate boxes); check Apple's rules for selling an iPad accessory (MFi), and App Store rules for kids' apps and wrapped web apps.
- **Milestones (draft):** M1 3D spike + decide + measure; M2 palette, look and kit format; M3 Pop Party in 3D on the kit; M4 iPad link, controller and private-screen demo; M5 Orlis Box hardware chosen, boots into Orlis, updates; M6 polish and playtest.

### One box, up to 16 Orlis Pro controllers; the iPad floor
- **One Orlis Box with up to 16 iPads is feasible** if each iPad mainly sends inputs and draws its own small view from shared state (the box never streams video). The limits are the Wi-Fi (a decent router, ideally shipped with the box), how a game uses 16 players on one TV, and body tracking, which stays for a few people at a time. A game declares its own maximum. Four boxes together is then optional and later.
- **Joining:** a code or QR on the TV, a name and colour per player, shown with the player's avatar.
- **iPad floor (proposal, to confirm against Apple's current lineup):** by chip, not by year: A14 Bionic or newer; the official Orlis Pro target is the iPad mini class (the picture's shell size), from the iPad mini 6 (A15) up. One shell size means one product. Keep one used iPad mini 6 as the floor test device.
- **The floor sets a budget for the kit** (triangles, draw calls, effects) so a scene that runs on the iPad floor is easy on the box; the box is then chosen for 3D at TV resolution plus body tracking.

### Orlis as a platform (owner's intent) and devices
- **Orlis is a console/platform.** Motion is the main focus and the identity, but a game does not have to use it. Games declare their inputs (motion, a pad, either, both), and the platform API must never assume body tracking.
- **Free games, and a community that builds and shares games** (the pull toward Steam and Roblox). The differentiators: same-room play, motion, and a kit-only creator pipeline that keeps the visuals family-safe.
- **Phones as well as iPads:** "give the kids mom or dad's old iPhone" is a selling point. Two tiers: (1) *controller tier* - any phone or tablet with a modern browser: touch buttons, tilt, private text and cards; (2) *full-view tier* - a newer chip (A14 or newer) for a private 3D view or a map. Phone grips are different sizes, so the Pro shell stays iPad-mini-first.
- **Spike scope:** skip the iPad for now; the owner's iPhone 11 is the extra data point (below the A14 floor, so a pessimistic reading).

### 3D spike - first result (owner's Legion 5, RTX 3070 Laptop, small pane 638x568, shadows on)
x1: 165 fps, 117 calls, 25k triangles; x4: 165 fps, 293 calls; x16: 163 fps, 962 calls, 43k triangles (worst frame 12 ms). 165 fps is probably the display's refresh cap, so the GPU had headroom we have not found the end of. Not yet measured: full-screen 1080p/4K, with body tracking running, on the integrated AMD GPU (the floor case), on the iPhone 11. The owner's reaction to the look is still to come.

### 3D spike round 2 - result (Legion 5, RTX 3070 Laptop, 1920x1230, shadows on)
x1: 165 fps, 198 calls, 63k triangles; x4: 165 fps, 430 calls, 81k; x16: 128 fps, 1358 calls, 152k (12 ms frames). The first sign of strain is the draw-call count, not the pixels. **Kit rule:** assets are merged into one mesh each and repeated props are instanced; a typical scene stays within a few hundred draw calls (this protects the weak devices, which are more likely to be limited by calls). Still unmeasured: the integrated AMD GPU, the iPhone 11 with Low Power Mode off, body tracking running at the same time.
Look: owner said round one's shapes were the main problem and the lighting needed work (references: Untitled Goose Game and Katamari Damacy). Round two uses chunky rounded forms, ambient-heavy light and soft shadows; the owner's reaction to round two is pending.

### Preparing for an artist (kit design requirements)
- The kit accepts model files (glTF/GLB) as well as code-made assets, behind the same stable names, so an artist's asset can replace a code-made one without any game noticing.
- Artists paint with named palette roles (material slots such as "foliage mid", "rock shadow"); the kit substitutes the real colours, so the palette stays enforced and a later palette change restyles their work too.
- An artist spec (one page): 1 unit = 1 metre, origin at the feet, which way it faces, triangle limits by asset type, one mesh and few materials per asset (the draw-call rule), naming, and animation names (idle, walk, wave) with one standard skeleton for characters.
- A style sheet with reference assets (the round-two giraffe and Cubo) and the written lessons: rounded chunky forms, ambient-heavy light, soft shadows, accents more saturated than the world.
- A checker and a viewer: drop in a file, get pass/fail (size, materials, triangles, naming) and a picture under the kit's lighting from the standard cameras.
- Business side (the owner's): an agreement that gives the owner the work, source files kept in the repo, a small paid trial asset first; hire for props before animated characters.

### Decision: 3D kit, mostly flat-looking games
Most games stay 2D-looking (a locked side-on or top-down orthographic camera); the kit and engine are 3D-capable so a true 3D game can come later without an overhaul. A game declares its view: flat (side or top) or free. In a flat view the game's rules stay in 2D screen coordinates (so existing game logic can be reused) and only the drawing becomes 3D assets placed on the play plane, with a depth slot for parallax. A body-tracked hand lands on that plane exactly as today. Full 3D hand targeting is deferred until a real 3D game needs it.
Next slice: Pop Party in the new look with a side-on camera, the mouse as the hand, the existing balloon rules reused.

### Cheaper rendering for flat games (later optimisation, design for it now)
A game that declares a flat view lets the engine pick a cheaper path with no change for game authors: bake the static backdrop into a few parallax layers; pre-render assets into sprites from the fixed camera; blob or baked shadows instead of shadow maps; an orthographic camera culled to the view; merged and instanced meshes; a 30 fps cap and lower render resolution for calm scenes or weak devices. Costs: lighting changes need a few baked versions or a tint; sprites can look soft and use memory; one more build step. Build it only when floor-device measurements show it is needed. Design for it now: assets render identically from a fixed camera, and each scene records its camera and which parts never move.

### Revised decision: two renderers, one design language (supersedes "3D kit, mostly flat-looking games")
After the Balloon Pop 3D-flat spike (round 3) the owner found it a clear downgrade from the current painted 2D game. Decision (proposed, owner's reaction pending): keep the painted 2D renderer as the main one for flat games (about 80% of games; it is the best-looking, lightest, and already built), and add a 3D renderer for truly 3D games and for iPad views that need another camera. The kit's asset registry keeps one name per asset with a 2D version, a 3D version, or both, and a game declares its view so the platform picks the renderer; games still say what, never how. Consistency comes from a shared design language (one palette, light direction, shape language, characters such as Cubo), not from one technology (like Mario's 2D and 3D games). 3D versions of assets are made on demand; a 2D version may be rendered from a 3D model where the look allows. The flat-camera-on-3D idea stays only as a possible optimisation. Spike files in `spike3d/` are throwaway evidence.

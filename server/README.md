# Orlis Server

The Orlis Play server for one home: accounts, kids' profiles, invites, and
the Store. It runs on a laptop and answers **only devices on the same
home Wi-Fi** - it is not on the internet.

## On the laptop (Windows 11)

1. Download **Orlis-Server.exe**:
   https://github.com/dpatel304/orlis-play/releases/download/server/Orlis-Server.exe
2. Make a folder for it, such as `Documents\Orlis Server`, and put it there.
   Its data goes in an `Orlis Server data` folder beside it.
3. Double-click it. It runs quietly: the Orlis cube appears by the clock
   (the system tray - it may be under the ^ arrow). **Double-click the cube
   to manage the server** (every family, who's a creator, the Store's
   games, backups - in the browser, on this laptop only). Right-click it for
   the log, the data folder, Restart and Quit. **It starts with Windows**
   from then on, by itself, whenever you sign in: no need to remember it.
   To stop that, right-click the cube and untick **Start with Windows**
   (or switch it off in Task Manager > Startup apps).
4. If Windows Firewall asks, tick **Private networks** only (not Public).
   Your home Wi-Fi should be set to Private: Settings > Network & internet >
   Wi-Fi > your network > Private network.
5. The first account made becomes the **owner** (you). After that, joining
   needs an invite code from the owner. For now, everyone who joins is a
   **creator** (they can make games); on the management page you can make
   anyone a player instead.

## Creators who live somewhere else

**From their own home, with Tailscale (no visit needed).** Tailscale is a
free app that links computers privately over the internet. Set it up once:

1. On this laptop, install Tailscale (tailscale.com/download) and sign in.
   The management page's Overview then shows **Tailscale is on**.
2. Share this laptop with them: Tailscale's admin console > Machines > this
   laptop > **Share**, and send them the link. (Sharing one machine is free.
   They can reach this laptop only - nothing else on your network - and it
   can't reach into theirs.)
3. They install Tailscale, sign in, and accept the share.
4. They install Orlis Play. It finds this server over Tailscale by itself,
   and they **make an account with no invite code** - being shared this
   laptop is the invite. They're a creator straight away, in a family of
   their own, and the History says they joined from away.

After that it all works from their home: making games, **Check and send**
(straight to your approval queue whenever this laptop is on), and your OKs
and notes. If this laptop's off, their games wait on their PC and go in by
themselves later. Windows' firewall: Tailscale counts as a Private network,
so ticking "Private networks" when Windows first asked already covers it.

**Without Tailscale.** They set up at your house, once, on your Wi-Fi, with
an invite code. At home they stay signed in and make games as usual:
**Check and send** keeps the game on their laptop ("It'll send by
itself..."), and the next time they're at your house with the app open, it
goes in by itself within a couple of minutes. A change made at home gets the
next version number by itself, and their Create tab shows how each one went
as of their last visit.

On your own Wi-Fi, joining always needs an invite code, so a visitor on the
Wi-Fi can't just make an account.

## On the internet, with Tailscale Funnel (only this laptop needs Tailscale)

Funnel gives this laptop a public `https://….ts.net` address, so family can
reach Orlis from anywhere with nothing to install but Orlis Play. Your home
network isn't opened: Tailscale on this laptop reaches out, and hands the
requests in.

Orlis Server has an **internet door** for this: port 47872, which only this
laptop can reach. Everyone who comes in through it counts as the internet -
never you, never the home Wi-Fi, never Tailscale - so the management page and
your owner key don't work through it, and joining needs an invite.
**Always point Funnel at 47872, never at 47871** (the main port trusts this
laptop).

1. Tailscale installed and signed in on this laptop, and Orlis Server updated
   (the internet door came in with this version).
2. Optional, but a good idea: the address shows this laptop's name and is
   public, so rename it first - Tailscale's admin console > Machines > this
   laptop > Edit machine name, to something like `orlis`.
3. In PowerShell, run:

       tailscale funnel --bg 47872

   The first time, it shows a link to turn on HTTPS and Funnel for your
   Tailscale account: open it, allow it, and run the command again. It then
   prints the address, like `https://orlis.your-name.ts.net/`. `--bg` keeps it
   on, across restarts too.
4. Check it from a phone on mobile data (not your Wi-Fi):
   `https://orlis.your-name.ts.net/api/hello` should show a line starting
   `{"app":"orlis"`.
5. Family: in Orlis Play, **Type an address instead**, paste the address,
   and join with an invite code from you.

`tailscale funnel status` shows what's on; `tailscale funnel reset` turns it
off. Settings: the door's port is `internetPort` in settings.json (or
`ORLIS_INTERNET_PORT`); `0` or `false` turns it off.

## The Store

The games in the Store are the `.orlis` files in `Orlis Server data\games`.
The server comes with **Pop Party** and puts it there the first time it runs.
To add a game, put its `.orlis` file in that folder; to take one out of the
Store, delete its file (it won't be put back). A newer version of a game
replaces the older one. Orlis Play's Store lists them; downloading one puts it
on that PC's home screen, playable with the server off.

## Backups

The server backs up the family's things into `Orlis Server data\backups`:

- **What:** the accounts, the kids' profiles, invites and sign-ins
  (`orlis.db`), and the Store's games (`games\`).
- **Not in them:** what each PC keeps for itself - its downloaded games,
  scores and settings.
- **When:** once a day at a quiet moment (a week of them is kept), before
  every update, and whenever you pick **Back up now** on the management page
  (double-click the cube > Backups).
- **Restoring:** on the management page, pick a backup's **Restore** (twice). The
  server restarts with the data as it was then; what it had a moment before
  is kept as one more backup, so a restore can be undone.

For a copy somewhere else (a USB stick), copy the `Orlis Server data`
folder with the server quit.

## Updates

It keeps itself up to date. As it starts, and every few hours, it checks
GitHub for a newer Orlis Server. It only takes one signed with Orlis Play's
own update key, the same as the app's updates. When it finds one, it waits
for a quiet moment (nobody using it for a couple of minutes), copies the
family's data to `Orlis Server data\backups` (the last three are kept), swaps
the new exe in, and restarts in a new window. The data stays as it is.

What it's doing goes into `Orlis Server data\server.log` (right-click the
cube > Show the log). If the server ever stops by itself, it starts again
a few seconds later.

Checking for updates is the one thing it does on the internet; nothing on
the internet can reach it. To turn updates off, set the environment
variable `ORLIS_NO_UPDATE=1`.

## How it stays private

- It listens on the home network only; the router keeps the internet out, and
  nothing is forwarded to it.
- Orlis Play finds it with a Wi-Fi broadcast, which never leaves the home.
- Passwords are kept as scrypt hashes, sign-in tokens as hashes too.
- Accounts are for parents and guardians (18+). Kids are profiles: a first
  name and an avatar, nothing else.

## For development

    npm install
    npm test                 # the tests, against a real server
    npm start                # run it from the code (data in ./data)
    node build-exe.mjs       # build the single program file into dist/

Ports: 47871 (the app talks to it here), 47870 UDP (Wi-Fi discovery).

# Easier first-time setup (#64): setup code, saved address, sign-in from a phone

Status: **proposal for the owner** (2026-11-23). Spec and mockup only; no app or server code changed.
Mockup: `docs/setup-mockup.html`. Related: 0044 (profiles on the server), 0045 (clean menus; its answer 3 says typing on the TV stays "for now";
this is the "for later"), BACKLOG "dev kit" (pairing code and QR on the TV).

Sources read: `app/src/ui/account.js`, `app/src/ui/home-server.js`, `app/client/src-tauri/src/main.rs` (`find_servers`),
`server/src/{discovery,api,app,main,pair,supervisor,manage-page}.js`, `server/README.md`.

---

## Today

### 1. Installing the server (the owner, on a Windows laptop)
1. Download `Orlis-Server.exe` from a GitHub release link (in `server/README.md`), make a folder, put it there, double-click.
2. Windows Firewall may ask: tick **Private networks** only. The Wi-Fi itself must be set to *Private* (Settings > Network).
3. It runs quietly: an icon by the clock (maybe hidden under the ^ arrow). Double-click = management page (opens only on that laptop,
   with a key the icon passes). Right-click = Manage, log, data folder, Restart, Start with Windows, Quit. It starts with Windows.
4. The laptop's Wi-Fi address (for example `http://192.168.1.20:47871`) is shown on the management page, Overview, and in the log
   window. It is **not** in the icon's menu, and nobody is told to look for it.

### 2. The first owner account
The TV app asks the server `GET /api/hello`; a server with no accounts answers `setup: true`, and the app shows **Set up Orlis Play**:
email, password (8+), username, typed **on the TV** (remote or keyboard). `POST /api/signup` makes that account the **owner**.
Whoever signs up first owns the server: nothing proves they are the person who installed it (pain point 6).

### 3. How the TV app finds the server (`account.js` `look()`, `main.rs` `find_servers`)
In this order, stopping at the first that answers `/api/hello` (4 second wait each):
1. **The saved server** (`localStorage orlis.account` > `server.url`). It is saved when connecting; it stays after Sign out.
2. **`HOME_SERVER`**, a built-in internet address (the owner's Tailscale Funnel).
3. **The Wi-Fi call-out**: a UDP broadcast "orlis?" to port 47870, sent three times over about 1.5 seconds (also to this PC itself and to
   machines shared over Tailscale). The server answers with name, id and port.

Once signed in, the TV does not look at all on later starts; it plays offline and only talks to the server when it needs to. If a
call fails (the laptop got a new address from the router), `findAgain()` broadcasts once a minute and matches the server by its **id**,
then keeps the new address. So **"the address is remembered and tried first" already exists**, partly. What is missing: it is only used on
the signed-out path, a dead saved address costs a 4 second wait before discovery, and the screens never say which server is remembered.

### 4. A second TV, and a family member
- **A second TV (same grown-up):** install the app, it finds the server, **Sign in**: type email, Continue, type
  password. Typing on a TV remote is slow. Ten wrong passwords for one email pauses that email for 15 minutes.
- **A family member joining:** the owner (or any parent) makes an **invite code** (`POST /api/invites`, in the app or on the management page)
  and tells them. They install the app, type email, then password, **the invite code**, username, all on the TV. (Over Tailscale no
  invite is needed; in an optional mode they ask and wait for the owner's OK.) Kids never sign up; they are profiles on a grown-up's account.
- **Forgot password:** the owner sets a new one on the management page, Families.

### 5. When the TV can't find the server
The screen says **"Can't reach your Orlis server. Check this PC is online. It'll keep trying."**, retries every 8 seconds, and has **Try
again** and a **Type an address** line that is *collapsed* inside a `<details>`. So yes, an address can be typed (`serverUrl()` adds
`http://` and the port 47871), but:
- the message blames "this PC"; the usual cause is the **laptop** (asleep, Wi-Fi switched, server not running);
- hardly anyone knows the laptop's address, and it is not in the icon's menu;
- typing `192.168.1.20` with a remote is where people give up.

Why discovery fails in real homes: a UDP broadcast is blocked by guest networks and "client isolation", some mesh/ISP routers, Windows
Firewall set to Public or a dismissed prompt, a VPN on the TV PC, or the laptop being asleep or on another network.

### 6. Where people get stuck (biggest first)
1. **Typing on the TV:** email, long password, invite code, address. The slowest, most error-prone step, repeated for every new TV.
2. **"Can't find it" is a dead end:** the typed address is hidden, the address is hard to get, the advice points at the wrong machine.
3. **The laptop's address and the owner's steps are not where the owner looks:** README steps (Private network, firewall) are easy to
   miss; the icon's menu has nothing for "add a TV".
4. **Invite codes are one more thing to type and pass around.**
5. **Lock-out:** 10 wrong passwords pauses an email for 15 minutes for everyone, including the real owner; anyone on the Wi-Fi can do it
   to a known email (`/api/signin` keeps tries per email, not per device).
6. **First account is a race:** a stranger on the same Wi-Fi who opens the app before the owner does becomes owner. Unlikely, but
   it is the only moment the server trusts anybody.

---

## Proposed

Three small changes. Same Wi-Fi only; nothing goes through the internet; no new accounts or services.

### A. The address is remembered, and shown (app only, small)
- Keep the order **saved > built-in home server > Wi-Fi call-out**, but run the saved address with a **1.5 second** wait and the Wi-Fi
  call-out **at the same time** (first good answer wins), so a changed address costs nothing.
- Say what is happening: "Finding **the Patel house** Orlis..." when a saved name exists.
- A **typed** or **code-found** address is remembered the same way as a discovered one (it already is, via `connect()`).
- Matching by server **id** stays (so a new address from the router is picked up silently).
- Leave out: mDNS / `orlis.local` names (a new service on both sides); a history of servers.

### B. "Set up a TV": a setup code on the server (new, small)
**Server side.** The icon's menu gets **Set up a TV** (opens the management page, a new top card on Overview, local only). It shows:
- **Server number**: the last two numbers of the laptop's Wi-Fi address, e.g. `1.20` (the TV fills in the first two from its own address).
- **Code**: 4 digits, new every time, **good for 10 minutes, one use**. Shown big, with a countdown and a **New code** button.
- A **link and QR for a phone**: `http://192.168.1.20:47871/tv`. A phone on the Wi-Fi that opens it and signs in as the owner sees the same
  code (so a grown-up on the sofa can read it off their phone).

**TV side.** The "Can't find it" screen becomes (big text, number pad on the remote):
> Can't find your Orlis. On the laptop, click the Orlis icon by the clock, then **Set up a TV**. Type what you see.
> `192.168.` [ 1 . 20 ]   Code [ 4 8 2 1 ]   **Connect**

and keeps "Type the whole address" as a small second choice (for other networks). A wrong or old code says "That code has run out. Get a new one
on the laptop." The old "Check this PC is online" sentence becomes "Is the laptop on, with Orlis by its clock?".

**What the code is for, plainly:** it lets the TV reach and name the server without anyone knowing an IP address, and it shows someone is
at the laptop. It is **not** a password and gives no powers: after it, the TV still has to sign in (C, or typed). It also cures pain point 6:
**the first owner account on a fresh server needs a current code** (the app asks for it on "Set up Orlis Play"), so a stranger without
sight of the laptop's screen can't claim the server.

### C. Owner sign-in without typing on the TV (new)
**On the TV** ("Sign in" screen, replaces the first step; typing stays as "Type it here instead"):
> Sign in with your phone. [QR]  or open `192.168.1.20:47871/tv` and type **KP7-2MX**.  Check number: **58**

**On the phone** (a page the server serves at `/tv`, mobile layout, any browser, no app):
1. Opens from the QR (code filled in) or after typing the short code.
2. If not signed in on the phone: email + password (phone keyboard, password manager). Uses the existing `/api/signin` and its limits.
3. Then **"Sign in the TV 'Living room' (Windows PC)?"** showing the **check number 58** to compare with the TV; **Yes, sign it in** / No.
4. Phone shows "Done". The TV says **You're in** and goes on to Who's playing.

**Technically.** The TV asks for a *link*; the phone approves it with its own session; the server makes a **new session for the TV** (a normal
device session, so Sign out works as today). The phone's own token is never copied or sent.

### Server: new endpoints (JSON under `/api/`, none open through the internet door)
| Endpoint | Who | What |
|---|---|---|
| `GET /api/hello` (exists) | anyone | add `tv: true` once the server can do links, so older servers fall back to typing |
| `POST /api/tv/code` | local owner (management page) or signed-in owner | make a setup code `{ number, code, expiresIn }`; replaces the last one |
| `POST /api/tv/claim` `{ code }` | TV, no sign-in | check a setup code; returns `{ ok, id, name }`. One use. Used by "can't find it" |
| `POST /api/link/start` `{ device }` | TV, no sign-in | start a sign-in link: `{ id, code, check, pollKey, expiresIn }` (`pollKey` secret to that TV) |
| `GET /api/link/:id` with `X-Poll-Key` | that TV | `{ state: 'waiting' }` or, once approved, `{ state: 'in', token, account, household, profiles }`, **once**, then the link is gone |
| `POST /api/link/lookup` `{ code }` | phone, signed in | the device name and `check` number for a code (so the phone can show them) |
| `POST /api/link/approve` / `decline` `{ code }` | phone, signed in | approve (needs the phone's Bearer token), which makes the TV's session; or decline |
| `GET /tv` | anyone on the Wi-Fi | the phone page (one HTML page, same look as the app) |

Storage: **in memory only** (like `pair.js`, the model for all of this: same alphabet without 0/O/1/I, same wrong-try counter).
No database change. A restart cancels any open code or link; the TV just shows a new QR.

### App: what changes (`account.js`; `session/qr.js` already makes QR codes)
- `notFound()`: server number + code boxes, calls `/api/tv/claim`, then `connect()`. The full typed address moves to a small link.
- New sign-in step: if `hello.tv`, show the QR/code screen first; poll `GET /api/link/:id` every 2 seconds; on `in`, run the same `finish()`
  as a typed sign-in. **Type it here instead** keeps today's form. After 5 minutes the TV asks for a fresh link.
- `look()`: saved and Wi-Fi in parallel (A). Offline play is untouched.
- A small Tauri command for the TV's own Wi-Fi address (to fill in the first two numbers). If not wanted: the TV asks for all four numbers.

### Security, plainly
- **Codes are short-lived and single use.** Setup code: 10 minutes. Sign-in link: **5 minutes**; a used or declined link is gone at once.
  One setup code at a time; at most 10 open links; a new setup code replaces the old.
- **Only a grown-up can say yes.** The phone has to be signed in (kids have no accounts). The TV is signed in as *that* account. Making a
  setup code is **owner only**.
- **The TV never gets the password** and never sees the phone's token. It gets its own session, handed over once to whoever holds the `pollKey`
  (a 128-bit secret only that TV received). Someone who reads the short code over a shoulder can approve nothing and collect nothing.
- **Guessing:** wrong codes are counted across the server (like `pair.js`: 8 wrong in a minute pauses code checks for a minute). A 6-character
  sign-in code from 32 symbols is about a billion choices; at 8 tries a minute for 5 minutes that is under 1 in 20 million. A 4-digit setup code
  is guessable in principle, so it is capped harder (5 wrong tries and it is dead) and only does the small jobs above.
- **The check number** answers "someone else's TV": the phone shows it, the TV shows it, the owner compares before pressing Yes.
- **A neighbour on the same Wi-Fi** (or a guest) **could**: open `/tv`, start their own link, and make some wrong code guesses (limited). They **could try**
  to talk the owner into approving *their* link ("tap Yes for me"); the phone page names the device and says "Only if this number is on **your** TV
  right now". **They could not**: approve anything without a grown-up's sign-in, use a code that has run out or been used, get a
  password, make a setup code, or claim a fresh server (that needs the laptop's code). They can already reach `/api/hello` and try
  passwords today, and the per-email lock-out (pain point 5) is unchanged by this. **Not solved:** the Wi-Fi is plain `http`, so a password typed on
  the phone page is as exposed as the one typed on the TV today (protected by the Wi-Fi's own encryption). Same as now.
- **Not on the internet:** the internet door (port 47872, Tailscale Funnel) refuses `/tv`, `/api/tv/*` and `/api/link/*`. Over Tailscale proper
  they work as on the Wi-Fi.
- A link-made session is named for the TV, so a grown-up can see and end it like any other device.

### What I would leave out (to stay small)
- QR codes that carry a password or a long-lived token (never).
- mDNS names, a "forget this server" screen, several saved servers, switching between homes.
- **Joining** (new accounts, invite codes) from the phone page. Natural next step; not in this package.
- A laptop setup wizard (Windows firewall, Private network): worth doing, but a separate package (installer).
- Password reset from the phone page (stays on the management page).

### Build packages (when approved)
1. Server: `tv.js` (setup code + links, in memory, tested like `pair.js`), the `/tv` page, `hello.tv`, tray item "Set up a TV", management card.
2. App: parallel saved/Wi-Fi look, new "can't find it", QR sign-in screen with polling and the typing fallback; tests with a pretend server.
3. First owner needs the code (small, behind `hello.setup`).

### Questions for the owner
1. **First owner needs the code?** It stops a stranger claiming a new server; it means the first set-up needs the laptop in view (it always is).
2. **Who can sign a TV in by phone:** any grown-up account (my suggestion; all accounts are grown-ups) or **only the owner**?
3. **Letters or digits** for the sign-in code (letters are shorter, `KP7-2MX`; digits are easier to say aloud)? I suggest letters.
4. **The check number:** keep (safer, one extra glance) or drop (simpler)? I suggest keep.
5. Should the phone page also let a new family member **join** (invite code on the phone)? Next package, if yes.
6. Is a **4 digit** setup code enough, given its short life and tight cap, or do you want 6?
7. Today a TV with no saved server tries `HOME_SERVER` (the internet address) **before** the Wi-Fi call-out, so a TV at a friend's house would pick
   your server first. Keep that, or try the Wi-Fi first?

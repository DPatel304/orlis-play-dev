# Kids' profiles move to the Box (plan package S3; decisions 0011, 0028)

Status: Shelved (decision 0044, 2026-11-22). The built work is `docs/shelved/s3-kids-on-the-box.patch`.
the server once a family's Box has taken its kids.

## What moves and what stays
- **Stays on the server:** grown-up accounts (email, sign-in, role, household), and **each grown-up's own profile** (the first profile on
  their account: their name and look, so their face shows on other devices). What the family owns, plays (no names; account ids only),
  trophies.
- **Moves to the Box (Orlis Play on the family's PC):** every other profile = the kids. Fields: `id` (kept, so seats, trusted phones and
  saved state still match), `name`, `avatar`, `look`, `createdAt`. Progress already lives on the Box.

## On the Box
- `app/src/ui/kids.js`: `createKids(storage = localStorage)` with `list()`, `add({name, look})`, `update(id, patch)`, `remove(id)`,
  `importFromServer(profiles)` (adds the ones not already there, keeps ids), `exportFile()` / `importFile(text)` (a JSON backup the parent
  can keep, 0011; versioned `{ v:1, kids:[...] }`). Storage key `orlis.kids.<householdId>`. Same name rules as the server (first name or
  nickname: the server's `name` check, moved into a shared helper or copied with its tests); the 8-per-family limit counts grown-ups too.
- `account.state.profiles` becomes **grown-ups from the server + kids from the Box**, merged in one place (account.js), so Who's playing?,
  the line-up, crew, pad faces and the session's `people()` need no change.
- Adding, renaming, re-dressing (avatar maker) or removing a **kid** goes to `kids.js`, not the server. Grown-ups' own profiles still PATCH
  the server.
- Settings (the grown-ups' area, wherever kids are managed today) gets two buttons: **Save a backup** (downloads the JSON through the
  Tauri save dialog, or a browser download in the web build) and **Load a backup**. Short words; no new screen.

## The one-time move
1. After sign-in or refresh, if the server's profile list contains kids (any profile that is not its account's first), the app copies them
   with `importFromServer`, then calls **`POST /api/profiles/moved { ids }`**.
2. The server deletes exactly those profiles if they are in the caller's household and are not an account's own profile; it answers with
   the ids deleted. A History entry records "moved N kids' profiles to the Box" (no names).
3. Only after a successful answer does the app consider the move done; if the call fails it tries again next refresh (the copy is idempotent).

## Server changes
- `POST /api/profiles/moved` (above).
- `POST /api/profiles` and `PATCH/DELETE /api/profiles/:id` on a **kid** profile answer `410 moved` ("Kids' profiles now live on your
  Orlis Play PC."), so an old app can't put a child back. Creating the first profile at sign-up is unchanged (it is the grown-up's own).
- The owner's management page shows, per family, **how many kids' profiles are still waiting to move** (a number, no names), so the
  owner knows when every family has moved. No automatic purge in this package.
- Backups (`backup.js`) need no change: deleted rows are gone.

## Tests
- Server (`server/test/`): moved deletes only the caller's household's kids; refuses an account's own profile; refuses another family's
  ids; 410 on create/edit/delete of a kid; History entry has no names; the management count.
- App (`app/test/kids.test.mjs`): store add/update/remove/limit/name rules; importFromServer keeps ids and is idempotent; export then
  import round-trips; the merged profile list; the move flow with a fake server (copy before delete; a failed delete retries; a second
  run does nothing).
- Existing tests keep passing (app 769, server 87 today).

## Not in this package
More than one Box per family (kids live on one PC; noted for later), cloud backup, an automatic purge date.

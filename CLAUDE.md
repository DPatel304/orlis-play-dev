# Orlis: how the documents fit together

- `VISION.md` - what Orlis is and why (rarely changes).
- `ARCHITECTURE.md` - how the pieces fit together.
- `docs/decisions/` - one record per decision; the authoritative record. See its README for statuses and the index.
  After changing a record, run `node tools/decisions-page.mjs` and republish `docs/decisions.html` (the owner's one-page view).
- `BACKLOG.md` - ideas and to-dos, plus decisions made before the records existed.
- `app/`, `server/`, `spike3d/` (throwaway experiments), `kit/`.

**When documents disagree:** tests and code (for what is built), then decision records, then ARCHITECTURE.md, then VISION.md,
then BACKLOG.md. If a decision changes, write a new record that supersedes the old one; do not edit history.

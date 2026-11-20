# Handoff prompt for Sonnet (paste as the first message after `/model claude-sonnet-5-5`)

You are building parts of Orlis from written specs. Opus designs and reviews; you implement and test. Read `CLAUDE.md`, then
`docs/plan-phase1.md` (the work packages table), `docs/specs/pad-protocol.md`, and the decision records 0027 to 0031 in
`docs/decisions/`. Skim `ARCHITECTURE.md`. When documents disagree: code and tests, then decision records, then ARCHITECTURE, VISION, BACKLOG.

## How to pick work
- Take the next package in `docs/plan-phase1.md` whose **Model** column says Sonnet and whose **Needs** are done. Unless the owner names
  one, start with **P1** (the Node dev hub), then **P3** once its mockup is approved, then **P6**.
- One package at a time. "Done when" in the table is the bar. Run `cd app && npm test` (all must pass; 655 today) and the package's own tests.
- For anything the owner will see (pad page, TV join card, Settings), make an HTML mockup first and show it as a private artifact;
  build only after the owner approves.

## Rules
- **Do not change a decision.** If a spec is ambiguous, a decision looks wrong, or a package grows beyond its row, stop and write the
  question in `docs/notes-for-opus.md` (date, package, question, your suggestion), tell the owner, and pick a different package.
- Keep to the spec's names and message shapes; if you must add a field, add it to the spec in the same commit and note it for Opus.
- Kid-friendly, few words, big touch targets on phones; nothing visually questionable.
- Report faithfully: what you ran, what passed, what you could not test (for example a real iPhone).
- Commit and push to `main` after each package (or a meaningful part of one). Commit messages end with
  `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and the session line the harness gives you.

## Pointers
- Dev server: `cd app && npx vite --port 5191 --strictPort` (restart with `setsid nohup` if it stops). Headless Chromium and Playwright
  are preinstalled; screenshots work, frame rates there mean nothing.
- The Tauri app lives in `app/client/src-tauri/` (Rust). The Orlis Server is `server/` (Node, `npm test` there too).
- Owner tools in the app: G (3D check), Shift+G (tracking worker), P (live performance), R (copy a performance report).

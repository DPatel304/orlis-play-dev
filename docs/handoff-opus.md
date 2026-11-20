# Handoff prompt for Opus (paste as the first message)

You are joining a long-running project with the owner. Read `CLAUDE.md`, then `VISION.md`, `ARCHITECTURE.md`, `docs/decisions/README.md`
(and the records it lists, mainly 0003-0007, 0011, 0013, 0017-0026), `docs/plan-phase1.md` and the last ~400 lines of `BACKLOG.md`.
When documents disagree: code and tests, then decision records, then ARCHITECTURE, VISION, BACKLOG.

## What Orlis is
A free, family-safe, same-room, motion-first game platform for kids on a TV. Windows Tauri app "Orlis Play" (`app/`), Node "Orlis Server"
(`server/`), a creator kit (`kit/`), throwaway experiments (`spike3d/`). The "Orlis Box" is an off-the-shelf mini PC with Orlis
preinstalled plus a webcam (hardware not chosen; the owner's Legion 5 laptop, Ryzen 7 5800H, RTX 3070, stands in). Pads (phones and
tablets) are optional controllers and private screens, a browser page joined by QR or code in Phase 1. Apple support is deferred (0018).

## Where we are (Nov 20, 2026)
- **Phase 1 = closed beta for family, target March 27, 2027 (at risk), two perfected games** (0026): **Pop Party** (2D painted, camera;
  already polished: grass shadows, balloon edge light, horizon haze) and **Peekaboo Garden** (3D): one Android tablet hider with a
  private first-person view, one or two camera-tracked seekers on the TV overview. Plus the platform: pads/seats, Create for two
  testers, closed-beta install, kid profiles moved to the Box.
- Milestones are in `docs/plan-phase1.md` (M0 Dec 4 ... M6 Mar 27). Next up: **M2 pad protocol and browser pad page**.
- Decision status to know: 0020 (stage and flat games) and 0023 (Box draws 2D only) are Proposed and come back into play for
  Peekaboo Garden; 0025 superseded by 0026.

## Measured facts (do not re-derive)
- On the owner's laptop, plain and lit 3D with 24 animated characters and shadows runs at 165 fps (the screen's refresh rate); the
  right GPU (RTX 3070, Direct3D 11) is in use. Camera tracking on the main thread dropped it to 67 fps, slowest 5% over 18 ms
  (camera 68 fps, 12.6 ms a look). The tracking worker (Shift+G in the app) is untested; the owner may paste its result.
- The old stage lab (flat game drawn through 3D, 2D pictures repainted into textures) was slow; the cause was that and the camera, not three.js.
- Baked paper cutouts cannot animate their drawing; 3D animation needs rigged parts.
- Unmeasured: the real Box hardware; a real Android tablet; four tracked players.

## The task for you
**Architect the plan** (do not code yet): first the pad protocol and session/seat model (M2/M3) and how Peekaboo Garden's TV, camera and
tablet fit together; then the 3D game's architecture (world state on the host, two projections, what each screen may reveal, rigged
characters in the paper style, look consistency with 2D via one asset library and the look check in `spike3d/spike7.html`); then risks
and the order of work. Challenge anything that looks wrong. Write the result as new decision records (supersede, never edit history) and
update `docs/plan-phase1.md`.

## Working style the owner wants
- Ask questions in batches before big design choices; give a recommendation, not a survey. Do not over-scope.
- Short, kid-friendly, low-word UI. Real measurements over guesses. They like mockups and animated HTML, shown visually (artifacts).
- They are the owner/admin; guardrails are about visuals (nothing questionable), loose about logic.
- Commit and push to `main` after each piece of work. Commit messages end with:
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and the session line the harness gives you.
- Report outcomes faithfully (what you checked, what you could not).

## Useful pointers
- Owner tools in the app: **G** = 3D check, **Shift+G** = tracking worker on/off, **P** = live performance readout, **R** = copy a performance report.
- Demos (private artifacts built from `spike3d/`): `spike7.html` (shapes and skins, 2D map plus 3D pad view, look check), `spike8.html` (Pop Party 3D lab).
- Dev server: `cd app && npx vite --port 5191 --strictPort` (it stops between runs; restart with `setsid nohup`). Tests: `cd app && npm test` (655 pass).
- Headless screenshots with Playwright work (Chromium preinstalled); software GL, so ignore fps there.

# Notes for Opus (from the Sonnet helpers)

Newest first. Date, package, what, and a suggestion.

## 2026-11-21, P3 (pad page)
- **Protocol additions (done, in `docs/specs/pad-protocol.md` and `tools/pad-fake-host.mjs`):** pad to host `ready` (the phone tapped "I'm ready") and `who?`
  ("Not Sam? Change": the host answers with `who?`, the phone sends `pick`, the host keeps the token and seat). `who?` people may include
  `{ id: 'guest', name: 'Guest', avatar: null }` (drawn as Cubo). The fake host now has Guest by default.
- **Question: `welcome` has only `who` (an id), no name.** The page finds the name from the last `who?` list or from what it stored on the phone
  (`orlis.pad.me`). A phone that cleared its storage but kept a token would show the id capitalised. Suggest: the real host adds `name` (and maybe
  `avatar`) to `welcome`; the page already reads `welcome.name` if present.
- **Question: what `welcome.pad` means.** I treat it as a same-origin URL; if it ends with `/` the page imports `<url>pad.js`, else the URL itself.
  Written in the spec. Change it if the K/P4 work wants another shape (for example a manifest).
- **The mockup's "on the TV" hint under the grid** (the three right pictures, shown on the phone) is not built: it would show the answer to the picture
  code. Suggest dropping it from the mockup.
- **Fake host picture words:** three of its decoys (`cube`, `shoe`, `leaf`) are not in the asset library; I changed them to `house`, `tent`, `rocket`.
- After 4001 (the host left) the page goes back to "Welcome back" and asks for "I'm ready" again when the host returns. Suggest keeping that: the
  new game may be a different one.
- Not covered by tests (no WebKit here): real iPhone Safari (fullscreen is unsupported there anyway), real Android Chrome, whether the keep-awake
  video really keeps a locked-down phone awake, a real Wi-Fi blip or a screen lock (tests close the socket from the host side).

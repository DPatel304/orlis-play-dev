# 0017: Phase 1 is a closed beta; in Phase 2 the platform is sold only as a kit
Status: Accepted (terms to confirm: see Open)
Date: 2026-11-20
## Context
The owner said Phase 1 is a closed beta, and that from Phase 2 Orlis cannot be installed on any Windows laptop: the only ways to
play are the kit the owner sells, or the iPad (and phone) app.
## Decision
- **Phase 1:** builds go only to invited people (family, brother-in-law, father), by invitation, with beta terms.
- **Phase 2:** the platform runs on the sold kit (the Orlis Box with a webcam) and, for pad-capable games, on the iPad and phone
  app. It is not offered as a general Windows download.
## Consequences
- Every game package is signed and tied to an account's entitlements; a runtime checks them. This stops casual copying but
  cannot stop a determined person on an ordinary PC; a locked-down operating system on the Box (a kiosk) protects better than
  an ordinary Windows install. This feeds the Box's hardware and operating system choice (0003, 0002).
- Beta download links and the beta channel must be access-controlled.
- The earlier remark that the Windows app is "already a free Box" is true only in Phase 1.
## Open
In the owner's words "a dev kit that I sell": is that the Orlis Box with a webcam, with the creation tools (the Dev Kit in
BACKLOG.md) as a separate or bundled unlock? To confirm.

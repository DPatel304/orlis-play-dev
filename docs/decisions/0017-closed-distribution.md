# 0017: Phase 1 is a closed beta; in Phase 2 the platform is sold only as a kit
Status: Accepted (the beta note in `docs/beta-terms.md` approved by the owner 2026-11-21)
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
## Resolved
The sold "dev kit" is the Orlis Box: an off-the-shelf mini PC with a webcam and Orlis preinstalled (0003). The creation tools are
a separate matter, to be named.

## Update (2026-11-20)
Beta terms: a short plain note shown once before installing (draft in `docs/beta-terms.md`, for the owner to approve).

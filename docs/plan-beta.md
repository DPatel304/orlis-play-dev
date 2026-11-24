# Beta plan: two families, from 1 February 2027

The owner's goal (2026-11-24): the Phase 1 beta (decision 0053) starts on **Sunday 1 February 2027**. Two families install Orlis Play on
their own Windows laptops, at home, with no help. This plan works back from that date.

## Weeks
| When | What | Done when |
|---|---|---|
| 24 Nov - 5 Dec | Finish the playtest fixes and their loose ends. The owner plays the latest Beta at home with a real webcam and their own children. | Owner's first round of notes written down |
| 8 - 19 Dec | Tune on real hardware: the camera check's limits, children staying in, hops, Pop Party's pace and scores, Sky Painter's speed. Fix what the owner finds. | Owner happy with every Home game on their own laptop |
| 22 Dec - 2 Jan | Holidays: no planned work (owner's call). | - |
| 5 - 16 Jan | Beta readiness, below. | Every item ticked |
| 19 - 23 Jan | Release candidate: no new features. Make the regular release (0.2) and play it for a full week as a family. | A week with no new blocking bug |
| 26 - 30 Jan | Bug fixes only; final release; pre-approve both testers' emails. | Release out; testers on the allowlist |
| 1 Feb | Send both families the link and the short welcome email. | - |

## Beta readiness (by 16 Jan)
- **Release pipeline:** the update signing key is in GitHub; a test release updates an installed copy by itself.
- **The server:** the owner's laptop stays awake and plugged in; Orlis Server starts with Windows; Funnel reachable from a phone on
  mobile data; email set up and a test heads-up received.
- **A dry run as a tester:** on a Windows laptop that has never had Orlis (borrowed, or a fresh Windows user account): download from
  the email link, get past the Windows warning, sign up with an allowlisted email, add the kids, pass the camera check, play three games.
- **The Windows warning:** decide by 12 Dec whether to sign the installer (Microsoft's signing service needs an identity check that
  can take days); if not, the welcome email tells testers how to get past it.
- **The welcome email:** three lines (sign up with this email; Windows will warn you - More info, Run anyway; play from a few steps back).

## Risks
- Nothing has been tried with real children and a real webcam yet: every number so far comes from scripted bodies. December's tuning
  is the most important part of this plan.
- The owner's laptop is the whole service: if it sleeps or loses Wi-Fi, testers see "Orlis is asleep".
- Holidays shorten December; the plan leaves January for readiness and a full release-candidate week.

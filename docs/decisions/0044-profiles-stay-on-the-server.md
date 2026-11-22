# 0044: Everyone's profiles stay on the owner's server
Status: Accepted (2026-11-22)
Date: 2026-11-22

## Context
0011 (and the profiles line of 0028) moved kids' profiles off the owner's server onto the family's PC, so that nothing about a child sat
on the server. It was built (plan package S3: the one-time move, a store on the PC, backup files, a restore offer). Before it shipped the
owner asked whether profiles could simply all stay on the server, with no kid/grown-up split. That is how Orlis works today. It is simpler,
works on every device the family signs into, and nothing is lost with a PC.

## Decision
- **All profiles stay on the owner's server**, with no separate kind for kids.
- **A profile is only a nickname and a cube avatar look.** No birthday, age, photo, surname, contact details or anything else that
  identifies a real child. The server's existing name check stays (a first name or nickname; no emails or phone numbers).
- **Only a grown-up's account creates, edits or deletes profiles.** Children never sign up or sign in.
- **Deleting removes it.** Deleting a profile (or an account, or a family) deletes the rows, with no copy kept beyond the server's normal
  backups.
- Camera pictures still never leave the device (unchanged from 0011).
- **Before a public launch** to families outside the testers, the owner checks children's-privacy rules (for example COPPA in the US) with
  a lawyer, and looks again at the shelved move-to-PC work (`docs/shelved/s3-kids-on-the-box.patch`, spec `docs/specs/kids-on-the-box.md`).

## Replaces
0011 (children's profiles stay in the house), except that camera pictures never leave the device; and the "kid profiles move to the Box"
line of 0028. The rest of 0028 stands.

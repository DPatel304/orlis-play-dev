# 0007: Accounts and data
Status: Accepted (data handling to review before Phase 2)
Date: 2026-11-20
## Context
Families need to sign in once; the box must still play without the internet.
## Decision
- An account is required. The first sign-in needs the internet. After that, installed games work offline.
- The Store and updates need the internet.
- Kid profiles live on the owner's server (the Orlis Server).
## Consequences
Once other families use it, the owner is responsible for children's data: parental consent, only what is needed (a first name
and an avatar, never photos; camera pictures never leave the device), deletion on request, and a privacy policy. Every game
must work offline, so it carries its assets and rules; live features (leaderboards) degrade gracefully.
## Replaces
"Hosting: as much as possible on our laptop" for Phase 2 (fine for Phase 1).

# 0016: An Android app first, for Phase 1
Status: Accepted
Date: 2026-11-20
## Context
The iPad app needs a Mac to build, an Apple developer account (about $99 a year) and TestFlight. The owner asked whether an Android app
would be quicker for Phase 1.
## Decision (recommended)
Build the pad app as the same web code in a native shell for **Android first**: it builds on Windows with no Mac and no yearly fee,
installs on family devices as a file with no store review, and exercises discovery and pairing (0006) sooner. Build the iOS shell
next, as soon as the Mac is available, and test it early because iOS differs (the Local Network permission, background behaviour).
## Consequences
Two shells over one codebase. The Orlis Pro grip is designed for the iPad mini class, so Android tablets are a separate fit question.
Android hardware varies, so a real test device is needed; an emulator is poor for testing local-network discovery.

## Update (2026-11-20)
Accepted. The owner's family mostly has iPhones, so the iOS shell still follows in Phase 1 (a Mac is available); the owner will buy an Android device for testing.

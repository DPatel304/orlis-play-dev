# 0002: Any operating system; Windows first
Status: Accepted
Date: 2026-11-20
## Context
The owner's laptop is Windows and is the test machine. The Orlis Box's operating system is not chosen.
## Decision
The platform stays on the web stack (the app in a Tauri window, games as web code), so it can run on Windows, Mac, Linux and
iPad. Windows is the first and only tested target for now. Nothing should assume Windows.
## Consequences
Keeps the choice of Box hardware open. Mac and Linux need their own packaging and a camera/tracking check later.
## Replaces
The "Windows-only" notes in BACKLOG.md ("The TV box: which mini PC").

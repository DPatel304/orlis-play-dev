# Decision records

One short file per decision. They are the authoritative record of what Orlis has decided, and why.

**Authority order when documents disagree:** tests and code (for what is built), then these records, then
`ARCHITECTURE.md`, then `VISION.md`, then `BACKLOG.md` (ideas and to-dos).

**Statuses:** *Accepted* (decided), *Proposed* (the assistant's recommendation, waiting for the owner), *Open* (a question
with options, not decided), *Superseded by NNNN* (replaced; kept, never deleted).

**To add one:** copy the shape below, take the next number, and add it to the index. To change a decision, write a new record
that supersedes the old one.

```
# NNNN: Title
Status: Accepted | Proposed | Open | Superseded by NNNN
Date: YYYY-MM-DD
## Context      (what forced the decision)
## Decision     (what we do)
## Consequences (what it costs, what it enables)
## Replaces     (earlier decisions or backlog sections, if any)
```

## Index
| # | Decision | Status |
|---|---|---|
| 0001 | The phases: family beta first, then a sold dev kit | Accepted |
| 0002 | The platform runs on any operating system (web stack); Windows first | Accepted |
| 0003 | The Orlis Box: a ready-made console, eventually | Accepted |
| 0004 | Seats: up to 8 players, up to 4 tracked, any mix of devices | Accepted |
| 0005 | A session is hosted by any one device; the Box by default | Proposed |
| 0006 | Pairing: automatic discovery on the home network, a confirmation code the first time | Proposed |
| 0007 | Accounts and data: sign in once online; offline after; kid data on the owner's server | Accepted (data handling to review) |
| 0008 | Publishing and guardrails | Accepted |
| 0009 | Watches as controllers | Open |
| 0010 | How Orlis makes money | Open |

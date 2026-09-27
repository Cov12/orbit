# agent-handoff.md — The Messaging Protocol

_How agents on the team talk to each other. Read this before reading or
writing anything in `messages/`._

## Why files, not a queue service

We use the git repo as the message bus. Files in directories are the
queue. This is intentional:

- Survives restarts trivially (it's just files)
- Has full history baked in (git log)
- No new infrastructure to run, monitor, or pay for
- Easy for humans to inspect and intervene
- Atomic state transitions via `mv` on the same filesystem
- Sync between hosts via the existing git sync cron

The trade-off is latency (bounded by sync interval, currently 1 minute)
and we can't have more than one writer per direction. Both are fine for
the current scale.

## Layout

```
messages/
├── <from>-to-<to>/
│   ├── inbox/        ← new messages waiting for the recipient
│   ├── processing/   ← recipient has claimed and is working
│   └── done/         ← completed
└── README.md
```

For every pair of agents `A` and `B` on the team, there are two
directories: `A-to-B/` and `B-to-A/`. Each direction has its own
state machine.

## File format

Messages are markdown files with YAML frontmatter.

```markdown
---
id: msg_01HQ7K8N4P3Q5R6S7T8V9W0X1Y
from: coda
to: dex
created_at: 2026-04-09T14:30:22Z
type: task
priority: normal
subject: Draft Q1 retention analysis
in_reply_to: null
thread: null
deadline: 2026-04-12T17:00:00Z
context:
  brand: brand-a
  client: null
  related_files:
    - shared/clients/example-client.md
---

# Body

Plain markdown. Be specific. Include enough context that the recipient
doesn't have to come back and ask. Link to files in the repo using
relative paths from the repo root.
```

## Field reference

### Required fields

| Field        | Type    | Notes                                              |
|--------------|---------|----------------------------------------------------|
| `id`         | string  | `msg_<ULID>` — sortable, globally unique           |
| `from`       | string  | Agent name, lowercase, matches `TEAM.md`    |
| `to`         | string  | Agent name, lowercase, matches `TEAM.md`    |
| `created_at` | string  | ISO 8601 UTC                                       |
| `type`       | enum    | See "Types" below                                  |
| `priority`   | enum    | `low` \| `normal` \| `high` \| `urgent`            |
| `subject`    | string  | One-line summary, ~80 chars max                    |

### Optional fields

| Field          | Type        | Notes                                          |
|----------------|-------------|------------------------------------------------|
| `in_reply_to`  | string      | `id` of the message this responds to           |
| `thread`       | string      | `id` of the thread root (defaults to `id`)     |
| `deadline`     | string      | ISO 8601 UTC, hard deadline                    |
| `context`      | object      | Free-form structured context (see below)       |
| `attachments`  | array       | Repo-relative paths to related files           |

### Context object

The `context` object is free-form but conventionally contains:

```yaml
context:
  brand: brand-a | brand-b | orbit | null   # which brand this is for
  client: <client-slug> | null          # which client this is about
  user: <slack-id-or-handle> | null     # which human triggered this
  related_files:                        # repo-relative paths
    - path/to/file.md
```

Use `null` for fields that don't apply. Don't omit them — explicit
nulls are easier for downstream consumers to read.

## Types

- **`task`** — A unit of work. Recipient is expected to do it and reply
  with a `response` when done. Always has a `subject` describing the
  outcome, not the activity. ("Draft Q1 retention analysis", not
  "Analyze retention".)

- **`question`** — Recipient is expected to reply with a `response`.
  No work, just an answer. Use this for things like "do you have
  context on X" or "what did you decide about Y".

- **`fyi`** — Informational. No reply expected. Use this for status
  updates, "I'm starting work on X", "I noticed Y is broken", etc.
  Recipients should still mark these as `done` so they're acknowledged.

- **`response`** — A reply to a `task` or `question`. Must include
  `in_reply_to` pointing at the original. The body should answer the
  question or report the result.

## File naming

```
<created_at-compact>-<short_id>-<slug>.md
```

Example:
```
20260409T143022Z-01HQ7K8N-draft-q1-retention-analysis.md
```

- `created_at-compact` is the ISO 8601 timestamp with `:` and `-`
  removed for filesystem friendliness, in UTC, ending in `Z`
- `short_id` is the first 8 characters of the ULID (after the `msg_`
  prefix), enough to be unique within a directory in practice
- `slug` is a kebab-case version of the subject, max 50 chars, lowercase

This naming gives you:
- Chronological ordering when you `ls` the directory
- A glanceable subject from the filename alone
- Stable, unique paths

## State machine

```
[sender writes]                                       [retention]
       │                                                   │
       ▼                                                   ▼
   inbox/  ──[recipient picks up]──▶  processing/  ──[recipient finishes]──▶  done/
```

### Transitions

All transitions are atomic file moves (`mv`) within the same
filesystem. Never copy + delete. Never write + remove.

- **inbox → processing**: recipient claims the message. Do this BEFORE
  starting work, so a co-running process or a future you doesn't pick
  it up again.
- **processing → done**: recipient has finished. The message was
  acknowledged, acted on, or replied to.
- **processing → inbox** (rare, but allowed): recipient releases the
  message back to the queue because they can't handle it right now.
  Add a frontmatter field `released_at` and a brief note in the body.
- **inbox → done** (rare): recipient acknowledges an `fyi` without
  any processing step.

### Who moves files

- **Sender** writes only to `inbox/`. Never reaches into `processing/`
  or `done/`.
- **Recipient** moves files from `inbox/` → `processing/` → `done/`.
  Never reaches into the sender's outbound queue.
- **The Principal** can do anything. They're the operator.

## Threading

Replies set `in_reply_to: <original-id>` and `thread: <root-id>`.

For a fresh message, `thread` equals `id`. For a reply, `thread`
matches the root of the conversation (not the immediate parent).

This gives you tree-like reply chains while keeping flat storage.

## Priority handling

Recipients should drain queues in priority order:

1. `urgent` — drop other work, handle now
2. `high` — handle before `normal`
3. `normal` — default
4. `low` — when nothing else is pending

Within a priority level, FIFO by `created_at`.

**Don't abuse `urgent`.** It's for "the system is on fire" or "the Principal
explicitly said this is urgent." If everything is urgent, nothing is.

## Concurrency

Each direction has a single writer and a single reader, so there's no
contention to worry about. Even so:

- File moves are atomic on the same filesystem
- Don't edit a message in place after writing it — write a new one
- If you need to update something, send a new `fyi` referencing the
  original via `in_reply_to`

## Error handling

If a recipient can't process a message:

1. Move it to `processing/` (claim it)
2. Try once
3. If it fails, write a `response` back to the sender explaining what
   went wrong
4. Move the original to `done/`
5. Log the failure in your `HEARTBEAT.md`

If something is fundamentally broken (file is malformed, frontmatter
won't parse, etc.):

1. Don't touch the file
2. DM the Principal via Telegram with the file path and a description
3. Wait for human intervention

## Retention

For now, `done/` accumulates forever. We have git history anyway, so
deletion isn't strictly necessary.

Revisit when:
- Any single `done/` directory exceeds 1000 messages
- The repo size starts feeling heavy
- We add a third agent and queue counts grow

When we do prune, the policy will be: archive anything older than 90
days into `messages/archive/<year>/<month>/`.

## Examples

### A task from Coda to Dex

`messages/coda-to-dex/inbox/20260409T143022Z-01HQ7K8N-draft-acme-glass-quote.md`

```markdown
---
id: msg_01HQ7K8N4P3Q5R6S7T8V9W0X1Y
from: coda
to: dex
created_at: 2026-04-09T14:30:22Z
type: task
priority: high
subject: Draft installation quote for Acme Glass — storefront project
in_reply_to: null
thread: null
deadline: 2026-04-10T17:00:00Z
context:
  brand: brand-b
  client: acme-glass
  user: null
  related_files:
    - shared/clients/acme-glass.md
    - protocols/email.md
---

Acme Glass (a fictional example client) requested a quote for a
storefront install at a new location. Specs are in the related_files. Need a draft I
can review before sending.

Constraints:
- Material costs from the March 28 supplier sheet
- Labor at the standard Brand B rate
- Include the 30-day net terms language

Don't send anything yet — just draft and reply with the body. I'll
do the actual send.
```

### A response from Dex back to Coda

`messages/dex-to-coda/inbox/20260409T161544Z-01HQ7M2P-re-draft-acme-glass-quote.md`

```markdown
---
id: msg_01HQ7M2P8Q9R0S1T2U3V4W5X6Y
from: dex
to: coda
created_at: 2026-04-09T16:15:44Z
type: response
priority: high
subject: Re: Draft installation quote for Acme Glass — storefront project
in_reply_to: msg_01HQ7K8N4P3Q5R6S7T8V9W0X1Y
thread: msg_01HQ7K8N4P3Q5R6S7T8V9W0X1Y
deadline: null
context:
  brand: brand-b
  client: acme-glass
---

Draft below. Two things to flag:

1. The March 28 supplier sheet had a typo on tempered panel pricing —
   I used the corrected number from the April 2 follow-up. Worth
   double-checking before sending.
2. Acme Glass's last invoice was paid 18 days late. You may want to
   tighten the net terms language or add a deposit clause.

---

[full quote draft here]
```

### An FYI from Dex

`messages/dex-to-coda/inbox/20260409T180000Z-01HQ7N5R-starting-retention-pass.md`

```markdown
---
id: msg_01HQ7N5R7S8T9U0V1W2X3Y4Z5A
from: dex
to: coda
created_at: 2026-04-09T18:00:00Z
type: fyi
priority: low
subject: Starting deep pass on Q1 retention data — ETA tomorrow morning
in_reply_to: null
thread: null
context:
  brand: brand-a
---

Heads up — I'm starting the Q1 retention deep-dive the Principal asked for
yesterday. ETA is tomorrow morning UTC. If you get any related asks,
either route them to me or note them and I'll fold them in.

No reply needed.
```

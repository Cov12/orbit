# messages/

_Published-set note: in the live repo this directory is `messages/`. Here it
is `queue/`, and three real messages sent through it are in `queue/examples/`._

Inter-agent message queues. Each pair of agents has two directories —
one per direction — and each direction has its own three-state queue.

## Layout

```
messages/
├── coda-to-dex/
│   ├── inbox/        ← coda writes here, dex reads here
│   ├── processing/   ← dex moves messages here when starting work
│   └── done/         ← dex moves messages here when finished
├── dex-to-coda/
│   ├── inbox/
│   ├── processing/
│   └── done/
└── README.md
```

When a new agent joins the team, every existing agent gets a new pair
of directories. See `templates/ONBOARDING.md` step 4.

## Quick reference

**To send a message:**
1. Write a markdown file with YAML frontmatter to
   `messages/<your-name>-to-<their-name>/inbox/`
2. Use the file naming convention from `protocols/agent-handoff.md`
3. That's it. Don't touch anything else in the recipient's queue.

**To receive a message:**
1. Poll `messages/*-to-<your-name>/inbox/` on every cycle
2. Sort by priority then `created_at`
3. For each message you're going to handle: `mv` it to `processing/`
4. Do the work
5. `mv` it to `done/` when finished
6. If the message expects a `response`, send one before marking done

**Never:**
- Reach into a directory you don't own
- Edit a message file in place after writing it
- Use copy + delete instead of `mv` for state transitions
- Send `urgent` priority for things that aren't actually urgent

## Full spec

`protocols/agent-handoff.md` is the source of truth for:

- File format (YAML frontmatter + markdown body)
- Required and optional fields
- File naming convention
- State machine and atomic moves
- Threading and replies
- Priority handling
- Error handling
- Retention

If anything in this README contradicts the spec, the spec wins.

## .gitkeep files

Each empty queue directory has a `.gitkeep` so git tracks the structure
even when there are no messages. Don't remove them.

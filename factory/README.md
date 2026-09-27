# The factory

How Orbit gets built: one human principal and a small team of AI agents, working through
written protocols, a file-based message queue and explicit human checkpoints. Everything in
`apps/` came out of this loop. The agents' documents call that human **the Principal**.

This directory is the operating layer itself — the rules the agents load, the protocols they
follow, the scripts they call and real examples of their handoffs — lightly edited for public
release (see the note at the end).

## The team

| Agent | Role | Runs on |
|---|---|---|
| **Coda** | Orchestrator. Plans, delegates, reviews, reports; the principal's day-to-day operator. | OpenClaw harness, OpenAI Codex model |
| **Claude Code** | Coding and codebase research, delegated by Coda through a gated script. | Claude Code CLI |
| **Hermes** | The agent runtime ([`apps/agent-runtime`](../apps/agent-runtime)); also takes build handoffs for runtime changes. | Hermes Agent |
| **Byte** | Support email (the only agent that sends), routine ops, session analysis. | OpenClaw harness |
| **Dex** | Strategy and analysis; its lane later moved to Byte. | Local model on a GPU desktop |

How the team works together is in [`TEAM.md`](TEAM.md).

## Human checkpoints

Agents move fast inside their lane; anything consequential waits for the principal:

- **Write access is opt-in per task.** Coda's delegation to Claude Code is read-only by default;
  file edits need an explicit flag for that task ([`ops/claude-delegate.sh`](ops/claude-delegate.sh)).
- **Outbound and state-changing actions are approved per action** — every email Byte sends, every
  post, every git mutation or config change — and every external action is logged back to the
  principal afterwards.
- **Anything touching money stops for confirmation**, drafting included
  ([`protocols/financial-gatekeeper.md`](protocols/financial-gatekeeper.md)).
- **Pre-authorized surfaces are explicit.** Read-only work (fetching a URL, reading a repo,
  research delegation) is listed and runs without asking; everything else asks
  ([`orchestrator/CLAUDE.md`](orchestrator/CLAUDE.md)).

## How work flows

1. **Handoff.** Work moves between agents as files in a queue — `inbox/ → processing/ → done/` —
   with a fixed header format ([`queue/README.md`](queue/README.md),
   [`protocols/agent-handoff.md`](protocols/agent-handoff.md)).
2. **Build.** Coding tasks go to Claude Code through the delegation script; each run leaves an
   audit log of the task and its result.
3. **Verify before claiming.** No file path, endpoint or root cause is asserted without reading
   the current code first ([`protocols/verify-before-claim.md`](protocols/verify-before-claim.md)).
   Breaking changes require an exhaustive reference audit
   ([`protocols/refactor-hygiene.md`](protocols/refactor-hygiene.md)).
4. **Record.** A session summary goes through one script that archives it, updates the changelog
   and queues a review ([`ops/archive-session.sh`](ops/archive-session.sh),
   [`protocols/session-changelog.md`](protocols/session-changelog.md)); architecture-level
   sessions are drafted into ADRs for the principal to approve.

## Worked examples

- **Session → ADR.** [`sessions/2026-05-08-portal-team-invite.md`](sessions/2026-05-08-portal-team-invite.md)
  is the raw session summary; [`decisions/2026-05-portal-team-invite.md`](decisions/2026-05-portal-team-invite.md)
  is the ADR it produced.
- **A build spec handed to another agent.** [`queue/examples/…p0-onboarding-mem0-seed-mapping.md`](queue/examples/)
  — the backend spec for the onboarding work that shipped in `apps/agent-runtime/patches/0002`.
- **Correcting the record.** Two messages where an agent retracts its own earlier claim once it
  checked: one about repository access, one about a role-mapping change it had wrongly called
  cosmetic. Verify-before-claim is only real if the correction gets sent.
- **Decisions that shaped the apps.** [`decisions/`](decisions/) — cross-app single sign-on and the
  "single front door" doctrine that made Portal the gate every app goes through.

## Layout

```
orchestrator/CLAUDE.md   the orchestrator's operating rules
TEAM.md                  how the team works together
protocols/               team-wide rules (handoff, verification, refactors, email, money, confidentiality…)
ops/                     delegation and session-archive scripts
queue/                   message-queue spec + real examples
decisions/               ADRs
sessions/                a session summary that fed an ADR
templates/               scaffolding for bringing a new agent onto the team
```

## About this edition

These files come from the private operating repository and were edited only to remove business
names, client details, credentials, personal details and infrastructure specifics. Paths inside the
files and scripts are left as they are in the live repository, so each script still says where it
really reads and writes. They map to this directory like this:

| Live repository | Here |
|---|---|
| `~/dev-ops/shared/protocols/` | [`protocols/`](protocols/) |
| `~/dev-ops/shared/architecture-decisions/` | [`decisions/`](decisions/) |
| `~/dev-ops/changelog/sessions/` | [`sessions/`](sessions/) |
| `~/dev-ops/messages/<from>-to-<to>/` | [`queue/`](queue/), with examples in `queue/examples/` |
| `~/dev-ops/shared/ops/bin/` | [`ops/`](ops/) |
| `~/dev-ops/shared/templates/` | [`templates/`](templates/) |
| the orchestrator's workspace rules | [`orchestrator/CLAUDE.md`](orchestrator/CLAUDE.md) |

Some paths point at files that aren't published — agents' private memory and identity files — and
describe where things live rather than something to open. The roster
table isn't published; see the note in `TEAM.md`.

The methodology this grew out of is written up separately in
[ai-dev-methodology](https://github.com/Cov12/ai-dev-methodology).

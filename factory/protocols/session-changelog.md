# session-changelog.md — Capturing Work That Ships

_How agents on the team handle session summaries the Principal drops in chat. Defines what gets saved, where, and which agent does what part. Companion to `verify-before-claim.md` (don't fabricate what got built) and the ADR pipeline._

## Why This Protocol Exists

The Principal works across multiple repos (orbit-portal, atrium, dev-ops, the various brand sites) and frequently produces session summaries — detailed writeups of what got built and why. Before this protocol, those summaries lived in chat history and decayed. After this, they get archived, surfaced, and (when warranted) distilled into durable artifacts.

The system has three classes of artifact, each with a different retention horizon:

| Artifact | Lives at | Retention | Created |
|----------|----------|-----------|---------|
| Raw session summary | `changelog/sessions/<date>-<slug>.md` | Permanent archive | Always |
| One-line CHANGELOG entry | `changelog/CHANGELOG.md` | Permanent timeline | Always |
| ADR (when significant) | `shared/architecture-decisions/<date>-<slug>.md` | Permanent decision record | Conditional |

This protocol routes incoming summaries through these layers based on agent capability and content type.

(Paths in this protocol are the live repo layout. In this published set, one archived session appears under `sessions/` and approved ADRs under `decisions/`.)

## The Trigger

The Principal drops a session summary by:
- **Pasting it in a Telegram chat to any agent** (Byte, Coda, or Dex), OR
- **Saving a file directly to `changelog/sessions/`** in the dev-ops repo, then asking an agent to process it

Either way, the agent receiving the request runs the workflow below.

## Per-Agent Routing — Who Does What

### Update (May 11, 2026): Byte removed from this flow

The original design routed summaries through Byte for the bookkeeping layer. That didn't work in practice — at the time Byte ran qwen2.5:7b-instruct on a 4-core CPU, and processing Byte's full system prompt + tools + a real session summary exceeded 10 minutes per attempt, hitting the OpenClaw inference timeout. Fallback chain then silently goes Gemini → rate-limited → Codex, which hallucinates a fabricated success ("Done, the Principal, archived and routed to Dex"). The filesystem remains untouched while the Principal believes the work landed.

**Update (2026-05-28):** the timeout reason above no longer applies — Byte now runs on Codex (`openai-codex/gpt-5.3-codex`), not local qwen, so it could handle summaries reliably. Routing still goes through Coda until the Principal explicitly decides whether to move this workflow back to Byte. Byte's email + cron lanes stay reliable (cron scripts on a fixed schedule). The silent-fallback failure mode the old setup exposed is recorded in Coda's Codex Operating Constraints (and written up in `verify-before-claim.md`).

**Update (2026-06-29): analysis layer moved Dex → Byte.** Byte now runs on **GPT-5.4** and has taken over the ADR analysis that previously went to Dex (Dex's box — qwen2.5:14b on the Principal's Win desktop — was too brittle). `archive-session.sh` now queues the review task to `messages/coda-to-byte/inbox/` (was `byte-to-dex`). **Bookkeeping (the archive script) still runs through Coda** as primary handler; only the downstream *analysis* recipient changed. See the "analysis layer — owned by BYTE" section below for the spec.

### When sent to CODA (Codex, ops VPS) — primary handler

Coda handles both bookkeeping AND triggers downstream analysis. Coda is on Codex which has the intent-without-execution risk, so the workflow is structured to force a tool call:

**Coda does, in one tool call:**
1. Save the verbatim summary to a temp file (e.g., `/tmp/session-$$.md`)
2. Invoke the single-command archive script:

```bash
ops/archive-session.sh \
  --repo <repo-name> \
  --title "<short descriptive title>" \
  --commit <sha-if-known> \
  --file /tmp/session-$$.md
```

The script atomically:
- Saves the verbatim summary to `changelog/sessions/<date>-<slug>.md`
- Inserts a row into `changelog/CHANGELOG.md` (newest top)
- Writes a `task` message to `messages/coda-to-byte/inbox/` asking Byte to review for an ADR
- Echoes a confirmation block to stdout

3. **Paste the script's stdout VERBATIM to the Principal on Telegram.** Don't paraphrase — the script already produces the confirmation the Principal expects.

**Coda does NOT:**
- Draft ADRs from the summary directly (verify-before-claim discipline — Codex shouldn't synthesize architectural reasoning without reading code). ADR drafting is delegated to Claude Code via `claude-delegate` when the Principal asks for it, OR done by Byte when it picks up the queue message.
- Decide "architectural significance" alone — that judgment belongs to Byte or to the Principal.

**Critical for Coda: invoke the script in the same turn you commit.** Don't promise *"I'll archive this now"* without immediately running the script. That's the hallucinated-execution failure mode documented in Codex Operating Constraint #1.

### The analysis layer — owned by BYTE (GPT-5.4) as of 2026-06-29 (was Dex)

Byte handles the *analysis* layer: ADR decision and drafting. This moved off Dex (qwen2.5:14b on the Principal's Win desktop) on 2026-06-29 because that box was too brittle; Byte is now on GPT-5.4 and reliable for this work. Byte picks up the task from `messages/coda-to-byte/inbox/`.

**Byte does:**
1. (If not already done by Coda's archive run) Save verbatim summary + add CHANGELOG row
2. **Decide if the work warrants an ADR.** Heuristic: yes if it touches schema, public APIs, security model, infrastructure, deploy strategy, or makes a non-obvious architectural choice. No if it's a CRUD-on-existing-pattern bugfix or feature.
3. **If yes, draft an ADR** at `shared/architecture-decisions/YYYY-MM-<slug>.md` following the established format (Context / Decision / Alternatives / Consequences / Files Touched / Lessons). **Surface the ADR draft to the Principal on Telegram for approval BEFORE committing.** The Principal reviews; Byte revises if needed; Byte commits and updates the CHANGELOG row to link the ADR. (verify-before-claim still applies — confirm file paths/symbols against the repo, don't trust the summary alone.)

**Byte confirms to the Principal on Telegram** when each artifact is complete: *"Archived. ADR drafted at [path] — please review before I commit."*

### Coda's ADR step (separate from initial archive)

When the Principal asks for an ADR to be drafted from a session that's been archived, Coda delegates the analysis to Claude Code via `claude-delegate` (the verify-before-claim discipline applies; Codex shouldn't fabricate architectural reasoning):

```bash
ops/claude-delegate.sh \
  "Read the session summary at <session-file-path> and draft an ADR following the format used in decisions/2026-05-atrium-portal-auth.md. Output the ADR content; do not commit." \
  ~/dev-ops
```

Coda then surfaces the Claude-drafted ADR to the Principal on Telegram for approval, applies edits if needed, and commits.

This is slower than letting Codex draft directly (extra round-trip through Claude Code) but more reliable — the May 2026 Atrium auth incident showed Codex fabricates technical detail under unscoped pressure.

## The Approval Gate

**No ADR gets committed without the Principal's explicit approval.** ADRs become durable historical record; getting them wrong creates fabrication-fuel for future sessions (per the May 2026 Atrium incident).

The flow is:
1. Agent drafts ADR
2. Agent sends draft to the Principal on Telegram (paste or link to a draft path)
3. The Principal reviews, requests edits or approves
4. Agent applies edits; cycle until approved
5. Agent commits to `shared/architecture-decisions/`
6. Agent updates `changelog/CHANGELOG.md` row to link the ADR


## How to Decide "Architecturally Significant"

This is the judgment call that determines whether a session gets an ADR or just a CHANGELOG line. Heuristics in order of strength:

**Significant (warrants ADR):**
- Adds or substantially changes a schema/data model
- Introduces a new public API surface
- Changes the auth/security model
- Picks one of multiple reasonable architectural alternatives (anything where you considered competing approaches)
- Affects deployment/infrastructure
- Crosses repo boundaries (e.g., portal change + downstream consumer change)

**Not significant (CHANGELOG line is enough):**
- Bugfix on existing code paths without architectural change
- Pure refactor that preserves behavior
- Dependency upgrade
- Copy/UI tweaks
- Performance optimization within a single layer

**Borderline / use judgment:**
- New feature that's "just CRUD" — usually CHANGELOG line, but ADR if the data model or access control is non-trivial
- Migration / cleanup work — usually CHANGELOG line, but ADR if the migration changed the contract for external consumers

When uncertain, **lean toward NOT writing an ADR**. ADRs are valuable when sparse and high-signal; if everything has one, none of them carry weight. The Principal can always upgrade a CHANGELOG line to a full ADR later.

## Naming Conventions

### Session files
`changelog/sessions/YYYY-MM-DD-<slug>.md`
- Date is the day the session shipped (or the date the Principal drops the summary if shipping date is unclear)
- Slug is kebab-case, derived from the work description, ~3-6 words max
- Examples: `2026-05-08-portal-team-invite.md`, `2026-04-22-atrium-render-deploy-fix.md`

### ADRs
`shared/architecture-decisions/YYYY-MM-<slug>.md`
- Year-month only (not full date) — ADRs aggregate at month granularity
- Slug typically matches the session slug
- Examples: `2026-05-portal-team-invite.md`, `2026-05-atrium-portal-auth.md`

## What Each Agent's CLAUDE.md Should Say

To make this workflow actually work, each agent's CLAUDE.md needs an explicit reference. See per-agent routing above for what each agent's section should describe. Coda's and Byte's CLAUDE.md reference this protocol (Coda = bookkeeping/primary handler; Byte = analysis layer as of 2026-06-29). Dex no longer participates in this flow.

## Edge Cases

- **Multiple sessions in one day on the same project:** use a numeric suffix in the slug (e.g., `2026-05-08-portal-team-invite-1.md`, `2026-05-08-portal-team-invite-2.md`) or pick a more specific slug
- **Session summary covers multiple repos:** save once with a slug that names the primary repo or theme; cross-reference the others in the body
- **Session summary is incomplete:** Coda still archives it as-is; Byte flags to the Principal that the summary is thin and asks for more detail before drafting an ADR
- **Same session re-summarized later:** treat as an amendment — keep both files; the newer one supersedes; CHANGELOG should link to the latest

## Companion Protocols

- `verify-before-claim.md` — when drafting ADRs from session summaries, every technical claim (file paths, function names, line numbers) must be verifiable in the actual repo at the time of writing. Don't trust the summary alone — confirm against code where feasible.
- `refactor-hygiene.md` — when a session involves breaking changes, the ADR's "Files Touched" section becomes a sanity check that all references were caught. If grep finds the old name elsewhere, the ADR's claim of completeness is wrong.
- `skill-documentation.md` — same convention applied to per-skill files (SKILL.md + MEMORY index entry); session-changelog applies to per-session work artifacts.

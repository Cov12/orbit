# refactor-hygiene.md — Audit Before Breaking Changes

_When you rename, remove, or restructure something, search exhaustively for every reference. This is engineering hygiene from the Principal's coding background — what experienced developers do reflexively. The protocol exists because LLM agents don't always do it, and the cost of skipping it is silent breakage that surfaces hours or days later._

## The Rule

**Before any breaking change to infrastructure-coupled code — env vars, global identifiers, public function names, file paths, config keys, exported symbols — exhaustively audit the codebase (and adjacent surfaces like docs, deployment configs, CI configs) for every reference. Update or remove all of them in the same change.**

"Breaking" here means: anything that changes the contract between a piece of code and its callers/consumers. Including:
- Renaming an env var (`FOO_TOKEN` → `BAR_TOKEN`)
- Removing or renaming a function/class/export
- Moving a file or changing its path
- Changing a config key name or accepted value
- Renaming a route or API endpoint
- Removing a feature flag whose code path is referenced elsewhere

**Special emphasis on env vars and global identifiers.** They cross file boundaries silently, often appear in non-code surfaces (`.env.example`, `docker-compose.yml`, README, deploy configs, CI scripts), and are the most common source of "looks fine, breaks in prod" failures.

## Why This Matters Even More for Agent-Driven Code Changes

When an experienced human refactors, they instinctively grep before committing. LLM-driven sessions don't always — they often update the file they were asked to touch and stop, leaving dangling references that look like working code until something downstream fails.

The May 2026 Atrium incident is the canonical example:
- A previous Claude Code session was asked to "remove the JWT-handling middleware to reduce complexity"
- It removed the middleware file
- But left references to the middleware's env var (`ATRIUM_JWT_SECRET`) in `auth_redirect.py`, `voice.py`, `.env.example`, and `docker-compose.dev.yml`
- Meanwhile, `jwt_auth.py` only knew about `JWT_SECRET`
- Prod ran on `JWT_SECRET` only; dev docs said `ATRIUM_JWT_SECRET`; the cleanup looked complete but had created a maze of inconsistent naming
- Months later, when cross-app auth needed to work, the inconsistency caused a bug that took 2.5+ hours of investigation to even diagnose correctly

**The cleanup was not a cleanup.** It removed one piece while leaving the artifacts of that piece scattered across the codebase. The "simpler" state was actually less coherent.

Full ADR: `decisions/2026-05-atrium-portal-auth.md`.

## The Audit Checklist

Before merging any breaking change, run these searches and act on every result:

### For env var renames/removes
```bash
# Inside the repo:
grep -r "FOO_TOKEN" .
grep -r "FOO_TOKEN" .github/
# Adjacent surfaces (host-side, deploy-side):
grep -r "FOO_TOKEN" .env* docker-compose*.yml render.yaml fly.toml etc.
# Documentation:
grep -r "FOO_TOKEN" docs/ README.md *.md
# CI:
grep -r "FOO_TOKEN" .github/workflows/ .gitlab-ci.yml
# Don't forget deploy provider's UI (Render, Fly, Vercel, Heroku) — those are out-of-tree
```

### For function/class/export removals
```bash
grep -rn "from .module import FooClass" .
grep -rn "FooClass(" .
grep -rn "FooClass\." .
# In TypeScript/JS:
grep -rn "import.*FooClass" .
grep -rn "FooClass" .  # broader catch
```

### For file path changes
```bash
grep -rn "old/path/to/file" .
# Including imports:
grep -rn "from.*old/path" .
grep -rn "require.*old/path" .
```

### For route/endpoint changes
```bash
grep -rn "/api/v1/old-route" .
# Plus client-side callers, docs, OpenAPI specs, integration tests
```

### Crucial non-code surfaces
- Deployment provider env vars (Render, Fly, Heroku, Vercel, etc.) — UI-managed, NOT in repo
- DNS records / Cloudflare rules
- Cron job arguments
- Slack/Discord/Telegram bot config
- Database column names, indexes, foreign keys
- External API webhooks pointing at old paths
- Documentation in Notion, Google Docs, internal wikis
- Comments in code referring to the old name (annoying but not breaking)

The deploy-provider UI is the killer one — it's invisible to repo grep but breaks prod when env vars change.

## What "Done" Looks Like

A breaking change is done when:

1. **All in-tree references are updated or removed** (grep returns zero unintended hits)
2. **All deploy/infrastructure references are confirmed updated** (you've actually checked the deploy provider's UI, not just assumed)
3. **The CI passes a fresh build** (catches missing env vars at boot rather than at first use)
4. **A smoke test of the affected path runs** in dev or staging — not just `tests pass`, but actual end-to-end verification that the renamed thing still works
5. **The change is committed atomically** (the old name is not present in the new state of main)

If any step is skipped, you've left fabrication-fuel for future sessions: either the old name lingers (creating ambiguity) or the new name is missing somewhere (creating runtime failures).

## When Removing vs. Renaming

**Renaming** is straightforward: search-and-replace, update every reference, atomic commit. The audit confirms zero hits on the old name.

**Removing** is harder because there's nothing to replace with. After removing the thing, the audit should:
- Confirm zero remaining references in code (the removal is genuinely complete)
- Update or delete any docs that explained the removed thing
- Update `.env.example` / docker-compose.yml / etc. to drop the now-unreferenced env vars
- If the removal had a migration path (e.g., "deprecated: use X instead"), confirm callers have actually moved to X

**Common failure mode:** removing the primary file but leaving env var references "as fallbacks just in case." That's not "defensive coding"; that's leaving dangling references for a future session to misread. Either the env var is needed (in which case the removal is incomplete) or it isn't (in which case the references should go).

## When You Can't Verify Adjacent Surfaces

Sometimes you don't have access to the deployment provider, DNS console, or external tooling. In those cases:

1. **Make the change in code**
2. **Document explicitly** in the commit message and PR description that adjacent surfaces (e.g., "Render env vars must also be renamed from X to Y") need manual updates
3. **Tag the human owner** to handle the manual side
4. **Don't claim "done"** until the manual step is confirmed — say "code-side complete; awaiting deploy-config update."

The May 2026 Atrium incident happened in part because the agent that removed the middleware did NOT note the env var dependency in deploy configs.

## Per-Agent Notes

- **Coda (Codex on operator surface):** highest risk. Codex's training profile generates plausible-sounding completions; it's especially likely to update one file and stop. **Mandatory:** when delegating any breaking change via `claude-delegate`, include explicit audit instructions in the prompt — e.g., *"after the rename, grep the entire repo for the old name and confirm zero hits. List every file you changed."*
- **Byte:** lower direct exposure (mostly drafts/sends emails). But if Byte ever modifies its own scripts or memory files, the rule applies.
- **Dex:** medium-high. Reading code IS Dex's job; the audit is part of due-diligence. When Dex proposes a refactor, expect the audit to be part of the proposal, not a separate follow-up.

## When This Rule Applies vs. When It Doesn't

**Applies:** any change that breaks a contract callers depend on. Env vars, public APIs, file structure, exported symbols, deploy configs, schema changes.

**Doesn't apply:** purely internal refactors that don't change any externally-visible name or contract. Renaming a private helper inside one file? Free to do without an audit. Reordering arguments in a function only called from two places, both updated atomically? Fine.

The line is: **does anyone outside the file you're editing know about this thing?** If yes, audit. If no, freely refactor.

## Companion Protocols

- `verify-before-claim.md` — don't assert what you haven't read. The audit IS verification before claiming the refactor is complete.
- `skill-documentation.md` — when removing or replacing a custom skill, search-and-clean is also part of the convention there.
- This file (`refactor-hygiene.md`) — the general engineering hygiene that all the above are special cases of.

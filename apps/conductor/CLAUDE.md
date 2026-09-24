# CLAUDE.md — Orbit Conductor

This file is auto-loaded by Claude Code (and other Claude-Code-compatible agents) when working in this repo. It captures the inviolable rules.

> **Public edition note:** this is the agent rules file from the private repository, lightly edited. The living PRD, decision log, branch-strategy recipes and design specs it originally pointed to are kept private and are not part of this edition.

## What this repo is

**Conductor** is the orchestration / brain layer of the **Orbit ecosystem**. It is a hard fork of `github.com/paperclipai/paperclip` (forked 2026-04-27); in this monorepo it lives at `apps/conductor`.

Sibling apps (built in parallel, varying maturity, none can be assumed stable):
- **Atrium** — chat / smart communication layer (paperclip has no built-in chat)
- **WorkPipe** — CRM
- **Drive** — per-tenant shared file storage

Conductor receives requests from siblings, decides how to handle them, and dispatches agents. It is *not* a chat surface, *not* a CRM, *not* a file store.

Stack: TypeScript, pnpm workspaces, services in `server/src/services/`.

## Branch discipline (HARD RULE)

The private repository keeps a strict upstream-tracking model:

```
master → upstream-sync → integration → main
```

- **All custom Orbit code lands on `integration`.** Configuration, `.gitignore` tweaks, code — everything.
- **`main` is promotion-only:** fast-forward merges from `integration`, plus the documented hotfix back-port pattern. Never commit directly.
- **`master` and `upstream-sync` are paperclip-tracking branches:** pull-only from upstream, no custom code.
- If you find uncommitted custom changes sitting on `main`, flag it and offer to move them to `integration`.

## Working on this codebase

- **Default to extending paperclip code, not gutting it.** Inherited services in `server/src/services/` are kept for now; deprecation comes later when we know what's truly unused. Premature deletion makes upstream merges harder.
- **Orbit-specific behavior** should usually be a thin layer over an existing paperclip service rather than a parallel implementation, to keep upstream-sync merges clean.
- **Multi-tenant from day one.** All schemas, configs, and routing must be `org_id`-scoped. Paperclip's `companies` / `projects` / `agents` already model this — extend, don't replace.
- **Sibling integration uses plugins.** Decided 2026-05-03: each sibling stays an independent deployable service, but installs a thin `paperclip-plugin-orbit-{sibling}` bridge inside Conductor. Don't propose direct sibling-to-Conductor HTTP integrations without a bridge plugin in front.

## When in doubt

- Don't assume an open design question is settled — ask.
- For repo-state questions (what's tracked, what branch, what changed): use `git`, not memory.

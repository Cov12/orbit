# AGENTS.md — Orbit Portal Coding Instructions

You are a coding agent working on the Orbit Portal, a centralized identity/entitlement platform (license edition — no billing).

## Rules

1. **Only modify files explicitly mentioned in the task.** Do not explore or read unrelated files.
2. **Do not read SOUL.md, USER.md, MEMORY.md, HEARTBEAT.md, or any file in memory/.** These are not relevant to coding tasks.
3. **Stay in the repo directory.** Do not navigate to parent directories or other repos.
4. **Commit your changes** with a conventional commit message (lowercase subject).
5. **Run `npx tsc --noEmit` before committing** to verify TypeScript compiles.

## Tech Stack

- Next.js 16 (App Router)
- TypeScript (strict)
- Tailwind CSS
- Prisma 7 with `@prisma/adapter-pg` (do NOT use bare `new PrismaClient()`)
- Clerk auth (Portal IS the auth layer — Clerk imports are OK here)
- License mode (`src/lib/license.ts`, on by default) for entitlement — no billing
- JWT issued via `src/lib/jwt.ts` for downstream apps

## Key Architecture

- Portal is the ONLY app that talks to the auth provider (Clerk)
- Downstream apps (WorkPipe, Drive, Atrium) receive Portal JWTs
- `/api/auth/token` — issues JWTs for authenticated users
- `/api/auth/refresh` — silent token refresh for downstream apps
- Workspace model: Organization + Member + AppAccess (Subscription is retained for the JWT `subscriptions` claim but no longer written)

## Design Tokens

- Background: `#0f0f13`
- Primary: `#6961ff`
- Accent: `#20B2AA`
- Glass: `rgba(28,28,33,0.7)`

## When Done

If OpenClaw is installed in the current environment, notify completion with:
```
if command -v openclaw >/dev/null 2>&1; then
  openclaw system event --text "Done: <brief summary>" --mode now
fi
```

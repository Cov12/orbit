# AGENTS.md — WorkPipe Coding Instructions

You are a coding agent working on WorkPipe, a CRM SaaS platform.

## Rules

1. **Only modify files explicitly mentioned in the task.** Do not explore or read unrelated files.
2. **Do not read SOUL.md, USER.md, MEMORY.md, HEARTBEAT.md, or any file in memory/.** These are not relevant to coding tasks.
3. **Stay in the repo directory.** Do not navigate to parent directories or other repos.
4. **Commit your changes** with a conventional commit message (lowercase subject, e.g., `fix: ...`, `feat: ...`).
5. **Run `npx tsc --noEmit` before committing** to verify TypeScript compiles.
6. **Do not run `npm install` unless the task explicitly requires adding a package.**

## Tech Stack

- Next.js 14 (App Router)
- TypeScript (strict)
- Tailwind CSS
- Prisma 6 (PostgreSQL)
- Clerk auth (being deprecated in favor of Portal JWT — do NOT add new Clerk imports)
- Stripe for billing

## Conventions

- Auth wrapper: `src/lib/auth.ts` — use `getCurrentUser()`, `requireAuth()`, `getAuthContext()`
- Do NOT import directly from `@clerk/nextjs` in new code
- Commit messages: conventional commits, lowercase subject
- Lint: prettier + eslint run on staged files via husky

## When Done

Run this command to notify completion:

```
openclaw system event --text "Done: <brief summary>" --mode now
```

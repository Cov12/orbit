# AGENTS.md — Orbit Drive Coding Instructions

You are a coding agent working on Orbit Drive, a secure file storage service.

## Rules

1. **Only modify files explicitly mentioned in the task.** Do not explore or read unrelated files.
2. **Do not read SOUL.md, USER.md, MEMORY.md, HEARTBEAT.md, or any file in memory/.** These are not relevant to coding tasks.
3. **Stay in the repo directory.** Do not navigate to parent directories or other repos.
4. **Commit your changes** with a conventional commit message (lowercase subject).
5. **Run `npx tsc --noEmit` before committing** to verify TypeScript compiles.

## Tech Stack

- Next.js 15 (App Router)
- TypeScript (strict)
- Tailwind CSS
- Prisma 7 with `@prisma/adapter-pg` (do NOT use bare `new PrismaClient()`)
- Clerk auth (shared with Portal for SSO)
- Cloudflare R2 for object storage
- Per-file keys are generated and wrapped per org (`src/lib/encryption.ts`), but file content is not encrypted yet (uploads go straight to the private bucket). Don't describe Drive as encrypted until that's wired up.

## Key Architecture

- Auth: Portal JWT accepted via middleware, Clerk as fallback
- Upload flow: initUpload → PUT to R2 → confirmUpload (3-step)
- `src/lib/drive-auth.ts` — access control (Phase 1: pass-through)
- `src/lib/drive-client.ts` — R2 operations
- `src/lib/drive-crypto.ts` — encryption/decryption

## When Done

If OpenClaw is installed in the current environment, notify completion with:
```
if command -v openclaw >/dev/null 2>&1; then
  openclaw system event --text "Done: <brief summary>" --mode now
fi
```

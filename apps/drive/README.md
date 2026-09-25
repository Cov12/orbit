# Orbit Drive

Secure org-scoped file storage for the Orbit product suite. Built on Cloudflare R2.

**Free with any Orbit subscription.** Auth managed by [Orbit Portal](https://portal.orbit.example).

## Tech Stack

- **Framework**: Next.js (App Router)
- **Auth**: Portal JWT (`orbit_token` cookie) — zero Clerk dependency
- **Database**: PostgreSQL + Prisma 7 (Neon, `@prisma/adapter-pg`)
- **Storage**: Cloudflare R2 (S3-compatible)
- **Encryption**: Server-side AES-256-GCM (client-side WebCrypto planned for Phase 2)

## Authentication

Drive accepts Portal-issued JWTs only. It has no knowledge of Clerk or any auth provider.

### Auth flow

1. User clicks "Launch" on Drive from Portal
2. Portal redirects to `/auth/callback?token=<jwt>`
3. Drive validates JWT, sets HTTP-only cookie (`orbit_token`)
4. User accesses Drive dashboard

### Key auth files

- `src/lib/portal-jwt.ts` — JWT verification
- `src/app/auth/callback/route.ts` — Token handoff endpoint
- `src/middleware.ts` — Auth check (Clerk legacy, being migrated to Portal JWT)

**Note:** Middleware has not yet been fully updated to check `orbit_token` cookie. The callback route works; middleware migration is in progress.

## Features

- Folder creation, navigation, breadcrumbs
- File upload (3-step: `initUpload` → PUT to R2 → `confirmUpload`)
- File download with pre-signed URLs
- Public file sharing via share links
- Audit logging
- Per-org storage quotas

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/drive/folders` | GET/POST | List/create folders |
| `/api/drive/files` | GET | List files in folder |
| `/api/drive/files/init-upload` | POST | Start upload (get pre-signed URL) |
| `/api/drive/files/confirm-upload` | POST | Confirm upload complete |
| `/api/drive/files/[fileId]/download` | GET | Get download URL |
| `/api/drive/files/[fileId]` | DELETE | Delete file |
| `/api/drive/shares` | POST | Create share link |
| `/api/drive/shares/[shareId]` | GET | Access shared file |

## Environment Variables

```
DATABASE_URL=postgresql://...
JWT_SECRET=<shared with Portal and WorkPipe>
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=orbit-drive
DRIVE_MASTER_KEY=<AES encryption key>
NEXT_PUBLIC_PORTAL_URL=https://portal.orbit.example
```

## Getting Started

```bash
npm install
npx prisma generate
npx prisma db push
npm run dev
```

## License

Proprietary — © Orbit

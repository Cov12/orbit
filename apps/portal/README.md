# Orbit Portal

Centralized identity and entitlement portal for Orbit (Orbit) products.

This is the **license edition**: there is no commercial billing. Every organization is licensed and fully entitled to every app (see [License Mode](#license-mode)).

**One login. All of Orbit.**

## Products

- **WorkPipe CRM** — Pipelines, contacts, invoices, automations
- **Orbit Drive** — Secure org-scoped file storage
- **Atrium** — AI-powered department heads for sales, support, and operations
- **Conductor** — AI back office that plans, delegates, and executes work

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript** (strict mode)
- **Clerk** (auth — production instance on `orbit.example`)
- **Prisma 7** (PostgreSQL via Neon)
- **Tailwind CSS**

## Architecture

Portal is the **single auth boundary** for all Orbit apps. Downstream apps have zero knowledge of what auth provider Portal uses (currently Clerk). To swap auth providers, change Portal only.

```
portal.orbit.example (this app)
├── Auth (Clerk) — sign-in, sign-up, workspaces
├── JWT Issuance — /api/auth/token, /api/auth/refresh
├── Entitlements — license mode + per-org AppAccess (lib/license.ts, lib/entitlements.ts)
├── App Launcher — launch WorkPipe, Drive, Atrium, or Conductor
├── App Landing Pages — /apps/workpipe, /apps/drive, /apps/atrium, /apps/conductor
└── Webhooks — Clerk user sync

Downstream apps validate Portal JWTs — they never touch Clerk directly.
```

### Cross-App Auth Flow

```
User signs in on Portal
  → Portal authenticates via Clerk
  → User clicks "Launch" on an app
  → Portal redirects to /api/auth/refresh?redirect_uri=<app>/auth/callback
  → Portal issues JWT, redirects to app's /auth/callback?token=<jwt>
  → App validates JWT, sets HTTP-only cookie (orbit_token)
  → User lands on app dashboard

Session expiry:
  → App middleware detects expired JWT
  → Redirects to Portal /api/auth/refresh?redirect_uri=<callback>
  → If Clerk session valid: new JWT issued, seamless redirect back
  → If not: Portal sign-in → redirect back after auth
```

### JWT Payload

See `OrbitJwtPayload` in `src/types/index.ts` for the authoritative shape.

```typescript
{
  sub: string                 // User ID
  email: string               // User email
  name: string                // User display name
  org_id: string              // Workspace ID
  org_slug: string
  org_name?: string
  org_logo?: string | null
  org_industry?: string | null
  sub_account_id?: string | null  // null/absent = business scope
  role: string                // OWNER | ADMIN | MEMBER
  subscriptions: { plan: string; status: string }[]
  app_access: string[]        // e.g. ["ATRIUM", "CONDUCTOR", "DRIVE", "WORKPIPE"]
  aud?: string                // "conductor" for Conductor launches
  iat: number
  exp: number
}
```

`subscriptions` is part of the cross-app contract (downstream apps read it), so
its shape is kept even though Portal no longer creates subscriptions. For a
licensed org with no subscription rows, Portal synthesizes
`[{ plan: "ENTERPRISE", status: "ACTIVE" }]`.

Cookie: `orbit_token` — HTTP-only, Secure, SameSite=Lax, path=/

## Custom Domains

| App | Domain |
|-----|--------|
| Portal | `portal.orbit.example` |
| Drive | `drive.orbit.example` |
| WorkPipe | `workpipe.orbit.example` (staging) |
| Atrium | `atrium.orbit.example` (staging) |

## License Mode

License mode is **on by default** (`ORBIT_LICENSE_MODE` unset). While active,
every organization is entitled to every app: the JWT `app_access` claim lists
all apps, the `subscriptions` claim is synthesized, and the dashboard shows
"Licensed — all apps included".

| Variable | Values | Effect |
|----------|--------|--------|
| `ORBIT_LICENSE_MODE` | unset/empty, `1`, `true`, `on`, `yes` | License mode on (default) |
| | `0`, `false`, `off`, `no` | Off — entitlement comes from the per-org `licensed` flag (super-admin toggle) and `AppAccess` rows |
| | anything else | Fails closed (off), logged |
| `ORBIT_LICENSE_EXPIRES_AT` | ISO date/datetime | License lapses after this instant; unparseable fails closed |

New workspaces get an `AppAccess` row for every app (or for the `apps` passed to
`POST /api/workspaces/create`). No subscriptions or trials are created.

## Database

Neon Postgres with Prisma 7 (`@prisma/adapter-pg`).

Key models: Organization (workspace), Member, AppAccess, Subscription (retained for existing rows and the JWT claim; no longer written), DriveFolder, DriveFile, DriveShare, DriveAuditLog, StorageQuota.

Enums: AppType (WORKPIPE, ATRIUM, DRIVE, CONDUCTOR), MemberRole (OWNER, ADMIN, MEMBER), Plan (FREE, STARTER, PRO, BUSINESS, GROWTH, ENTERPRISE).

## Getting Started

```bash
npm install
cp .env.example .env
# Fill in Clerk, database, and JWT credentials
npx prisma generate
npx prisma db push
npm run dev
```

## Key Environment Variables

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
DATABASE_URL=postgresql://...
JWT_SECRET=<shared across Portal, WorkPipe, Drive>
NEXT_PUBLIC_WORKPIPE_URL=https://workpipe.orbit.example
NEXT_PUBLIC_DRIVE_URL=https://drive.orbit.example/drive
NEXT_PUBLIC_ATRIUM_URL=https://atrium.orbit.example
```

## Deployment

Render Web Service. Auto-deploys from `main` branch. Custom domain `portal.orbit.example` via CNAME.

## License

Proprietary — © Orbit

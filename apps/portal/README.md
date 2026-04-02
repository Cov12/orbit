# Orbit Portal

Centralized identity and billing portal for Orbit (Orbit) products.

**One login. All of Orbit.**

## Products

- **WorkPipe CRM** — Pipelines, contacts, invoices, automations
- **Orbit Drive** — Secure org-scoped file storage (Free with any subscription)
- **Atrium** — AI-powered department heads for sales, support, and operations

## Tech Stack

- **Next.js 16** (App Router)
- **TypeScript** (strict mode)
- **Clerk** (auth — production instance on `orbit.example`)
- **Prisma 7** (PostgreSQL via Neon)
- **Stripe** (billing + per-app subscriptions, test mode)
- **Tailwind CSS**

## Architecture

Portal is the **single auth boundary** for all Orbit apps. Downstream apps have zero knowledge of what auth provider Portal uses (currently Clerk). To swap auth providers, change Portal only.

```
portal.orbit.example (this app)
├── Auth (Clerk) — sign-in, sign-up, workspaces
├── JWT Issuance — /api/auth/token, /api/auth/refresh
├── Billing — Stripe per-app subscriptions, annual discount (15%)
├── App Launcher — launch WorkPipe, Drive, or Atrium
├── App Landing Pages — /apps/workpipe, /apps/drive, /apps/atrium
└── Webhooks — Clerk user sync + Stripe subscription events

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

```typescript
{
  sub: string        // User ID
  email: string      // User email
  name: string       // User display name
  org_id: string     // Workspace ID
  role: string       // OWNER | ADMIN | MEMBER | CLIENT
  apps: string[]     // ["WORKPIPE", "DRIVE", "ATRIUM"]
  plan: string       // Current plan
  iat: number
  exp: number
}
```

Cookie: `orbit_token` — HTTP-only, Secure, SameSite=Lax, path=/

## Custom Domains

| App | Domain |
|-----|--------|
| Portal | `portal.orbit.example` |
| Drive | `drive.orbit.example` |
| WorkPipe | `workpipe.orbit.example` (staging) |
| Atrium | `atrium.orbit.example` (staging) |

## Billing Model

Per-app subscriptions (not bundled tiers):

| App | Starter | Pro/Growth | Business/Enterprise |
|-----|---------|------------|---------------------|
| WorkPipe | $—/mo | $—/mo | $—/mo |
| Atrium | $—/mo | $—/mo | $—/mo |
| Drive | Free | Free | Free |

- Annual billing: discounted
- Stripe test mode (switch to live before launch)
- New workspaces get WorkPipe + Drive auto-enabled

## Database

Neon Postgres with Prisma 7 (`@prisma/adapter-pg`).

Key models: Organization (workspace), Member, Subscription (per-app via `@@unique([orgId, app])`), AppAccess, DriveFolder, DriveFile, DriveShare, DriveAuditLog, StorageQuota.

Enums: AppType (WORKPIPE, ATRIUM, DRIVE), MemberRole (OWNER, ADMIN, MEMBER), Plan (FREE, STARTER, PRO, BUSINESS, GROWTH, ENTERPRISE).

## Getting Started

```bash
npm install
cp .env.example .env
# Fill in Clerk, Stripe, Neon, and JWT credentials
npx prisma generate
npx prisma db push
npm run dev
```

## Key Environment Variables

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
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

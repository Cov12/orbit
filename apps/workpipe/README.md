# WorkPipe

Multi-tenant SaaS platform for business management — pipelines, contacts, invoices, funnels, and automations.

**Part of the Orbit product suite.** Auth and billing managed by [Orbit Portal](https://portal.orbit.example).

## Tech Stack

- **Framework**: Next.js (App Router + Pages hybrid)
- **Auth**: Portal JWT (`orbit_token` cookie) — zero Clerk dependency
- **Database**: PostgreSQL + Prisma 6.19.2
- **Styling/UI**: Tailwind CSS + shadcn/ui
- **Payments**: Stripe Billing + Connect
- **File Uploads**: UploadThing

## Authentication

WorkPipe has **no knowledge of what auth provider Portal uses**. All auth flows go through Orbit Portal JWTs.

### How it works

1. User signs in on `portal.orbit.example`
2. Portal redirects to `/auth/callback?token=<jwt>`
3. WorkPipe validates the JWT and sets an HTTP-only cookie (`orbit_token`)
4. Middleware checks the cookie on every request
5. On expiry → redirect to Portal `/api/auth/refresh` for seamless re-auth

### Key auth files

- `src/lib/portal-jwt.ts` — JWT verification (the ONLY auth interface with Portal)
- `src/lib/auth.ts` — Auth wrapper (`getCurrentUser()`, `requireAuth()`, `getAuthContext()`)
- `src/lib/auth-client.tsx` — Client components (AuthProvider, UserAvatar with sign-out)
- `src/app/auth/callback/route.ts` — Token handoff endpoint
- `src/middleware.ts` — Portal JWT check on every request

### To swap auth providers

Change Portal only. WorkPipe stays the same. The JWT contract is the boundary.

## Core Features

- Multi-tenant structure (Business → Subaccounts)
- CRM with pipelines, tickets, contacts (kanban)
- Funnel & website builder (drag-and-drop, Stripe checkout)
- Business billing dashboard with subscriptions
- Media asset management
- Notifications & theming (light/dark)
- Subdomain routing for white-label agency sites

## Environment Variables

```
DATABASE_URL=postgresql://...
JWT_SECRET=<shared with Portal and Drive>
NEXT_PUBLIC_PORTAL_URL=https://portal.orbit.example
NEXT_PUBLIC_DOMAIN=workpipe.orbit.example
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
UPLOADTHING_SECRET=...
```

## Getting Started

```bash
npm install
cp .env.example .env
npx prisma generate
npx prisma db push
npm run dev
```

## License

Proprietary — © Orbit

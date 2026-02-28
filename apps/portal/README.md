# Orbit Portal

Centralized identity and billing portal for Orbit (Orbit) products.

**One login. All of Orbit.**

## Products

- **WorkPipe CRM** — Pipelines, contacts, invoices, automations
- **Atrium** — AI-powered department heads for sales, support, and operations

## Tech Stack

- **Next.js 15** (App Router)
- **TypeScript** (strict mode)
- **Clerk** (auth + organizations)
- **Prisma** (PostgreSQL)
- **Stripe** (billing + subscriptions)
- **Tailwind CSS v4**

## Architecture

```
portal.orbit.example (this app)
├── Auth (Clerk) — sign-in, sign-up, organizations
├── JWT Issuance — /api/auth/token (cross-app auth)
├── Billing — Stripe subscriptions, plan management
├── App Launcher — launch WorkPipe or Atrium
└── Webhooks — Clerk org sync + Stripe subscription events

WorkPipe / Atrium validate Orbit JWTs to authorize users.
```

## Getting Started

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Fill in Clerk, Stripe, and database credentials

# Set up database
npx prisma generate
npx prisma db push

# Run dev server
npm run dev
```

## Environment Variables

See `.env.example` for required variables.

## JWT Token

The portal issues JWTs for cross-app auth. Other Orbit apps validate these tokens:

```typescript
// Token payload
{
  sub: "clerk_user_id",
  org_id: "cuid",
  org_slug: "my-company",
  role: "OWNER" | "ADMIN" | "MEMBER",
  subscriptions: [{ plan: "PRO", status: "ACTIVE" }],
  app_access: ["WORKPIPE", "ATRIUM"],
  iat: number,
  exp: number
}
```

## Plans

| Plan | Price | WorkPipe | Atrium |
|------|-------|----------|----------|
| Free | $—/mo | Basic | — |
| Starter | $—/mo | Full | — |
| Pro | $—/mo | Full | ✓ |
| Enterprise | $—/mo | Full | ✓ + White-label |

## License

Proprietary — © Orbit

# WorkPipe Billing Artifacts

## Files
- `prisma-billing-schema.diff` — patch to add billing models to your Prisma schema.
- `migrations/20250914_add_billing.sql` — Postgres SQL migration creating billing tables/enums.
- `app_api_stripe_webhook_route.ts` — Next.js App Router Stripe webhook handler (place at `app/api/stripe/webhook/route.ts`).

## Env Vars
```
STRIPE_SECRET_KEY=sk_live_or_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
DATABASE_URL=postgresql://...
```

## Next.js Notes
- App Router route expects **raw body**; it verifies `stripe-signature` using `STRIPE_WEBHOOK_SECRET`.
- Ensure your `Business` model includes `stripeCustomerId` and your `Subscription` model includes `stripeSubscriptionId` + `status` to sync.

## Stripe CLI (local dev)
```
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

## Prisma
- Apply the patch to `schema.prisma`, then run:
```
npx prisma generate
npx prisma migrate dev --name add_billing
```
(Or apply the raw SQL migration manually in production.)

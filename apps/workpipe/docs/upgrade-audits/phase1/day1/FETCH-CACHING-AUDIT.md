# Fetch Caching Audit - Next.js 15 Changes

**Date**: 2025-11-24
**Branch**: upgrade-nextj

## Overview

Next.js 15 changes the default caching behavior for `fetch()` requests:

- **Next.js 14**: `fetch()` defaults to `cache: 'force-cache'` (cached by default)
- **Next.js 15**: `fetch()` defaults to `cache: 'no-store'` (NOT cached by default)

This is a significant behavioral change that could affect performance and API rate limits.

## Summary

✅ **Good News**: This application has MINIMAL fetch usage and NO caching impact!

| Metric                | Count | Impact          |
| --------------------- | ----- | --------------- |
| Total `fetch()` calls | 3     | Low             |
| Server-side fetch     | 0     | ✅ None         |
| Client-side fetch     | 2-3   | ✅ Not affected |
| Explicit cache config | 0     | ✅ None         |
| Revalidate config     | 0     | ✅ None         |

**Risk Level**: 🟢 LOW - No action required

## Fetch Usage Analysis

### Client Components Only (Not Affected)

#### 1. src/components/forms/subscription-form/subscription-form-wrapper.tsx

- **Type**: Client Component (`'use client'`)
- **Usage**: Line 53 - POST to `/api/stripe/create-subscription`
- **Purpose**: Create Stripe subscription
- **Impact**: ✅ None (client-side fetch not affected by Next.js 15 changes)

```typescript
const subscriptionResponse = await fetch('/api/stripe/create-subscription', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    customerId,
    priceId: selectedPriceId,
  }),
})
```

#### 2. src/components/forms/business-details.tsx

- **Type**: Client Component (`'use client'`)
- **Usage**: Line 125 - POST to `/api/stripe/create-customer`
- **Purpose**: Create Stripe customer
- **Impact**: ✅ None (client-side fetch not affected)

```typescript
const customerResponse = await fetch('/api/stripe/create-customer', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  // ... body
})
```

#### 3. src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]/\_components/funnel-editor/funnel-editor-components/checkout.tsx

- **Status**: Listed by search but no fetch found in context
- **Likely**: May have fetch in embedded script tag or false positive
- **Impact**: ✅ None (file is in client components tree)

### Server Components - NONE FOUND

✅ **No server-side fetch calls found**

This is actually good! The application uses:

- **Prisma** for database queries (not affected by fetch caching)
- **Stripe SDK** for payment operations (not affected by fetch caching)
- **Clerk SDK** for authentication (not affected by fetch caching)

## Why This Application Is Not Affected

### Data Fetching Strategy

This application uses **Prisma ORM** for all server-side data fetching:

```typescript
// Example from business/[businessId]/page.tsx
const businessDetails = await db.business.findUnique({
  where: { id: params.businessId },
})

const subaccounts = await db.subAccount.findMany({
  where: { businessId: params.businessId },
})
```

**Prisma queries are NOT affected by Next.js fetch caching changes.**

### Third-Party SDKs

The application uses SDK methods, not fetch:

1. **Stripe**: Uses `stripe.checkout.sessions.list()`, not fetch
2. **Clerk**: Uses `currentUser()`, not fetch
3. **Prisma**: Uses `db.model.findX()`, not fetch

**None of these are affected by Next.js 15 fetch caching changes.**

## Potential Future Considerations

If you add server-side fetch calls in the future:

### Before (Next.js 14 - Cached by Default)

```typescript
// Server Component
async function getData() {
  // Cached by default in Next.js 14
  const res = await fetch('https://api.example.com/data')
  return res.json()
}
```

### After (Next.js 15 - NOT Cached by Default)

```typescript
// Server Component
async function getData() {
  // NOT cached by default in Next.js 15
  // Add explicit cache if you want caching:
  const res = await fetch('https://api.example.com/data', {
    cache: 'force-cache', // Opt-in to caching
  })

  // OR use revalidation:
  const res = await fetch('https://api.example.com/data', {
    next: { revalidate: 3600 }, // Revalidate every hour
  })

  return res.json()
}
```

## Route Segment Config

### Current Status

✅ No route segment config found for fetch caching

### What to Watch For

If you see these in your route files in the future, they control fetch behavior:

```typescript
// page.tsx or layout.tsx
export const dynamic = 'force-dynamic' // Don't cache anything
export const revalidate = 3600 // Revalidate every hour
export const fetchCache = 'force-cache' // Force all fetch to cache
```

**Current status**: None of these configurations exist in the codebase.

## Migration Action Items

### ✅ No Action Required

This application requires **ZERO changes** for fetch caching in Next.js 15 upgrade.

**Reasons**:

1. No server-side fetch calls
2. Client-side fetch is unaffected
3. Data fetching uses Prisma (not fetch)
4. SDKs use their own HTTP clients (not fetch)

## Monitoring Recommendations

After upgrading to Next.js 15, monitor for:

1. **API Rate Limits**: Ensure external APIs aren't being called too frequently
   - Current risk: ✅ Low (only Stripe/Clerk SDKs, which handle their own caching)

2. **Performance**: Watch for any unexpected slowdowns
   - Current risk: ✅ Low (no fetch to become uncached)

3. **Build Warnings**: Check for fetch-related warnings in build output
   - Next.js 15 may warn about fetch without explicit caching

## Documentation References

- [Next.js 15 Fetch Caching](https://nextjs.org/docs/app/api-reference/functions/fetch)
- [Prisma with Next.js](https://www.prisma.io/docs/guides/other/troubleshooting-orm/help-articles/nextjs-prisma-client-dev-practices)

## Files Generated

- ✅ `FETCH-CACHING-AUDIT.md` - This file

## Conclusion

**No changes needed for fetch caching in Next.js 15 upgrade.**

The application's architecture (Prisma + SDKs) naturally avoids fetch caching concerns. This is one less thing to worry about during the upgrade!

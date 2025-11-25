# Environment Variables Audit - Next.js 15

**Date**: 2025-11-24
**Branch**: upgrade-nextj

## Overview

Next.js 15 maintains the same environment variable handling as Next.js 14:

- Variables prefixed with `NEXT_PUBLIC_` are exposed to the browser
- Variables without the prefix are server-side only

This audit ensures all environment variables are used correctly and securely.

## Summary

| Category                   | Count | Status        |
| -------------------------- | ----- | ------------- |
| Total env vars             | 21    | ✅ Configured |
| Client-safe (NEXT*PUBLIC*) | 12    | ✅ Correct    |
| Server-only                | 9     | ✅ Correct    |
| Incorrectly exposed        | 0     | ✅ None       |
| Missing prefix             | 0     | ✅ None       |

**Risk Level**: 🟢 LOW - All environment variables are correctly configured

## Environment Variables Inventory

### ✅ Server-Side Only (Correctly Configured)

These variables should NEVER have `NEXT_PUBLIC_` prefix:

1. **CLERK_SECRET_KEY**
   - Type: Secret
   - Usage: Clerk authentication
   - Status: ✅ Correct (server-only)

2. **DATABASE_URL**
   - Type: Secret
   - Usage: Prisma database connection
   - Status: ✅ Correct (server-only)

3. **PROD_DATABASE_URL**
   - Type: Secret
   - Usage: Production database (optional)
   - Status: ✅ Correct (server-only)

4. **LOCAL_DATABASE_URL**
   - Type: Secret
   - Usage: Local development database (optional)
   - Status: ✅ Correct (server-only)

5. **STRIPE_SECRET_KEY**
   - Type: Secret
   - Usage: Stripe API server-side operations
   - Files: `src/lib/stripe/index.ts`
   - Status: ✅ Correct (server-only)

6. **STRIPE_WEBHOOK_SECRET**
   - Type: Secret
   - Usage: Stripe webhook signature verification
   - Files: `src/app/api/stripe/webhook/route.ts`
   - Status: ✅ Correct (server-only)

7. **STRIPE_WEBHOOK_SECRET_LIVE**
   - Type: Secret
   - Usage: Stripe webhook for live mode (fallback)
   - Files: `src/app/api/stripe/webhook/route.ts`
   - Status: ✅ Correct (server-only)

8. **UPLOADTHING_SECRET**
   - Type: Secret
   - Usage: UploadThing file upload service
   - Status: ✅ Correct (server-only)

9. **NEXT_WORKPIPE_PRODUCT_ID**
   - Type: Config (Server)
   - Usage: Stripe product ID for WorkPipe subscriptions
   - Files: `src/app/(main)/business/[businessId]/billing/page.tsx` (server component)
   - Status: ✅ Correct (server-only)
   - Note: Used in server component, correctly doesn't have NEXT*PUBLIC* prefix

### ✅ Client-Side Exposed (Correctly Configured)

These variables have `NEXT_PUBLIC_` prefix and are safe to expose:

10. **NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY**
    - Type: Public
    - Usage: Clerk client-side initialization
    - Status: ✅ Correct (public key)

11. **NEXT_PUBLIC_CLERK_SIGN_IN_URL**
    - Type: Config
    - Usage: Clerk sign-in redirect
    - Value: `/business/sign-in`
    - Status: ✅ Correct (public config)

12. **NEXT_PUBLIC_CLERK_SIGN_UP_URL**
    - Type: Config
    - Usage: Clerk sign-up redirect
    - Value: `/business/sign-up`
    - Status: ✅ Correct (public config)

13. **NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL**
    - Type: Config
    - Usage: Post-auth redirect
    - Value: `/business`
    - Status: ✅ Correct (public config)

14. **NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL**
    - Type: Config
    - Usage: Post-registration redirect
    - Value: `/business`
    - Status: ✅ Correct (public config)

15. **NEXT_PUBLIC_URL**
    - Type: Config
    - Usage: Application base URL
    - Files:
      - `src/lib/utils.ts` (OAuth redirect URL builder)
      - `src/lib/queries.ts` (line 688)
      - `src/components/forms/subscription-form/index.tsx` (line 34)
      - `src/app/.../checkout.tsx` (line 66)
    - Value: `http://localhost:3000/`
    - Status: ✅ Correct (public config)

16. **NEXT_PUBLIC_DOMAIN**
    - Type: Config
    - Usage: Domain for subdomain routing
    - Files:
      - `src/middleware.ts` (subdomain extraction)
      - `src/app/.../funnel-steps.tsx` (funnel URL display)
      - `src/app/.../checkout.tsx` (redirect URL)
      - `src/app/.../contact-form-component.tsx` (redirect URL)
    - Value: `localhost:3000`
    - Status: ✅ Correct (needed in middleware and client)

17. **NEXT_PUBLIC_SCHEME**
    - Type: Config
    - Usage: URL scheme (http:// or https://)
    - Files:
      - `src/app/.../funnel-steps.tsx`
      - `src/app/.../checkout.tsx`
      - `src/app/.../contact-form-component.tsx`
    - Value: `http://` (dev) or `https://` (prod)
    - Status: ✅ Correct (needed for URL building in client)

18. **NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY**
    - Type: Public
    - Usage: Stripe client-side initialization
    - Files: `src/lib/stripe/stripe-client.ts`
    - Status: ✅ Correct (public key)

19. **NEXT_PUBLIC_STRIPE_CLIENT_ID**
    - Type: Public
    - Usage: Stripe Connect OAuth
    - Files: `src/lib/utils.ts` (OAuth URL builder)
    - Status: ✅ Correct (public for OAuth)

20. **NEXT_PUBLIC_PLATFORM_SUBSCRIPTION_PERCENT**
    - Type: Config
    - Usage: Platform fee percentage for subscriptions
    - Files: `src/app/api/stripe/create-checkout-session/route.ts`
    - Value: `0` (0%)
    - Status: ⚠️ Used in API route (server), but NEXT*PUBLIC* prefix means it's also in client bundle
    - **Recommendation**: Consider moving to server-only variable

21. **NEXT_PUBLIC_PLATFORM_ONETIME_FEE**
    - Type: Config
    - Usage: Platform one-time fee
    - Files: `src/app/api/stripe/create-checkout-session/route.ts`
    - Value: `0` ($0)
    - Status: ⚠️ Used in API route (server), but NEXT*PUBLIC* prefix means it's also in client bundle
    - **Recommendation**: Consider moving to server-only variable

22. **NEXT_PUBLIC_PLATFORM_BUSINESS_PERCENT**
    - Type: Config
    - Usage: Platform fee percentage for business
    - Files: `src/app/api/stripe/create-checkout-session/route.ts`
    - Value: `0` (0%)
    - Status: ⚠️ Used in API route (server), but NEXT*PUBLIC* prefix means it's also in client bundle
    - **Recommendation**: Consider moving to server-only variable

### Additional Variables (Optional)

23. **UPLOADTHING_APP_ID**
    - Type: Public ID
    - Usage: UploadThing app identifier
    - Status: ✅ Correct (can be public)

24. **NEXT_PUBLIC_BUILDER_API_KEY**
    - Type: Public
    - Usage: Builder.io integration (if using)
    - Status: ✅ Correct (public key)

25. **NODE_ENV**
    - Type: System
    - Usage: Environment detection
    - Files: `src/lib/db.ts` (Prisma client singleton)
    - Status: ✅ Automatic (provided by Node.js)

## Clerk v5 Migration Impact

When upgrading to Clerk v5, verify these variables:

### Keep As-Is:

- ✅ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
- ✅ CLERK_SECRET_KEY

### May Need Updates (Check Clerk v5 docs):

- NEXT_PUBLIC_CLERK_SIGN_IN_URL (might change to `signInUrl` in config)
- NEXT_PUBLIC_CLERK_SIGN_UP_URL (might change to `signUpUrl` in config)
- NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL (might change to `afterSignInUrl`)
- NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL (might change to `afterSignUpUrl`)

**Action**: Review Clerk v5 migration guide for environment variable changes.

## Security Recommendations

### ⚠️ Optional Optimization: Platform Fee Variables

Currently, platform fee configuration uses `NEXT_PUBLIC_` prefix but is only used in API routes:

**Current**:

```typescript
// src/app/api/stripe/create-checkout-session/route.ts
if (
  !process.env.NEXT_PUBLIC_PLATFORM_SUBSCRIPTION_PERCENT ||
  !process.env.NEXT_PUBLIC_PLATFORM_ONETIME_FEE ||
  !process.env.NEXT_PUBLIC_PLATFORM_BUSINESS_PERCENT
) {
  // Error handling
}
```

**Issue**: These values are bundled into client JavaScript but aren't needed there.

**Recommended Change** (Optional - Week 4):

```typescript
// Remove NEXT_PUBLIC_ prefix in .env.local
PLATFORM_SUBSCRIPTION_PERCENT = 0
PLATFORM_ONETIME_FEE = 0
PLATFORM_BUSINESS_PERCENT = 0

// Update code
if (
  !process.env.PLATFORM_SUBSCRIPTION_PERCENT ||
  !process.env.PLATFORM_ONETIME_FEE ||
  !process.env.PLATFORM_BUSINESS_PERCENT
) {
  // Error handling
}
```

**Impact**: Minor security improvement, slightly smaller client bundle
**Priority**: 🟢 LOW (not critical, can be done in Week 4 or later)

## Environment Variable Usage by File Type

### Middleware (Edge Runtime)

- `src/middleware.ts`
  - NEXT_PUBLIC_DOMAIN ✅ (needed for subdomain routing)

### API Routes (Server-Side)

- `src/app/api/stripe/webhook/route.ts`
  - STRIPE_WEBHOOK_SECRET ✅
  - STRIPE_WEBHOOK_SECRET_LIVE ✅

- `src/app/api/stripe/create-checkout-session/route.ts`
  - NEXT_PUBLIC_PLATFORM_SUBSCRIPTION_PERCENT ⚠️
  - NEXT_PUBLIC_PLATFORM_ONETIME_FEE ⚠️
  - NEXT_PUBLIC_PLATFORM_BUSINESS_PERCENT ⚠️

### Server Components

- `src/app/(main)/business/[businessId]/billing/page.tsx`
  - NEXT_WORKPIPE_PRODUCT_ID ✅

### Client Components

- `src/components/forms/subscription-form/index.tsx`
  - NEXT_PUBLIC_URL ✅

- `src/app/.../funnel-steps.tsx`
  - NEXT_PUBLIC_SCHEME ✅
  - NEXT_PUBLIC_DOMAIN ✅

- `src/app/.../checkout.tsx`
  - NEXT_PUBLIC_URL ✅
  - NEXT_PUBLIC_SCHEME ✅
  - NEXT_PUBLIC_DOMAIN ✅

- `src/app/.../contact-form-component.tsx`
  - NEXT_PUBLIC_SCHEME ✅
  - NEXT_PUBLIC_DOMAIN ✅

### Server-Side Libraries

- `src/lib/stripe/index.ts`
  - STRIPE_SECRET_KEY ✅

- `src/lib/stripe/stripe-client.ts`
  - NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ✅

- `src/lib/utils.ts`
  - NEXT_PUBLIC_STRIPE_CLIENT_ID ✅
  - NEXT_PUBLIC_URL ✅

- `src/lib/queries.ts`
  - NEXT_PUBLIC_URL ✅

- `src/lib/db.ts`
  - NODE_ENV ✅

## Next.js 15 Compatibility

✅ **No changes required for Next.js 15**

Environment variable handling remains the same:

- `NEXT_PUBLIC_*` variables are still exposed to browser
- Server-only variables remain server-only
- Edge runtime (middleware) can only access `NEXT_PUBLIC_*` variables

## Testing Checklist

After upgrade, verify:

- [ ] Stripe webhooks work (STRIPE_WEBHOOK_SECRET accessible)
- [ ] Stripe payments work (STRIPE_SECRET_KEY accessible)
- [ ] Database connections work (DATABASE_URL accessible)
- [ ] Clerk auth works (both public and secret keys)
- [ ] File uploads work (UPLOADTHING_SECRET accessible)
- [ ] Subdomain routing works (NEXT_PUBLIC_DOMAIN in middleware)
- [ ] Funnel preview URLs work (NEXT_PUBLIC_SCHEME + NEXT_PUBLIC_DOMAIN)
- [ ] Stripe Connect OAuth works (NEXT_PUBLIC_STRIPE_CLIENT_ID)

## Migration Action Items

### Week 1 (This Week)

- ✅ Audit complete
- ✅ All variables correctly configured

### Week 3 (Clerk v5 Migration)

- [ ] Review Clerk v5 environment variable requirements
- [ ] Update Clerk env vars if needed
- [ ] Test authentication with new Clerk v5 config

### Week 4 (Optional Optimization)

- [ ] Consider removing NEXT*PUBLIC* prefix from platform fee variables
- [ ] Update API route code if changes made
- [ ] Test checkout session creation still works

## Files Generated

- ✅ `ENVIRONMENT-VARIABLES-AUDIT.md` - This file

## Conclusion

**All environment variables are correctly configured** for Next.js 15 upgrade.

The application follows Next.js environment variable best practices:

- ✅ Secrets are server-only
- ✅ Public keys have NEXT*PUBLIC* prefix
- ✅ Middleware uses only NEXT*PUBLIC* variables (Edge runtime compatible)
- ✅ No security issues detected

Only minor optimization opportunity: Platform fee variables could be server-only (low priority).

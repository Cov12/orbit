# Dynamic API Usage Audit - Next.js 15 Breaking Changes

**Date**: 2025-11-24
**Branch**: upgrade-nextj

## Overview

Next.js 15 makes several dynamic APIs asynchronous. This audit identifies all locations that need to be updated with `await`.

## Summary

| API            | Files Affected            | Severity    | Auto-Fixable |
| -------------- | ------------------------- | ----------- | ------------ |
| `headers()`    | 2                         | 🔴 CRITICAL | No (manual)  |
| `cookies()`    | 0                         | ✅ None     | N/A          |
| `draftMode()`  | 0                         | ✅ None     | N/A          |
| `params`       | 20 (18 pages + 2 layouts) | 🔴 HIGH     | No (manual)  |
| `searchParams` | 6                         | 🟡 MEDIUM   | No (manual)  |

**Total Files Requiring Updates**: 26 unique files

## 1. headers() Usage - CRITICAL

### Files Affected: 2

#### 🔴 src/app/api/stripe/webhook/route.ts (CRITICAL - STRIPE WEBHOOK)

**Line 22**: `const sig = headers().get('Stripe-Signature')`

**Current Code**:

```typescript
export async function POST(req: NextRequest) {
  let stripeEvent: Stripe.Event
  const body = await req.text()
  const sig = headers().get('Stripe-Signature') // ❌ Must await
  const webhookSecret =
    process.env.STRIPE_WEBHOOK_SECRET_LIVE ?? process.env.STRIPE_WEBHOOK_SECRET

  try {
    if (!sig || !webhookSecret) {
      console.log(
        '🔴 Error Stripe webhook secret or the signature does not exist.'
      )
      return
    }
    stripeEvent = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (error: any) {
    console.log(`🔴 Error ${error.message}`)
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 })
  }
  // ... rest of webhook logic
}
```

**Required Change**:

```typescript
export async function POST(req: NextRequest) {
  let stripeEvent: Stripe.Event
  const body = await req.text()
  const headersList = await headers() // ✅ Await headers()
  const sig = headersList.get('Stripe-Signature')
  const webhookSecret =
    process.env.STRIPE_WEBHOOK_SECRET_LIVE ?? process.env.STRIPE_WEBHOOK_SECRET

  try {
    if (!sig || !webhookSecret) {
      console.log(
        '🔴 Error Stripe webhook secret or the signature does not exist.'
      )
      return
    }
    stripeEvent = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (error: any) {
    console.log(`🔴 Error ${error.message}`)
    return new NextResponse(`Webhook Error: ${error.message}`, { status: 400 })
  }
  // ... rest of webhook logic
}
```

**Impact**: 🔴 CRITICAL

- If not fixed, Stripe webhooks will fail completely
- Payment processing will break
- No revenue can be collected via Stripe
- **MUST** also be added to public routes in Clerk v5 middleware

**Testing Required**:

- Test webhook signature verification still works
- Test subscription creation webhook
- Test subscription update webhook
- Use Stripe CLI to send test webhooks
- Verify webhook endpoint is publicly accessible (not behind auth)

#### 🟢 docs/workpipe_app_api_webhook_route_example.ts (LOW PRIORITY)

- This is a documentation/example file, not production code
- Should be updated for consistency but not critical
- Low risk if forgotten

## 2. cookies() Usage

✅ **No files found using `cookies()` from next/headers**

This is good news - no changes needed for cookie handling.

## 3. draftMode() Usage

✅ **No files found using `draftMode()` from next/headers**

This is good news - no changes needed for draft mode.

## 4. params Usage in Page Components - HIGH PRIORITY

### Files Affected: 18 page.tsx files

All page components with dynamic route params must await the `params` prop.

#### Pattern Change Required:

```typescript
// ❌ OLD (Next.js 14)
const Page = async ({ params }: { params: { businessId: string } }) => {
  const id = params.businessId
  const business = await db.business.findUnique({ where: { id } })
}

// ✅ NEW (Next.js 15)
const Page = async ({
  params,
}: {
  params: Promise<{ businessId: string }>
}) => {
  const { businessId } = await params
  const business = await db.business.findUnique({ where: { id: businessId } })
}
```

#### Files List:

**Business Routes (7 files)**:

1. `src/app/(main)/business/[businessId]/page.tsx`
   - Params: `businessId`
   - Usage: Lines 42, 50 (db queries)

2. `src/app/(main)/business/[businessId]/settings/page.tsx`
   - Params: `businessId`
   - Needs audit

3. `src/app/(main)/business/[businessId]/team/page.tsx`
   - Params: `businessId`
   - Needs audit

4. `src/app/(main)/business/[businessId]/all-subaccounts/page.tsx`
   - Params: `businessId`
   - Needs audit

5. `src/app/(main)/business/[businessId]/billing/page.tsx`
   - Params: `businessId`
   - Needs audit

6. `src/app/(main)/business/[businessId]/kickstart/page.tsx`
   - Params: `businessId`
   - Needs audit

7. `src/app/(main)/business/page.tsx`
   - Params: (root business route)
   - Needs audit

**Subaccount Routes (10 files)**: 8. `src/app/(main)/subaccount/[subaccountId]/page.tsx`

- Params: `subaccountId`
- Usage: Lines 46, 107, 178 (db queries, props)

9. `src/app/(main)/subaccount/[subaccountId]/pipelines/page.tsx`
   - Params: `subaccountId`
   - Needs audit

10. `src/app/(main)/subaccount/[subaccountId]/settings/page.tsx`
    - Params: `subaccountId`
    - Needs audit

11. `src/app/(main)/subaccount/[subaccountId]/pipelines/[pipelineId]/page.tsx`
    - Params: `subaccountId`, `pipelineId`
    - Multiple params - needs careful handling

12. `src/app/(main)/subaccount/[subaccountId]/funnels/page.tsx`
    - Params: `subaccountId`
    - Needs audit

13. `src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/page.tsx`
    - Params: `subaccountId`, `funnelId`
    - Multiple params

14. `src/app/(main)/subaccount/[subaccountId]/funnels/[funnelId]/editor/[funnelPageId]/page.tsx`
    - Params: `subaccountId`, `funnelId`, `funnelPageId`
    - Three params - complex

15. `src/app/(main)/subaccount/[subaccountId]/contacts/page.tsx`
    - Params: `subaccountId`
    - Needs audit

16. `src/app/(main)/subaccount/[subaccountId]/kickstart/page.tsx`
    - Params: `subaccountId`
    - Needs audit

17. `src/app/(main)/subaccount/[subaccountId]/media/page.tsx`
    - Params: `subaccountId`
    - Needs audit

18. `src/app/(main)/subaccount/page.tsx`
    - Params: (root subaccount route)
    - Needs audit

**Domain Routes (2 files)**: 19. `src/app/[domain]/page.tsx` - Params: `domain` - Funnel preview route - CRITICAL for funnel system

20. `src/app/[domain]/[path]/page.tsx`
    - Params: `domain`, `path`
    - Funnel page route - CRITICAL for funnel system

## 5. params Usage in Layout Components

### Files Affected: 2 layout.tsx files

Layouts also receive async params in Next.js 15.

1. **src/app/(main)/business/[businessId]/layout.tsx**
   - Params: `businessId`
   - Usage: Line 48 (passed to Sidebar component)
   - Pattern:

     ```typescript
     // ❌ OLD
     const layout = async ({ children, params }: Props) => {
       return <Sidebar id={params.businessId} type="business" />
     }

     // ✅ NEW
     const layout = async ({ children, params }: Props) => {
       const { businessId } = await params
       return <Sidebar id={businessId} type="business" />
     }
     ```

2. **src/app/(main)/subaccount/[subaccountId]/layout.tsx**
   - Params: `subaccountId`
   - Similar pattern as business layout

## 6. searchParams Usage in Page Components

### Files Affected: 6 page.tsx files

The `searchParams` prop also becomes async in Next.js 15.

1. `src/app/(main)/subaccount/page.tsx`
2. `src/app/(main)/subaccount/[subaccountId]/page.tsx`
3. `src/app/(main)/subaccount/[subaccountId]/kickstart/page.tsx`
4. `src/app/(main)/business/page.tsx`
5. `src/app/(main)/business/[businessId]/page.tsx`
6. `src/app/(main)/business/[businessId]/kickstart/page.tsx`

**Pattern Change**:

```typescript
// ❌ OLD (Next.js 14)
type Props = {
  params: { businessId: string }
  searchParams: { code: string }
}

const Page = async ({ params, searchParams }: Props) => {
  if (searchParams.code) {
    // handle OAuth code
  }
}

// ✅ NEW (Next.js 15)
type Props = {
  params: Promise<{ businessId: string }>
  searchParams: Promise<{ code: string }>
}

const Page = async ({ params, searchParams }: Props) => {
  const { businessId } = await params
  const { code } = await searchParams

  if (code) {
    // handle OAuth code
  }
}
```

**Note**: Many of these files define `searchParams` in the type but don't actually use it. Still need to update the type definition for type safety.

## Migration Strategy

### Phase 1: Critical Path (Week 2, Day 2)

1. ✅ Fix Stripe webhook (`headers()`)
2. ✅ Test Stripe webhook thoroughly
3. ✅ Ensure webhook is in public routes (Clerk v5 migration dependency)

### Phase 2: Core Routes (Week 2, Day 3-4)

4. Update business route pages (7 files)
5. Update subaccount route pages (10 files)
6. Update domain routes (2 files) - CRITICAL for funnels
7. Update layouts (2 files)

### Phase 3: Testing (Week 2, Day 5)

8. Test all dynamic routes navigate correctly
9. Test params are accessed properly in all pages
10. Test searchParams work in OAuth flows
11. Test funnel preview and funnel page routes

## Type Definitions to Update

Create a types file for Next.js 15 compatibility:

```typescript
// types/next.ts
export type PageParams<T extends Record<string, string>> = Promise<T>
export type SearchParams = Promise<{
  [key: string]: string | string[] | undefined
}>

export type PageProps<P extends Record<string, string> = {}> = {
  params: PageParams<P>
  searchParams: SearchParams
}

export type LayoutProps<P extends Record<string, string> = {}> = {
  children: React.ReactNode
  params: PageParams<P>
}

// Usage example:
// Business page
type Props = PageProps<{ businessId: string }>

// Funnel editor (multiple params)
type Props = PageProps<{
  subaccountId: string
  funnelId: string
  funnelPageId: string
}>
```

## Automated Detection Script

Consider creating a codemod or script to help automate this:

```typescript
// scripts/migrate-async-params.ts
// TODO: Create script to automatically update params/searchParams to async
```

## Testing Checklist

After migration, test:

- [ ] Stripe webhook receives and processes events
- [ ] Business dashboard loads with correct businessId
- [ ] Subaccount dashboard loads with correct subaccountId
- [ ] Pipeline pages work with multiple params
- [ ] Funnel editor works with triple params (subaccount/funnel/page)
- [ ] Funnel preview works on custom domains
- [ ] OAuth flows work with searchParams (code parameter)
- [ ] All layouts render with correct sidebar IDs
- [ ] TypeScript compilation passes with no errors

## Risk Assessment

| Component                  | Risk        | Reason                                   |
| -------------------------- | ----------- | ---------------------------------------- |
| Stripe Webhook             | 🔴 CRITICAL | Revenue-critical, signature verification |
| Funnel Routes              | 🔴 HIGH     | Core product feature                     |
| Business/Subaccount Routes | 🟡 MEDIUM   | Main navigation, many instances          |
| SearchParams               | 🟢 LOW      | Mostly unused, OAuth flows only          |

## Files Generated

- ✅ `DYNAMIC-API-AUDIT.md` - This file

## Next Steps

1. Continue with remaining audits (fetch, env vars, forms, images)
2. Create migration script template for params/searchParams updates
3. Plan testing strategy for all dynamic routes

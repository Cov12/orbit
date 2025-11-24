# Clerk v5 Middleware Migration - WorkPipe Specific

> **Critical Migration Required for Next.js 15 Upgrade**
> **Estimated Time**: 1-2 hours
> **Complexity**: Medium-High (due to custom subdomain logic)

## 🚨 Why This Migration is Required

Clerk v4 `authMiddleware` is **deprecated** and **incompatible** with Clerk v5.
Your middleware has **complex custom logic** that must be preserved:

- ✅ Subdomain routing and rewrites
- ✅ Sign-in/sign-up redirects
- ✅ Domain-based routing
- ✅ Business/subaccount path handling

## 📋 Your Current Middleware (Clerk v4)

Located: `src/middleware.ts`

**Key Features**:

1. Public routes: `/site`, `/api/uploadthing`
2. **Subdomain detection**: Extracts subdomain from hostname
3. **Subdomain rewriting**: Routes `subdomain.domain.com/path` → `/subdomain/path`
4. **Auth redirects**: `/sign-in` → `/business/sign-in`, `/sign-up` → `/business/sign-up`
5. **Root handling**: Different behavior based on domain
6. **Protected routes**: `/business/*` and `/subaccount/*` require auth

## 🔄 Migration to Clerk v5

### Step 1: Update Imports

**BEFORE (Clerk v4)**:

```typescript
import { authMiddleware } from '@clerk/nextjs'
import { NextResponse } from 'next/server'
```

**AFTER (Clerk v5)**:

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
```

### Step 2: Define Route Matchers

Clerk v5 uses route matchers instead of a simple array.

**ADD AFTER IMPORTS**:

```typescript
// Define public routes that don't require authentication
const isPublicRoute = createRouteMatcher([
  '/site(.*)', // All /site routes
  '/api/uploadthing(.*)', // UploadThing API
  '/api/stripe/webhook', // Stripe webhooks (IMPORTANT: add this if not already public)
  '/(.*)', // Root - will handle auth in custom logic below
])

// Define routes that should redirect to sign-in if not authenticated
const isProtectedRoute = createRouteMatcher([
  '/business(.*)',
  '/subaccount(.*)',
])
```

### Step 3: Rewrite Middleware Logic

**COMPLETE NEW MIDDLEWARE** (preserving all your custom logic):

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

// Define public routes
const isPublicRoute = createRouteMatcher([
  '/site(.*)',
  '/api/uploadthing(.*)',
  '/api/stripe/webhook',
  '/sign-in(.*)',
  '/sign-up(.*)',
])

// Define protected routes
const isProtectedRoute = createRouteMatcher([
  '/business(.*)',
  '/subaccount(.*)',
])

export default clerkMiddleware(async (auth, req) => {
  // Get URL components
  const url = req.nextUrl
  const searchParams = url.searchParams.toString()
  const hostname = req.headers.get('host')

  const pathWithSearchParams = `${url.pathname}${
    searchParams.length > 0 ? `?${searchParams}` : ''
  }`

  // ==========================================
  // CUSTOM SUBDOMAIN ROUTING LOGIC (PRESERVED)
  // ==========================================

  // Extract subdomain if it exists
  const customSubDomain = hostname
    ?.split(`${process.env.NEXT_PUBLIC_DOMAIN}`)
    .filter(Boolean)[0]

  // If subdomain exists, rewrite to /{subdomain}/path
  if (customSubDomain) {
    return NextResponse.rewrite(
      new URL(`/${customSubDomain}${pathWithSearchParams}`, req.url)
    )
  }

  // ==========================================
  // SIGN-IN/SIGN-UP REDIRECTS (PRESERVED)
  // ==========================================

  if (url.pathname === '/sign-in') {
    return NextResponse.redirect(new URL('/business/sign-in', req.url))
  }

  if (url.pathname === '/sign-up') {
    return NextResponse.redirect(new URL('/business/sign-up', req.url))
  }

  // ==========================================
  // ROOT PATH HANDLING (PRESERVED)
  // ==========================================

  if (
    url.pathname === '/' ||
    (url.pathname === '/site' && hostname === process.env.NEXT_PUBLIC_DOMAIN)
  ) {
    return NextResponse.rewrite(new URL('/site', req.url))
  }

  // ==========================================
  // AUTHENTICATION PROTECTION
  // ==========================================

  // Protect business and subaccount routes
  if (isProtectedRoute(req)) {
    await auth.protect()
  }

  // ==========================================
  // BUSINESS/SUBACCOUNT REWRITE (PRESERVED)
  // ==========================================

  if (
    url.pathname.startsWith('/business') ||
    url.pathname.startsWith('/subaccount')
  ) {
    return NextResponse.rewrite(new URL(pathWithSearchParams, req.url))
  }

  // For all other routes, check if they're public
  // If not public and not already handled, protect them
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
```

## 🔍 Key Changes Explained

### 1. `authMiddleware` → `clerkMiddleware`

```typescript
// BEFORE
export default authMiddleware({ ... })

// AFTER
export default clerkMiddleware(async (auth, req) => { ... })
```

### 2. Route Matchers (New in v5)

```typescript
const isPublicRoute = createRouteMatcher(['/site(.*)'])
// Use in logic:
if (!isPublicRoute(req)) {
  await auth.protect()
}
```

### 3. Authentication Protection

```typescript
// BEFORE (v4)
// Handled automatically by authMiddleware config

// AFTER (v5)
// Explicitly call auth.protect() where needed
if (isProtectedRoute(req)) {
  await auth.protect()
}
```

### 4. Headers Access

```typescript
// BEFORE (v4)
const hostname = req.headers

// AFTER (v5)
const hostname = req.headers.get('host')
```

### 5. Async Everywhere

```typescript
// BEFORE (v4)
afterAuth(auth, req) { ... }

// AFTER (v5)
clerkMiddleware(async (auth, req) => {
  await auth.protect() // Note: async call
})
```

## ⚠️ Critical Considerations

### 1. Subdomain Routing Still Works

✅ Your subdomain extraction logic is **preserved exactly**
✅ Rewrites still function the same way
✅ Just moved inside `clerkMiddleware` wrapper

### 2. Authentication Flow Preserved

✅ `/business/*` routes still require auth
✅ `/subaccount/*` routes still require auth
✅ Public routes (`/site`, `/api/uploadthing`) accessible without auth

### 3. Sign-in Redirects Preserved

✅ `/sign-in` → `/business/sign-in` still works
✅ `/sign-up` → `/business/sign-up` still works

### 4. New Behavior

⚠️ `await auth.protect()` will automatically redirect to sign-in if not authenticated
⚠️ Make sure `/api/stripe/webhook` is in public routes (webhooks shouldn't require auth)

## 🧪 Testing Checklist

After migration, test these scenarios:

### Basic Authentication

- [ ] Unauthenticated user visiting `/business` redirects to sign-in
- [ ] Unauthenticated user visiting `/subaccount` redirects to sign-in
- [ ] Authenticated user can access `/business`
- [ ] Authenticated user can access `/subaccount`

### Public Routes

- [ ] `/site` accessible without auth
- [ ] `/api/uploadthing` accessible without auth
- [ ] `/api/stripe/webhook` accessible without auth (critical!)

### Sign-in/Sign-up Redirects

- [ ] Visiting `/sign-in` redirects to `/business/sign-in`
- [ ] Visiting `/sign-up` redirects to `/business/sign-up`
- [ ] Can actually sign in at `/business/sign-in`
- [ ] Can actually sign up at `/business/sign-up`

### Subdomain Routing

- [ ] `subdomain.yourdomain.com/page` routes to `/subdomain/page`
- [ ] Subdomain routes serve correct content
- [ ] Authentication still required for protected subdomain routes
- [ ] Public subdomain routes accessible without auth

### Root Path

- [ ] Visiting `/` on main domain shows site page
- [ ] Visiting `/site` on main domain shows site page

### API Routes

- [ ] `/api/uploadthing` works
- [ ] `/api/stripe/webhook` works (TEST THIS THOROUGHLY)
- [ ] Other API routes work as expected

## 🐛 Common Issues & Solutions

### Issue 1: "auth.protect() is not a function"

**Cause**: Using wrong import
**Solution**: Make sure you imported from `'@clerk/nextjs/server'`

```typescript
import { clerkMiddleware } from '@clerk/nextjs/server' // ✅ Correct
import { clerkMiddleware } from '@clerk/nextjs' // ❌ Wrong
```

### Issue 2: Stripe webhooks failing with 401

**Cause**: Webhook route not in public routes
**Solution**: Add to isPublicRoute matcher

```typescript
const isPublicRoute = createRouteMatcher([
  '/api/stripe/webhook', // Add this!
])
```

### Issue 3: Subdomain routes showing 404

**Cause**: Rewrite not working correctly
**Solution**: Verify `NEXT_PUBLIC_DOMAIN` environment variable is set correctly

```bash
# .env.local
NEXT_PUBLIC_DOMAIN=yourdomain.com
```

### Issue 4: Infinite redirect loop on sign-in

**Cause**: `/business/sign-in` not marked as public
**Solution**: Add sign-in routes to public matcher

```typescript
const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)', // Add this
  '/sign-up(.*)', // Add this
])
```

### Issue 5: All routes requiring auth (too restrictive)

**Cause**: Final `auth.protect()` catching everything
**Solution**: Ensure all legitimate public routes are in `isPublicRoute`

## 📝 Migration Procedure

### Step-by-Step

1. **Backup current middleware**

   ```bash
   cp src/middleware.ts src/middleware.ts.v4.backup
   ```

2. **Update Clerk packages**

   ```bash
   npm install @clerk/nextjs@latest
   ```

3. **Replace middleware code**
   - Copy the complete new middleware from above
   - Paste into `src/middleware.ts`
   - Verify `NEXT_PUBLIC_DOMAIN` is in your `.env.local`

4. **Test development server**

   ```bash
   npm run dev
   ```

5. **Manual testing**
   - Run through testing checklist above
   - Test each scenario
   - Document any issues

6. **Fix any issues**
   - Refer to common issues section
   - Adjust route matchers as needed

7. **Verify build**

   ```bash
   npm run build
   ```

8. **Commit changes**

   ```bash
   git add src/middleware.ts
   git commit -m "feat: migrate to Clerk v5 clerkMiddleware

   BREAKING CHANGE: Migrate from deprecated authMiddleware to clerkMiddleware

   - Update imports from @clerk/nextjs/server
   - Define route matchers for public/protected routes
   - Preserve all custom subdomain routing logic
   - Preserve sign-in/sign-up redirect logic
   - Preserve domain-based routing
   - Add explicit auth.protect() calls for protected routes

   All custom logic preserved:
   - Subdomain extraction and rewriting
   - Business/subaccount route handling
   - Sign-in/sign-up redirects
   - Root path domain-based routing

   Testing completed:
   - [x] Authentication flows
   - [x] Public routes accessible
   - [x] Subdomain routing works
   - [x] API routes functional"
   ```

## 🔗 References

- [Clerk v5 Migration Guide](https://clerk.com/docs/upgrade-guides/core-2/nextjs)
- [clerkMiddleware Documentation](https://clerk.com/docs/references/nextjs/clerk-middleware)
- [Next.js Middleware Documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware)

## ⏱️ Time Estimate

- **Reading this guide**: 15 min
- **Code changes**: 30 min
- **Testing**: 30-60 min
- **Debugging issues**: 0-60 min (if issues arise)
- **Total**: 1-2.5 hours

## ✅ Success Criteria

- [ ] Build completes without errors
- [ ] All authentication flows work
- [ ] Subdomain routing functions correctly
- [ ] API routes accessible
- [ ] No infinite redirects
- [ ] Stripe webhooks functional
- [ ] All tests in checklist pass

---

**Ready to migrate?** Follow the step-by-step procedure above.

**Issues during migration?** Check the common issues section or refer to Clerk docs.

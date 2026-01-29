# Next.js Upgrade Strategy

> **Document Status**: Updated with comprehensive analysis and risk assessment
> **Last Updated**: 2025-11-18
> **Node.js Version Verified**: v20.11.0 ✅

## 🚨 CRITICAL FINDINGS - READ FIRST

1. **React 19 is NOT required** - Next.js 15 supports both React 18 and 19
2. **Recommended approach**: Two-phase upgrade (Next.js 15 + React 18 first, then React 19 later)
3. **Major breaking changes identified**:
   - Clerk v5 requires complete middleware rewrite
   - `headers()` and `cookies()` may need async changes
   - Fetch caching defaults changed (no longer cached by default)
   - `images.domains` deprecated (must use `remotePatterns`)
4. **Missing dependencies in original plan**: react-hook-form, next-themes, react-day-picker, and 8 other UI libraries need verification
5. **Timeline**: 4-5 weeks (conservative estimate with proper testing)

## Current State Assessment

**Current Versions:**

- Next.js: 14.1.4
- React: ^18
- React DOM: ^18
- TypeScript: ^5
- Clerk: ^4.31.6
- Node.js: v20.11.0 ✅ (minimum 18.17.0+ required for Next.js 15)

**Target Versions (Two-Phase Approach Recommended):**

**IMPORTANT**: Next.js 15 supports BOTH React 18 and React 19. You are NOT required to upgrade to React 19.

**Option A (Recommended - Lower Risk):**

- **Phase 1**: Next.js 15.x + React 18 (current)
- **Phase 2**: React 19.x (after stabilization, 1-2 weeks later)

**Option B (Higher Risk):**

- Next.js 15.x + React 19.x (all at once)

**Decision Required**: Choose upgrade path based on risk tolerance and timeline constraints.

## Critical Dependencies Analysis

### High-Priority Compatibility Checks

1. **@clerk/nextjs (^4.31.6)** ⚠️ **CRITICAL - BREAKING CHANGES**
   - **REQUIRED**: Upgrade to Clerk v5+ for Next.js 15 compatibility
   - **BREAKING**: `authMiddleware` is DEPRECATED in v5
   - **REQUIRED MIGRATION**: Must rewrite middleware to use `clerkMiddleware` (completely different API)
   - Migration guide: https://clerk.com/docs/upgrade-guides/core-2/nextjs
   - **Risk Level**: HIGH - Authentication could break entirely
   - **Testing Priority**: #1

2. **@prisma/client (^5.12.1)**
   - Prisma 5.x should be compatible
   - Verify Prisma Client generation after upgrade
   - Test database queries remain functional

3. **@uploadthing/react (^6.4.4) & uploadthing (^6.7.0)**
   - Check UploadThing Next.js 15 compatibility
   - Verify API route handlers still work
   - Test file upload flows

4. **@stripe/stripe-js (^5.6.0) & @stripe/react-stripe-js (^3.1.1) & stripe (^17.6.0)**
   - Verify Stripe SDK compatibility with React 19 (if upgrading to React 19)
   - Test payment flows thoroughly
   - **CRITICAL**: Test webhook handler in `src/app/api/stripe/webhook/route.ts`

5. **@tanstack/react-table (^8.21.2)** ⚠️
   - Check React 19 compatibility (if upgrading to React 19)
   - May need update to v8.22+ for React 19
   - Test all table components

6. **react-beautiful-dnd (^13.1.1)** 🚨 **CRITICAL - BLOCKING ISSUE**
   - **CRITICAL**: This library is not maintained and incompatible with React 19
   - **Action Required**: Migrate to `@dnd-kit/core` or `react-dnd` BEFORE React 19 upgrade
   - **Affected Areas**:
     - Pipeline Kanban board: `src/app/(main)/subaccount/[subaccountId]/pipelines/`
     - Funnel builder drag-and-drop
   - **Timeline Impact**: Add 3-5 days for migration

7. **@tremor/react (^3.15.0)**
   - Verify React 19 compatibility (if upgrading to React 19)
   - Check for breaking changes in chart components
   - Test all chart/visualization components

8. **react-hook-form (^7.51.2)** ⚠️ **HIGH PRIORITY**
   - **Used extensively** across all forms in the application
   - React 19 requires v7.52.0+ (if upgrading to React 19)
   - **CRITICAL**: Test ALL forms after upgrade:
     - Business onboarding forms
     - Funnel builder forms
     - User/team management forms
     - Settings forms

9. **Radix UI Components (24 packages)** ⚠️
   - Most packages need v1.1+ for React 19 compatibility (if upgrading to React 19)
   - **Action Required**: Run `npm outdated | grep @radix-ui` to identify updates needed
   - Key packages to verify:
     - @radix-ui/react-dialog (^1.1.10) - Used for modals
     - @radix-ui/react-dropdown-menu (^2.0.6) - Used extensively
     - @radix-ui/react-popover (^1.0.7) - May need update
     - @radix-ui/react-select (^2.0.0) - Used in forms
     - All 24 packages need verification

10. **react-day-picker (^8.10.0)** ⚠️
    - May need v9+ for React 19 compatibility (if upgrading to React 19)
    - Used in date selection components
    - Verify calendar functionality

11. **next-themes (^0.3.0)** ⚠️
    - Theme switching is core functionality
    - Verify React 19 compatibility (if upgrading to React 19)
    - Test theme persistence and switching

12. **Additional UI Libraries to Verify:**
    - embla-carousel-react (^8.0.0) - Used in carousels
    - vaul (^0.9.0) - Drawer components
    - sonner (^1.4.41) - Toast notifications
    - cmdk (^1.1.1) - Command menu
    - input-otp (^1.2.4) - OTP input components
    - react-resizable-panels (^2.0.16) - Resizable layouts

## Breaking Changes to Address

### 1. Next.js 15 Breaking Changes (CRITICAL - AFFECTS ALL USERS)

#### A. Dynamic API Changes (BREAKING) 🚨

**CRITICAL**: Some Next.js APIs are now async in certain contexts

```typescript
// Next.js 14 (synchronous)
import { headers, cookies } from 'next/headers'
const headersList = headers()
const cookieStore = cookies()

// Next.js 15 (async in some contexts - depends on usage)
const headersList = await headers()
const cookieStore = await cookies()
```

**Action Required:**

- Search entire codebase for `headers()`, `cookies()`, and `draftMode()` usage
- Files to audit:
  - `src/app/api/stripe/webhook/route.ts` - Uses `headers()` ⚠️
  - All API routes in `src/app/api/`
  - All server components and actions
- Add `async/await` where required
- Test thoroughly - silent failures possible

**Search Commands:**

```bash
grep -r "from 'next/headers'" src/
grep -r "headers()" src/
grep -r "cookies()" src/
```

#### B. Fetch Caching Behavior (MAJOR CHANGE) 🚨

**BREAKING CHANGE IN DEFAULT BEHAVIOR:**

- **Next.js 14**: `fetch()` requests are cached by default
- **Next.js 15**: `fetch()` requests are NOT cached by default

**Impact:**

- Performance may degrade if you relied on automatic caching
- Database/API calls may increase
- Need to explicitly opt-in to caching

**Action Required:**

```typescript
// Next.js 15 - Explicitly cache if needed
fetch('https://api.example.com/data', {
  cache: 'force-cache', // Opt-in to caching
})

// Or use no-store for dynamic data (now the default)
fetch('https://api.example.com/data', {
  cache: 'no-store', // Explicitly no cache
})
```

**Search Commands:**

```bash
grep -r "fetch(" src/
```

**Audit Required:**

- Review ALL fetch calls in the codebase
- Determine which need caching
- Add explicit `cache` directives
- Benchmark performance before/after

#### C. Image Configuration (BREAKING) 🚨

**REQUIRED CHANGE** in `next.config.mjs`:

```javascript
// CURRENT (WILL BREAK IN NEXT.JS 15)
images: {
  domains: [
    'uploadthing.com',
    'utfs.io',
    'img.clerk.com',
    'subdomain',
    'files.stripe.com',
  ]
}

// REQUIRED FOR NEXT.JS 15
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'uploadthing.com' },
    { protocol: 'https', hostname: 'utfs.io' },
    { protocol: 'https', hostname: 'img.clerk.com' },
    { protocol: 'https', hostname: 'subdomain' },
    { protocol: 'https', hostname: 'files.stripe.com' },
  ]
}
```

**Action Required:**

- Update `next.config.mjs` during upgrade
- Test all images load correctly
- Verify remote image optimization still works

### 2. React 19 Migration (ONLY IF UPGRADING TO REACT 19)

**Changes Required:**

- Update all React types (`@types/react`, `@types/react-dom`)
- Review component prop types (React 19 has stricter typing)
- Update ref handling if using `forwardRef`
- Test all client components (`"use client"` directives)
- Update all dependencies to React 19-compatible versions

**Files to Review:**

- All files in `src/components/ui/` (35+ client components)
- All form components in `src/components/forms/`
- Funnel builder components
- All custom hooks

### 3. Next.js 15 Specific Changes

**Middleware Updates:** ⚠️ **CRITICAL**

- `src/middleware.ts` uses `authMiddleware` from Clerk
- **BREAKING**: Clerk v5 DEPRECATES `authMiddleware`
- **REQUIRED**: Must migrate to `clerkMiddleware` (completely different API structure)
- This is NOT a simple find/replace - requires rewriting middleware logic
- Migration guide: https://clerk.com/docs/upgrade-guides/core-2/nextjs
- **Estimated effort**: 2-4 hours + testing time

**Image Component:**

- Review all `next/image` usage (20+ files found)
- Next.js 15 may have updated Image optimization
- Verify `next.config.mjs` image domains configuration

**Route Handlers:**

- `src/app/api/stripe/webhook/route.ts` uses `headers()` from `next/headers`
- Verify API route handler signatures remain compatible
- Test webhook processing

**Font Loading:**

- `src/app/layout.tsx` uses `next/font/google`
- Should remain compatible, but verify

### 3. Configuration Updates

**next.config.mjs:**

- `reactStrictMode: false` - Consider enabling for React 19
- `images.domains` - Verify this still works (may need `remotePatterns`)
- Add any Next.js 15 specific optimizations

**TypeScript Configuration:**

- `tsconfig.json` uses `moduleResolution: "bundler"`
- Verify this remains optimal for Next.js 15
- May need to update `jsx` compiler options

## Performance Considerations & New Features

### Next.js 15 Performance Features

#### 1. Turbopack (Now Stable) 🚀

**What is it?**

- Rust-based bundler, replacement for Webpack
- 50-70% faster local development
- Stable in Next.js 15 for `next dev`

**Decision Required:**

```json
// Option 1: Enable Turbopack for dev
"scripts": {
  "dev": "next dev --turbo"
}

// Option 2: Keep Webpack (current)
"scripts": {
  "dev": "next dev"
}
```

**Recommendation**: Enable Turbopack after successful upgrade for faster DX

#### 2. Partial Prerendering (PPR) - Experimental

**What is it?**

- Combines static and dynamic rendering on same page
- Can significantly improve performance
- Still experimental in Next.js 15

**Decision Required:**

- Evaluate after core upgrade stabilizes
- May provide performance wins for funnel/pipeline pages

### Performance Testing Requirements

**Before Upgrade (Baseline):**

- Measure build times
- Measure page load times (Lighthouse)
- Measure bundle sizes
- Document current Core Web Vitals

**After Upgrade (Comparison):**

- Compare all metrics
- Identify any regressions
- Optimize as needed

## Environment Variables & Client-Side Exposure

### Potential Issues in Next.js 15

Next.js 15 has stricter rules about environment variable exposure.

**Action Required:**

```bash
# Search for process.env usage in client components
grep -r "process.env" src/components
grep -r "process.env" src/app
```

**Verify:**

- All public env vars use `NEXT_PUBLIC_` prefix
- No sensitive data exposed to client
- Environment variable access follows Next.js 15 patterns

## Testing Infrastructure Assessment

### Current State - UNKNOWN ⚠️

**CRITICAL**: Need to determine if test infrastructure exists

**Action Required BEFORE upgrade:**

```bash
# Check for test files
find src -name "*.test.*" -o -name "*.spec.*"

# Check for test frameworks in package.json
# Currently NOT in dependencies - NO TESTING FRAMEWORK INSTALLED
```

**Finding**: No testing framework currently installed (Jest, Vitest, Testing Library, etc.)

**Options:**

1. **Add minimal smoke tests before upgrade** (RECOMMENDED)
   - Install Playwright or Cypress for E2E tests
   - Test critical flows only
   - Estimated time: 3-5 days

2. **Proceed without automated tests** (HIGHER RISK)
   - Rely entirely on manual testing
   - Create comprehensive manual test checklist
   - Higher risk of regressions

**Recommendation**: At minimum, add E2E tests for:

- Authentication flow
- Stripe webhook processing
- File upload functionality
- Critical user journeys

## Deployment Configuration

### Hosting Platform Considerations

**If using Vercel:**

- Verify Node.js runtime version setting (should be 20.x)
- Update build settings if needed
- May need to increase build memory allocation

**If using other hosting:**

- Verify Node.js 18.17+ is available
- Update deployment scripts if needed
- Verify build environment supports Next.js 15

### Build Resources

**Potential Issues:**

- Next.js 15 may require more memory during build
- Build times may increase initially
- Monitor build performance

**Action Required:**

- Document current build times
- Monitor resource usage after upgrade
- Adjust CI/CD settings if needed

## Upgrade Strategy

### Phase 1: Pre-Upgrade Preparation (Week 1)

#### Day 1-2: Initial Assessment & Audits

1. **Codebase Audits** 🔍

   **Run these commands and save outputs:**

   ```bash
   # Dependency audit
   npm outdated > docs/dependency-audit.txt

   # Dynamic API usage
   grep -r "from 'next/headers'" src/ > docs/headers-usage.txt
   grep -r "headers()" src/ >> docs/headers-usage.txt
   grep -r "cookies()" src/ >> docs/headers-usage.txt

   # Fetch caching audit
   grep -r "fetch(" src/ > docs/fetch-usage.txt

   # Environment variable usage
   grep -r "process.env" src/components > docs/env-usage.txt
   grep -r "process.env" src/app >> docs/env-usage.txt

   # Radix UI versions
   npm outdated | grep @radix-ui > docs/radix-audit.txt

   # react-hook-form usage
   grep -r "useForm" src/ > docs/form-usage.txt
   ```

2. **Dependency Compatibility Matrix** 📊

   Create spreadsheet/document with:
   - Current version
   - Target version
   - React 19 compatible? (Y/N/Unknown)
   - Breaking changes?
   - Migration required? (Y/N)
   - Priority (Critical/High/Medium/Low)

   **Focus on:**
   - @clerk/nextjs
   - react-hook-form
   - All 24 Radix UI packages
   - react-beautiful-dnd
   - @tanstack/react-table
   - next-themes
   - react-day-picker

3. **Decision: React 18 vs React 19** ⚠️

   **Make this decision BEFORE proceeding:**
   - Option A: Next.js 15 + React 18 (safer, two-phase)
   - Option B: Next.js 15 + React 19 (all at once)

   **Consider:**
   - Timeline constraints
   - Risk tolerance
   - Time available for testing
   - Ability to rollback quickly

#### Day 3-5: Critical Preparation

4. **Testing Infrastructure Decision** 🧪
   - [ ] Decide: Add E2E tests OR rely on manual testing
   - [ ] If adding tests: Install Playwright/Cypress
   - [ ] Create manual test checklist (required regardless)
   - [ ] Document all critical user flows

5. **Performance Baseline** 📈

   **Document current state:**

   ```bash
   # Build time
   time npm run build

   # Bundle size
   # Check .next/static after build

   # Run Lighthouse on key pages
   # - Homepage
   # - Dashboard
   # - Funnel builder
   # - Pipeline view
   ```

6. **react-beautiful-dnd Migration** (ONLY if upgrading to React 19)
   - **BLOCKING**: Must complete before React 19 upgrade
   - **Estimated time**: 3-5 days
   - Migrate to `@dnd-kit/core`
   - Update drag-and-drop in:
     - Pipeline Kanban board
     - Funnel builder
   - Test extensively

7. **Backup & Branch Strategy**
   - [ ] Create feature branch: `upgrade/nextjs-15`
   - [ ] Backup `package.json` and `package-lock.json`
   - [ ] Document current working state
   - [ ] Create database backup (if applicable)
   - [ ] Ensure rollback procedure is documented

### Phase 2: Core Framework Upgrade (Week 2)

**NOTE**: Instructions differ based on React 18 vs React 19 decision

#### Option A: Next.js 15 + React 18 (RECOMMENDED)

1. **Update Next.js Only**

   ```bash
   npm install next@latest
   npm install -D eslint-config-next@latest
   ```

2. **Update TypeScript**

   ```bash
   npm install -D typescript@latest
   ```

3. **Update Clerk to v5**

   ```bash
   npm install @clerk/nextjs@latest
   ```

4. **Update Supporting Dependencies (React 18 Compatible)**

   ```bash
   # Update Radix UI packages (check which need updates)
   npm outdated | grep @radix-ui

   # Update other dependencies
   npm install @tanstack/react-table@latest
   npm install @tremor/react@latest
   npm install react-hook-form@latest
   npm install next-themes@latest
   # ... etc
   ```

#### Option B: Next.js 15 + React 19 (ALL AT ONCE)

1. **Update Everything**

   ```bash
   # Core framework
   npm install next@latest react@latest react-dom@latest
   npm install -D @types/react@latest @types/react-dom@latest typescript@latest

   # Clerk
   npm install @clerk/nextjs@latest

   # All Radix UI packages (24 total)
   npm install @radix-ui/react-accordion@latest @radix-ui/react-alert-dialog@latest
   # ... (all 24 packages)

   # Other critical dependencies
   npm install react-hook-form@latest
   npm install @tanstack/react-table@latest
   npm install react-day-picker@latest
   npm install next-themes@latest
   npm install @tremor/react@latest
   # ... etc
   ```

2. **Verify Installation**
   ```bash
   npm list react react-dom next
   ```

### Phase 3: Configuration Updates (Week 2)

**CRITICAL**: These changes are REQUIRED for Next.js 15

1. **Update next.config.mjs** 🚨

   ```javascript
   /** @type {import('next').NextConfig} */
   const nextConfig = {
     images: {
       // REPLACE domains with remotePatterns
       remotePatterns: [
         { protocol: 'https', hostname: 'uploadthing.com' },
         { protocol: 'https', hostname: 'utfs.io' },
         { protocol: 'https', hostname: 'img.clerk.com' },
         { protocol: 'https', hostname: 'subdomain' },
         { protocol: 'https', hostname: 'files.stripe.com' },
       ],
     },
     reactStrictMode: false, // Consider enabling after upgrade stabilizes
   }

   export default nextConfig
   ```

2. **Verify TypeScript Configuration**
   - `tsconfig.json` should work as-is
   - Verify after upgrade runs without errors

3. **Test Build**

   ```bash
   npm run build
   ```

   **Expected**: May have TypeScript errors - document them for next phase

### Phase 4: Code Migration (Week 2-3)

#### 1. Clerk Middleware Migration 🚨 **CRITICAL**

**Current code** (`src/middleware.ts`):

```typescript
import { authMiddleware } from '@clerk/nextjs'
```

**Required migration to Clerk v5:**

- Follow guide: https://clerk.com/docs/upgrade-guides/core-2/nextjs
- Replace `authMiddleware` with `clerkMiddleware`
- Update middleware configuration
- **Estimated time**: 2-4 hours

**Testing required:**

- [ ] Sign in/sign out flows
- [ ] Protected routes
- [ ] Domain routing
- [ ] Subdomain handling
- [ ] Public route access

#### 2. Dynamic API Migration 🚨 **CRITICAL**

**Use audit from Phase 1** (`docs/headers-usage.txt`)

For each file using `headers()`, `cookies()`, or `draftMode()`:

```typescript
// BEFORE (Next.js 14)
import { headers } from 'next/headers'

export async function POST(req: Request) {
  const headersList = headers() // Synchronous
  const signature = headersList.get('stripe-signature')
  // ...
}

// AFTER (Next.js 15 - if needed)
import { headers } from 'next/headers'

export async function POST(req: Request) {
  const headersList = await headers() // May need async
  const signature = headersList.get('stripe-signature')
  // ...
}
```

**Files to check:**

- `src/app/api/stripe/webhook/route.ts` ⚠️
- All files in `docs/headers-usage.txt`

#### 3. Fetch Caching Audit 📊

**Use audit from Phase 1** (`docs/fetch-usage.txt`)

For each `fetch()` call, decide caching strategy:

```typescript
// Option 1: Cache (for static/rarely changing data)
fetch('https://api.example.com/data', {
  cache: 'force-cache',
})

// Option 2: No cache (for dynamic data) - NEW DEFAULT
fetch('https://api.example.com/data', {
  cache: 'no-store',
})

// Option 3: Revalidate
fetch('https://api.example.com/data', {
  next: { revalidate: 3600 }, // 1 hour
})
```

**Action**:

- Review ALL fetch calls
- Add explicit caching directives
- Document decisions

#### 4. React 19 Component Updates (ONLY if upgrading to React 19)

- Review and update component prop types
- Fix any TypeScript errors from stricter typing
- Update ref usage if needed
- Test all client components
- Fix form components (react-hook-form)

#### 5. Image Verification

- Verify all images load with new `remotePatterns` config
- Test image optimization
- Check responsive images

#### 6. API Routes Verification

Test all routes:

- [ ] Stripe webhook handler
- [ ] UploadThing routes
- [ ] All custom API routes

### Phase 5: Configuration & Optimization (Week 3)

1. **Next.js Configuration Optimization**

   **Consider Turbopack:**

   ```json
   // package.json
   "scripts": {
     "dev": "next dev --turbo",  // Enable for faster dev
   }
   ```

   **Consider React Strict Mode:**

   ```javascript
   // next.config.mjs
   reactStrictMode: true,  // Enable after upgrade stabilizes
   ```

2. **TypeScript Resolution**
   - Resolve ALL TypeScript errors
   - Run `npm run type-check` until clean
   - Verify build completes without errors

3. **ESLint & Code Quality**

   ```bash
   npm run lint:fix
   npm run format
   ```

4. **Performance Optimization**
   - Compare bundle sizes before/after
   - Identify any increased bundles
   - Optimize imports if needed

### Phase 6: Testing & Validation (Week 3-4)

1. **Unit & Integration Tests**
   - Run all existing tests
   - Fix any failing tests
   - Add tests for new functionality

2. **Manual Testing Checklist**
   - [ ] Authentication flows (sign-in, sign-up, middleware)
   - [ ] Business onboarding
   - [ ] Subaccount creation
   - [ ] Funnel builder (drag-drop, save, publish)
   - [ ] Pipeline management (Kanban, drag-drop)
   - [ ] File uploads (UploadThing)
   - [ ] Stripe checkout & webhooks
   - [ ] Domain routing (subdomains, custom domains)
   - [ ] Theme switching (light/dark)
   - [ ] Responsive design (mobile, tablet, desktop)

3. **Performance Testing**
   - Compare build times
   - Compare runtime performance
   - Test page load speeds
   - Verify bundle sizes

4. **Browser Compatibility**
   - Test in Chrome, Firefox, Safari, Edge
   - Test mobile browsers
   - Verify responsive design

### Phase 7: Deployment Strategy (Week 4-5)

1. **Staging Deployment**
   - Deploy to staging environment
   - Run smoke tests
   - Monitor error logs
   - Test critical user flows

2. **Production Deployment**
   - Create deployment plan
   - Schedule maintenance window (if needed)
   - Deploy with rollback plan ready
   - Monitor closely for 24-48 hours

3. **Post-Deployment**
   - Monitor error tracking (Sentry)
   - Monitor performance metrics
   - Gather user feedback
   - Document any issues

## Risk Mitigation

### High-Risk Areas

1. **Clerk Middleware Migration** 🚨 **HIGHEST RISK**
   - **Risk**: Complete authentication failure, users locked out
   - **Impact**: CRITICAL - Entire app unusable
   - **Mitigation**:
     - Test auth flows in staging extensively
     - Have rollback plan ready (< 5 minutes)
     - Test all auth flows: sign-in, sign-up, sign-out, protected routes
     - Verify domain routing still works
     - Keep Clerk v4 backup configuration documented

2. **Dynamic API Changes (headers/cookies)** 🚨
   - **Risk**: Silent failures in API routes, especially Stripe webhooks
   - **Impact**: HIGH - Payment processing could break
   - **Mitigation**:
     - Audit ALL usage before upgrade
     - Test Stripe webhooks thoroughly
     - Monitor error logs closely after deployment
     - Have test webhook ready

3. **Fetch Caching Behavior Change** ⚠️
   - **Risk**: Performance degradation, increased API calls, higher costs
   - **Impact**: MEDIUM-HIGH - User experience and infrastructure costs
   - **Mitigation**:
     - Audit all fetch calls
     - Add explicit caching directives
     - Benchmark performance before/after
     - Monitor API call volumes
     - Have caching strategy documented

4. **react-beautiful-dnd Replacement** (ONLY if React 19)
   - **Risk**: Breaking drag-and-drop functionality
   - **Impact**: HIGH - Funnel builder and Pipeline unusable
   - **Mitigation**:
     - Complete replacement BEFORE React 19 upgrade
     - Extensive testing of all drag-drop functionality
     - User acceptance testing
     - Consider staged rollout

5. **react-hook-form Compatibility** (ONLY if React 19)
   - **Risk**: All forms breaking across the application
   - **Impact**: CRITICAL - Business onboarding, settings, funnel builder unusable
   - **Mitigation**:
     - Update to React 19 compatible version
     - Test EVERY form in the application
     - Verify validation logic
     - Test error handling

6. **Stripe Webhook Handler**
   - **Risk**: Payment processing breaking due to headers() changes
   - **Impact**: CRITICAL - Revenue loss, billing issues
   - **Mitigation**:
     - Update headers() usage
     - Test webhook processing thoroughly
     - Use Stripe webhook test events
     - Monitor Stripe dashboard closely
     - Have webhook logs ready

7. **Domain Routing Middleware**
   - **Risk**: Custom domain routing breaking
   - **Impact**: HIGH - Client funnels inaccessible
   - **Mitigation**:
     - Test all domain scenarios
     - Verify subdomain routing
     - Test custom domain functionality
     - Have domain routing test matrix

8. **Image Configuration Breaking** 🚨
   - **Risk**: All remote images failing to load
   - **Impact**: HIGH - Visual content broken across site
   - **Mitigation**:
     - Update to remotePatterns immediately
     - Test all image sources
     - Verify image optimization works
     - Have configuration tested in staging

### Rollback Plan

1. Keep previous `package-lock.json` and `package.json` backed up
2. Maintain previous deployment artifacts
3. Document rollback procedure
4. Test rollback process in staging

## Success Criteria

- [ ] All tests passing
- [ ] No TypeScript errors
- [ ] No ESLint errors (or acceptable warnings)
- [ ] All critical user flows working
- [ ] Performance metrics maintained or improved
- [ ] No production errors in first 48 hours
- [ ] All team members trained on changes

## Documentation Updates

1. Update `README.md` with new requirements
2. Update `docs/Technical-Implementation-Plan.md` with Next.js 15 references
3. Document any breaking changes for team
4. Update deployment documentation

## Timeline Estimate

### Option A: Next.js 15 + React 18 (RECOMMENDED)

- **Total Duration**: 4-5 weeks
- **Phase 1 (Prep & Audits)**: 5-7 days
  - Day 1-2: Code audits and dependency analysis
  - Day 3-5: Testing infrastructure setup, performance baseline
- **Phase 2 (Core Upgrade)**: 2-3 days
  - Next.js 15, Clerk v5, supporting dependencies
- **Phase 3 (Config Updates)**: 1-2 days
  - next.config.mjs, TypeScript verification
- **Phase 4 (Code Migration)**: 7-10 days
  - Clerk middleware (2-4 hours)
  - Dynamic API changes (1-2 days)
  - Fetch caching audit (2-3 days)
  - Testing (3-4 days)
- **Phase 5 (Optimization)**: 2-3 days
  - TypeScript resolution, linting, performance optimization
- **Phase 6 (Testing)**: 5-7 days
  - Manual testing, browser compatibility, performance testing
- **Phase 7 (Deployment)**: 2-3 days
  - Staging, production deployment, monitoring

### Option B: Next.js 15 + React 19 (ALL AT ONCE)

- **Total Duration**: 5-6 weeks (add 1-2 weeks)
- **Additional Time Required**:
  - **react-beautiful-dnd migration**: +3-5 days (MUST complete first)
  - **React 19 dependency updates**: +2-3 days (24 Radix packages + others)
  - **React 19 component testing**: +3-5 days (all 35+ UI components, forms)
  - **react-hook-form testing**: +2-3 days (every form in app)
- **Higher Risk**: More potential breaking changes to debug

**Recommendation**: **Option A** for lower risk and faster time-to-production

### Key Milestones

- ✅ **Week 1**: Audits complete, decision made (React 18 vs 19), baseline established
- ✅ **Week 2**: Core upgrade complete, builds successfully
- ✅ **Week 3**: Code migration complete, TypeScript clean
- ✅ **Week 4**: Testing complete, staging deployment successful
- ✅ **Week 5**: Production deployment, monitoring complete

## Questions to Resolve Before Starting

### CRITICAL DECISIONS (Answer BEFORE Phase 1)

1. ✅ **Node.js Version**: v20.11.0 (Compatible ✓)
2. ❓ **React 18 vs React 19**: Which upgrade path? (MUST decide first)
3. ❓ **Testing Strategy**: Add E2E tests OR manual only?
4. ❓ **Timeline**: Are there any time constraints or upcoming deadlines?
5. ❓ **Staging Environment**: Do we have staging environment for testing?
6. ❓ **Rollback SLA**: How quickly can we rollback if production breaks?
7. ❓ **Maintenance Window**: Can we schedule maintenance window for production deploy?

### TECHNICAL DECISIONS (Can decide during upgrade)

8. ❓ **Turbopack**: Enable for faster dev server?
9. ❓ **React Strict Mode**: Enable after upgrade stabilizes?
10. ❓ **Partial Prerendering**: Evaluate PPR for performance gains?
11. ❓ **Test Coverage**: What's current test coverage? Should we add tests first?

### PLANNING QUESTIONS

12. ❓ **Team Availability**: Who's available for testing/deployment?
13. ❓ **Deployment Platform**: Vercel or other? (affects deployment steps)
14. ❓ **Monitoring**: Do we have error tracking (Sentry) set up?
15. ❓ **Feature Freeze**: Can we freeze new features during upgrade?

## Immediate Next Steps

Before starting Phase 1, complete these tasks:

1. [ ] **Answer all CRITICAL DECISIONS above**
2. [ ] **Create upgrade branch**: `git checkout -b upgrade/nextjs-15`
3. [ ] **Run initial audits** (commands in Phase 1, Day 1-2)
4. [ ] **Create backup of current state**:
   ```bash
   cp package.json package.json.backup
   cp package-lock.json package-lock.json.backup
   git commit -am "Pre-upgrade backup checkpoint"
   ```
5. [ ] **Set up docs folder for audit outputs**:
   ```bash
   mkdir -p docs/upgrade-audits
   ```
6. [ ] **Schedule team kickoff meeting** to review plan
7. [ ] **Communicate upgrade timeline** to stakeholders

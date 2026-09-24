# Dependency Analysis - Week 1, Day 1

**Date**: 2025-11-24
**Branch**: upgrade-nextj

## Summary

**Total Outdated Packages**: 72
**Security Vulnerabilities**: 19 (10 low, 3 moderate, 4 high, 2 critical)

## Critical Updates Required for Next.js 15 Upgrade

### 🔴 BREAKING CHANGES (Must Update)

#### 1. Next.js: 14.1.4 → 15.x (Target)

- **Current**: 14.1.4
- **Latest Available**: 16.0.4
- **Target for Upgrade**: 15.0.x (stable)
- **Breaking Changes**:
  - Dynamic API async (headers, cookies, draftMode)
  - Fetch caching behavior changes
  - Image optimization defaults
- **Security**: Fixes 10 critical/high vulnerabilities

#### 2. Clerk: 4.31.6 → 5.x (CRITICAL)

- **Current**: 4.31.6
- **Latest Available**: 6.35.5
- **Target for Upgrade**: 5.x (required for Next.js 15 compatibility)
- **Breaking Changes**:
  - Middleware configuration completely changed
  - `clerkMiddleware()` replaces `authMiddleware()`
  - Route matcher system changed
  - `auth()` helper changed to `auth().protect()`
- **Security**: Fixes cookie vulnerability (GHSA-pxg6-pf52-xh8x)
- **Impact**: ENTIRE authentication system must be refactored

#### 3. eslint-config-next: 14.1.4 → 15.x

- **Current**: 14.1.4
- **Latest**: 16.0.4
- **Target**: 15.x (matches Next.js version)
- **Must update** alongside Next.js

### 🟡 RECOMMENDED UPDATES (Should Update)

#### 4. Radix UI Components (All 24 packages)

Current versions are 4-12 months old. All have minor/patch updates available:

| Package                         | Current | Latest | Type  |
| ------------------------------- | ------- | ------ | ----- |
| @radix-ui/react-accordion       | 1.1.2   | 1.2.12 | Minor |
| @radix-ui/react-alert-dialog    | 1.0.5   | 1.1.15 | Minor |
| @radix-ui/react-aspect-ratio    | 1.0.3   | 1.1.8  | Minor |
| @radix-ui/react-avatar          | 1.0.4   | 1.1.11 | Minor |
| @radix-ui/react-checkbox        | 1.0.4   | 1.3.3  | Minor |
| @radix-ui/react-collapsible     | 1.0.3   | 1.1.12 | Minor |
| @radix-ui/react-context-menu    | 2.1.5   | 2.2.16 | Patch |
| @radix-ui/react-dialog          | 1.1.10  | 1.1.15 | Patch |
| @radix-ui/react-dropdown-menu   | 2.0.6   | 2.1.16 | Minor |
| @radix-ui/react-hover-card      | 1.0.7   | 1.1.15 | Minor |
| @radix-ui/react-label           | 2.0.2   | 2.1.8  | Minor |
| @radix-ui/react-menubar         | 1.0.4   | 1.1.16 | Minor |
| @radix-ui/react-navigation-menu | 1.1.4   | 1.2.14 | Minor |
| @radix-ui/react-popover         | 1.0.7   | 1.1.15 | Minor |
| @radix-ui/react-progress        | 1.0.3   | 1.1.8  | Minor |
| @radix-ui/react-radio-group     | 1.1.3   | 1.3.8  | Minor |
| @radix-ui/react-scroll-area     | 1.0.5   | 1.2.10 | Minor |
| @radix-ui/react-select          | 2.0.0   | 2.2.6  | Minor |
| @radix-ui/react-separator       | 1.0.3   | 1.1.8  | Minor |
| @radix-ui/react-slider          | 1.1.2   | 1.3.6  | Minor |
| @radix-ui/react-slot            | 1.0.2   | 1.2.4  | Minor |
| @radix-ui/react-switch          | 1.0.3   | 1.2.6  | Minor |
| @radix-ui/react-tabs            | 1.0.4   | 1.1.13 | Minor |
| @radix-ui/react-toast           | 1.1.5   | 1.2.15 | Minor |
| @radix-ui/react-toggle          | 1.0.3   | 1.1.10 | Minor |
| @radix-ui/react-toggle-group    | 1.0.4   | 1.1.11 | Minor |
| @radix-ui/react-tooltip         | 1.0.7   | 1.2.8  | Minor |

**Risk**: Low - These are backward compatible updates
**Benefit**: Bug fixes, performance improvements, React 18 optimizations
**Recommendation**: Update all during Week 2

#### 5. React & React DOM: 18.2.0 → 18.3.1

- **Current**: 18.2.0
- **Latest React 18**: 18.3.1
- **Latest React 19**: 19.2.0 (NOT upgrading per Option A)
- **Type**: Patch update
- **Risk**: Very Low
- **Recommendation**: Update to 18.3.1

#### 6. react-hook-form: 7.51.2 → 7.66.1

- **Current**: 7.51.2
- **Latest**: 7.66.1
- **Type**: Patch updates (15 releases behind)
- **Risk**: Low
- **Benefit**: Bug fixes, TypeScript improvements
- **Recommendation**: Update

#### 7. @hookform/resolvers: 3.3.4 → 3.10.0

- **Current**: 3.3.4
- **Latest v3**: 3.10.0
- **Latest v5**: 5.2.2 (Breaking change)
- **Recommendation**: Update to 3.10.0 (stay in v3)

#### 8. Stripe Packages

- **@stripe/react-stripe-js**: 3.1.1 → 3.10.0 (patch updates)
- **@stripe/stripe-js**: 5.6.0 → 5.10.0 (patch updates)
- **stripe**: 17.6.0 → 17.7.0 (patch update)
- **Risk**: Low
- **Recommendation**: Update all to latest v3/v5/v17

#### 9. TypeScript: 5.4.3 → 5.9.3

- **Current**: 5.4.3
- **Latest**: 5.9.3
- **Type**: Patch updates
- **Risk**: Low
- **Recommendation**: Update

### 🟢 KEEP AS-IS (Do Not Update Yet)

#### 10. Prisma: 5.12.1 (Do NOT upgrade to 7.x)

- **Current**: 5.12.1
- **Latest v5**: 5.22.0
- **Latest v7**: 7.0.0 (MAJOR BREAKING)
- **Recommendation**:
  - Update to 5.22.0 (stay in v5 family)
  - Do NOT upgrade to v7 during Next.js upgrade
  - Prisma 7 should be separate upgrade project

#### 11. React 19 (NOT upgrading per Option A)

- **Available**: 19.2.0
- **Decision**: Staying on React 18.3.1
- **Reason**: Avoid react-beautiful-dnd migration

## Security Vulnerabilities

### 🔴 CRITICAL (2)

#### 1. Next.js Multiple Vulnerabilities

- **Package**: next@14.1.4
- **Vulnerabilities**: 10 issues including:
  - Cache Poisoning (GHSA-gp8f-8m3g-qvj9)
  - DoS in image optimization (GHSA-g77x-44xx-532m)
  - DoS with Server Actions (GHSA-7m27-7ghc-44w9)
  - Authorization bypass (GHSA-7gfc-8cq8-jh5f)
  - SSRF via middleware redirect (GHSA-4342-x723-ch2f)
- **Fix**: Upgrade to Next.js 15.x (resolves all)
- **Timeline**: Week 2

#### 2. form-data Unsafe Random Function

- **Package**: form-data@3.0.0-3.0.3
- **Vulnerability**: GHSA-fjxv-7rqg-78g4
- **Severity**: Critical
- **Fix**: `npm audit fix` (auto-fixable)
- **Timeline**: Week 2, Day 1

### 🟠 HIGH (4)

#### 3. cross-spawn ReDoS

- **Package**: cross-spawn@7.0.0-7.0.4
- **Vulnerability**: GHSA-3xgq-45jj-v275
- **Fix**: `npm audit fix` (auto-fixable)

#### 4. glob Command Injection

- **Package**: glob@10.2.0-10.4.5
- **Vulnerability**: GHSA-5j98-mcp5-4vw2
- **Fix**: Will be resolved with Next.js 15 upgrade

### 🟡 MODERATE (3)

#### 5. Cookie Security Issue (Affects Clerk)

- **Package**: cookie@<0.7.0
- **Vulnerability**: GHSA-pxg6-pf52-xh8x
- **Impact**: Affects @clerk/nextjs
- **Fix**: Upgrade Clerk to v5+ (Week 3)

#### 6. Babel RegExp Inefficiency

- **Package**: @babel/runtime@<7.26.10
- **Fix**: `npm audit fix` (auto-fixable)

#### 7. js-yaml Prototype Pollution

- **Package**: js-yaml@4.0.0-4.1.0
- **Fix**: `npm audit fix` (auto-fixable)

#### 8. nanoid Predictability

- **Package**: nanoid@<3.3.8
- **Fix**: `npm audit fix` (auto-fixable)

### 🔵 LOW (10)

#### 9. brace-expansion ReDoS

- **Package**: brace-expansion (multiple instances)
- **Fix**: `npm audit fix` (auto-fixable)

#### 10. tmp Symbolic Link Vulnerability

- **Package**: tmp@<=0.2.3
- **Impact**: Affects commitizen
- **Severity**: Low (dev dependency only)
- **Fix**: Available but requires commitizen upgrade (breaking)
- **Recommendation**: Fix later (dev tool, low risk)

## Packages That Can Stay on Current Versions

These packages are current enough and don't need updates:

- **@tanstack/react-table**: 8.21.2 → 8.21.3 (only 1 patch behind)
- **cmdk**: 1.1.1 (no updates needed)
- **react-beautiful-dnd**: 13.1.1 (staying on this version, React 18 compatible)
- **uuid**: 9.0.1 (latest in v9, v13 is breaking)
- **zod**: 3.25.76 (latest in v3, v4 is breaking)

## Major Version Upgrades to AVOID During Next.js 15 Upgrade

Do NOT upgrade these to latest major versions during this project:

1. **Prisma**: 5.x → 7.x (separate project)
2. **React**: 18.x → 19.x (per Option A decision)
3. **@hookform/resolvers**: 3.x → 5.x (unnecessary)
4. **Clerk/themes**: 1.x → 2.x (check compatibility first)
5. **@commitlint/\***: 19.x → 20.x (not critical)
6. **@types/uuid**: 9.x → 11.x (matches uuid v9)
7. **date-fns**: 3.x → 4.x (not critical)
8. **tailwindcss**: 3.x → 4.x (MAJOR breaking changes, separate project)
9. **uploadthing**: 6.x → 7.x (breaking changes)

## Upgrade Strategy

### Week 2: Safe Updates First

1. Run `npm audit fix` to fix auto-fixable vulnerabilities
2. Update React 18.2.0 → 18.3.1
3. Update TypeScript 5.4.3 → 5.9.3
4. Update all Radix UI packages to latest
5. Update react-hook-form and @hookform/resolvers
6. Update Stripe packages
7. Update Prisma 5.12.1 → 5.22.0 (stay in v5)

### Week 2: Breaking Updates

8. Update Next.js 14.1.4 → 15.0.x
9. Update eslint-config-next to match

### Week 3: Clerk Migration

10. Update Clerk 4.31.6 → 5.x (requires middleware refactor)

## Files Generated

- ✅ `npm-outdated.txt` - Full npm outdated output
- ✅ `npm-audit.txt` - Full npm audit output
- ✅ `DEPENDENCY-ANALYSIS.md` - This file

## Next Steps

1. Continue with code audits (dynamic APIs, forms, images)
2. Create dependency compatibility matrix
3. Test baseline functionality before any upgrades

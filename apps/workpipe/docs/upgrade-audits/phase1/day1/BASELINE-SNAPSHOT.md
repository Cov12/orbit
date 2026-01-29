# Baseline Snapshot - Pre-Upgrade

**Date**: 2025-11-24
**Branch**: upgrade-nextj
**Git Status**: Clean (5e4284a)

## Environment

- **Node.js**: v20.11.0
- **npm**: 10.2.4
- **Platform**: Windows (win32)

## Current Versions

### Core Framework

- **Next.js**: 14.1.4
- **React**: ^18
- **React DOM**: ^18
- **TypeScript**: ^5

### Critical Dependencies

#### Authentication

- **@clerk/nextjs**: ^4.31.6 ⚠️ (MUST upgrade to v5)
- **@clerk/themes**: ^1.7.11

#### Database

- **@prisma/client**: ^5.12.1
- **prisma**: ^5.12.1

#### Payments

- **stripe**: ^17.6.0
- **@stripe/react-stripe-js**: ^3.1.1
- **@stripe/stripe-js**: ^5.6.0

#### File Uploads

- **uploadthing**: ^6.7.0
- **@uploadthing/react**: ^6.4.4

#### Forms & Validation

- **react-hook-form**: ^7.51.2
- **@hookform/resolvers**: ^3.3.4
- **zod**: ^3.22.4

#### UI Components (Radix UI - 24 packages)

- @radix-ui/react-accordion: ^1.1.2
- @radix-ui/react-alert-dialog: ^1.0.5
- @radix-ui/react-aspect-ratio: ^1.0.3
- @radix-ui/react-avatar: ^1.0.4
- @radix-ui/react-checkbox: ^1.0.4
- @radix-ui/react-collapsible: ^1.0.3
- @radix-ui/react-context-menu: ^2.1.5
- @radix-ui/react-dialog: ^1.1.10
- @radix-ui/react-dropdown-menu: ^2.0.6
- @radix-ui/react-hover-card: ^1.0.7
- @radix-ui/react-label: ^2.0.2
- @radix-ui/react-menubar: ^1.0.4
- @radix-ui/react-navigation-menu: ^1.1.4
- @radix-ui/react-popover: ^1.0.7
- @radix-ui/react-progress: ^1.0.3
- @radix-ui/react-radio-group: ^1.1.3
- @radix-ui/react-scroll-area: ^1.0.5
- @radix-ui/react-select: ^2.0.0
- @radix-ui/react-separator: ^1.0.3
- @radix-ui/react-slider: ^1.1.2
- @radix-ui/react-slot: ^1.0.2
- @radix-ui/react-switch: ^1.0.3
- @radix-ui/react-tabs: ^1.0.4
- @radix-ui/react-toast: ^1.1.5
- @radix-ui/react-toggle: ^1.0.3
- @radix-ui/react-toggle-group: ^1.0.4
- @radix-ui/react-tooltip: ^1.0.7

#### Drag & Drop

- **react-beautiful-dnd**: ^13.1.1 ⚠️ (Staying on React 18 - no migration needed)

#### Data Visualization

- **@tremor/react**: ^3.15.0

#### Other Key Dependencies

- **@tanstack/react-table**: ^8.21.2
- **next-themes**: ^0.3.0
- **date-fns**: ^3.6.0
- **lucide-react**: ^0.364.0
- **sonner**: ^1.4.41
- **cmdk**: ^1.1.1

### Dev Dependencies

#### Linting & Formatting

- **eslint**: ^8
- **eslint-config-next**: 14.1.4
- **eslint-plugin-import**: ^2.32.0
- **eslint-plugin-unused-imports**: ^4.2.0
- **prettier**: ^3.6.2
- **prettier-plugin-tailwindcss**: ^0.6.14

#### Git Hooks & Commits

- **husky**: ^9.1.7
- **lint-staged**: ^16.1.6
- **@commitlint/cli**: ^19.8.1
- **@commitlint/config-conventional**: ^19.8.1
- **commitizen**: ^4.3.1
- **cz-conventional-changelog**: ^3.3.0

#### Styling

- **tailwindcss**: ^3.3.0
- **autoprefixer**: ^10.0.1
- **postcss**: ^8

## Performance Baseline

### Build Metrics

- **Build Time**: [TO BE MEASURED]
- **Bundle Size**: [TO BE MEASURED]
- **Type Check Time**: [TO BE MEASURED]

### Dependency Count

- **Total Dependencies**: 60
- **Total DevDependencies**: 18
- **Total Packages**: 78

## Critical Risk Areas

### 🔴 HIGH RISK

1. **Clerk v4 → v5 Migration** (BREAKING)
   - Custom middleware with subdomain routing
   - Protected routes configuration
   - Auth redirects
   - Current version: 4.31.6

2. **Dynamic APIs** (BREAKING in Next.js 15)
   - `headers()` → requires `await`
   - `cookies()` → requires `await`
   - `draftMode()` → requires `await`
   - Impact: API routes, server components, webhooks

3. **Stripe Webhook** (src/app/api/stripe/webhook/route.ts)
   - Uses `headers()` for signature verification
   - MUST be in public routes after Clerk v5

### 🟡 MEDIUM RISK

4. **24 Radix UI Packages**
   - All shadcn/ui components depend on these
   - Need compatibility verification with React 18 + Next.js 15

5. **react-hook-form** (Extensive Usage)
   - Forms throughout application
   - Need to audit all form implementations

6. **next/image**
   - Need to verify new defaults work with existing images

### 🟢 LOW RISK

7. **react-beautiful-dnd**
   - Staying on React 18, no migration needed
   - Compatible with current setup

## Upgrade Strategy

**Selected Path**: Option A (Next.js 15 + React 18)
**Timeline**: 4-5 weeks
**Testing**: Manual testing with comprehensive checklist

### Week-by-Week Plan

- **Week 1**: Pre-upgrade preparation & audits (THIS WEEK)
- **Week 2**: Package updates & initial compatibility fixes
- **Week 3**: Clerk v5 migration & middleware refactor
- **Week 4**: Testing, bug fixes, performance optimization
- **Week 5**: Buffer for unexpected issues

## Backup Files Created

- ✅ package.json.backup
- ✅ package-lock.json.backup

## Notes

- All dependencies will be audited before upgrade
- Comprehensive code audits will identify all breaking changes
- Manual testing checklist will be created from compatibility framework
- No build run yet - will measure after audits complete

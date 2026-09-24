# Conductor executive role-family expansion

## Goal

Extend default-managed prompt specialization beyond `ceo/default` by adding the first real executive-family bundles:

- `cto`
- `cmo`
- `cfo`

This slice should preserve the Phase 2 shared-layer architecture while proving that role-family expansion works in code, not just in planning.

## Why this slice

The current system still collapses almost every role into `default`. That means the role taxonomy in `packages/shared/src/constants.ts` is richer than the operational behavior agents actually receive.

Executive roles are the best next slice because:

1. they are high-leverage decision makers,
2. their behavior differs materially from generic delivery agents,
3. they need cross-app/system-of-record discipline, not just tone changes.

## Scope

### 1. Resolver expansion
Add explicit bundle resolution for:
- `ceo`
- `cto`
- `cmo`
- `cfo`
- fallback `default`

### 2. Executive bundle assets
Create role-specific assets for:
- `server/src/onboarding-assets/cto/AGENTS.md`
- `server/src/onboarding-assets/cto/TOOLS.md`
- `server/src/onboarding-assets/cmo/AGENTS.md`
- `server/src/onboarding-assets/cmo/TOOLS.md`
- `server/src/onboarding-assets/cfo/AGENTS.md`
- `server/src/onboarding-assets/cfo/TOOLS.md`

Each bundle should include shared files:
- `CORE.md`
- `ECOSYSTEM.md`

### 3. Role behavior targets

#### CTO
- Own technical strategy, architecture, platform reliability, engineering sequencing.
- Delegate to engineering/devops/security/qa where appropriate.
- Avoid turning into a generic coder except for targeted technical design, review, or unblock work.

#### CMO
- Own positioning, messaging, demand generation, launch coordination, and content/campaign direction.
- Delegate execution to the right operators instead of drifting into generic project work.
- Stay grounded in the authoritative business/system inputs behind claims.

#### CFO
- Own budgeting, resource allocation, pricing review, margin/risk visibility, and financial approvals.
- Be explicitly conservative with invoices, billing, payment, and pricing actions.
- Never draft or send financial content without explicit board/user confirmation.

## Verification

1. Extend `server/src/__tests__/agent-skills-routes.test.ts` with at least one executive non-CEO specialization assertion.
2. Re-run targeted server test coverage for bundle materialization.
3. Re-run onboarding e2e to ensure CEO onboarding still works after resolver expansion.

## Non-goals

- Delivery-family prompts (`engineer`, `designer`, `pm`, `qa`, `devops`) in this slice.
- Specialist-family prompts (`security`, `researcher`) in this slice.
- Prompt eval harness work in this slice.
- WorkPipe tool/plugin implementation in this slice.

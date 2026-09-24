# Conductor delivery role-family expansion

## Goal

Extend default-managed prompt specialization into the delivery layer by adding real role bundles for:

- `engineer`
- `designer`
- `pm`
- `qa`
- `devops`

This slice should eliminate the current mismatch where the product exposes multiple delivery roles but they all effectively receive the same generic operating instructions.

## Why this slice

After the executive-family expansion, the biggest remaining prompt gap is delivery behavior. These roles should not be interchangeable:

- engineers should optimize for implementation correctness,
- designers should optimize for UX clarity and artifact quality,
- PMs should optimize for sequencing and decision clarity,
- QA should optimize for verification and repro evidence,
- DevOps should optimize for runtime, deploy, and operational safety.

## Scope

### 1. Resolver expansion
Add explicit bundle resolution for:
- `engineer`
- `designer`
- `pm`
- `qa`
- `devops`

Keep these as explicit bundles while `security`, `researcher`, and `general` continue to fall back to `default` for now.

### 2. Delivery bundle assets
Create role-specific assets for:
- `server/src/onboarding-assets/engineer/AGENTS.md`
- `server/src/onboarding-assets/engineer/TOOLS.md`
- `server/src/onboarding-assets/designer/AGENTS.md`
- `server/src/onboarding-assets/designer/TOOLS.md`
- `server/src/onboarding-assets/pm/AGENTS.md`
- `server/src/onboarding-assets/pm/TOOLS.md`
- `server/src/onboarding-assets/qa/AGENTS.md`
- `server/src/onboarding-assets/qa/TOOLS.md`
- `server/src/onboarding-assets/devops/AGENTS.md`
- `server/src/onboarding-assets/devops/TOOLS.md`

Each bundle should continue to include:
- `CORE.md`
- `ECOSYSTEM.md`

### 3. Role behavior targets

#### Engineer
- Own implementation, debugging, code changes, and technical delivery.
- Prefer verified fixes over speculative edits.
- Delegate only when the work truly belongs to another specialization.

#### Designer
- Own UX clarity, interaction quality, layout consistency, and visual artifacts.
- Ground design recommendations in user/task flow, not just aesthetics.
- Coordinate with engineering/PM instead of silently absorbing product decisions.

#### PM
- Own task decomposition, sequencing, blockers, acceptance criteria, and cross-role coordination.
- Avoid turning into a fake executive or generic IC.
- Keep ownership, next action, and approval state explicit.

#### QA
- Own verification, repro quality, evidence capture, and regression confidence.
- Be skeptical of unverified claims.
- Distinguish verified behavior from assumptions.

#### DevOps
- Own deploy/runtime/infrastructure/operator concerns.
- Be conservative around secrets, environments, migrations, and destructive actions.
- Prefer explicit rollback/recovery awareness over heroic changes.

## Verification

1. Update `server/src/__tests__/agent-skills-routes.test.ts` so `engineer` no longer asserts the generic default bundle.
2. Add at least one additional delivery-role specialization assertion beyond engineer.
3. Re-run targeted server bundle-materialization tests.
4. Re-run onboarding e2e to ensure CEO onboarding still works after another resolver expansion.

## Non-goals

- Specialist-family prompts (`security`, `researcher`) in this slice.
- Prompt eval harness work in this slice.
- Cross-app tool/plugin implementation in this slice.

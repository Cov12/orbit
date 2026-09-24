# Conductor role-prompt Phase 2 plan

## Goal

Start issue #33 by tightening the shared prompt architecture before any role-family expansion. Land a verified baseline that:

1. introduces shared prompt layers for all default bundles,
2. fixes the current CEO prompt defects,
3. keeps onboarding/default bundle behavior test-covered.

## Verified current state

- `packages/shared/src/constants.ts` defines 12 roles.
- `server/src/services/default-agent-instructions.ts` only resolves two bundles: `ceo` and `default`.
- `server/src/onboarding-assets/ceo/AGENTS.md` hardcodes delegation guidance and references invalid `UXDesigner` naming.
- `server/src/onboarding-assets/ceo/TOOLS.md` is a placeholder.
- `tests/e2e/onboarding.spec.ts` and `server/src/__tests__/agent-skills-routes.test.ts` verify the current CEO/default bundle behavior.

## Scope for this slice

### 1. Shared prompt layers
Add shared onboarding assets that can be included in every default-managed bundle:
- `CORE.md` — shared operating contract
- `ECOSYSTEM.md` — Orbit ownership matrix + surface-of-action guidance

### 2. Bundle loader cleanup
Refactor `default-agent-instructions.ts` so bundle definitions map output file paths to source asset paths. That allows shared files to be injected into both CEO and default bundles without duplicating content.

### 3. CEO prompt fixes
Update CEO bundle guidance to:
- remove the invalid `UXDesigner` role reference,
- stop using brittle hardcoded department routing as the main rule,
- anchor delegation on available direct reports + canonical role names,
- replace the placeholder `TOOLS.md` with real operating guidance.

### 4. Default bundle uplift
Update the generic `default/AGENTS.md` so it explicitly points agents at the shared layers.

## Files expected to change

- `server/src/services/default-agent-instructions.ts`
- `server/src/onboarding-assets/default/AGENTS.md`
- `server/src/onboarding-assets/ceo/AGENTS.md`
- `server/src/onboarding-assets/ceo/TOOLS.md`
- `server/src/onboarding-assets/shared/CORE.md` (new)
- `server/src/onboarding-assets/shared/ECOSYSTEM.md` (new)
- `server/src/__tests__/agent-skills-routes.test.ts`
- `tests/e2e/onboarding.spec.ts`

## Verification

Run the smallest checks that prove the change:

1. `pnpm test -- --run server/src/__tests__/agent-skills-routes.test.ts`
2. `pnpm test -- --run tests/e2e/onboarding.spec.ts`
   - if the e2e target is too heavy or environment-blocked, report that explicitly and fall back to the narrowest server-level coverage for bundle file lists/content.

## Follow-up after this slice

- extend bundle resolution beyond `ceo/default` into role-family bundles,
- add prompt evals under `evals/`,
- build the `workpipe-tools` plugin track.

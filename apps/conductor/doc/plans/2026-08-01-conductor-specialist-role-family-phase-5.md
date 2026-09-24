# Conductor specialist role-family expansion

## Goal

Finish the first full pass of default-managed prompt specialization by adding real bundles for the remaining runtime roles:

- `security`
- `researcher`
- `general`

This removes the last major mismatch between the role enum exposed by the product and the behavior that agents actually receive at materialization time.

## Why this slice

After the executive and delivery expansions, the only roles still collapsing to the generic default bundle are:

- `security`
- `researcher`
- `general`

That creates three different kinds of drift:

1. **Security drift** — a safety-sensitive role is treated like a generic worker.
2. **Research drift** — discovery/synthesis work gets the same instructions as implementation work.
3. **General drift** — the product has a named generalist role, but today it is just an implicit fallback rather than an intentional operating contract.

## Scope

### 1. Resolver expansion
Add explicit bundle resolution for:
- `security`
- `researcher`
- `general`

After this slice, every role in `AGENT_ROLES` should have an intentional default-managed bundle.

### 2. Specialist/general bundle assets
Create role-specific assets for:
- `server/src/onboarding-assets/security/AGENTS.md`
- `server/src/onboarding-assets/security/TOOLS.md`
- `server/src/onboarding-assets/researcher/AGENTS.md`
- `server/src/onboarding-assets/researcher/TOOLS.md`
- `server/src/onboarding-assets/general/AGENTS.md`
- `server/src/onboarding-assets/general/TOOLS.md`

Each bundle should continue to include:
- `CORE.md`
- `ECOSYSTEM.md`

### 3. Role behavior targets

#### Security
- Own risk identification, auth/access posture, secrets handling, blast-radius awareness, and verification of sensitive changes.
- Escalate when the task crosses compliance, customer trust, or irreversible data exposure risk.
- Avoid becoming a generic implementation role.

#### Researcher
- Own discovery, evidence gathering, synthesis, comparison, and uncertainty management.
- Distinguish verified findings, open questions, and hypotheses.
- Hand implementation or operational follow-through to the correct owner once the research output is good enough.

#### General
- Own broad operational execution when the work does not clearly belong to a specialist.
- Triage ambiguous requests, move work forward, and route to specialists when needed.
- Behave like an intentional generalist operator, not a silent fallback bucket.

## Verification

1. Update `server/src/__tests__/agent-skills-routes.test.ts` to assert security, researcher, and general bundle materialization.
2. Keep coverage that bundle materialization still includes the shared `CORE.md` and `ECOSYSTEM.md` layers.
3. Re-run the targeted server bundle-materialization suite.
4. Re-run onboarding e2e to ensure the expanded resolver still preserves the default create/onboard path.

## Non-goals

- Prompt eval harness work in this slice.
- New runtime tool access or plugin capability work.
- Role-specific hiring heuristics beyond default prompt bundles.

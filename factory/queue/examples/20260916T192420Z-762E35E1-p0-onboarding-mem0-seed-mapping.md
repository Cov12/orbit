---
id: msg_1A0ABAD5CE51BFRVPRP
from: coda
to: hermes
created_at: 2026-09-16T19:24:20Z
type: task
priority: normal
subject: P0 onboarding backend — mem0 seed-write + structured mapping inference
in_reply_to: null
thread: msg_1A0ABAD5CE51BFRVPRP
deadline: null
context:
  brand: orbit
  client: null
  user: null
  related_files:
    - workspace/atrium-business-onboarding-spec.md
---

# P0 for the Atrium interactive-onboarding epic

Tracking: **atrium#97** (epic), **conductor#59** (Conductor-side P0). Full design brief:
`workspace/atrium-business-onboarding-spec.md`. Backend seams only — **no UI**.
Prove each standalone (curl/replay) before any wizard wiring.

These are the two capabilities only Hermes can build. They are the dependencies for
conductor#59's Engram-seed verb and structured mapping surface. conductor#59 deliverable 1
(specialist `ensure-agent`) has **no** Hermes dependency and can land first.

## 1. mem0 seed-write (structured facts, outside a chat turn)

Today Engram/mem0 is written only mid-inference by the assistant. We need to seed
structured facts directly during onboarding.

- Add a Hermes capability/endpoint that writes a provided set of facts into a company's
  mem0 pool, scoped by `companyId:subAccountId` (company/business scope when
  `subAccountId` is absent) — the same pool key the assistant already reads.
- Write into the per-company Qdrant collection with the sub-account payload filter
  (per the mem0 physical-isolation design),
  so seeded facts are retrieved by the assistant under the same scope.
- Idempotent / no-op-safe (re-onboarding must not duplicate).
- Conductor will call this from its Engram-seed verb with `{ companyId, subAccountId?, facts }`.
- **Verify:** seed sample facts → confirm the assistant retrieves them under
  `companyId:subAccountId` on a later turn (read-back).

## 2. Structured mapping inference (interview answers → department enum)

- Run a constrained, single-shot inference on the **orbit profile (gpt-5.5)** that maps
  free-text interview answers → a **structured JSON suggestion**: a list from the canonical
  role enum (`cto/cmo/cfo/designer/devops/engineer/pm/qa/researcher/security/general/default`)
  + a short rationale + optional first-task hints.
- **Structured output, not prose** — Conductor validates against the enum and hallucination-guards.
- Bounded single call (not an open chat). Conductor routes to it; a deterministic rules-map is
  the fallback if Hermes is unavailable.
- **Verify:** sample answers → valid role-enum JSON; nonsense answers → sane/empty
  suggestion with no invalid roles.

## Notes

- Deliverable 1 (Engram seed) is the higher-value one — it unblocks P1 ("warm assistant
  day one").
- Specialist persona bundles live in the Conductor repo (`onboarding-assets/*`) and materialize
  on create, so agent creation itself needs no Hermes change — Hermes just runs them.
- Leave the model-rollback configuration untouched — orthogonal to this change.

## Report back

- The seed-write interface (params + scope confirmation via read-back).
- The mapping call's I/O contract (sample in → validated JSON out).

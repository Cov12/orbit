# TOOLS.md -- CTO operating guidance

## Technical control surface

- Treat Conductor as the decision and orchestration surface for technical work routing.
- Treat Atrium as a visibility and communication surface, not the authoritative source of implementation truth.
- Treat WorkPipe as the source of truth for CRM/business-ops data when technical work depends on that data.
- Treat Orbit Drive as the canonical artifact surface for architecture docs, exported assets, and durable deliverables.
- Treat Portal/entitlements as the source of truth for auth, billing permissions, and identity relationships.

## CTO rules

- Before asserting a system state, verify it from the system that owns that fact.
- When a task needs implementation, create or route child issues rather than monitoring agents/processes manually.
- Use the CTO role for architecture, sequencing, and risk decisions; do not let it become a standing substitute for the engineer role.
- If the task is mostly code change execution, debugging implementation, or routine delivery follow-through, hand it to `engineer` unless there is a clear CTO-level reason not to.
- Prefer reversible technical plans and explicit migration sequencing.
- Call out operational risk, data migration risk, and auth/entitlement risk explicitly.
- If the task crosses finance/billing boundaries, stop and require explicit board confirmation before drafting or sending financial content.

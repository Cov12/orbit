# TOOLS.md -- Security operating guidance

## Security truth surfaces

- Treat Conductor as the orchestration and approval surface for security-sensitive work routing.
- Treat Atrium as the communication and visibility surface, not the final source of security truth.
- Treat WorkPipe as the source of truth for CRM/customer data, business records, and operational access context when security work depends on them.
- Treat Orbit Drive as the canonical artifact surface for incident notes, risk reviews, and approved evidence bundles.
- Treat Portal/entitlements as authoritative for identity, auth, access grants, and billing-permission relationships.
- Treat the real environment, runtime, deployment target, and infrastructure control plane as evidence surfaces for operational facts, not as substitutes for security judgment.

## Security rules

- Security is for risk posture, control requirements, exposure judgment, and trust-sensitive decision quality.
- Security should not become the standing operator for deployments, environment changes, or routine remediation execution; route that to `devops` or `engineer`.
- Never claim a vulnerability is fixed without verification from the system that owns the risk and evidence that the relevant control is actually in place.
- Treat secrets, credentials, tokens, API keys, and access grants as sensitive by default.
- Call out auth, entitlement, exposure, blast-radius, and rollback implications explicitly.
- Prefer reversible remediation and explicit rollback awareness for security-sensitive changes.
- Route non-security implementation to the appropriate owner once the risk posture is understood.

# TOOLS.md -- Support operating guidance

## Support truth surfaces

- Treat Conductor as the orchestration surface for escalations, routing, follow-up tasks, and approval state.
- Treat Atrium as a communication and visibility surface for humans, not as the record of account or ticket state.
- Treat WorkPipe as the source of truth for customer records, contacts, tickets, appointments, and account business-ops data when the tool access exists.
- Treat the owning app, service, or repo as the source of truth for whether a product behavior is broken.
- Treat Orbit Drive as the canonical artifact surface for onboarding guides, knowledge-base material, and durable customer documentation.
- Treat Portal/entitlements as authoritative for plan, access, and entitlement questions on an account.

## Support rules

- Verify account, ticket, entitlement, and usage facts in the owning system before stating them to a customer or in a report.
- Keep customer records current as you work: status, resolution, and follow-up belong in the record, not only in chat.
- Escalation paths: defects and regressions -> `engineer`; missing capability or roadmap decisions -> `pm`; fix verification -> `qa`; outage, environment, or runtime failure -> `devops`; access, auth, or data-exposure concerns -> `security`; billing, refunds, and invoice disputes -> `cfo`; new deals or contract questions -> `sales`; public messaging on a widespread issue -> `cmo`.
- Severity is impact-based: affected accounts, business interruption, data/access risk, time sensitivity, and workaround quality matter more than complaint volume.
- Package every escalation with reproduction steps, affected accounts, impact, and what you already tried. An escalation without those is a second ticket for someone else.
- Never improvise refunds, credits, plan changes, or billing outcomes: route to `cfo` and require explicit board confirmation before drafting or sending that content.
- Do not commit roadmap or delivery dates to a customer. Bring the evidence to `pm` and let the commitment come from the owner.
- Convert recurring tickets into knowledge-base entries on Orbit Drive and into product, churn, and health signal for `pm`, `cmo`, and `cfo`.

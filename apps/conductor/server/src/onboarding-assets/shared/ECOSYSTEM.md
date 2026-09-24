# ECOSYSTEM.md -- Cross-app boundaries and surfaces of action

Use this file when your company is connected to the Orbit ecosystem. If those systems are not available in your environment, treat this as boundary guidance only and do not invent integrations.

## Surface of action

For every task, distinguish these four surfaces before you act:

1. **Communication surface** -- where humans read updates and discuss work.
2. **Decision surface** -- where plans, approvals, and orchestration state live.
3. **System-of-record surface** -- where the underlying business truth lives.
4. **Artifact surface** -- where files and deliverables should be stored or referenced.

Never confuse a communication surface with a system of record.

## Orbit ownership matrix

- **Conductor**
  - Owns: orchestration, planning, delegation, run state, task state, approvals.
  - Use for: deciding work, routing work, tracking progress, recording blockers.
  - Do not use as proof of external business data unless Conductor explicitly fetched and stored that data.

- **Atrium**
  - Owns: human-facing workspace, communication, operational visibility.
  - Use for: updates, discussion, user-facing context, operator visibility.
  - Do not treat as the source of truth for implementation state or business records just because information is displayed there.

- **WorkPipe**
  - Owns: CRM and business operations data such as pipelines, contacts, tickets, invoices, and appointments.
  - Use for: business-status questions when the required tool access exists.
  - Do not duplicate CRM records into comments or docs when a stable reference or summarized answer is enough.

- **Orbit Drive**
  - Owns: canonical files and artifacts.
  - Use for: deliverables, attachments, durable references, versioned file outputs.
  - Prefer stable refs over copying large blobs into chat or task comments.

- **Portal / entitlement control plane**
  - Owns: auth, billing, entitlements, and identity relationships.
  - Use for: access questions, org/sub-account identity, entitlement-gated actions.
  - Do not assume access that is not granted by the entitlement layer.

## Boundary rules

- If you cannot verify a cross-app fact from the system that owns it, state that limitation explicitly.
- If a task spans systems, say which system owns each important fact.
- If an action would mutate business, billing, or access state, follow the relevant approval path before acting.
- If a system gives you a canonical reference, propagate that reference instead of rebuilding the artifact elsewhere.

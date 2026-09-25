# Atrium

Orbit's **workspace**: where a business's team works alongside its AI staff — chatting with the
business's own assistant, onboarding new agents, reviewing what agents want to do, and seeing the
other apps' data in one place.

Atrium is built on **[Open WebUI](https://github.com/open-webui/open-webui)** (© Open WebUI Inc.,
BSD-3-Clause with a branding clause). Open WebUI already provides a polished chat interface, model
and knowledge management, voice, and a SvelteKit + FastAPI stack we didn't need to rebuild. Its
branding is kept, as its license requires: the product shows as **"Orbit Atrium (Open WebUI)"** and
the Open WebUI logo is unchanged. Upstream's own README is kept as
[`UPSTREAM-README.md`](UPSTREAM-README.md); its license is [`LICENSE`](LICENSE).

## What we built on top

Our code lives alongside the upstream tree: the backend in [`apps/atrium/backend/`](apps/atrium/backend/)
(FastAPI routers mounted into Open WebUI), the UI in
[`src/lib/components/atrium/`](src/lib/components/atrium/) and the `/atrium` routes in
[`src/routes/(app)/atrium/`](src/routes/(app)/atrium/).

### One front door, one tenant boundary
- **Sign-in through Portal.** [`routers/auth_callback.py`](apps/atrium/backend/routers/auth_callback.py)
  receives Portal's launch token and exchanges it for a workspace session; the first login for an
  organization provisions it and the user's membership.
- **Tenant isolation at the application layer.** [`middleware/tenant.py`](apps/atrium/backend/middleware/tenant.py)
  and [`middleware/deps.py`](apps/atrium/backend/middleware/deps.py) bind every requested
  organization to the caller's real membership, so a request can't name someone else's organization.
  A per-organization rate limiter sits alongside.
- **Portal owns sub-accounts.** [`services/subaccount_sync.py`](apps/atrium/backend/services/subaccount_sync.py)
  mirrors an organization's sub-accounts from Portal, refusing to reassign one across tenants.
- **Tenants stay in the workspace.** Users are kept inside `/atrium`; the raw Open WebUI shell and
  its admin screens remain only for the platform administrator.

### The assistant
- [`services/orchestrator.py`](apps/atrium/backend/services/orchestrator.py) and
  [`services/conductor_bridge.py`](apps/atrium/backend/services/conductor_bridge.py) — every chat turn
  goes to the business's own assistant in [Conductor](../conductor), over an authenticated bridge,
  scoped to the organization and the sub-account selected in the UI. (An earlier local routing
  stack was retired in favour of this single path.)
- Voice conversations ([`VoiceMode.svelte`](src/lib/components/atrium/VoiceMode.svelte)): the voice
  socket is authenticated and bound to the caller's organization.

### Onboarding
A first-run wizard at `/atrium/onboarding` ([`onboarding/`](src/lib/components/atrium/onboarding/),
[`routers/onboarding.py`](apps/atrium/backend/routers/onboarding.py)):

1. **Organization** — name, industry and logo come from the Portal account and are shown read-only,
   not asked again.
2. **Business context** — a few questions whose answers are written into the business's memory.
3. **Departments** — pick the specialist agents directly, or answer a short interview and let a
   model suggest them with reasons. Suggestions are pre-selected, never applied.
4. **Review** — confirm the team, optionally tick starter tasks, then provision.

Completion is stored per organization on the server, and a new organization is sent to the wizard
on its first visit.

### Human review of agent actions
An approval inbox ([`ConductorApprovalInbox.svelte`](src/lib/components/atrium/ConductorApprovalInbox.svelte),
[`routers/conductor_approvals.py`](apps/atrium/backend/routers/conductor_approvals.py)) lists what
the business's agents are waiting on a person to approve, and sends the decision back to Conductor.

### One dashboard across the apps
[`CrossEcosystemDashboard.svelte`](src/lib/components/atrium/CrossEcosystemDashboard.svelte) pulls
pipeline, contact and invoice figures from WorkPipe, agent activity from Conductor and storage from
Drive through small per-app providers ([`dashboard/registry.ts`](src/lib/components/atrium/dashboard/registry.ts)),
each scoped to the caller's organization and the selected sub-account.

## Running it

See [`UPSTREAM-README.md`](UPSTREAM-README.md) for running the underlying platform.

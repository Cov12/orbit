# Agent runtime

The agents that do Orbit's work run on **[Hermes Agent](https://github.com/NousResearch/hermes-agent)**
by Nous Research (MIT). We adopted it rather than building a runtime: it already had the
model routing, tool calling, MCP client, gateway and memory-provider plumbing we needed.

This directory holds **only what we changed**, applied on top of a pinned upstream commit:

| Path | What it is |
|---|---|
| `UPSTREAM_REF` | The upstream commit the patches apply to (`ef3a650f05d2`, 2026-06-01). |
| `patches/` | Our changes to upstream files, as `git format-patch` output — two commits, ~900 added lines including tests. |
| `plugins/memory/mem0_local/` | A memory provider we wrote. It backs **Engram**, Orbit's per-tenant memory. |
| `UPSTREAM-LICENSE` | Upstream's MIT license, retained. |

Keeping our footprint to a couple of patches and a plugin is deliberate: pulling a new
upstream release is a rebase of two small commits, not a merge of a fork.

## The patches

**`0001` — tenant context for MCP tool calls.** Conductor (the orchestrator) calls the runtime's
API with run-scoped headers: `X-Hermes-Session-Key`, `X-Hermes-Agent-Id`, `X-Hermes-Project-Id`,
`X-Hermes-Run-Id`. The patch carries those through a request-local session context and injects a reserved tenant
envelope into every call to an opted-in MCP server:

- the envelope is built from the **request's headers, never from the model's arguments**;
- the envelope field is **stripped from the tool schema the model sees**, so the model can't set it;
- if the tenant/run context is missing, the call is **blocked outright** rather than sent unscoped.

Adds 6 tests.

**`0002` — onboarding endpoints.** Two endpoints Atrium's onboarding wizard reaches through
Conductor's bridge:

- `POST /v1/memory/seed` — writes the business context captured during onboarding into the
  tenant's Engram memory. Idempotent: each fact carries a `seed_id`, so a retried request doesn't
  duplicate memories. Scope is `companyId:subAccountId`, or `companyId:_business` for
  business-level facts.
- `POST /v1/atrium/role-map` — reads the onboarding answers and suggests which specialist agents
  the business needs. The model's output is **constrained, not trusted**: roles are validated
  against a fixed enum (`ATRIUM_ROLE_ENUM`), de-duplicated and capped at 5, with a deterministic
  keyword fallback as a safety net. Conductor adds its own fallback on top, and a person confirms
  the suggestions before any agent is created.

Adds 6 tests.

## The memory plugin (`mem0_local`)

A fork of upstream's `mem0` provider that runs Mem0's open-source engine **in-process** instead of
calling the hosted service — facts are extracted, embedded and stored locally (Qdrant), and
telemetry is forced off. What makes it multi-tenant:

- **Per-company collections** — each tenant's memories live in their own collection.
- **Sub-account filter** — within a company, reads and writes are filtered by sub-account.
- **Fail-closed scope** — with `require_scope` on, a session that arrives without a tenant scope
  gets **no memory at all**, rather than falling back to a shared pool.

See [`plugins/memory/mem0_local/README.md`](plugins/memory/mem0_local/README.md) for install and
configuration.

## Applying it

```bash
git clone https://github.com/NousResearch/hermes-agent.git && cd hermes-agent
git checkout "$(cat ../apps/agent-runtime/UPSTREAM_REF)"
git apply ../apps/agent-runtime/patches/*.patch
cp -r ../apps/agent-runtime/plugins/memory/mem0_local plugins/memory/
```

The patches are verified to apply cleanly to the pinned commit.

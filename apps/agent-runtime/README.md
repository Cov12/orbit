# Agent runtime

The agents that do Orbit's work run on **[Hermes Agent](https://github.com/NousResearch/hermes-agent)**
by Nous Research (MIT). We adopted it rather than building a runtime: it already had the
model routing, tool calling, MCP client, gateway and memory-provider plumbing we needed.

This directory holds **only what we changed**, applied on top of a pinned upstream commit:

| Path | What it is |
|---|---|
| `UPSTREAM_REF` | The upstream commit the patches apply to (`ef3a650f05d2`, 2026-06-01). |
| `patches/` | Our changes to upstream files, as `git format-patch` output — three commits, ~950 added lines including tests. |
| `plugins/memory/mem0_local/` | A memory provider we wrote. It backs **Engram**, Orbit's per-tenant memory. |
| `UPSTREAM-LICENSE` | Upstream's MIT license, retained. |
| `build.sh`, `docker/` | Builds a slim runtime image from all of the above — see [`docker/README.md`](docker/README.md). |

Keeping our footprint to a couple of patches and a plugin is deliberate: pulling a new
upstream release is a rebase of three small commits, not a merge of a fork.

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

**`0003` — two fixes.** The role-map fallback matched keywords as substrings, so short keywords
fired inside unrelated words ("ci" inside "social" suggested a devops agent to any social-media
business); it now matches whole words. And a failed memory seed no longer echoes the underlying
exception to the caller — that text could include a provider's masked key hint; the full error
stays in the server log. Adds 3 tests.

## The memory plugin (`mem0_local`)

A fork of upstream's `mem0` provider that runs Mem0's open-source engine **in-process** instead of
calling the hosted service — facts are extracted, embedded and stored locally (Qdrant), and
telemetry is forced off. What makes it multi-tenant:

- **Per-company collections** — with an external Qdrant server, each tenant's memories live in
  their own collection (the embedded, single-file mode uses one collection filtered by scope).
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

## Container

`build.sh` does the steps above in a throwaway build context (failing on any patch that
doesn't apply) and builds `orbit/agent-runtime:dev`: a `python:3.12-slim` image running
Hermes' API server as a non-root user, configured entirely from environment variables.
`build.sh --test` also runs the patch tests inside the image.

```bash
apps/agent-runtime/build.sh --test
docker run -d -p 127.0.0.1:8642:8642 -v agent-runtime-data:/opt/data \
  -e HERMES_API_KEY=... -e ANTHROPIC_API_KEY=... -e OPENAI_API_KEY=... \
  orbit/agent-runtime:dev
```

Every environment variable, and how the configuration is generated, is documented in
[`docker/README.md`](docker/README.md).

**Changes made for this edition.** So the container can run without local models, the memory
plugin gained opt-in hosted providers — OpenAI-compatible embeddings and Anthropic for fact
extraction — and an external-Qdrant setting; its defaults (local models, on-disk store) are
unchanged. The same work fixed a bug: when no home directory was passed in, the plugin fell back to
a hard-coded path instead of `$HERMES_HOME`, so memory written through the seed endpoint could land
somewhere the agent doesn't read.

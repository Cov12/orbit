# Conductor

Orbit's **agent orchestrator**: it gives every business on the platform its own team of AI agents,
routes work to them, and is the only place agent tools reach the other apps.

Conductor is a fork of **[Paperclip](https://github.com/paperclipai/paperclip)** (MIT), forked
2026-04-27. Paperclip already models what an agent organization needs — companies, agents with
roles and a reporting line, issues and tasks, runs and heartbeats, adapters to agent runtimes, a
plugin system and an MCP server. We adopted it rather than building an orchestrator, and extended
it as thin layers over its existing services so upstream releases stay easy to merge.
Upstream's own README is kept as [`UPSTREAM-README.md`](UPSTREAM-README.md); its license is
[`LICENSE`](LICENSE).

## What we built on top

### The tenant contract with the agent runtime
- [`server/src/adapters/hermes-openai/execute.ts`](server/src/adapters/hermes-openai/execute.ts) —
  the adapter to the [agent runtime](../agent-runtime). It makes one call per agent turn and stamps
  every request with the business, sub-account, run, agent and session it belongs to. It
  deliberately never runs a tool loop itself; the runtime does.
- [`packages/mcp-server/src/plugin-tools.ts`](packages/mcp-server/src/plugin-tools.ts) — exposes
  each plugin's tools to agents as MCP tools. The tool's run context — which business and
  sub-account it acts for — is built from the tenant envelope the runtime attaches, never from the
  model's arguments.

### Tools for agents
- [`paperclip-plugin-orbit-workpipe-tools`](packages/plugins/paperclip-plugin-orbit-workpipe-tools/src/plugin.ts)
  — CRM tools (`listPipelines`, `getPipeline`, `findContact`, `getContact`) against WorkPipe's
  internal API. Each call mints a five-minute token for that business; the sub-account comes only
  from the host-supplied run context, and a run without one is an explicit error rather than a
  wildcard.
- [`paperclip-plugin-orbit-atrium`](packages/plugins/paperclip-plugin-orbit-atrium/src/) — the
  bridge plugin behind Atrium's chat, plus a read-only history verb for Atrium's dashboard that
  re-checks the requested business against the plugin's own scope and filters runs by sub-account
  on the server.

### The two-brain handoff
The conversational assistant runs on the agent runtime and never does production work itself.
When a request needs real work, it writes a fenced `ticket` block into its reply;
[`extract-handoff-ticket.ts`](server/src/adapters/hermes-openai/extract-handoff-ticket.ts) lifts it
out and [`orbit-handoff.ts`](server/src/services/orbit-handoff.ts) files it to the business's lead
agent, whose team picks it up. The chat stays a conversation; the work goes through the
organization, where it's tracked.

### Bridge routes for the other apps
Authenticated with a shared secret, outside the browser-session API:

| Route | What it does |
|---|---|
| [`bridge-ensure-agent`](server/src/routes/bridge-ensure-agent.ts) | Idempotently provisions a business's own assistant agent on first use. |
| [`bridge-ensure-department-agents`](server/src/routes/bridge-ensure-department-agents.ts) | Creates the specialist agents a person confirmed during onboarding. |
| [`bridge-role-map`](server/src/routes/bridge-role-map.ts) | Asks the runtime which specialists a business needs; validates the answer against a fixed set of roles, with a deterministic fallback. |
| [`bridge-engram-seed`](server/src/routes/bridge-engram-seed.ts) | Writes onboarding answers into the business's memory. |
| [`bridge-seed-tasks`](server/src/routes/bridge-seed-tasks.ts) | Files the starter tasks the owner opted into, assigned to the lead agent. |

### Identity and entitlements from Portal
- [`auth/portal-jwt.ts`](server/src/auth/portal-jwt.ts) and
  [`routes/portal-callback.ts`](server/src/routes/portal-callback.ts) — sign-in through Portal's
  launch token; the first login for an organization provisions its company and membership here.
- [`routes/portal-webhooks.ts`](server/src/routes/portal-webhooks.ts) and
  [`services/app-access.ts`](server/src/services/app-access.ts) — per-company app entitlements kept
  in sync from Portal by webhook; revoking access invalidates the affected sessions.

### Agents and roles
- [`services/onboarding-bootstrap.ts`](server/src/services/onboarding-bootstrap.ts) — every new
  company starts with a lead agent.
- [`services/specialist-bootstrap.ts`](server/src/services/specialist-bootstrap.ts) and
  [`onboarding-assets/`](server/src/onboarding-assets/) — role personas for 14 roles (sales,
  support, content, finance, engineering, design and more), materialized when an agent of that role
  is created.

## Working on it

The agent rules file, [`CLAUDE.md`](CLAUDE.md), is what the coding agents load in this codebase:
upstream-tracking branch discipline, extend rather than gut the inherited services, and scope
everything by tenant from the start.

For running and developing the underlying platform, see [`UPSTREAM-README.md`](UPSTREAM-README.md).

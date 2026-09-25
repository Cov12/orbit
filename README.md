# Orbit

**A multi-tenant, agent-native business platform — five apps behind one identity gate, an agent
orchestrator and an agent runtime — built by one engineer working with a team of AI agents.**

> **About this edition.** Most of this work lives in private repositories that can't be made
> public. So that it can be reviewed, I assembled this curated public edition: the real code and
> real commit history, with business names, customer data, credentials, pricing and internal
> planning documents removed. Nothing was rewritten to look better — the scrub replaced
> identifiers and removed sensitive files, and every step of it is described
> [below](#how-this-edition-was-made).

| | |
|---|---|
| **Shipped** | 216 merged pull requests — **148 in the last 90 days** ([ship log](docs/SHIPLOG.md)) |
| **Built with** | Claude Code, Codex and an orchestrator agent running on OpenClaw — see [the factory](factory/README.md) |
| **Speed** | Wiring five apps behind one identity gate: 50 PRs in ~8 weeks, against my own solo estimate of 6–9 months — [the list](docs/VELOCITY.md) |
| **Agents in production** | A tenant-scoped assistant with tools and per-tenant memory, and an onboarding flow where the model suggests and a person confirms |

## Start here — a 10-minute tour

1. **[`factory/README.md`](factory/README.md)** — how this is built: an orchestrator agent, delegated
   coding agents, written protocols and explicit human checkpoints.
2. **[`apps/agent-runtime/patches/0001-…`](apps/agent-runtime/patches/)** — tenant identity for agent
   tool calls: built from the request's headers, hidden from the tool schema the model sees, and the
   call is blocked if it's missing.
3. **[`apps/conductor/…/hermes-openai/execute.ts`](apps/conductor/server/src/adapters/hermes-openai/execute.ts)**
   — the orchestrator's side of that contract: every agent request carries company, sub-account, run
   and agent identity.
4. **[`apps/conductor/packages/mcp-server/src/plugin-tools.ts`](apps/conductor/packages/mcp-server/src/plugin-tools.ts)**
   — how app capabilities (e.g. CRM lookups) become agent tools, with the tool's tenant context taken
   from that envelope rather than from the model.
5. **[`apps/conductor/server/src/routes/bridge-role-map.ts`](apps/conductor/server/src/routes/bridge-role-map.ts)**
   — an LLM suggests which specialist agents a new business needs; its output is validated against a
   fixed set of roles, there's a deterministic fallback, and nothing is created until a person confirms.
6. **[`apps/portal/src/app/api/auth/token/route.ts`](apps/portal/src/app/api/auth/token/route.ts)** —
   the identity gate: one signed token carries organization, sub-account and app entitlements to every app.
7. **[`apps/workpipe/src/lib/authz.ts`](apps/workpipe/src/lib/authz.ts)** — the ownership guards that
   closed a class of cross-tenant access bugs in the CRM.
8. **[`apps/drive/src/lib/encryption.ts`](apps/drive/src/lib/encryption.ts)** — envelope encryption:
   a random key per file, wrapped by a per-tenant key.
9. **[`docs/SHIPLOG.md`](docs/SHIPLOG.md)** — every merged PR, with dates.

## Architecture

```mermaid
flowchart LR
  U([User]) -->|sign in| P[Portal<br/>identity gate]
  P -->|signed launch token<br/>org · sub-account · app access| A[Atrium<br/>team + AI workspace]
  P -->|signed launch token| W[WorkPipe<br/>CRM]
  P -->|signed launch token| D[Drive<br/>file vault]
  P -. entitlement webhooks .-> C
  A -->|bridge calls<br/>shared secret| C[Conductor<br/>agent orchestrator]
  C -->|agent request<br/>+ tenant headers| R[Agent runtime<br/>Hermes + our patches]
  R <-->|per-tenant memory| E[(Engram)]
  R -->|MCP tool call<br/>+ tenant envelope| C
  C -->|plugin tool,<br/>tenant-scoped token| W
```

**Identity.** Portal is the single front door. A user signs in once; Portal resolves their
organization, sub-account and which apps they're entitled to, and launches each app with a signed
token carrying exactly that. Apps provision themselves from the token on first launch, so a new
organization appears everywhere without a sync job. Entitlement changes reach the orchestrator by
webhook.

**A request to the assistant.** Atrium forwards chat to Conductor over an authenticated bridge.
Conductor resolves the tenant's own assistant agent and calls the runtime once, stamping the
request with tenant headers. The runtime runs the agent loop; when the agent uses a tool, the runtime
attaches a tenant envelope the model never sees, and Conductor's MCP server executes the tool in that
tenant's context — tools scoped to a sub-account fail closed without one. Memory (Engram) is
partitioned per company and filtered per sub-account, and refuses to operate without a scope.

## The apps

| App | What it does | Built on | Worth a look |
|---|---|---|---|
| [Portal](apps/portal) | Identity, organizations, sub-accounts, entitlements, admin | Next.js, Clerk, Prisma | The launch token and entitlement model; license mode |
| [Atrium](apps/atrium) | Workspace where a team works with its AI staff; onboarding | Open WebUI | Onboarding: context capture → memory seeding → agent provisioning |
| [Conductor](apps/conductor) | Agent orchestrator: per-tenant assistants, specialists, tools | Paperclip | Bridge routes, tool plugins, the tenant contract |
| [WorkPipe](apps/workpipe) | CRM: pipelines, contacts, funnels, invoices, files | Next.js, Prisma | Full commit history; ownership guards |
| [Drive](apps/drive) | Per-tenant file storage and sharing | Next.js, object storage | Envelope encryption; per-tenant storage |
| [Agent runtime](apps/agent-runtime) | Runs the agents | Hermes Agent | Two small patches and a memory plugin |

## Adopt before build

Where the work wasn't core, I adopted strong open-source projects and extended them rather than
building my own: **Open WebUI** for the workspace, **Paperclip** for agent orchestration, **Hermes
Agent** for the runtime, **Mem0** and **Qdrant** for memory. The effort went into what makes the
platform itself — the identity gate, the tenant contract across apps, the onboarding flow and the
CRM. Upstream licenses and attribution are kept ([NOTICE](NOTICE.md)).

Drive is the same judgment in the other direction: I first planned to integrate Google Drive, but
object storage was a better fit — it gave me the flexibility to allocate dedicated storage per
tenant.

## How it's built

I work with a small team of AI agents: an orchestrator that plans and delegates, coding agents that
implement on feature branches, and agents for review, operations and the runtime. They coordinate
through a file-based message queue and written protocols — verify before claiming anything,
exhaustive reference audits for breaking changes, a session changelog that feeds ADRs — and anything
consequential (sending email, touching money, write access, merging) waits for my approval.
The whole operating layer is in **[`factory/`](factory/README.md)**, including real handoffs where an
agent corrects its own earlier claim.

The clearest measure of what that changed: making Portal the single gate for five separate apps
(identity, launch tokens, entitlements with webhook sync, shared sub-accounts, per-tenant
provisioning and isolation) took **50 pull requests across all five repositories in the eight weeks from 2026-05-26 to
general availability on 2026-07-23** ([every one of them](docs/VELOCITY.md)). My own estimate for
building that solo, the way I worked before, is six to nine months — roughly 3–4.5× slower.

## Evals

_In progress._ An eval harness for the agent behaviors — role suggestions, memory grounding and
tenant isolation — with committed results will live in `evals/`.

## Repository layout

```
apps/
  portal/         identity gate            (full commit history)
  workpipe/       CRM                      (full commit history)
  drive/          file vault               (full commit history)
  atrium/         workspace, on Open WebUI (snapshot — see below)
  conductor/      orchestrator, on Paperclip (snapshot — see below)
  agent-runtime/  our changes to Hermes Agent
factory/          how it's built: agent rules, protocols, scripts, real handoffs
docs/SHIPLOG.md   every merged pull request
scripts/          the scrub gate used by this edition
```

## How this edition was made

- **History.** Portal, WorkPipe and Drive keep their full commit history — real dates, real
  authorship. Human commits map to my GitHub account; commits written by agents stay attributed to
  the agent. Atrium and Conductor are forks of large upstream projects whose history isn't mine to
  republish, so they're single snapshots and their shipped work is listed in the
  [ship log](docs/SHIPLOG.md).
- **Scrub.** History was rewritten with `git filter-repo` to replace business names and identifiers,
  personal emails, production hostnames, tenant IDs and pricing. Product names were changed too (Atrium,
  Conductor and Engram are new names). Original pull-request numbers appear as `WP-`, `PT-`, `DR-`, `AT-`
  and `CD-` references.
- **Removed outright.** Internal planning documents (including a security audit), one-off production
  scripts, commercial billing code (Portal runs in license mode), and a file that once held a storage
  credential — removed from every commit, not just the latest.
- **Gates.** Every file and every commit passes a denylist check ([`scripts/scrub-check.sh`](scripts/scrub-check.sh),
  patterns kept private because a list of removed terms would itself disclose them) and two secret
  scanners — gitleaks, with a narrow allowlist of verified test fixtures, and trufflehog, where each
  finding was reviewed individually.

## Running it

_In progress_ — a containerized stack for local runs and a hosted demo.

## License

Source-available for review; see [NOTICE](NOTICE.md) for terms and upstream licenses.

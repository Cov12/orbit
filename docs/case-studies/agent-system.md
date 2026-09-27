# Case study: a tenant-safe AI assistant and onboarding agents, in production

*An agent system I built and run: what it does, how it's orchestrated, and how I know it works —
including the times it didn't.*

## What it does

Every business on the platform gets its own **assistant agent**, provisioned automatically the
first time the business uses it. The team talks to it in Atrium; it answers from the business's
own memory and uses tools against the business's live CRM data — its pipelines and contacts.

New businesses go through an **onboarding flow** that sets the agents up:

1. The owner answers a handful of questions about the business.
2. Those answers are written into the business's memory, so the assistant knows the business from
   its first message.
3. A model reads the answers and suggests which specialist agents the business needs — sales,
   support, content, finance and so on — each with a short rationale.
4. **A person confirms** the suggestions (or picks departments by hand). Only then are the agents
   created, each with its own role persona, under the business's lead agent.
5. Optionally, the owner ticks starter tasks for the new agents. Nothing is filed unless ticked.

The assistant has been in production since the platform reached general availability on
2026-07-23; per-business assistant provisioning shipped on 2026-07-18. The onboarding flow was
built in September 2026 (see [the ship log](../SHIPLOG.md)).

## How it's orchestrated

```
Atrium ──bridge (shared secret)──▶ Conductor ──agent request + tenant headers──▶ Agent runtime
                                      ▲                                         │  agent loop,
                                      │                                         │  per-tenant memory
                                      └───── MCP tool call + tenant envelope ◀──┘
                                      │
                                      └──▶ WorkPipe internal API (5-minute tenant-scoped token)
```

- **Atrium** forwards the user's message to **Conductor** over an authenticated bridge.
- **Conductor** resolves which business and sub-account the request belongs to, and that
  business's own assistant agent. It calls the **runtime** once, stamping the request with the
  business, sub-account, run and agent identity
  ([`execute.ts`](../../apps/conductor/server/src/adapters/hermes-openai/execute.ts)).
- The **runtime** runs the agent loop. Memory is partitioned per business and filtered per
  sub-account, and it refuses to operate for a request that arrives without a scope.
- When the agent calls a tool, the runtime attaches a **tenant envelope built from the request's
  headers**. The envelope is stripped from the tool schema the model sees, so the model can't set
  or alter it, and a call without it is blocked
  ([patch 0001](../../apps/agent-runtime/patches/)).
- **Conductor's MCP server** executes the tool with a run context built from that envelope
  ([`plugin-tools.ts`](../../apps/conductor/packages/mcp-server/src/plugin-tools.ts)). The CRM
  tools take the sub-account **only** from that context; a run without one is an explicit error,
  never a wildcard over every sub-account
  ([`plugin.ts`](../../apps/conductor/packages/plugins/paperclip-plugin-orbit-workpipe-tools/src/plugin.ts)).
  Each call mints a five-minute token scoped to that business.

The design principle throughout: **identity is decided by the servers, never by the model.** The
model chooses what to do; it never chooses whose data it does it to.

**Tool lockdown.** One runtime serves every tenant, so anything the model can reach that isn't
tenant-scoped is a way across the boundary. Tenant sessions get an allowlist, not a denylist
([`render_config.py`](../../apps/agent-runtime/docker/render_config.py)):
- **Off:** the runtime's terminal, file, code-execution, browser, scheduling and delegation tools.
- **Off:** its built-in memory, which is one file per runtime and is replaced by the tenant-scoped memory.
- **Off:** its session search, which spans every conversation (see *Evals* below).
- **Conductor's MCP server:** registers only the four CRM tools. The same server offers generic admin
  tools, such as raw API requests and approval decisions, that run with the service key. That key can
  act for any company, so those tools are never registered.

Each of these came from checking what the model could actually reach, not what the prompt told it to do. The same check against production found those tools open there too; the allowlist went into production the same day, and a review of its session history and memory showed no sign that tenant data had crossed.

Onboarding follows the same shape. The role suggestion is constrained, not trusted: the model's
output is validated against a fixed set of roles, capped and de-duplicated, with a deterministic
fallback if the model is unavailable
([`bridge-role-map.ts`](../../apps/conductor/server/src/routes/bridge-role-map.ts)). Creating
agents is a separate, idempotent step that runs only after a person confirms.

## How I know it works

**Tests.** Our runtime patches add 15 tests (tenant envelope, onboarding endpoints and their
fixes); the two test files they extend — 367 tests in all — pass inside the runtime image. The orchestrator's
bridge routes, tool plugin and tenant scoping have their own unit and route tests.

**Evals.** [`evals/`](../../evals/) runs the agent against fixed inputs through the real runtime
and scores it deterministically:
- *Role suggestions* — 30 business descriptions, including negations, nonsense and prompt-injection
  attempts. Any invalid role, or any answer that came from the fallback rather than the model,
  fails the run.
- *Memory* — facts seeded with unique canary tokens. Recall within the right tenant is scored;
  **any canary appearing for another business, a sibling sub-account, a new tenant or an unscoped
  request fails the run.**

Results are committed in [`evals/results/`](../../evals/results/SUMMARY.md), failed runs included.
The first memory runs failed: the memory layer was isolated correctly, but the runtime's built-in
session-search tool searched every tenant's past conversations, and one business's assistant
repeated another's codes. Every unit test passed, because none of them covered that path. Disabling the tool
brought leaks to zero in three straight runs; scoping the session store by tenant is the permanent
fix. The same suite flags one open weakness. When a prompt injection is mixed into a real business
description, the model sometimes discards the whole answer instead of only the injected part.

**End-to-end smoke tests before users see a change** — and incidents written up when something
gets through anyway. Four that shaped the system:

- **The assistant asked "which account?" instead of answering.** It looked like a prompt problem.
  It was a failed credential between the runtime and the tool server: every tool call was being
  rejected, and the agent was politely covering for it. Fixed the credential, then made per-run
  scoped credentials the target design so one stale key can't take out every tenant's tools.
  Lesson: an agent's fluent answer can hide an infrastructure failure — check the tool layer first.
- **Valid answers, wrong answers.** After three roles (sales, support, content) were added to the
  platform, the runtime's list of allowed roles wasn't updated. Nothing failed: the model simply
  never suggested them, and the fallback never triggered because the model *was* answering. Caught
  in manual testing; the role-suggestion eval now fails on exactly that case.
- **Built, merged — and unreachable.** A pre-release smoke test of the onboarding flow found that
  its entry point was never wired, and two of its steps had been left unmounted by an earlier
  change — so new businesses were getting no specialist agents. Found and fixed before customers
  hit it, and it's why the smoke test walks the real flow rather than calling endpoints.
- **A memory layer that failed silently.** A credential a third-party service depended on was
  revoked upstream, and the memory service stopped writing — while the assistant kept answering,
  just without new memories. It was weeks before anyone noticed. Restoring it was quick; the
  lesson is that a component which degrades gracefully also needs to report that it's degraded.

## What's next

- Per-run scoped credentials for tool calls, replacing the shared service key.
- A tenant-scoped session store, so conversation search can be turned back on safely.
- Tool-use evals over the full stack (does the agent call the right tool with the right scope, and
  ground its answer in the result?).
- Health reporting for components that degrade silently.

# Evals

Unit tests tell you the code does what it says. Evals tell you the **agent** does what you need —
the same fixed inputs run through the real model, prompt and runtime, scored the same way every
time, so a prompt tweak or a model swap can't quietly change behaviour.

These suites run against a live [agent runtime](../apps/agent-runtime) over its HTTP API.
Scoring is deterministic — no model grades another model's work.

## Suites

### `role_map` — does the onboarding agent suggest the right specialists?

30 synthetic business descriptions ([`datasets/role_map.jsonl`](datasets/role_map.jsonl)), sent to
`POST /v1/atrium/role-map` the way onboarding sends them — as free text and as the structured
answers the wizard collects. Each case states which roles must, may and must not appear. Also
covered: a negation ("no marketing help — just bookkeeping"), nonsense input, an empty answer, two
prompt-injection attempts, and a one-role limit.

**Hard gates** — a single failure fails the run:
- every response contains only canonical roles, without duplicates, within the requested limit;
- no case was answered by the runtime's keyword fallback instead of the model.

### `memory` — is memory recalled in the right tenant, and never outside it?

Facts are seeded into tenant memory with unique canary tokens
([`datasets/memory.jsonl`](datasets/memory.jsonl)), then the harness chats as different tenants
through the same header the orchestrator uses (`X-Hermes-Session-Key: <company>:<sub-account>`).

- **Grounding** (scored): does the agent recall a fact in the scope it was saved in?
- **Isolation** (hard gate): does a canary ever appear for another company, for a sibling
  sub-account, for a brand-new tenant, or for a request with no scope at all? One leak fails the run.

Every run uses fresh tenant IDs, so runs never share memory.

## What they would have caught

In September the runtime's role list was missing three newly added roles (sales, support,
content). Nothing failed — for businesses that needed those roles it simply returned well-formed
but incomplete suggestions, so the orchestrator's own fallback never triggered and the gap
surfaced only in manual testing. Case `rm-01` fails on exactly that.

The runtime marks answers produced by its keyword fallback (`"fallback": "deterministic"`), and the
suite treats any fallback as a failure — otherwise a broken model configuration would quietly
score as the fallback's accuracy.

## Running

```bash
# validate datasets (no server; runs in CI)
python evals/run.py --check

# run against a runtime (see apps/agent-runtime for starting one)
HERMES_API_KEY=… python evals/run.py --base-url http://127.0.0.1:18643 --label <model-name>
```

Each run writes a full JSON report to [`results/`](results/) and appends a row to
[`results/SUMMARY.md`](results/SUMMARY.md). The exit code is non-zero if a hard gate fails.

## Results

These evals were added in September 2026, for this edition. Results of the runs are committed in
[`results/SUMMARY.md`](results/SUMMARY.md) — including runs that failed.

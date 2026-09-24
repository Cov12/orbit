# TOOLS.md -- QA operating guidance

## Verification truth surfaces

- Treat Conductor as the orchestration surface for test/verification work.
- Treat Atrium as a communication surface for reporting outcomes.
- Treat the real runtime, UI, API, logs, or system output as the source of truth for observed behavior.
- Treat Orbit Drive as the canonical artifact surface for screenshots, logs, reports, and durable evidence files.

## QA rules

- Do not mark work verified unless you actually observed the behavior.
- Distinguish reproducible failures, intermittent failures, and unverified hypotheses.
- Capture exact repro/evidence whenever practical.
- If the task touches pricing, invoices, payments, or billing behavior, require explicit board confirmation before drafting or sending financial content.

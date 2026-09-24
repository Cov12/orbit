# TOOLS.md -- Engineer operating guidance

## Engineering truth surfaces

- Treat Conductor as the orchestration surface for implementation tasks and status.
- Treat Atrium as a visibility surface, not the source of implementation truth.
- Treat the actual repo, runtime, database, or owning service as the source of truth for technical state.
- Treat Orbit Drive as the canonical artifact surface for durable files and generated outputs when file delivery matters.

## Engineer rules

- Verify claims from the system or code path that actually owns them.
- Run the smallest relevant checks that prove your change before you claim success.
- Avoid destructive commands or migrations unless the task explicitly requires them.
- If a task touches pricing, invoices, payments, or billing flows, stop for explicit board confirmation before drafting or sending financial content.

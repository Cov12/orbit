# Eval runs

| UTC | Model | Suite | Result | Hard gates | Detail |
|---|---|---|---|---|---|
| 20260925T210711Z | anthropic-claude-sonnet-5 | role_map | 30/30 (100%) | PASS | fallback cases: 0; short-circuit (empty input): 1 |
| 20260925T210711Z | anthropic-claude-sonnet-5 | memory | grounding 0/4 | FAIL: seeds_ok | every seed failed — the embeddings provider rejected requests (no account credits); isolation not meaningful. Re-scored after the seeds gate was added. |

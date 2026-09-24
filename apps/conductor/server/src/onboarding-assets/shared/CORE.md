# CORE.md -- Shared Operating Contract

Read this before acting. This file defines the baseline operating rules for every default-managed agent.

## Execution

- Start actionable work in the same heartbeat. Do not stop at a plan unless the issue explicitly asks for planning.
- Keep work moving until it is done, handed off, or explicitly blocked.
- Leave durable progress in issue comments, docs, plans, or work products before you exit.
- When work needs another agent, create or route child issues instead of polling agents, sessions, or background processes.

## Coordination and approvals

- Respect budget, pause/cancel controls, approval gates, and company boundaries.
- Use issue-thread interactions when the board/user needs to choose tasks, answer structured questions, or confirm a proposal.
- Use `request_confirmation` for explicit yes/no approvals instead of asking in markdown.
- If a pending confirmation is superseded by fresh board/user input, revise the artifact or proposal and create a fresh confirmation when needed.

## Reporting discipline

- Every meaningful work session must leave a concise task comment with: status, what changed, current blocker if any, and next action.
- Name the owner of any unblock you need.
- Keep updates brief, factual, and easy to skim.

## Grounding and truth

- Do not claim state from another app, service, or repo unless you actually read it in this run or were given it explicitly.
- Name the source system when making a factual claim that came from another surface.
- If context is missing, say what you know, what you do not know, and what system would answer it.
- Treat caches, mirrors, dashboards, and summaries as secondary views unless they are explicitly the source of truth.

## Artifacts

- Prefer canonical artifact references over duplicated blobs.
- When a file already lives in a system-of-record file service, pass the stable reference instead of pasting or recreating the asset.
- If the system you need is unavailable from your toolset, say so directly instead of inventing outputs.

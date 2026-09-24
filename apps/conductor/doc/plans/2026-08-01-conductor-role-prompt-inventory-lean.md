# Conductor lean role-prompt inventory

## Purpose

This is the short working inventory for Conductor role prompts after the executive, delivery, and specialist bundle expansions.

It is not a full audit. It is a practical map of:
- what roles exist,
- what bundle each role actually gets,
- what each role is supposed to own,
- where the boundaries still look soft,
- and what to improve next.

## Current runtime role map

Source of truth:
- role enum: `packages/shared/src/constants.ts`
- bundle resolver: `server/src/services/default-agent-instructions.ts`

Current `AGENT_ROLES`:
- `ceo`
- `cto`
- `cmo`
- `cfo`
- `security`
- `engineer`
- `designer`
- `pm`
- `qa`
- `devops`
- `researcher`
- `general`

### Shared layers

Every default-managed role now includes:
- `CORE.md`
- `ECOSYSTEM.md`

### Bundle map by role

- `ceo`
  - `AGENTS.md`
  - `TOOLS.md`
  - `HEARTBEAT.md`
  - `SOUL.md`
  - shared: `CORE.md`, `ECOSYSTEM.md`
  - note: only role with extra cadence/persona layers today

- `cto`
  - `AGENTS.md`
  - `TOOLS.md`
  - shared: `CORE.md`, `ECOSYSTEM.md`

- `cmo`
  - `AGENTS.md`
  - `TOOLS.md`
  - shared: `CORE.md`, `ECOSYSTEM.md`

- `cfo`
  - `AGENTS.md`
  - `TOOLS.md`
  - shared: `CORE.md`, `ECOSYSTEM.md`

- `security`
  - `AGENTS.md`
  - `TOOLS.md`
  - shared: `CORE.md`, `ECOSYSTEM.md`

- `engineer`
  - `AGENTS.md`
  - `TOOLS.md`
  - shared: `CORE.md`, `ECOSYSTEM.md`

- `designer`
  - `AGENTS.md`
  - `TOOLS.md`
  - shared: `CORE.md`, `ECOSYSTEM.md`

- `pm`
  - `AGENTS.md`
  - `TOOLS.md`
  - shared: `CORE.md`, `ECOSYSTEM.md`

- `qa`
  - `AGENTS.md`
  - `TOOLS.md`
  - shared: `CORE.md`, `ECOSYSTEM.md`

- `devops`
  - `AGENTS.md`
  - `TOOLS.md`
  - shared: `CORE.md`, `ECOSYSTEM.md`

- `researcher`
  - `AGENTS.md`
  - `TOOLS.md`
  - shared: `CORE.md`, `ECOSYSTEM.md`

- `general`
  - `AGENTS.md`
  - `TOOLS.md`
  - shared: `CORE.md`, `ECOSYSTEM.md`

## One-line role contracts

These are the current intended contracts, reduced to the shortest useful form.

- `ceo`: strategy, prioritization, hiring, board communication, and delegation; should not become an IC.
- `cto`: technical direction, architecture, sequencing, and technical risk; should not become a generic implementation sink.
- `cmo`: positioning, launch readiness, claim discipline, and public-facing message quality; should not invent product truth or absorb PM/research/product gaps.
- `cfo`: pricing/billing/spend/risk posture; should not become a general operator and should stay confirmation-heavy.
- `security`: auth/access/exposure/secrets risk review; should not drift into generic engineering.
- `engineer`: implementation, debugging, code changes, verified fixes; should not own product/approval authority by default.
- `designer`: UX clarity, interaction quality, design artifacts; should not optimize aesthetics over usability or absorb PM/engineering decisions.
- `pm`: decomposition, sequencing, blockers, acceptance criteria, coordination; should not become a fake executive or stealth IC.
- `qa`: repro, verification, evidence, regression confidence; should not convert weak evidence into false confidence.
- `devops`: deploy/runtime/environment safety and reliability; should not behave like generic engineering with shell access.
- `researcher`: discovery, evidence gathering, synthesis, uncertainty management; should not quietly turn into implementation.
- `general`: triage, broad execution, and routing ambiguous work; should not pretend to be a specialist.

## Fast read on prompt quality

### Strongest / most opinionated currently
- `ceo`
  - strongest structure
  - explicit delegation contract
  - explicit anti-IC rule
  - extra cadence/persona files make it feel more complete than the rest

- `cto`
  - clear about architecture vs execution
  - good cross-app/system-of-record framing
  - reasonably distinct from engineer

- `cfo`
  - clear stop conditions
  - confirmation-sensitive
  - good fit with existing financial gatekeeper expectations

- `security`
  - surprisingly clean for a first pass
  - has real skepticism and blast-radius posture
  - better than a generic “security reviewer” stub

- `cmo`
  - now has real launch-readiness and claim-discipline posture
  - sharper about not compensating for PM/research/product gaps
  - feels materially more operational than the first-pass version

### Solid but still somewhat thin
- `engineer`
- `designer`
- `pm`
- `qa`
- `devops`
- `researcher`
- `general`

These all have real direction now, but most are still compact first-pass contracts rather than mature role systems.

### Structural imbalance
- `ceo` is more developed than every other role because it has:
  - more explicit delegation rules
  - `HEARTBEAT.md`
  - `SOUL.md`
- everyone else currently has only:
  - `AGENTS.md`
  - `TOOLS.md`
  - shared layers

That may be fine, but it is the clearest architecture asymmetry in the current system.

## Overlap watchlist

These are the collisions most likely to cause blurry behavior.

### `cto` vs `engineer`
Risk:
- CTO prompt still permits some direct technical intervention.
- Engineer owns implementation.
- Without a sharper trigger, CTO may still do too much hands-on work.

Boundary to tighten:
- CTO should step in for architecture, technical review, sequencing, and unblock work.
- Engineer should own most actual code-change execution unless the task is explicitly CTO-level.

### `pm` vs `general`
Risk:
- both can triage, decompose, and coordinate.
- if not watched, `general` becomes low-rent PM or `pm` becomes generic operator.

Boundary to tighten:
- PM owns structure, sequencing, acceptance criteria, and dependency management.
- General owns straightforward cross-functional execution when no specialist depth is required.

### `security` vs `devops`
Risk:
- both care about environments, secrets, and risk.
- devops may overstep into security judgment; security may overstep into operational execution.

Boundary to tighten:
- Security should define/assess risk posture.
- DevOps should execute environment/runtime changes safely once posture is clear.

### `researcher` vs `general`
Risk:
- both can gather context and reduce ambiguity.
- general may sprawl into research, or researcher may become a generic problem-solver.

Boundary to tighten:
- Researcher owns evidence and synthesis when the answer is not yet known.
- General owns momentum once the work is operationally straightforward.

### `ceo` vs `pm`
Risk:
- the pair is much healthier now, but CEO can still be pulled toward task-ops if not watched.

Boundary to protect:
- CEO decides, arbitrates, and delegates.
- PM operationalizes that decision into durable execution structure.

### `cfo` vs `ceo`
Risk:
- the pair is cleaner now, but strategic urgency can still try to bulldoze financial caution if the product culture drifts.

Boundary to protect:
- CEO owns company direction and final trade-off ownership.
- CFO owns pricing/billing/economic caution and should remain the explicit brake on commitment-sensitive work.

## Weak spots worth fixing next

### 1. non-CEO roles may eventually need cadence layers
Right now only CEO has a heartbeat-like structure.

Candidates for future cadence files:
- `pm` — daily sequencing / blocker sweep
- `qa` — verification checklist
- `devops` — operational risk / rollback sweep
- `security` — risk review checklist

### 2. `general` still has the highest junk-drawer risk long-term
It is much better than a silent fallback now, but it can still become:
- “whoever handles random stuff,” or
- stealth PM / stealth researcher / stealth ops

Best next improvement if it starts drifting again:
- sharpen explicit examples of what *does* belong to general vs what must be escalated.

### 3. some delivery roles are still compact first-pass contracts rather than deeper systems
The current boundaries are serviceable.
The remaining question is whether roles like `pm`, `qa`, `devops`, or `designer` need more cadence or checklists, not whether they are missing core identity.

## Recommended next edit order

1. Decide whether selected roles need `HEARTBEAT.md`-style cadence files
2. If yes, start with `pm` or `qa`
3. Revisit `general` only if runtime behavior shows it drifting back into junk-drawer territory

## Bottom line

The prompt system is now in a much better place:
- every runtime role has an intentional managed bundle
- shared operating rules are centralized
- major executive, delivery, and specialist boundaries were deliberately tightened

The next phase is no longer “add missing roles” or “rescue fuzzy prompts.”
It is:
- decide which roles deserve deeper cadence layers,
- deepen selected operators only if runtime behavior justifies it,
- and otherwise treat the current prompt architecture as good enough to move on.

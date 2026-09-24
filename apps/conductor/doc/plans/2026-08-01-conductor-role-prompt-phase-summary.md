# Conductor role-prompt issue #33 phase summary

## Purpose

This is the short checkpoint after the first boundary-tightening passes for issue #33.

It is not a full redesign doc.
It is a blunt summary of:
- what already landed,
- which overlaps were deliberately tightened,
- what still looks soft,
- and what the next sensible move is.

## What landed in this phase

### 1. Shared architecture is now real
The prompt system is no longer mostly ad hoc role prose.

Default-managed bundles now compose shared layers:
- `CORE.md`
- `ECOSYSTEM.md`

That means role-local prompts no longer have to each reinvent:
- execution contract,
- approval behavior,
- system-of-record discipline,
- surface-of-action rules.

### 2. Every runtime role now has an intentional managed bundle
Current runtime roles:
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

Each role now resolves to an intentional managed bundle instead of collapsing silently into a generic fallback.

### 3. Bundle-materialization coverage was tightened as prompts changed
The server-level bundle test now asserts role-specific boundary language for the tightened roles instead of only broad string presence.

Current focused verification result during this sweep:
- `pnpm exec vitest run --config vitest.config.ts --testTimeout=20000 src/__tests__/agent-skills-routes.test.ts`
- result: `22/22` tests passed

## Overlap pairs tightened in this phase

### `cto` vs `engineer`
Current intended split:
- `cto` owns architecture, technical direction, review, sequencing, and technical risk
- `engineer` owns most code-change execution and debugging

What changed:
- CTO now asks first: `is this CTO work or Engineer work?`
- CTO was pushed up toward architecture/review/unblock judgment
- CTO now has stronger language against quietly becoming the implementation owner

Why it matters:
- this reduces the "technical executive turns into senior IC" failure mode

### `pm` vs `general`
Current intended split:
- `pm` owns plan state, sequencing, blockers, dependencies, approval state, and acceptance criteria
- `general` owns routine momentum and cross-functional follow-through once the path is clear

What changed:
- PM now asks first: `is this PM work or General work?`
- PM was pushed toward durable execution structure rather than generic coordination
- PM tool guidance now explicitly routes low-complexity routine follow-through to `general`

Why it matters:
- this reduces the "General with a clipboard" / "PM as vague operator" blur

### `security` vs `devops`
Current intended split:
- `security` owns risk posture, control requirements, exposure judgment, and trust-sensitive decision quality
- `devops` owns safe operational execution, deployment/runtime changes, rollback readiness, and operational reliability

What changed:
- both roles now ask the boundary question directly:
  - `is this Security work or DevOps work?`
  - `is this DevOps work or Security work?`
- Security was pushed toward posture and control judgment
- DevOps was pushed toward execution once the policy/security boundary is clear
- both prompt/tool layers now explicitly reject absorbing the other role's center of gravity

Why it matters:
- this reduces the classic failure mode where infra access becomes accidental authority to make security decisions

### `researcher` vs `general`
Current intended split:
- `researcher` owns discovery, source evaluation, contradiction handling, evidence synthesis, and recommendation quality when the answer is not yet known
- `general` owns motion and routine follow-through once the path is already clear

What changed:
- Researcher now asks first: `is this Researcher work or General work?`
- Researcher was pushed toward truth-finding and decision-useful synthesis
- Researcher tool guidance now explicitly routes routine follow-through to `general`

Why it matters:
- this reduces the blur between "find out what is true" and "carry out the obvious next step"

### `cmo` vs adjacent product/research/PM gaps
Current intended split:
- `cmo` owns positioning, launch readiness, claim discipline, and public-facing message quality
- adjacent roles own plan mechanics, evidence gathering, implementation, and product truth

What changed:
- CMO now asks first: `is this CMO work or am I compensating for missing product, research, or PM clarity?`
- CMO was tightened around launch-readiness judgment, claim verification, and handoff quality
- CMO tool guidance now defines readiness as message quality + proof quality + handoff quality

Why it matters:
- this reduces the failure mode where marketing becomes a cleanup role for missing product, PM, or research clarity

### `ceo` vs `pm` / `cfo`
Current intended split:
- `ceo` owns company direction, prioritization, executive arbitration, and final trade-off ownership
- `pm` owns execution structure and plan state
- `cfo` owns financial caution, commitment sensitivity, and economic brake-setting

What changed:
- CEO now asks first: `is this CEO work or should PM / CFO own the center of gravity?`
- CEO guidance now explicitly rejects becoming a stealth PM or stealth CFO
- CFO now asks first: `is this CFO work or CEO work?`
- CFO guidance now makes the executive-vs-finance split explicit: CEO chooses direction; CFO clarifies whether the company can support the commitment safely

Why it matters:
- this reduces the last big executive-layer blur where strategy, plan mechanics, and finance caution could otherwise collapse into one prompt

## What is stronger now

The system is materially better than the original state because it now has:
- shared prompt layers instead of repeated local drift
- intentional bundle coverage for every runtime role
- clearer asymmetry in the highest-risk overlap pairs
- stronger test assertions tied to actual boundary language

In practical terms, more roles now answer one of these questions cleanly:
- who owns judgment?
- who owns execution?
- who owns structure?
- who owns momentum?
- who owns posture?
- who owns proof?

That is the right direction for issue #33.

## What still looks soft

### 1. Non-CEO cadence layers are still undecided
Only `ceo` currently has:
- `HEARTBEAT.md`
- `SOUL.md`

That may be okay, but the asymmetry is real.

Most plausible next cadence candidates:
- `pm`
- `qa`
- `devops`
- `security`

### 2. Some role bundles are still compact first-pass systems rather than deeper cadence-driven operators
This is not a boundary failure anymore.
It is a depth question.

Most likely future deepening candidates:
- `pm`
- `qa`
- `devops`
- `security`
- possibly `designer`

## Recommended next move

Best next move:
1. decide whether selected non-CEO roles deserve cadence files
2. if yes, start with `pm` or `qa`

Why this order:
- the highest-value overlap pairs have already had meaningful tightening passes
- the remaining gap is structural depth more than boundary confusion
- cadence files only make sense now that the role contracts themselves are much sharper

## Bottom line

Issue #33 has moved past the "missing bundle / generic fallback" stage.

The system now has a real prompt architecture with:
- shared prompt layers,
- intentional bundles for every runtime role,
- tightened executive, delivery, and specialist boundaries,
- and targeted bundle-materialization coverage for those role contracts.

At this point the remaining work is optional depth work, not required rescue work:
- deciding where non-CEO cadence layers are justified,
- and deepening selected roles only if the product benefits from that extra operational structure.

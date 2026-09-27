---
id: msg_1A0BB26FDEABH0HOPIU
from: coda
to: hermes
created_at: 2026-09-19T19:31:29Z
type: task
priority: normal
subject: CORRECTION — role-map inference enum (sales/support/content) is needed, not cosmetic
in_reply_to: msg_1A0B56E0A674FM0OS3F
thread: msg_1A0B56E0A674FM0OS3F
context:
  brand: orbit
  client: null
  user: null
  related_files:
    - workspace/atrium-business-onboarding-spec.md
---

# Correction + bump on the role-map inference enum

Follow-up to my earlier handoff (add sales/support/content to the Hermes-side
`/v1/atrium/role-map` INFERENCE enum). I said then it was "not a blocker, the
Conductor-bridge fallback covers them." **That was wrong — please treat it as needed
before the onboarding smoke passes clean.**

## Why the fallback does NOT cover it
I re-read the Conductor bridge (`server/src/routes/bridge-role-map.ts:299`):

    filtered = result.ok ? filterToCanonicalRoles(result.body) : null;
    // deterministic rules fallback fires ONLY when `filtered` is null

`filterToCanonicalRoles` returns null only when your reply isn't shaped like a
role-map (no `roles` array). So when your service is **up and returns a valid
result that simply omits sales/support/content** (because its inference enum
doesn't know them), the bridge accepts that result and the rules fallback never
runs. Net: for a clearly sales/support/content-oriented business, the assisted
onboarding path won't suggest those roles while your service is healthy. The
fallback only rescues them when your service is DOWN.

## Ask (unchanged, just now prioritized)
Add `sales`, `support`, `content` to the allow-list that constrains the model's
output in the Hermes-side `/v1/atrium/role-map` implementation (and to the
prompt's role menu if it lists roles). Keep the constrained/validated contract
otherwise identical.

Scope: this is the ONLY item standing between us and a fully-clean onboarding
smoke (epic P0–P4 is merged + deployed). Everything else — explicit department
picks, provisioning, activation, Engram seeding — is unaffected.

## Verify
A "we run outbound sales and handle heavy support tickets, and need a content
calendar" answer set should surface `sales` / `support` / `content` in the
suggested roles from the LLM path (not just the keyword fallback).

## Report back
Whether the inference enum needed the change (or already had them), and the
verify result.

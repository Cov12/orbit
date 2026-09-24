# Ship log

Every pull request merged in the private repositories this edition was curated from, newest first. Titles went through the same scrub as the code (business identifiers and retired product names replaced); nothing else was edited.

PR IDs keep the original numbers with an app prefix — `AT-` Atrium, `CD-` Conductor, `PT-` Portal, `WP-` WorkPipe, `DR-` Drive — and match the `WP-`/`PT-`/`DR-` references in the imported commit history.

## Summary (as of 2026-09-24)

| App | Merged PRs, last 90 days | Merged PRs, all time |
|---|--:|--:|
| Atrium | 56 | 78 |
| Conductor | 30 | 47 |
| Portal | 15 | 27 |
| WorkPipe | 43 | 56 |
| Drive | 4 | 8 |
| **Total** | **148** | **216** |

The last-90-days window is 2026-06-26 → 2026-09-24.

## September 2026 — 42 merged

| Date | App | PR | Title |
|---|---|---|---|
| 2026-09-22 | Portal | PT-34 | fix(portal): add org_industry to OrbitJwtPayload type (build fix) |
| 2026-09-22 | Portal | PT-33 | feat(portal): persist org industry + emit org_industry JWT claim |
| 2026-09-22 | Atrium | AT-114 | feat(atrium): replace mock "Connect Your Workflow" step with DeptSetup (re-activate P2/P3) |
| 2026-09-22 | Atrium | AT-113 | fix(atrium): align onboarding industry list with Portal's |
| 2026-09-22 | Atrium | AT-112 | fix(atrium): lock onboarding industry on any account value |
| 2026-09-22 | Atrium | AT-111 | feat(atrium): prefill + lock org profile in onboarding step 1 |
| 2026-09-22 | Atrium | AT-110 | fix(atrium): trigger onboarding wizard on first open |
| 2026-09-21 | Atrium | AT-109 | fix(atrium): clean browser tab title to "Orbit Atrium" |
| 2026-09-19 | Conductor | CD-63 | Onboarding P4a: seed-tasks bridge verb (starter tasks → CEO issues) |
| 2026-09-19 | Atrium | AT-107 | Onboarding P4c: opt-in starter-tasks checklist (activation, frontend) |
| 2026-09-19 | Atrium | AT-106 | Onboarding P4b: starter-tasks endpoint (activation, backend) |
| 2026-09-18 | Conductor | CD-62 | Add agency roles: sales, support, content (onboarding P2-pre) |
| 2026-09-18 | Atrium | AT-105 | Onboarding P3b: assisted 'help me decide' interview |
| 2026-09-18 | Atrium | AT-104 | Onboarding P3a: role-suggestion endpoint (assisted path, backend) |
| 2026-09-18 | Atrium | AT-103 | Onboarding P2b: DeptSetup → agent provisioning + real roster |
| 2026-09-17 | Atrium | AT-99 | Fix Atrium sidebar TOOLS nav (New Chat → chat; drop Search/Workspace) |
| 2026-09-17 | Atrium | AT-98 | Onboarding P1: context capture → Engram seed → backend-tracked completion |
| 2026-09-17 | Atrium | AT-102 | Add Atrium-branded Notes surface |
| 2026-09-17 | Atrium | AT-101 | Onboarding P2a: explicit agent-provisioning endpoint (backend) |
| 2026-09-16 | Conductor | CD-61 | Onboarding P0 d2/d3: Engram-seed + role-map bridge forwarders (completes CD-59) |
| 2026-09-16 | Conductor | CD-60 | Onboarding P0 d1: idempotent ensure-department-agents bridge endpoint |
| 2026-09-16 | Atrium | AT-94 | GA: lock non-admin tenants into /atrium + rebrand Open WebUI → Atrium (AT-93) |
| 2026-09-11 | Conductor | CD-56 | fix(portal-callback): self-heal missing per-company WorkPipe portalOrgId (CD-55) |
| 2026-09-11 | Atrium | AT-92 | fix(atrium): chat/voice UI polish — mobile overlap, friendly errors, version toast, notif close, sub-account label (AT-90) |
| 2026-09-11 | Atrium | AT-89 | fix(deps): repair package-lock.json drift from the AT-88 merge |
| 2026-09-11 | Atrium | AT-88 | feat(atrium): promote chat persistence to prod |
| 2026-09-10 | WorkPipe | WP-64 | feat(files): consolidate Media + Documents into one Files surface (WP-24) |
| 2026-09-10 | WorkPipe | WP-63 | feat(invoices): numbering, derived overdue badge, money-math tests (WP-22) |
| 2026-09-10 | WorkPipe | WP-62 | fix(funnels): delete action, subdomain hardening, live-page metadata (WP-21) |
| 2026-09-10 | Conductor | CD-54 | fix(hermes-openai): scope Hermes thread id by sub-account (CD-20) |
| 2026-09-10 | Atrium | AT-87 | test(atrium): close chat persistence QA blockers |
| 2026-09-09 | WorkPipe | WP-61 | feat(contacts): configurable funnel form + AND tag filter (WP-54 wrap-up) |
| 2026-09-09 | WorkPipe | WP-60 | feat(contacts): tags on contacts — view, add/remove, filter (WP-54 phase 5) |
| 2026-09-09 | Atrium | AT-85 | feat(atrium): persist voice turns in Open WebUI chat history |
| 2026-09-09 | Atrium | AT-84 | feat(atrium): persist text chat history in Open WebUI |
| 2026-09-08 | WorkPipe | WP-59 | feat(contacts): capture phone/company/message on contact forms (WP-54 phase 4b) |
| 2026-09-08 | WorkPipe | WP-58 | feat(contacts): route funnel contact form through the lead endpoint (WP-54 phase 4a) |
| 2026-09-08 | WorkPipe | WP-57 | feat(contacts): public lead-capture endpoint (WP-54 phase 3) |
| 2026-09-05 | WorkPipe | WP-56 | feat(contacts): expand Contact, add ContactSubmission and tags (WP-54 phase 2) |
| 2026-09-04 | WorkPipe | WP-55 | fix(contacts): dedupe on email within a sub-account (WP-54 phase 1) |
| 2026-09-04 | WorkPipe | WP-53 | fix(security): guard user-management + upsert server actions (WP-44) |
| 2026-09-04 | WorkPipe | WP-52 | fix(security): guard remaining IDOR-exposed server actions (WP-44) |

## August 2026 — 32 merged

| Date | App | PR | Title |
|---|---|---|---|
| 2026-08-28 | WorkPipe | WP-51 | feat: re-pull Portal sub-accounts on-demand (no cookie clear) |
| 2026-08-27 | WorkPipe | WP-50 | fix: WorkPipe business-page 500 on workspace switch |
| 2026-08-27 | Atrium | AT-82 | feat(atrium): org switcher for multi-org users (AT-79) |
| 2026-08-27 | Atrium | AT-81 | fix(atrium): refresh org name/slug from Portal on bind (AT-79) |
| 2026-08-27 | Atrium | AT-80 | fix: land multi-org users on the org they launched with (AT-79) |
| 2026-08-27 | Atrium | AT-78 | feat(onboarding): first-sub-account CTA, nudge, and return-flow |
| 2026-08-26 | Portal | PT-32 | feat(subaccounts): reusable add-sub-account page + shared returnTo guard |
| 2026-08-26 | Conductor | CD-53 | feat(persona): Orbit Assistant v4 — guide to account selection at org scope |
| 2026-08-26 | Conductor | CD-52 | fix(entitlements): skip app-access writes for unprovisioned companies |
| 2026-08-25 | Conductor | CD-51 | feat(plugins): per-company WorkPipe org resolution, fail-closed |
| 2026-08-19 | Conductor | CD-50 | feat(onboarding): auto-seed a CEO + parent the Orbit assistant on company creation |
| 2026-08-18 | Conductor | CD-49 | Orbit Assistant persona v3 — never relabel the current account's data |
| 2026-08-18 | Conductor | CD-48 | workpipe-tools: configurable base URL + manifest-driven tool registration |
| 2026-08-17 | Conductor | CD-47 | fix(workpipe-tools): register handlers under bare manifest names (execute 500) |
| 2026-08-17 | Conductor | CD-46 | Orbit Assistant persona v2 — use WorkPipe lookup tools |
| 2026-08-17 | Conductor | CD-45 | fix(plugins): route plugin-tool worker lookup by DB UUID, not plugin key |
| 2026-08-13 | Conductor | CD-44 | fix: fail closed on workpipe sub-account scope |
| 2026-08-13 | Conductor | CD-43 | fix(authz): let instance-admin API keys act as cross-company service … |
| 2026-08-11 | Conductor | CD-42 | Option 2: WorkPipe tools via native MCP (conductor#41) |
| 2026-08-07 | Conductor | CD-40 | fix: server build for optional plugin tool projectId |
| 2026-08-07 | Conductor | CD-39 | feat: expose WorkPipe plugin tools to hermes_openai |
| 2026-08-07 | Conductor | CD-37 | fix(docker): build the workpipe-tools plugin in the image |
| 2026-08-06 | WorkPipe | WP-49 | feat: add GET /api/internal/contacts/[id] (service by-id read) |
| 2026-08-06 | WorkPipe | WP-48 | fix: dual-context read/write split for funnel + service callers (WP-44) |
| 2026-08-06 | WorkPipe | WP-47 | fix: ownership guards on CRM read helpers (WP-44 phase 2) |
| 2026-08-06 | Portal | PT-31 | feat: per-org license toggle in super-admin (keeps global env switch) |
| 2026-08-06 | Portal | PT-30 | feat: hide subscription/billing UI under license mode |
| 2026-08-06 | Conductor | CD-36 | feat: add workpipe tools plugin |
| 2026-08-04 | Conductor | CD-35 | feat: complete Conductor issue CD-33 role-prompt architecture sweep |
| 2026-08-01 | WorkPipe | WP-46 | fix: ownership guards on CRM write mutations (WP-44 phase 1b) |
| 2026-08-01 | WorkPipe | WP-45 | fix: ownership guards on destructive CRM server actions (WP-44 phase 1a) |
| 2026-08-01 | WorkPipe | WP-43 | fix: contact cross-tenant leak in ticket Customer dropdown |

## July 2026 — 71 merged

| Date | App | PR | Title |
|---|---|---|---|
| 2026-07-31 | WorkPipe | WP-42 | fix: count funnel sub-page visits + harden subdomain parsing (WP-21 tail) |
| 2026-07-31 | WorkPipe | WP-41 | feat: Media + Documents backed by sub-account-scoped Drive (WP-24 C) |
| 2026-07-31 | Portal | PT-29 | chore: sync Portal schema to live DB + prisma db push on deploy |
| 2026-07-30 | WorkPipe | WP-40 | feat: route native sub-account creation through Portal (WP-24 B) |
| 2026-07-30 | WorkPipe | WP-39 | fix: SMTP auth username can differ from the from-address |
| 2026-07-30 | Portal | PT-28 | feat: service-to-service sub-account create (Bearer) — PT-24 B |
| 2026-07-30 | Portal | PT-27 | feat: super-admin per-org app-access toggle (PT-22 PR 2/2) |
| 2026-07-30 | Portal | PT-26 | fix: construct the seed-admin Prisma client with the pg adapter |
| 2026-07-30 | Portal | PT-25 | feat: super-admin auth foundation — isolated /admin surface (PT-22 PR 1/2) |
| 2026-07-30 | Drive | DR-11 | feat: sub-account-scoped service API for siblings (DR-24 workstream A) |
| 2026-07-29 | WorkPipe | WP-38 | chore: sync Prisma schema to the DB on deploy |
| 2026-07-29 | WorkPipe | WP-37 | feat: email invoices to customers over SMTP (WP-22 INV-5b) |
| 2026-07-29 | WorkPipe | WP-36 | feat: invoices landing metrics — Paid / Pending / Overdue |
| 2026-07-29 | WorkPipe | WP-35 | fix: back-fill the Invoices sidebar link for existing sub-accounts |
| 2026-07-29 | WorkPipe | WP-34 | feat: Stripe Connect pay-link for invoices (WP-22 INV-6) |
| 2026-07-29 | WorkPipe | WP-33 | feat: public invoice pay/view page + share link (WP-22 INV-5a) |
| 2026-07-29 | WorkPipe | WP-32 | feat: invoice view page + print-to-PDF (WP-22 INV-4) |
| 2026-07-29 | WorkPipe | WP-31 | feat: invoice list + create/edit UI (WP-22 INV-3) |
| 2026-07-28 | WorkPipe | WP-30 | feat: invoice server actions + server-side money math (WP-22 INV-2) |
| 2026-07-28 | WorkPipe | WP-29 | feat: harden the invoice schema — status + integer-cents amounts (WP-22 INV-1) |
| 2026-07-28 | WorkPipe | WP-28 | feat: Payment ledger + wire the Stripe Connect checkout webhook (WP-21/#22 foundation) |
| 2026-07-28 | WorkPipe | WP-27 | fix: resolve 18 TypeScript errors in the funnel builder (WP-21) |
| 2026-07-28 | WorkPipe | WP-26 | fix: make Stripe Connect optional on the sub-account dashboard (WP-23) |
| 2026-07-28 | WorkPipe | WP-25 | fix: enforce published flag on public funnel resolution (WP-20) |
| 2026-07-28 | Portal | PT-24 | feat: license mode — run the ecosystem without Stripe subscriptions (PT-21) |
| 2026-07-28 | Portal | PT-23 | refactor: unify app-entitlement selector across portal UI (PT-20) |
| 2026-07-27 | WorkPipe | WP-19 | feat(internal): trends endpoint — daily new contacts/deals/invoices (WP-61) |
| 2026-07-27 | WorkPipe | WP-18 | feat(internal): appointments/invoices/funnels read endpoints for the dashboard |
| 2026-07-27 | Atrium | AT-77 | feat(dashboard): activity trend widget — contacts/deals/invoices over time (AT-61) |
| 2026-07-26 | Atrium | AT-76 | feat(dashboard): WorkPipe appointments/invoices/funnels widgets (AT-60) |
| 2026-07-26 | Atrium | AT-75 | fix(dashboard): pipeline board per-lane value shows $0 (wrong ticket key) |
| 2026-07-25 | Portal | PT-19 | fix(portal): Drive tile launches to the wrong callback (404 on login) |
| 2026-07-25 | Drive | DR-9 | feat(drive): add GET /api/drive/summary + fix multi-org getDriveContext callers |
| 2026-07-25 | Drive | DR-10 | fix(middleware): accept a Bearer Portal JWT for service-to-service /api calls |
| 2026-07-25 | Atrium | AT-74 | feat(dashboard): degrade gracefully when a widget's app isn't enabled |
| 2026-07-25 | Atrium | AT-73 | feat(dashboard): Drive summary widget — consumer half of AT-59 |
| 2026-07-24 | Atrium | AT-72 | harden: idempotent ensure-columns after create_all so column-adds self-apply (AT-66) |
| 2026-07-24 | Atrium | AT-71 | fix(auth): switch Atrium session when switching Portal accounts (AT-70) |
| 2026-07-24 | Atrium | AT-69 | fix(subaccount-sync): parse empty envelope + refuse cross-tenant reassignment |
| 2026-07-23 | Portal | PT-18 | feat: make Conductor visibility + launch entitlement-driven (retire env allowlists) |
| 2026-07-23 | Portal | PT-17 | fix(auth): don't bounce app launches on a stale orbit_workspace cookie |
| 2026-07-23 | Conductor | CD-31 | CD-62: run-lifecycle hardening — default run timeout (wall-clock sweep) |
| 2026-07-23 | Atrium | AT-68 | fix: sync sub-accounts at login so the dashboard reflects them (AT-67) |
| 2026-07-18 | Conductor | CD-32 | feat(bridge): ensure-agent core route — per-company assistant provisioning |
| 2026-07-18 | Atrium | AT-65 | conductor_bridge: point ensure-agent at the Conductor core route |
| 2026-07-17 | Atrium | AT-64 | GA: resolve a per-company Conductor assistant agent (Atrium side) |
| 2026-07-17 | Atrium | AT-63 | [GA blocker/security] scope GET /orgs/ to OWUI membership + reconcile active org |
| 2026-07-17 | Atrium | AT-58 | atrium#55 (security): authenticate voice WS + bind org to caller identity |
| 2026-07-17 | Atrium | AT-44 | AT-43 (security): stop request-path org-ownership claiming (TOFU) + backfill |
| 2026-07-16 | Drive | DR-8 | Orbit-drive#7: render the org logo in the Drive UI |
| 2026-07-16 | Atrium | AT-57 | atrium#56 (security): fail closed on the email ingest webhook |
| 2026-07-15 | Atrium | AT-54 | atrium: remove the dead portal-exchange callback duplicate |
| 2026-07-15 | Atrium | AT-53 | atrium#69: gate RLS SET LOCAL to Postgres (stop the SQLite no-op) |
| 2026-07-13 | Atrium | AT-52 | atrium#50 (PR-4): remove the ATRIUM_DEV_ALLOW_HEADER_AUTH rollout grace |
| 2026-07-12 | Atrium | AT-51 | AT-45 / atrium#50: provision Atrium membership on the real login path |
| 2026-07-11 | Atrium | AT-48 | AT-45: normalize Portal role casing (real OWNER/ADMIN recognized as admin) — unblocks PR-4 |
| 2026-07-08 | Atrium | AT-47 | AT-45 PR-3: authorize the add-member route (privilege-escalation fix) |
| 2026-07-08 | Atrium | AT-46 | AT-45 (PR-1+PR-2): Atrium auth gates enforce off the real OWUI session identity |
| 2026-07-06 | Atrium | AT-42 | AT-41 (GA blocker/security): bind org_id to JWT — cross-tenant IDOR fix |
| 2026-07-06 | Atrium | AT-40 | AT-35 (GA-safety): remove unguarded workpipe.py + fix /orgs/ cross-tenant leak |
| 2026-07-05 | Conductor | CD-30 | Dashboard D4 (CD-29): bridge history verb + sub-account-filtered runs RPC |
| 2026-07-05 | Atrium | AT-39 | Dashboard D4b (AT-38): Atrium Conductor recent-runs widget via /history verb |
| 2026-07-05 | Atrium | AT-37 | Dashboard D2 (AT-33): WorkPipe provider (HTTP+JWT) + widgets |
| 2026-07-05 | Atrium | AT-36 | Dashboard D1 (AT-32): cross-ecosystem dashboard shell + provider registry |
| 2026-07-02 | Conductor | CD-28 | CD-22 (C5/Guard 6): audit-stamp the active sub-account on runs |
| 2026-07-02 | Conductor | CD-27 | CD-24: entitlement webhook receiver + session-invalidation on revoke |
| 2026-07-02 | Conductor | CD-26 | CD-25: DB-backed per-company AppAccess entitlement (non-regressive) |
| 2026-07-02 | Conductor | CD-23 | C1+C2 (CD-17): business-scope Mem0 namespace companyId:_business + verified Hermes backfill |
| 2026-07-02 | Atrium | AT-31 | A2+A3 (AT-28, AT-29): sub-account chat scope selector + send Portal cuid to bridge |
| 2026-07-02 | Atrium | AT-30 | A1 (AT-27): sync Portal sub-account roster into Atrium per org |
| 2026-07-01 | Atrium | AT-26 | AT-66 Stage 2: auto-populate portal_org_id on org provisioning |

## June 2026 — 40 merged

| Date | App | PR | Title |
|---|---|---|---|
| 2026-06-29 | WorkPipe | WP-17 | fix(settings): treat upsertSubAccount null (not missing id) as the failure signal |
| 2026-06-28 | WorkPipe | WP-16 | fix(settings): stop empty-payload saves on user + subaccount forms |
| 2026-06-26 | WorkPipe | WP-15 | fix(notifications): make saveActivityLogsNotification fail-safe |
| 2026-06-25 | WorkPipe | WP-14 | fix(branding): forward token to Drive as Cookie (+ X-Org-Id) |
| 2026-06-25 | WorkPipe | WP-13 | chore(branding): tag upload errors with stage to disambiguate 401s |
| 2026-06-25 | WorkPipe | WP-12 | fix(subaccount): make settings save robust + diagnosable |
| 2026-06-25 | WorkPipe | WP-11 | feat(uploads): route all uploads to Orbit Drive, remove UploadThing |
| 2026-06-25 | Drive | DR-6 | Accept Orbit JWT as Bearer for service-to-service Drive calls |
| 2026-06-25 | Drive | DR-5 | Add public branding assets to Drive (managed, unencrypted, stable URL) |
| 2026-06-24 | WorkPipe | WP-9 | chore(images): allow Orbit R2 branding host for next/image |
| 2026-06-24 | WorkPipe | WP-10 | feat(auth): provision Portal sub-accounts into WorkPipe on callback |
| 2026-06-24 | Portal | PT-14 | Let Orbit apps read an org's sub-accounts via JWT bearer |
| 2026-06-24 | Portal | PT-13 | Replace UploadThing with our own R2-backed logo upload |
| 2026-06-23 | WorkPipe | WP-8 | feat(auth): auto-provision Business from Portal JWT to skip onboarding |
| 2026-06-23 | Portal | PT-12 | Capture workspace logo at onboarding (UploadThing v7) |
| 2026-06-23 | Portal | PT-11 | Add org_name + org_logo to the Orbit JWT |
| 2026-06-23 | Atrium | AT-21 | Feat/bridge portal org column |
| 2026-06-21 | Portal | PT-10 | Fix "Unable to resolve user profile" lockout for nameless signups |
| 2026-06-19 | Conductor | CD-18 | Scope agent long-term memory by sub-account (CD-17) |
| 2026-06-19 | Atrium | AT-25 | Thread the org's sub-account into the Conductor bridge chat (AT-17 source) |
| 2026-06-18 | Portal | PT-9 | Add sub-account step to onboarding wizard (PT-6) |
| 2026-06-18 | Portal | PT-8 | Enforce mandatory onboarding; create initial sub-accounts (PT-6) |
| 2026-06-18 | Drive | DR-3 | Add sub-account switcher to Drive (DR-1) |
| 2026-06-18 | Drive | DR-2 | Add sub-account scoping to Drive data layer (DR-1) |
| 2026-06-17 | Portal | PT-7 | Add shared sub-account model to Portal org layer (PT-5) |
| 2026-06-14 | Atrium | AT-22 | migrations: correct 002 for Atrium-on-SQLite reality |
| 2026-06-13 | Atrium | AT-20 | Feat/bridge portal org column |
| 2026-06-09 | Atrium | AT-18 | Revert per-org bridge resolution (restore Orbit chat) |
| 2026-06-08 | Atrium | AT-17 | Fix/revert bridge per org |
| 2026-06-08 | Atrium | AT-16 | feat(conductor-bridge): per-org company resolution; retire ORBIT_COMPANY_… |
| 2026-06-08 | Atrium | AT-10 | Atrium prod |
| 2026-06-07 | Conductor | CD-16 | fix(portal-callback): per-org company resolution; stop collapsing org… |
| 2026-06-06 | Atrium | AT-15 | Teardown legacy local routing; collapse chat to single Orbit Assistant |
| 2026-06-03 | Conductor | CD-15 | fix(hermes_openai): report a session so the bridge survives multi-turn |
| 2026-06-03 | Conductor | CD-14 | feat(orbit): file CEO handoff tickets from Assistant replies |
| 2026-06-03 | Atrium | AT-14 | feat(chat): forward chat to Conductor Orbit Assistant via the bridge (thi… |
| 2026-06-02 | Conductor | CD-13 | feat(bridge+adapter): Path A — deliver chat prompt + hermes_openai em… |
| 2026-06-02 | Conductor | CD-12 | feat(deploy): optional Tailscale userspace sidecar for Conductor (no-op … |
| 2026-06-01 | Conductor | CD-11 | fix(bridge): capture claude-code result text in Option B response |
| 2026-06-01 | Conductor | CD-10 | feat(bridge): block-and-return (Option B) on Orbit chat route |

## May 2026 — 25 merged

| Date | App | PR | Title |
|---|---|---|---|
| 2026-05-31 | Conductor | CD-9 | fix(plugins): forward x-orbit-bridge-secret header to webhook-auth plu… |
| 2026-05-31 | Conductor | CD-8 | feat(plugins): bundle + register the Orbit Atrium bridge plugin for … |
| 2026-05-31 | Conductor | CD-7 | fix(auth): add __Secure- prefix to portal-callback session cookie on … |
| 2026-05-30 | Portal | PT-4 | fix(auth): grant CONDUCTOR entitlement to admins when entitlement is real |
| 2026-05-27 | Conductor | CD-6 | Integration |
| 2026-05-27 | Conductor | CD-5 | feat(plugins): paperclip-plugin-orbit-atrium bridge scaffold + chat … |
| 2026-05-27 | Conductor | CD-4 | feat(plugins): enable webhook auth dispatch for plugin API routes |
| 2026-05-26 | Conductor | CD-3 | fix(auth): portal-callback provisions company + membership for portal… |
| 2026-05-26 | Conductor | CD-2 | Hotfix/portal callback company memberships |
| 2026-05-21 | Atrium | AT-13 | refactor(model-router): remove dead OWUI harness path; direct API only |
| 2026-05-19 | Atrium | AT-12 | chore(config): swap premium+mid tiers to claude-haiku-4-5 (cost reduc… |
| 2026-05-18 | Atrium | AT-9 | Feature/conductor approvals route |
| 2026-05-18 | Atrium | AT-11 | fix(intent-classifier): use .replace not .format to preserve literal … |
| 2026-05-14 | Portal | PT-3 | Feature/conductor portal UI |
| 2026-05-14 | Conductor | CD-1 | Feature/portal jwt callback |
| 2026-05-14 | Atrium | AT-8 | Feature/despoof user id proposals departments |
| 2026-05-14 | Atrium | AT-7 | ci: add pytest step covering conductor entitlement tests |
| 2026-05-14 | Atrium | AT-6 | Feature/conductor entitlement gating |
| 2026-05-13 | Portal | PT-2 | test(webhooks): conductor AppAccess synced through stripe lifecycle |
| 2026-05-13 | Portal | PT-1 | feat: portal foundations for Conductor integration (PR PT-1 of 4) |
| 2026-05-11 | Atrium | AT-5 | Integration |
| 2026-05-11 | Atrium | AT-4 | feat(atrium): wire up lane router for local model routing |
| 2026-05-11 | Atrium | AT-3 | Integration |
| 2026-05-11 | Atrium | AT-2 | Integration |
| 2026-05-09 | Atrium | AT-1 | fix: enable Portal SSO auth for Atrium |

## February 2026 — 4 merged

| Date | App | PR | Title |
|---|---|---|---|
| 2026-02-18 | WorkPipe | WP-7 | fix: React error WP-301 on calendar modal open |
| 2026-02-18 | WorkPipe | WP-6 | fix: calendar time picker + timezone offset bugs |
| 2026-02-17 | WorkPipe | WP-5 | Feature/calendar |
| 2026-02-15 | WorkPipe | WP-4 | refactor: make Stripe billing optional during business signup |

## January 2026 — 1 merged

| Date | App | PR | Title |
|---|---|---|---|
| 2026-01-29 | WorkPipe | WP-3 | Upgrade to Next.js 15.5.6 with ESLint 9 and Clerk v6 migration |

## November 2025 — 1 merged

| Date | App | PR | Title |
|---|---|---|---|
| 2025-11-16 | WorkPipe | WP-1 | feat: add funnel builder UI components and editor infrastructure |

# Velocity: making Portal the single gate

The claim in the README — that wiring five separate apps behind one identity gate took about eight
weeks — rests on this list. It's every pull request that was part of that integration: identity and
launch tokens, entitlements and their webhook sync, the shared sub-account model, per-tenant
provisioning, and the cross-tenant isolation fixes needed before general availability.

**How the list was built.** Candidates came from the [ship log](SHIPLOG.md) (titles mentioning
identity, tokens, tenants, sub-accounts, entitlements and similar), then were reviewed one by one;
unrelated fixes that matched a keyword (settings-form bugs, payments, a database chore) were dropped.

| | |
|---|---|
| Window | 2026-05-26 → general availability on 2026-07-23 (58 days, ~8.3 weeks) |
| Pull requests to GA | **50**, across all five repositories |
| Hardening after GA, through July | 13 more |
| Solo estimate, before this workflow | 6–9 months (26–39 weeks) |
| Ratio | **~3–4.5×** faster |

The solo estimate is mine and is a judgment, not a measurement; the PR list and dates are real.

## To general availability — 50 PRs

| Date | PR | Title |
|---|---|---|
| 2026-05-26 | CD-2 | Hotfix/portal callback company memberships |
| 2026-05-26 | CD-3 | fix(auth): portal-callback provisions company + membership for portal… |
| 2026-05-27 | CD-4 | feat(plugins): enable webhook auth dispatch for plugin API routes |
| 2026-05-30 | PT-4 | fix(auth): grant CONDUCTOR entitlement to admins when entitlement is real |
| 2026-05-31 | CD-7 | fix(auth): add __Secure- prefix to portal-callback session cookie on … |
| 2026-05-31 | CD-9 | fix(plugins): forward x-orbit-bridge-secret header to webhook-auth plu… |
| 2026-06-07 | CD-16 | fix(portal-callback): per-org company resolution; stop collapsing org… |
| 2026-06-08 | AT-16 | feat(conductor-bridge): per-org company resolution; retire ORBIT_COMPANY_… |
| 2026-06-08 | AT-17 | Fix/revert bridge per org |
| 2026-06-09 | AT-18 | Revert per-org bridge resolution (restore Orbit chat) |
| 2026-06-13 | AT-20 | Feat/bridge portal org column |
| 2026-06-17 | PT-7 | Add shared sub-account model to Portal org layer (PT-5) |
| 2026-06-18 | DR-2 | Add sub-account scoping to Drive data layer (DR-1) |
| 2026-06-18 | DR-3 | Add sub-account switcher to Drive (DR-1) |
| 2026-06-18 | PT-8 | Enforce mandatory onboarding; create initial sub-accounts (PT-6) |
| 2026-06-18 | PT-9 | Add sub-account step to onboarding wizard (PT-6) |
| 2026-06-19 | AT-25 | Thread the org's sub-account into the Conductor bridge chat (AT-17 source) |
| 2026-06-19 | CD-18 | Scope agent long-term memory by sub-account (CD-17) |
| 2026-06-23 | AT-21 | Feat/bridge portal org column |
| 2026-06-23 | PT-11 | Add org_name + org_logo to the Orbit JWT |
| 2026-06-23 | PT-12 | Capture workspace logo at onboarding (UploadThing v7) |
| 2026-06-23 | WP-8 | feat(auth): auto-provision Business from Portal JWT to skip onboarding |
| 2026-06-24 | PT-14 | Let Orbit apps read an org's sub-accounts via JWT bearer |
| 2026-06-24 | WP-10 | feat(auth): provision Portal sub-accounts into WorkPipe on callback |
| 2026-06-25 | DR-6 | Accept Orbit JWT as Bearer for service-to-service Drive calls |
| 2026-06-25 | WP-14 | fix(branding): forward token to Drive as Cookie (+ X-Org-Id) |
| 2026-07-01 | AT-26 | AT-66 Stage 2: auto-populate portal_org_id on org provisioning |
| 2026-07-02 | AT-30 | A1 (AT-27): sync Portal sub-account roster into Atrium per org |
| 2026-07-02 | AT-31 | A2+A3 (AT-28, AT-29): sub-account chat scope selector + send Portal cuid to bridge |
| 2026-07-02 | CD-26 | CD-25: DB-backed per-company AppAccess entitlement (non-regressive) |
| 2026-07-02 | CD-27 | CD-24: entitlement webhook receiver + session-invalidation on revoke |
| 2026-07-02 | CD-28 | CD-22 (C5/Guard 6): audit-stamp the active sub-account on runs |
| 2026-07-05 | AT-37 | Dashboard D2 (AT-33): WorkPipe provider (HTTP+JWT) + widgets |
| 2026-07-05 | CD-30 | Dashboard D4 (CD-29): bridge history verb + sub-account-filtered runs RPC |
| 2026-07-06 | AT-40 | AT-35 (GA-safety): remove unguarded workpipe.py + fix /orgs/ cross-tenant leak |
| 2026-07-06 | AT-42 | AT-41 (GA blocker/security): bind org_id to JWT — cross-tenant IDOR fix |
| 2026-07-08 | AT-46 | AT-45 (PR-1+PR-2): Atrium auth gates enforce off the real OWUI session identity |
| 2026-07-08 | AT-47 | AT-45 PR-3: authorize the add-member route (privilege-escalation fix) |
| 2026-07-11 | AT-48 | AT-45: normalize Portal role casing (real OWNER/ADMIN recognized as admin) — unblocks PR-4 |
| 2026-07-12 | AT-51 | AT-45 / atrium#50: provision Atrium membership on the real login path |
| 2026-07-13 | AT-52 | atrium#50 (PR-4): remove the ATRIUM_DEV_ALLOW_HEADER_AUTH rollout grace |
| 2026-07-15 | AT-54 | atrium: remove the dead portal-exchange callback duplicate |
| 2026-07-16 | DR-8 | Orbit-drive#7: render the org logo in the Drive UI |
| 2026-07-17 | AT-44 | AT-43 (security): stop request-path org-ownership claiming (TOFU) + backfill |
| 2026-07-17 | AT-58 | atrium#55 (security): authenticate voice WS + bind org to caller identity |
| 2026-07-17 | AT-63 | [GA blocker/security] scope GET /orgs/ to OWUI membership + reconcile active org |
| 2026-07-18 | CD-32 | feat(bridge): ensure-agent core route — per-company assistant provisioning |
| 2026-07-23 | AT-68 | fix: sync sub-accounts at login so the dashboard reflects them (AT-67) |
| 2026-07-23 | PT-17 | fix(auth): don't bounce app launches on a stale orbit_workspace cookie |
| 2026-07-23 | PT-18 | feat: make Conductor visibility + launch entitlement-driven (retire env allowlists) |

## Hardening after GA — 13 PRs

| Date | PR | Title |
|---|---|---|
| 2026-07-24 | AT-69 | fix(subaccount-sync): parse empty envelope + refuse cross-tenant reassignment |
| 2026-07-24 | AT-71 | fix(auth): switch Atrium session when switching Portal accounts (AT-70) |
| 2026-07-25 | DR-10 | fix(middleware): accept a Bearer Portal JWT for service-to-service /api calls |
| 2026-07-25 | DR-9 | feat(drive): add GET /api/drive/summary + fix multi-org getDriveContext callers |
| 2026-07-25 | PT-19 | fix(portal): Drive tile launches to the wrong callback (404 on login) |
| 2026-07-28 | PT-23 | refactor: unify app-entitlement selector across portal UI (PT-20) |
| 2026-07-28 | PT-24 | feat: license mode — run the ecosystem without Stripe subscriptions (PT-21) |
| 2026-07-30 | DR-11 | feat: sub-account-scoped service API for siblings (DR-24 workstream A) |
| 2026-07-30 | PT-25 | feat: super-admin auth foundation — isolated /admin surface (PT-22 PR 1/2) |
| 2026-07-30 | PT-27 | feat: super-admin per-org app-access toggle (PT-22 PR 2/2) |
| 2026-07-30 | PT-28 | feat: service-to-service sub-account create (Bearer) — PT-24 B |
| 2026-07-30 | WP-40 | feat: route native sub-account creation through Portal (WP-24 B) |
| 2026-07-31 | WP-41 | feat: Media + Documents backed by sub-account-scoped Drive (WP-24 C) |

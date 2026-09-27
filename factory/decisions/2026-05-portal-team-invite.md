# ADR — Orbit Portal Team Invite System

- **Date:** 2026-05-08
- **Status:** Accepted, deployed
- **Author:** The Principal (build session); Coda (ADR distillation)
- **Repo:** `orbit-portal`
- **Deploy:** Merged to `main`; live at `https://portal.orbit.example/settings/team`
- **Source session:** `sessions/2026-05-08-portal-team-invite.md`

## Context

The Orbit Portal is the central identity + billing layer for the ecosystem. Workspaces (organizations) need a way for owners/admins to invite additional users. Two requirements drove this:

1. **Inherited access:** invited members should reach the same downstream apps (Atrium, WorkPipe, Drive) as the org owner — without each member triggering individual billing
2. **Owner-pays model:** the OWNER's subscriptions cover everyone in the org; ADMINs and MEMBERs are free seats

Before this work, organizations were single-user — the OWNER was the only entity that could authenticate, and there was no mechanism to extend access to teammates. This blocked any agency-style multi-seat use case (an agency owner working with assistants), as well as basic delegation (an OWNER giving a developer access to manage WorkPipe pipelines).

## Decision

**Implement an email-based invite system with token-based acceptance, three-tier role hierarchy, and inherited subscription access.**

### Three-tier roles

| Role   | Can Invite | Can Manage Members        | Billing | App Access                       |
|--------|------------|---------------------------|---------|----------------------------------|
| OWNER  | Yes        | Yes (all)                 | Pays    | All apps                         |
| ADMIN  | Yes        | Yes (except other admins) | Free    | All apps                         |
| MEMBER | No         | No                        | Free    | Inherited from org subscriptions |

ADMINs cannot remove or demote other ADMINs — only the OWNER can. This prevents an admin coup. MEMBERs have read access only to org-internal team management.

### Token-based invite acceptance

The `Invite` table stores email + orgId + role + a unique random `token`. Acceptance happens by visiting `/invites/[token]`. This decouples invite creation from acceptance:
- An invite can be created before the recipient has an account
- The recipient signs up (or signs in) at the link, then accepts
- The token is the proof of authorization; no signed-in state required to view the invite details

### Schema design

```prisma
model Invite {
  id         String      @id @default(cuid())
  email      String
  orgId      String
  org        Organization @relation(...)
  role       MemberRole  @default(MEMBER)
  token      String      @unique @default(cuid())
  invitedBy  String      // clerkUserId of inviter
  expiresAt  DateTime
  acceptedAt DateTime?
  createdAt  DateTime    @default(now())

  @@unique([email, orgId])
}
```

Key decisions:
- **`token` is `@unique`** — guarantees no two invites share the same URL
- **`@@unique([email, orgId])`** — prevents an admin from spamming the same email with multiple invites to the same org; if you want to re-invite, revoke the old one first
- **`acceptedAt` is nullable** — same row tracks the invite throughout its lifecycle (pending → accepted), avoiding a separate `acceptances` table
- **`expiresAt` is required** — invites must expire; no perpetual invites floating around
- **`invitedBy` stores the clerkUserId** — audit trail: who invited whom
- **No `acceptedBy` field** — the membership's `userId` (in the `Member` table on acceptance) IS the accepter; cross-referencing via the Member table is sufficient

## Implementation Surface

### 8 API endpoints

| Endpoint                                | Method | Purpose                          |
|-----------------------------------------|--------|----------------------------------|
| `/api/workspaces/[id]/invites`          | GET    | List pending invites             |
| `/api/workspaces/[id]/invites`          | POST   | Create invite (sends email)      |
| `/api/workspaces/[id]/invites/[inviteId]` | DELETE | Revoke invite                  |
| `/api/workspaces/[id]/members`          | GET    | List workspace members           |
| `/api/workspaces/[id]/members/[memberId]` | PATCH  | Update member role             |
| `/api/workspaces/[id]/members/[memberId]` | DELETE | Remove member                  |
| `/api/invites/[token]`                  | GET    | Get invite details (public)      |
| `/api/invites/accept`                   | POST   | Accept invite, create membership |

The `/api/invites/[token]` GET is intentionally public (no auth required) so that a recipient who isn't yet signed in can see what they're being invited to before authenticating. The POST `/api/invites/accept` requires authentication (the accepting user must be signed in).

### 3 UI components

- `src/app/(portal)/settings/team/page.tsx` — team management dashboard
- `src/app/invites/[token]/page.tsx` — acceptance landing page
- `src/components/portal/sidebar.tsx` — added "Team" nav link

### Email integration

`src/lib/email.ts` uses Resend for transactional sends. Falls back to `console.log` if `RESEND_API_KEY` isn't set — local dev works without burning email quota.

### Invite flow

```
Owner/Admin → Settings/Team → Enter email + role → Send Invite
                                      ↓
                              Create Invite record (cuid token, expiresAt set)
                              Send email with link to /invites/<token>
                                      ↓
Invitee clicks link → /invites/[token] → Sign in (if needed) → Accept
                                      ↓
                              Create Member record (links user to org)
                              Mark invite acceptedAt
                              Redirect to dashboard
```

## Alternatives Considered

### A. Per-user billing (each invited member pays)
Standard SaaS multi-seat model. Rejected because:
- Wrong economics for an operator that serves several clients (one operator org should have one billing relationship; the OWNER pays for the entire team)
- Adds complexity to billing flow (multiple Stripe customers per org, etc.)

### B. Pre-create user accounts at invite time
Some systems pre-create a "shadow" user record when an invite is sent, then promote it on acceptance. Rejected because:
- Creates orphaned user rows if invites expire unaccepted
- Couples invite lifecycle to user lifecycle (deleting an invite shouldn't delete a user)
- The invite + token approach decouples cleanly

### C. Magic-link signup (no separate invite token)
Some flows let any signup at `/api/auth/signup?ref=<orgId>` join the referenced org automatically. Rejected because:
- Anyone with the link could join — no email gating
- Lacks per-recipient role assignment (the invite's `role` field controls what the accepter becomes)

**C (chosen — token + email + role).** Decoupled from user lifecycle, gates on email, captures role at invite time, supports revocation.

## Consequences

### Positive
- Multi-seat orgs work end-to-end (invite → accept → access inherited apps)
- Owner pays once; admins and members are free seats
- Audit trail via `invitedBy` and `acceptedAt`
- Token-based acceptance means recipient doesn't need a Portal account before being invited
- Email integration gracefully degrades (no Resend key in dev → console logs)

### Negative / Trade-offs
- The `@@unique([email, orgId])` constraint means re-inviting requires explicit revocation first (small UX friction; intentional protection against accidental spam)
- Invite tokens are CUIDs (unguessable but not cryptographically opaque) — fine for this use case but if any sensitive content lived in invite metadata, would warrant rotation/revocation discipline
- ADMIN role can manage other MEMBERs but not other ADMINs. The asymmetry is intentional (prevent coup) but could surprise an ADMIN trying to remove a teammate who got upgraded to ADMIN — they'd need to ask the OWNER. Acceptable until/unless this becomes a real friction point.

### Future work / out of scope for this ADR
- Reissue / renew invite (currently must revoke + create new)
- Bulk invite (send to multiple emails at once)
- Per-app role overrides (e.g., MEMBER everywhere except WorkPipe where they're ADMIN)
- SSO group sync (for orgs that want their identity provider to drive membership)

## Files Touched

**New (9):**
- `src/app/(portal)/settings/team/page.tsx`
- `src/app/api/invites/[token]/route.ts`
- `src/app/api/invites/accept/route.ts`
- `src/app/api/workspaces/[id]/invites/route.ts`
- `src/app/api/workspaces/[id]/invites/[inviteId]/route.ts`
- `src/app/api/workspaces/[id]/members/route.ts`
- `src/app/api/workspaces/[id]/members/[memberId]/route.ts`
- `src/app/invites/[token]/page.tsx`
- `src/lib/email.ts`

**Modified (4):**
- `prisma/schema.prisma`
- `src/components/portal/sidebar.tsx`
- `package-lock.json`
- `.gitignore`

## Deployment Notes

- Schema pushed to Neon via `prisma db push` — `Invite` table now exists in production
- `RESEND_API_KEY` must be set in Render env for invite emails to actually send (otherwise falls back to console log)
- Portal does not implement the 3-branch strategy (integration → prod) used by Atrium — ships directly from `main` to Render auto-deploy. This is documented architectural reality, not an oversight.
- Merged to `orbit-portal` `main`

## Lessons / Patterns Worth Capturing

The schema-design pattern (token + unique email/org constraint + nullable acceptedAt for lifecycle tracking) and the role-hierarchy-with-inherited-billing model are both reusable patterns.

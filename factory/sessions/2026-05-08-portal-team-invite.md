# Session Summary: Orbit Portal Team Invite System

- **Date:** 2026-05-08
- **Repo:** orbit-portal
- **Author:** The Principal (provided to Coda via chat for archival)
- **Deploy:** Committed to `orbit-portal` main branch; pushed to GitHub → Render auto-deploy. Live at `https://portal.orbit.example/settings/team`.
- **Branch strategy note:** Portal does not implement the 3-branch strategy used by Atrium. Ships directly from `main`.

## Overview

Implemented a complete team invite system for the Orbit Portal, allowing workspace owners/admins to invite users to their organization. Invited users inherit access from the org's subscriptions without being billed.

## 1. Schema Changes

File: `prisma/schema.prisma`

Added `Invite` model:

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

Added `invites` relation to `Organization` model.

## 2. API Endpoints Created

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

## 3. UI Components Created

| File                                    | Purpose                                                         |
|-----------------------------------------|-----------------------------------------------------------------|
| `src/app/(portal)/settings/team/page.tsx` | Team management UI (members list, invite form, pending invites) |
| `src/app/invites/[token]/page.tsx`      | Accept invite page (shown when clicking invite link)            |
| `src/components/portal/sidebar.tsx`     | Added "Team" nav link                                           |

## 4. Email Integration

File: `src/lib/email.ts`

- Uses Resend for transactional emails
- Falls back to console logging if `RESEND_API_KEY` not set
- Sends branded HTML invite emails

## 5. Invite Flow

```
Owner/Admin → Settings/Team → Enter email + role → Send Invite
                                      ↓
                              Create Invite record
                              Send email with link
                                      ↓
Invitee clicks link → /invites/[token] → Sign in (if needed) → Accept
                                      ↓
                              Create Member record
                              Mark invite accepted
                              Redirect to dashboard
```

## 6. Access Control

| Role   | Can Invite | Can Manage Members        | Billing | App Access                       |
|--------|------------|---------------------------|---------|----------------------------------|
| OWNER  | Yes        | Yes (all)                 | Pays    | All apps                         |
| ADMIN  | Yes        | Yes (except other admins) | Free    | All apps                         |
| MEMBER | No         | No                        | Free    | Inherited from org subscriptions |

## 7. Dev-Ops Updates (in this same session, by the Principal)

| File                   | Change                                                |
|------------------------|-------------------------------------------------------|
| `dex/MEMORY.md`        | Added "Ongoing Tasks" section with Orbit Portal review |
| `dex/HEARTBEAT.md`     | Added biweekly Orbit Portal review periodic task       |
| `dex/SKILL_BOOTSTRAP.md` | Deleted (skill convention applied)                  |

## 8. Database

- Schema pushed to Neon via `prisma db push`
- Invite table created in production database

## 9. Files Changed (13 total)

**New:**
- `src/app/(portal)/settings/team/page.tsx`
- `src/app/api/invites/[token]/route.ts`
- `src/app/api/invites/accept/route.ts`
- `src/app/api/workspaces/[id]/invites/route.ts`
- `src/app/api/workspaces/[id]/invites/[inviteId]/route.ts`
- `src/app/api/workspaces/[id]/members/route.ts`
- `src/app/api/workspaces/[id]/members/[memberId]/route.ts`
- `src/app/invites/[token]/page.tsx`
- `src/lib/email.ts`

**Modified:**
- `prisma/schema.prisma`
- `src/components/portal/sidebar.tsx`
- `package-lock.json`
- `.gitignore`

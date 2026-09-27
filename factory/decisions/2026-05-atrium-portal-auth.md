# ADR — Atrium Portal Cross-App SSO

- **Date:** 2026-05-08
- **Status:** Accepted, deployed
- **Author:** The Principal (resolution session)
- **Related:** Earlier diagnostic session (Coda on Codex) produced a fictional diagnosis later corrected via `claude-delegate` and direct prod investigation.

## Context

The Orbit ecosystem has three apps that share authentication:
- **Orbit Portal** (Next.js + Clerk) — the central identity provider
- **Atrium** (Open WebUI fork — SvelteKit frontend + FastAPI backend)
- **WorkPipe and Drive** (similar pattern, future)

The portal owns user identity via Clerk. Downstream apps trust portal-issued JWTs. The expected cross-app flow:

1. User signs into Portal (Clerk session)
2. Clicks "Launch Atrium"
3. Portal hits `/api/auth/refresh?redirect_uri=<atrium>/auth/callback`
4. Portal mints a short-lived JWT signed with a shared `JWT_SECRET`, redirects to `<atrium>/auth/callback?token=<jwt>`
5. Atrium callback consumes the token and creates an authenticated session
6. User lands at `/atrium` fully authenticated

### The Symptom

A signed-in Orbit Portal user clicked "Launch Atrium" and was hit with an "Invalid token" error, then bounced back to the portal sign-in page — even though they had just authenticated. Step 5 was broken.

A previous attempt by another agent had partially diagnosed this but the fix wasn't landing correctly. The diagnosis claimed "JWT_SECRET mismatch in /api/v1/auths/portal-exchange between portal and atrium." When investigated against the actual code, that endpoint did not exist anywhere in the repo — the prior agent's narrative was fabricated.

### Three Concurrent Root Causes (Verified Against Code)

#### 1. JWT Schema Mismatch

The portal's JWT (from `src/lib/jwt.ts` and `src/app/api/auth/refresh/route.ts`):

```json
{
  "sub": "user_2abc...",       // Clerk user ID
  "email": "user@example.com",
  "name": "User Name",
  "org_id": "org_xyz",
  "org_slug": "acme",
  "role": "OWNER",
  "subscriptions": [...],
  "app_access": ["ATRIUM", "WORKPIPE", "DRIVE"]
}
```

Open WebUI's `get_current_user()` in `backend/open_webui/utils/auth.py` (~line 320):

```python
data = decode_token(token)
if data is not None and "id" in data:    # ← expects "id"
    user = Users.get_user_by_id(data["id"])
```

Mismatch: Portal JWT has `sub` (Clerk user ID); OWUI expects `id` (OWUI internal UUID). Different fields, different identities.

#### 2. Direct Token Storage Bypassing Exchange

The Atrium auth callback at `src/routes/(app)/atrium/auth/callback/+page.svelte`:

```javascript
// BROKEN
localStorage.setItem('token', token);   // raw portal JWT
document.cookie = `atrium_token=${token}; ...`;
```

The OWUI frontend reads `localStorage.token` and sends it as `Authorization: Bearer <token>` on every API call. Every authenticated request hit OWUI's auth, OWUI looked for `data["id"]`, found `data["sub"]` instead, and rejected the token.

The previous agent had identified this surface but their fix was incomplete — there was no actual token exchange happening. The middleware they updated only validated tokens; no code was creating the OWUI-format session token.

#### 3. Inconsistent Env Var Names

After auditing every file that touched JWT secrets:

| File | Env var(s) used |
|------|-----------------|
| `apps/atrium/backend/middleware/jwt_auth.py` | `JWT_SECRET` only |
| `apps/atrium/backend/middleware/auth_redirect.py` | `ATRIUM_JWT_SECRET` → fallback `JWT_SECRET` |
| `apps/atrium/backend/routers/voice.py` | `JWT_SECRET` → fallback `ATRIUM_JWT_SECRET` |
| `.env.example` | Only `ATRIUM_JWT_SECRET` |
| `docker-compose.dev.yml` | Only `ATRIUM_JWT_SECRET` |

Anyone following `.env.example` would set only `ATRIUM_JWT_SECRET`. The portal-exchange endpoint we'd add reads only `JWT_SECRET`. Even with the schema fix, a fresh deployment following the docs would silently fail token validation.

## Decision

Adopt the **token-exchange** pattern: each downstream app exposes one endpoint that consumes the portal JWT and mints its own native session token. Portal stays unchanged as new apps are added.

### Alternatives Considered

**A. Use OWUI's existing OAuth/OIDC flow.** Would require the portal to expose an OIDC discovery endpoint, JWKS, authorization endpoint, etc. Significant new surface area on the portal. Rejected as too big a refactor for a working bug fix.

**B. Have the portal directly POST to Atrium to pre-create the session.** Would add backend-to-backend coupling between portal and every downstream app. Each new downstream app would need a corresponding portal integration. Rejected as scaling poorly.

**C. Token exchange ← chosen.** Portal stays unchanged. Atrium (and any future app) just adds one endpoint that accepts the portal JWT and mints its native session. Decoupled, scalable, and uses each app's existing session infrastructure unchanged.

### Implementation (Four Changes)

#### Change 1 — New Token Exchange Endpoint

`POST /api/v1/auths/portal-exchange` added to `backend/open_webui/routers/auths.py`:

1. Accepts a portal JWT in the request body
2. Validates with `JWT_SECRET` using HS256
3. Extracts `email` and `name` from the payload
4. Looks up the OWUI user by email; auto-creates if missing (first user → admin, otherwise default user role)
5. Calls `create_session_response()` — the standard OWUI helper — which mints a token via `create_token({"id": user.id})` signed with `WEBUI_SECRET_KEY`
6. Returns the OWUI session payload (token + expiry + user fields)

Implementation notes:
- Uses `Auths.insert_new_auth()` for user creation (matches OWUI's OAuth signup path)
- Random password (never used since auth is via portal exchange)
- Calls `apply_default_group_assignment()` so new users get correct group permissions
- Updates user's name on subsequent sign-ins if it changed in the portal
- Returns proper HTTP error codes (401 / 500 / 400)

#### Change 2 — Updated Callback Page

Replaced direct `localStorage` write with an exchange call:

```javascript
const response = await fetch('/api/v1/auths/portal-exchange', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: portalToken }),
});
if (!response.ok) {
  const data = await response.json().catch(() => ({}));
  throw new Error(data.detail || 'Token exchange failed');
}
const session = await response.json();
localStorage.setItem('token', session.token);  // OWUI token, has "id"
document.cookie = `token=${...}; path=/; max-age=86400; SameSite=Lax`;
```

Cookie name changed from `atrium_token` to `token` to match OWUI's middleware reads.

#### Change 3 — Updated `auth_redirect.py` Middleware

Originally validated only against `JWT_SECRET` (portal). After exchange, tokens stored client-side are OWUI tokens signed with `WEBUI_SECRET_KEY`. Middleware now accepts both:

```python
def _is_valid_jwt(self, token: str) -> bool:
    # Try OWUI secret first (post-exchange tokens)
    owui_secret = os.environ.get("WEBUI_SECRET_KEY", "")
    if owui_secret:
        try:
            payload = pyjwt.decode(token, owui_secret, algorithms=[JWT_ALGORITHM])
            if "id" in payload:
                return True
        except pyjwt.InvalidTokenError:
            pass

    # Fallback: portal JWTs (pre-exchange or query-param case)
    portal_secret = os.environ.get("JWT_SECRET", "")
    ...
```

Same middleware handles pre-exchange (portal JWT via `?token=`) and post-exchange (cookies / Bearer with OWUI token).

#### Change 4 — Standardized on `JWT_SECRET`

Removed all `ATRIUM_JWT_SECRET` references:
- `auth_redirect.py` — dropped fallback chain
- `voice.py` — dropped fallback chain (and updated outdated docstring)
- `.env.example` — renamed with clarifying comment "must match Portal's JWT_SECRET"
- `docker-compose.dev.yml` — renamed env var key

One shared env var name across both apps. Set to the same value in both deployments, done.

### What Was Deliberately NOT Changed

- **`JWTAuthMiddleware`** (handles `/api/atrium/*` requests) — still extracts `org_id`/`role` from portal JWTs for multi-tenancy. Different responsibility from the UI auth path.
- **`TenantMiddleware`** — still scopes data by org. Unrelated to authentication.
- **Portal's `/api/auth/refresh`** — already correct; issues a properly signed JWT.
- **OWUI's `get_current_user()`** — leaving alone keeps OWUI upgradable; we adapt to it via the exchange rather than patching.

## Final Auth Flow

```
User signs into Portal (Clerk)
   ↓
Clicks "Launch Atrium" (opens new tab)
   ↓
GET /api/auth/refresh?redirect_uri=<atrium>/auth/callback
   ↓ (Portal mints JWT signed with JWT_SECRET)
302 → <atrium>/auth/callback?token=<portal_jwt>
   ↓
Callback page: POST /api/v1/auths/portal-exchange { token }
   ↓ (validates portal JWT, finds/creates OWUI user, mints OWUI session)
200 { token: "<owui_jwt>", id, email, name, ... }
   ↓
Callback stores OWUI token in localStorage + cookie, redirects to /atrium
   ↓
User lands authenticated. Subsequent requests use OWUI token.
```

## Consequences

### Positive
- One shared env var name (`JWT_SECRET`) across portal and all downstream apps
- Portal unchanged as new downstream apps are added; each just needs its own exchange endpoint
- OWUI's auth machinery untouched; safe to upstream upgrades
- Pre- and post-exchange traffic both handled by same middleware via dual-secret validation
- User identity is reconciled by email — clean fallback if Clerk IDs change format

### Negative / Trade-offs
- Email is the join key — collisions across organizations would be a problem (mitigated: org scoping happens later in the request lifecycle, not at token validation)
- Two valid signing secrets in `auth_redirect.py` widens the validation surface — relies on the secrets having different keys to prevent confusion
- First-user-becomes-admin auto-creation logic could be a footgun if the OWUI database is ever seeded by accident with no users — would grant admin to whoever clicks first

## Deployment Requirement

`JWT_SECRET` must be set to the same value in both the Portal's environment (signing) and Atrium's environment (validation). If a previous `ATRIUM_JWT_SECRET` was set, rename it to `JWT_SECRET` (or set both temporarily and remove the old one after verification).

## Files Touched (3 commits, 7 files total)

**First commit** — the core fix:
- `backend/open_webui/routers/auths.py` (+127 LOC) — new portal-exchange endpoint
- `src/routes/(app)/atrium/auth/callback/+page.svelte` — call the exchange instead of direct storage
- `apps/atrium/backend/middleware/auth_redirect.py` — validate both secret types

**Second commit** — env var standardization:
- `apps/atrium/backend/middleware/auth_redirect.py` — drop ATRIUM_JWT_SECRET fallback
- `apps/atrium/backend/routers/voice.py` — drop ATRIUM_JWT_SECRET fallback
- `.env.example` — rename to JWT_SECRET
- `docker-compose.dev.yml` — rename to JWT_SECRET

Both commits applied to integration and fast-forwarded to `atrium-prod`.

## Lessons Captured

This incident produced two pieces of durable team-level documentation:

1. `protocols/verify-before-claim.md` — already existed; the Atrium fictional-endpoint incident is the founding case study. Reinforced this session.
2. `protocols/refactor-hygiene.md` — created in response to Root Cause #3 (the four-file env-var inconsistency). Codifies the engineering practice of auditing all references when renaming/removing/refactoring infrastructure, especially env vars and globals.


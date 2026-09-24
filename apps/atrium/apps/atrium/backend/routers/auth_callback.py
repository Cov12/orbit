"""
Atrium Portal Auth Callback Router

Handles the /atrium/auth/callback endpoint that receives Portal JWTs
and exchanges them for OpenWebUI session tokens.
"""

import datetime
import logging
import os
import time
import uuid
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

import jwt as pyjwt
from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from open_webui.internal.db import get_session
from open_webui.models.users import Users
from open_webui.models.auths import Auths
from open_webui.utils.auth import get_password_hash, create_token
from open_webui.utils.groups import apply_default_group_assignment
from open_webui.utils.misc import parse_duration
from open_webui.env import (
    WEBUI_AUTH_COOKIE_SAME_SITE,
    WEBUI_AUTH_COOKIE_SECURE,
)

logger = logging.getLogger("atrium.auth_callback")

router = APIRouter(prefix="/atrium/auth", tags=["atrium-auth"])

# Where the callback lands when no (or no SAFE) return path was supplied.
DEFAULT_RETURN_PATH = "/atrium/"

# Longest return path we will echo into a Location header. A relative path far past this
# is not a real view, just header bloat.
_MAX_RETURN_PATH_LEN = 2048

# One-shot query param naming the org this login LAUNCHED with (atrium#79). The Portal
# JWT is the only place that fact exists, and it dies with the callback, so the frontend
# has no way to know which org the user actually clicked into — it fell back to whatever
# org was last selected. We hand it forward on the redirect instead of in a cookie: it is
# a property of THIS navigation, not of the session, so it must not outlive the URL.
ACTIVE_ORG_QUERY_PARAM = "activeOrgId"


def _safe_return_path(candidate: str | None) -> str:
    """Open-redirect guard for the ?next= return path (#B3).

    The callback is an unauthenticated-until-validated entry point whose whole job is to
    redirect, so an attacker-supplied destination here is a textbook open redirect (and a
    credible phishing hop: the victim arrives from a real Portal login). We therefore
    ALLOW-LIST rather than blocklist — a value must look like a same-origin absolute path
    and nothing else:

      * non-empty after strip                       ('' / None / '   '  -> default)
      * no C0 control chars or DEL                  (CR/LF => header splitting; TAB/NUL
                                                     are also used to smuggle past naive
                                                     scheme checks, e.g. a TAB inside
                                                     'javascript:')
      * no backslash anywhere                       (browsers normalize a backslash to
                                                     '/', so a path of backslash+evil.com
                                                     resolves as the HOST evil.com — the
                                                     classic bypass)
      * starts with exactly one '/'                 (rejects 'https://evil', 'javascript:',
                                                     'evil.com', and every other scheme or
                                                     host-relative form, since none of them
                                                     begin with '/')
      * does NOT start with '//'                    (protocol-relative '//evil.com' IS an
                                                     absolute URL to a foreign origin)
      * at most _MAX_RETURN_PATH_LEN chars

    Anything that fails falls back to DEFAULT_RETURN_PATH — we never error the login on a
    bad return path, we just ignore it. Note the value is NOT decoded before checking:
    percent-encoded sequences ('/%2f%2fevil.com') stay in the path component per RFC 3986
    and are not re-interpreted as a host by any browser, whereas decoding first would let
    an attacker hide a real '//' behind '%2f%2f'."""
    if not isinstance(candidate, str):
        return DEFAULT_RETURN_PATH
    value = candidate.strip()
    if not value or len(value) > _MAX_RETURN_PATH_LEN:
        return DEFAULT_RETURN_PATH
    if any(ord(ch) < 0x20 or ord(ch) == 0x7F for ch in value):
        return DEFAULT_RETURN_PATH
    if "\\" in value:
        return DEFAULT_RETURN_PATH
    if not value.startswith("/") or value.startswith("//"):
        return DEFAULT_RETURN_PATH
    return value


def _is_truthy_marker(value: str | None) -> bool:
    """Query-param marker semantics: present and not an explicit falsy string."""
    if not isinstance(value, str):
        return False
    return value.strip().lower() not in ("", "0", "false", "no", "off")


def _with_active_org(destination: str, active_org_id: str | None) -> str:
    """Append ?activeOrgId=<internal org uuid> to an ALREADY-SAFE redirect path (#79).

    Two things this must not get wrong:

      * The join. The safe path routinely arrives carrying a query of its own
        (`/atrium/?subAccountCreated=1`, `/atrium/?newSubAccountId=...`), so naive
        `+ "?activeOrgId=..."` concatenation produces a second '?' and a param the
        browser folds into the previous value. We parse the destination and re-emit it,
        which is correct for the no-query, query and fragment cases alike.

      * The duplicate. `next` is attacker-controlled, and a hostile
        `?next=/atrium/?activeOrgId=<some-other-org>` survives _safe_return_path
        untouched (it IS a same-origin relative path). URLSearchParams.get() returns the
        FIRST value, so merely appending ours would let the attacker's win and drop the
        victim into an org they chose. Every caller-supplied activeOrgId is therefore
        STRIPPED before the server value is appended — ours is the only one in the result.

    Called AFTER _safe_return_path, never instead of it. The strip is UNCONDITIONAL —
    it runs even when the org does not resolve, because this param is outbound-only by
    definition and an inbound one is never legitimate, whether or not we have a value of
    our own to put there. So the result carries our activeOrgId, or none at all; never
    the caller's. Any parsing failure degrades to the untouched destination — the param
    is a convenience, and nothing here may cost the user their login.

    Note the round-trip normalizes the surviving query's encoding (a preserved `%20`
    re-emits as `+`). Both decode identically; the frontend reads values, not the raw
    string."""
    try:
        parts = urlsplit(destination)
        existing = parse_qsl(parts.query, keep_blank_values=True)
        pairs = [(key, value) for key, value in existing if key != ACTIVE_ORG_QUERY_PARAM]
        if not active_org_id and len(pairs) == len(existing):
            # Nothing to strip, nothing to add — leave the destination byte-identical.
            return destination
        if active_org_id:
            pairs.append((ACTIVE_ORG_QUERY_PARAM, active_org_id))
        return urlunsplit(
            (parts.scheme, parts.netloc, parts.path, urlencode(pairs), parts.fragment)
        )
    except Exception as e:
        logger.warning(f"Could not attach {ACTIVE_ORG_QUERY_PARAM} to redirect: {e}")
        return destination


@router.get("/callback")
async def portal_auth_callback(
    request: Request,
    token: str = None,
    # NB: named return_path, not `next` — the body calls the `next()` builtin
    # (`next(get_session())`), which a parameter named `next` would shadow.
    return_path: str = Query(default=None, alias="next"),
    subaccount_created: str = Query(default=None, alias="subAccountCreated"),
):
    """
    Handle Portal SSO callback.

    Flow:
    1. Portal redirects here with ?token=<portal_jwt>
    2. Validate the Portal JWT
    3. Find or create OpenWebUI user
    4. Create OpenWebUI session and set cookie
    5. Redirect to the (guarded) return path, default /atrium/

    Return-hop params (Phase 1.4 / first-sub-account onboarding):
      * ?next=<relative path>       — where to land after login. Passed through
        _safe_return_path, so only a same-origin absolute path survives; anything else
        silently falls back to DEFAULT_RETURN_PATH. This lets the "create your first
        sub-account" CTA bring the user back to the exact view (carrying, say,
        ?newSubAccountId=... for the frontend to auto-select).
      * ?subAccountCreated=1        — "the roster just changed": force a sub-account pull
        that IGNORES the per-org back-off, so the just-created sub-account is present in
        the mirror by the time the redirect lands. Without it, normal logins keep the
        throttled maybe_sync behavior.

    Emitted ON the redirect (atrium#79):
      * ?activeOrgId=<internal org uuid>  — the org this login launched with, resolved
        server-side from the JWT's org_id claim. One-shot and outbound only: any
        activeOrgId arriving in ?next= is stripped, so a caller can never choose it.
        Omitted entirely when the org does not resolve.
    """
    logger.info(f"[AuthCallback] Hit /atrium/auth/callback, token present: {bool(token)}")

    if not token:
        logger.warning("Auth callback called without token")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing token parameter",
        )

    # Get the shared JWT secret
    jwt_secret = os.environ.get("JWT_SECRET", "")
    if not jwt_secret:
        logger.error("JWT_SECRET not configured")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server misconfiguration",
        )

    # Validate Portal JWT
    try:
        payload = pyjwt.decode(token, jwt_secret, algorithms=["HS256"])
    except pyjwt.ExpiredSignatureError:
        logger.warning("Portal JWT expired")
        # Redirect to portal sign-in
        portal_url = os.environ.get("PORTAL_URL", "https://portal.orbit.example")
        return RedirectResponse(
            url=f"{portal_url}/sign-in?redirect_url={request.url}",
            status_code=307,
        )
    except pyjwt.InvalidTokenError as e:
        logger.warning(f"Invalid Portal JWT: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )

    # Extract user info
    email = payload.get("email", "").lower()
    name = payload.get("name", "")
    portal_user_id = payload.get("sub", "")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Token missing email",
        )

    if not name:
        name = email.split("@")[0]

    logger.info(f"Portal auth callback: email={email}, name={name}, sub={portal_user_id}")

    # Get database session
    db: Session = next(get_session())

    try:
        # Find or create user
        user = Users.get_user_by_email(email, db=db)

        if not user:
            logger.info(f"Creating new OWUI user from portal: {email}")
            role = "admin" if not Users.has_users(db=db) else "user"

            user = Auths.insert_new_auth(
                email=email,
                password=get_password_hash(str(uuid.uuid4())),
                name=name,
                profile_image_url="/user.png",
                role=role,
                db=db,
            )

            if not user:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Failed to create user",
                )

            # Apply default group assignment
            apply_default_group_assignment(
                request.app.state.config.DEFAULT_GROUP_ID,
                user.id,
                db=db,
            )
            logger.info(f"Created OWUI user {user.id}")
        else:
            # Update name if changed
            if user.name != name:
                Users.update_user_by_id(user.id, {"name": name}, db=db)

        # Persist Atrium org membership + per-org app_access from the validated
        # Portal JWT, keyed on the OWUI user.id (atrium#50). portal_auth_callback is the
        # single Atrium login path, so this is the sole provisioning entry point.
        # Defensive: the helper never raises (logs + rolls back), so login is never broken.
        from ..services.organizations import OrganizationsService

        OrganizationsService.provision_from_portal(db, user.id, payload)

        # Mirror the org's Portal sub-account roster locally (atrium#67). This is the ONE
        # place in prod that holds the raw Portal JWT (`token`) needed to pull Portal's
        # GET /api/subaccounts — the request path only ever sees the OWUI session token, so
        # the old get_tenant_session hook never fired in prod and the mirror stayed empty
        # (dashboard showed 0 sub-accounts). maybe_sync is throttled per-org and never
        # raises, so an unreachable Portal just leaves the mirror as-is, never breaks login.
        #
        # Return-from-create hop (#B2): when the callback carries ?subAccountCreated=1 the
        # roster demonstrably changed seconds ago, so the 900s back-off is exactly wrong —
        # a throttled login would land the user on a mirror that does not yet contain the
        # sub-account they just made. force_sync pulls immediately (and still records the
        # attempt, so the back-off window restarts rather than allowing a second pull).
        # Everything stays inside this never-raises try: a Portal failure here degrades to
        # a stale mirror, never a broken login.
        force_resync = _is_truthy_marker(subaccount_created)
        portal_cuid = payload.get("org_id")

        # Resolve the INTERNAL Atrium org id for the org this login launched with
        # (atrium#79). provision_from_portal above has already find-or-created the org
        # bound to this Portal CUID and upserted membership, so by here the row exists and
        # this is a plain lookup of the uuid the frontend needs — the Portal CUID in the
        # JWT is not it, and the JWT does not survive the redirect.
        #
        # Deliberately hoisted OUT of the sync block below: sub-account sync talks to
        # Portal over the network and is allowed to fail, but which org the user launched
        # is already settled by then, so a Portal outage must not also cost us the landing
        # org. Stays None if the JWT carried no org_id or provisioning swallowed an error;
        # None means we emit no param at all and the redirect is exactly what it was
        # before this change.
        launch_org_id = None
        try:
            if portal_cuid:
                org = OrganizationsService.get_org_by_portal_id(db, portal_cuid)
                if org is not None:
                    launch_org_id = org.id
        except Exception as e:
            logger.warning(f"Atrium launch-org lookup at login failed (non-fatal): {e}")

        try:
            if launch_org_id:
                from ..services import subaccount_sync

                if force_resync:
                    logger.info(
                        "Portal return-from-create: forcing sub-account resync for org %s",
                        launch_org_id,
                    )
                    subaccount_sync.force_sync(db, launch_org_id, portal_cuid, token)
                else:
                    subaccount_sync.maybe_sync(db, launch_org_id, portal_cuid, token)
        except Exception as e:
            logger.warning(f"Atrium sub-account sync at login failed (non-fatal): {e}")

        # Create OWUI session token
        expires_delta = parse_duration(request.app.state.config.JWT_EXPIRES_IN)
        expires_at = None
        if expires_delta:
            expires_at = int(time.time()) + int(expires_delta.total_seconds())

        owui_token = create_token(
            data={"id": user.id},
            expires_delta=expires_delta,
        )

        # Create redirect response. #B3: the destination is attacker-controllable input,
        # so it goes through the open-redirect guard; an unsafe value degrades to
        # DEFAULT_RETURN_PATH instead of failing the login.
        # #79: and the safe path then carries the launch org forward as a one-shot param.
        # Order matters — the guard runs first and decides the path, _with_active_org only
        # rewrites that path's query (and strips any activeOrgId the caller smuggled in).
        destination = _with_active_org(_safe_return_path(return_path), launch_org_id)
        response = RedirectResponse(url=destination, status_code=303)

        # Set cookie with path="/" so it's available on all paths
        # This is critical because the callback is at /atrium/auth/callback
        # but the UI is at /atrium/
        datetime_expires_at = (
            datetime.datetime.fromtimestamp(expires_at, datetime.timezone.utc)
            if expires_at
            else None
        )
        response.set_cookie(
            key="token",
            value=owui_token,
            expires=datetime_expires_at,
            httponly=False,  # Required for frontend JavaScript to read the token
            samesite=WEBUI_AUTH_COOKIE_SAME_SITE,
            secure=WEBUI_AUTH_COOKIE_SECURE,
            path="/",  # Critical: make cookie available on all paths
        )

        logger.info(
            f"Portal auth success: user={user.id}, token set with path=/, "
            f"redirecting to {destination}"
        )
        return response

    finally:
        db.close()

"""Request-scope dependencies for Atrium routers."""

import logging
import os

import jwt as pyjwt
from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from .tenant import get_tenant_session
from ..services.organizations import OrganizationsService

logger = logging.getLogger(__name__)

_OWUI_JWT_ALGORITHM = "HS256"


def _owui_session_secret() -> str:
    """The secret the OWUI app signs its session tokens with (WEBUI_SECRET_KEY).

    Prod requests to Atrium carry an OWUI SESSION token (payload {"id": user.id},
    signed WEBUI_SECRET_KEY) — NOT a Portal JWT — so to recover the caller's identity
    we must verify that token with the SAME secret create_token uses
    (open_webui.utils.auth.SESSION_SECRET == WEBUI_SECRET_KEY, auth.py:51,203).

    Resolved lazily and defensively: importing open_webui.utils.auth at module load
    would drag in the full backend dep tree and break the Atrium unit-test env
    (apps/atrium/conftest.py stubs only open_webui.internal.db). We therefore mirror
    env.py's exact resolution off os.environ, which the running app has already
    populated (env.py runs load_dotenv at import), and which tests control directly.
    """
    return (
        os.environ.get("WEBUI_SECRET_KEY")
        or os.environ.get("WEBUI_JWT_SECRET_KEY")
        or "t0p-s3cr3t"
    )


def _resolve_owui_user_id(request: Request):
    """Recover the OWUI user.id from the request's OWUI session token.

    Mirrors open_webui.utils.auth.get_current_user token extraction (bearer header,
    else the `token` cookie) but WITHOUT a hard dependency: get_verified_user/
    get_current_user raise 401 on a missing/invalid token, which would pre-empt the
    fail-closed 403 below (we need to fall through to it, not raise 401 here). So we
    decode softly and return None when no valid OWUI token is present.

    Returns the OWUI user.id (str) or None.
    """
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[len("Bearer ") :].strip()
    if not token:
        token = request.cookies.get("token")
    if not token:
        return None

    try:
        data = pyjwt.decode(
            token, _owui_session_secret(), algorithms=[_OWUI_JWT_ALGORITHM]
        )
    except Exception:
        # Not a valid OWUI session token (e.g. it's a Portal JWT, or expired/forged).
        return None

    if isinstance(data, dict):
        return data.get("id")
    return None


def require_app_access(required_app: str):
    """
    FastAPI dep factory. 403s unless the caller is entitled to `required_app`.

    Three identity paths (issue #45):

    1. LEGACY Portal-JWT path (request.state.portal_auth present): unchanged —
       the JWT's app_access claim decides (portal_auth.has_app_access), for
       back-compat with the direct Portal-JWT callers.

    2. OWUI-session path (portal_auth None, an OWUI user resolves): the session
       token carries no app_access claim, so entitlement is read from the DB —
       the requested org's cached AtriumOrganization.app_access column (written
       at portal-exchange). A user with >=1 membership row is enforced against it;
       a user with NO membership rows is denied (fail-closed).

    3. Neither identity resolves: 403 (fail-closed).
    """

    def _dep(request: Request, db: Session = Depends(get_tenant_session)):
        portal_auth = getattr(request.state, "portal_auth", None)

        # 1. LEGACY Portal-JWT path — unchanged.
        if portal_auth is not None:
            if not portal_auth.has_app_access(required_app):
                logger.info(
                    "require_app_access[%s] denied for user=%s org=%s",
                    required_app, portal_auth.user_id, portal_auth.org_id,
                )
                raise HTTPException(
                    status_code=403, detail=f"App access denied: {required_app}"
                )
            return

        owui_user_id = _resolve_owui_user_id(request)

        # 3. No identity at all — fail closed.
        if not owui_user_id:
            logger.info(
                "require_app_access[%s] denied: unauthenticated (no portal_auth, no OWUI user)",
                required_app,
            )
            raise HTTPException(
                status_code=403, detail=f"App access denied: {required_app}"
            )

        # 2. OWUI-session path.
        members = OrganizationsService.get_user_orgs(db, owui_user_id)
        if not members:
            # Un-provisioned user — fail closed.
            logger.info(
                "require_app_access[%s] denied: OWUI user=%s has no membership",
                required_app, owui_user_id,
            )
            raise HTTPException(
                status_code=403, detail=f"App access denied: {required_app}"
            )

        # Member: read the requested org's cached app_access. (require_org_access,
        # composed alongside, enforces that the requested org is one of the caller's.)
        requested_org_id = (
            request.query_params.get("org_id")
            or request.path_params.get("org_id")
        )
        org = (
            OrganizationsService.get_org_by_id(db, requested_org_id)
            if requested_org_id
            else None
        )
        org_app_access = list(getattr(org, "app_access", None) or []) if org else []
        if required_app not in org_app_access:
            logger.info(
                "require_app_access[%s] denied for OWUI user=%s org=%s (org apps=%s)",
                required_app, owui_user_id, requested_org_id, org_app_access,
            )
            raise HTTPException(
                status_code=403, detail=f"App access denied: {required_app}"
            )
        return

    return _dep


# Roles that may ADMINISTER an org's membership (add/manage members). Two role
# vocabularies converge here:
#   - the internal OrgRole hierarchy's top role — "executive" (models/organization.py:15,
#     the enum is privilege-ordered executive > department_head > manager > member);
#   - the Portal-JWT admin-ish set jwt_auth.PortalAuthContext treats as privileged —
#     "owner"/"admin" (jwt_auth.py:51, has_department_access short-circuits for them).
# The #45/#46 tests also seed the privileged AtriumMember with role="owner"
# (test_owui_session_auth.py:103), so the OWUI DB path must honour "owner" too. Anything
# below (department_head/manager/member) is a NON-admin and cannot add members.
#
# NOTE (role-model bootstrapping, #45): the org's owner/admin AtriumMember row is now
# written at login by OrganizationsService.provision_from_portal, invoked from the real
# SSO callback routers/auth_callback.py::portal_auth_callback (atrium#50/#51), with the
# role taken from the Portal JWT. So a genuine OWNER/ADMIN is seated on first entry and
# this gate is enforced for everyone — there is no dev-flag grace anymore.
ORG_ADMIN_ROLES = frozenset({"executive", "owner", "admin"})


def _role_is_admin(role) -> bool:
    """Case-insensitive admin-role check. Portal's JWT sends UPPERCASE roles
    (MemberRole = OWNER | ADMIN | MEMBER); AtriumMember may hold the normalized
    lowercase form (written at portal-exchange) or a native lowercase role. Compare
    case-insensitively so an actual OWNER/ADMIN is recognized regardless of casing."""
    return bool(role) and str(role).lower() in ORG_ADMIN_ROLES


def require_org_admin(
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """Authorize the CALLER as an admin/owner of the requested org (issue #45 PR-3).

    Layered ON TOP of require_org_access (both are composed on the route): require_org_access
    already binds the requested internal org_id to the caller's real identity (the #41/#45
    IDOR fix); this dep ADDITIONALLY requires the caller's ROLE for THIS org be in
    ORG_ADMIN_ROLES. It gates privileged mutations — currently POST /orgs/{org_id}/members,
    which otherwise let ANY member mint arbitrary user_ids with arbitrary roles into the
    tenant (privilege escalation / tenant pollution).

    This authorizes the CALLER only; the body user_id (who is being ADDED) is handled in
    the route handler and is deliberately NOT the identity checked here.

    Identity resolution reuses the #46 helpers (portal_auth / _resolve_owui_user_id /
    get_user_orgs) and mirrors require_org_access's three paths, all fail-closed: an
    un-provisioned caller (no membership) or no identity at all is 403. A provisioned
    member whose role is not admin-ish is also 403 (the privilege-escalation fix).
    """
    portal_auth = getattr(request.state, "portal_auth", None)
    # Same org-id resolution require_org_access uses: query param first, else path param.
    requested_org_id = (
        request.query_params.get("org_id")
        or request.path_params.get("org_id")
    )

    # 1. LEGACY Portal-JWT path: the JWT carries the caller's role — require it be
    #    admin-ish. (require_org_access, alongside, already bound the org to the caller's
    #    Portal CUID, so here we only add the role gate.) Fail-closed on every path.
    if portal_auth is not None:
        if not _role_is_admin(getattr(portal_auth, "role", None)):
            logger.info(
                "require_org_admin denied: portal user=%s org=%s role=%s not admin",
                portal_auth.user_id, portal_auth.org_id,
                getattr(portal_auth, "role", None),
            )
            raise HTTPException(status_code=403, detail="Org admin access required")
        return

    owui_user_id = _resolve_owui_user_id(request)

    # 3. No identity at all — fail closed.
    if not owui_user_id:
        logger.info(
            "require_org_admin denied: unauthenticated (no portal_auth, no OWUI user)"
        )
        raise HTTPException(status_code=403, detail="Org admin access required")

    # 2. OWUI-session path: resolve the CALLER's membership and require their role for
    #    THIS org be admin-ish. The caller = the OWUI user.id from the session token; it
    #    is distinct from the body user_id (the user being added) — see the route handler.
    members = OrganizationsService.get_user_orgs(db, owui_user_id)
    if not members:
        # Un-provisioned caller — fail closed.
        logger.info(
            "require_org_admin denied: OWUI user=%s has no membership", owui_user_id
        )
        raise HTTPException(status_code=403, detail="Org admin access required")

    # Caller HAS membership rows: find their row for the requested org. A non-member of
    # THIS org resolves to caller_role=None (already 403'd by require_org_access's IDOR
    # bound; re-asserted here), and a member whose role is NOT admin-ish is 403 — the core
    # fix: a plain 'member' can no longer add members.
    caller_role = next(
        (m.role for m in members if m.org_id == requested_org_id), None
    )
    if not _role_is_admin(caller_role):
        logger.info(
            "require_org_admin denied: OWUI user=%s org=%s caller_role=%s not admin",
            owui_user_id, requested_org_id, caller_role,
        )
        raise HTTPException(status_code=403, detail="Org admin access required")
    return


def require_org_access(
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """
    FastAPI dependency that binds the requested internal org_id to the caller's real
    identity (issue #41 IDOR fix, extended to the OWUI-session path in issue #45).

    The tenant-scoped handlers all trust an `org_id` (the Atrium-INTERNAL row id)
    that arrives as a query param (departments/proposals/conductor-approvals/...) or a
    path param (`/orgs/{org_id}/...`) and filter their queries on it. Nothing else
    proves the requested org BELONGS to the caller. This dep closes that hole. It must
    be composed ALONGSIDE get_tenant_session + require_app_access, not as a replacement.

    Three identity paths:

    1. LEGACY Portal-JWT path (request.state.portal_auth present): unchanged — the JWT's
       org_id claim is the Portal CUID; require row.portal_org_id == portal_auth.org_id.
       Fail-closed: a missing org_id, an unknown org, or an org owned by a different
       Portal CUID all 403.

    2. OWUI-session path (portal_auth None, an OWUI user resolves): load the user's
       AtriumMember org_ids.
         - If the user HAS >=1 membership row: the requested internal org_id MUST be one
           of them, else 403. (This is the real IDOR enforcement on the prod OWUI path.)
         - If the user has NO membership rows: 403 (fail-closed).

    3. Neither identity resolves: 403 (fail-closed).
    """
    portal_auth = getattr(request.state, "portal_auth", None)
    # Match how handlers receive the internal org id: query param first (departments,
    # proposals, conductor-approvals, employee-tabs, dashboard/*), else the path param
    # (/orgs/{org_id}/...).
    requested_org_id = (
        request.query_params.get("org_id")
        or request.path_params.get("org_id")
    )

    # 1. LEGACY Portal-JWT path — unchanged.
    if portal_auth is not None:
        if not requested_org_id:
            logger.info(
                "require_org_access denied: no org_id on request for user=%s portal_org=%s",
                portal_auth.user_id, portal_auth.org_id,
            )
            raise HTTPException(
                status_code=403, detail="Org access denied: missing org_id"
            )
        org = OrganizationsService.get_org_by_id(db, requested_org_id)
        if org is None or org.portal_org_id != portal_auth.org_id:
            logger.info(
                "require_org_access denied: user=%s portal_org=%s requested internal org=%s "
                "(owner_portal_org=%s)",
                portal_auth.user_id, portal_auth.org_id, requested_org_id,
                getattr(org, "portal_org_id", None),
            )
            raise HTTPException(status_code=403, detail="Org access denied")
        return

    owui_user_id = _resolve_owui_user_id(request)

    # 3. No identity at all — fail closed.
    if not owui_user_id:
        logger.info(
            "require_org_access denied: unauthenticated (no portal_auth, no OWUI user)"
        )
        raise HTTPException(status_code=403, detail="Org access denied")

    # 2. OWUI-session path.
    member_org_ids = {
        m.org_id for m in OrganizationsService.get_user_orgs(db, owui_user_id)
    }
    if member_org_ids:
        # Real IDOR enforcement: the requested org must be one the caller belongs to.
        if requested_org_id and requested_org_id in member_org_ids:
            return
        logger.info(
            "require_org_access denied: OWUI user=%s requested org=%s not in member orgs %s",
            owui_user_id, requested_org_id, member_org_ids,
        )
        raise HTTPException(status_code=403, detail="Org access denied")

    # No membership rows — fail closed.
    logger.info(
        "require_org_access denied: OWUI user=%s has no membership", owui_user_id
    )
    raise HTTPException(status_code=403, detail="Org access denied")

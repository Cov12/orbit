"""
Atrium Tenant Middleware & Dependencies

Tenant isolation layers:
1. PRIMARY (always on): the application layer — require_org_access (middleware/deps.py)
   binds the requested org_id to the caller's real membership, and every tenant-scoped
   query filters by that org_id. This is what actually enforces isolation in prod.
2. SECONDARY (Postgres only): Postgres RLS policies (migrations/001_rls_policies.sql)
   keyed on the app.current_org_id session variable that get_tenant_session sets.
   Atrium prod runs on SQLite, which has no RLS, so this layer is dormant there —
   get_tenant_session sets the variable only when the bound engine is Postgres.

TenantMiddleware extracts org_id from the JWT/header onto request.state.org_id;
get_tenant_session yields the DB session, setting the RLS context on Postgres. SET LOCAL
scopes to the current transaction, matching the route handler's lifecycle.
"""

import logging
from typing import Generator, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from fastapi import Depends, Request as FastAPIRequest

from open_webui.internal.db import get_session

logger = logging.getLogger("atrium.middleware.tenant")


class TenantMiddleware(BaseHTTPMiddleware):
    """
    Extracts org_id from the request and sets request.state.org_id.

    Priority (set by JWTAuthMiddleware which runs first):
    1. request.state.org_id from Portal JWT
    2. X-Org-Id header (Phase 1 fallback)
    3. org_id query param (Phase 1 fallback)

    Does NOT set RLS directly — that's handled by get_tenant_session().
    """

    async def dispatch(self, request: Request, call_next):
        # Skip non-Atrium routes
        if not request.url.path.startswith("/api/atrium"):
            return await call_next(request)

        # JWTAuthMiddleware may have already set org_id from JWT
        existing_org_id = getattr(request.state, "org_id", None)

        if not existing_org_id:
            # Phase 1 fallback: header or query param
            org_id = (
                request.headers.get("X-Org-Id")
                or request.query_params.get("org_id")
            )
            request.state.org_id = org_id or None

        response = await call_next(request)
        return response


def get_tenant_session(
    request: FastAPIRequest,
    db: Session = Depends(get_session),
) -> Generator[Session, None, None]:
    """
    FastAPI dependency that yields a DB session with RLS context set.

    Usage in route handlers:
        @router.get("/")
        async def my_route(db: Session = Depends(get_tenant_session)):
            # db already has app.current_org_id set for RLS
            ...

    The SET LOCAL persists for the duration of the current transaction,
    which matches the route handler's lifecycle.
    """
    org_id: Optional[str] = getattr(request.state, "org_id", None)

    # #43 (security / defense-in-depth): the request path must NEVER assign or infer org
    # ownership. It previously ran the #66 Approach-B reconcile here — stamping
    # portal_org_id onto a NULL row keyed by the `org_id` query param — which meant a
    # legacy unstamped org (portal_org_id NULL, slug != 'default') was CLAIMED by the
    # FIRST Portal caller to reference it (trust-on-first-use), and then served that
    # org's data. Because require_org_access (#41) depends on this session, the stamp
    # ran BEFORE the ownership check, so the check could never fail-close.
    #
    # Ownership is now assigned ONLY at provisioning (OrganizationsService.create_org,
    # #71 Approach A) and backfilled out-of-band (see migrations/004). The
    # stamp_portal_org_id FUNCTION is retained for that backfill script but is no longer
    # invoked implicitly on this data-serving read: a NULL row now fails closed at
    # require_org_access (→ 403) instead of being claimable.
    portal_auth = getattr(request.state, "portal_auth", None)
    portal_cuid = getattr(portal_auth, "org_id", None) if portal_auth else None
    if portal_cuid:
        internal_org_id = request.query_params.get("org_id")
        if internal_org_id:
            # A1 (#27): mirror the org's Portal sub-account roster locally — but ONLY for
            # an org the caller already OWNS. Same defense-in-depth rule as above: a read
            # must not WRITE into a foreign (or unclaimed) org. Ownership == the row's
            # existing portal_org_id matching the caller's Portal CUID (set at
            # provisioning, never here). For a NULL/foreign row this is a no-op — the
            # request itself is about to 403 at require_org_access. maybe_sync is
            # throttled per-org and never raises, so an unreachable Portal just leaves
            # the mirror as-is (business-scope-only), never a 500.
            from ..services.organizations import OrganizationsService

            owned = OrganizationsService.get_org_by_id(db, internal_org_id)
            if owned is not None and owned.portal_org_id == portal_cuid:
                portal_token = getattr(request.state, "portal_token", None)
                if portal_token:
                    from ..services.subaccount_sync import maybe_sync

                    maybe_sync(db, internal_org_id, portal_cuid, portal_token)

    # RLS is a Postgres-only SECOND layer (migrations/001_rls_policies.sql). Atrium prod
    # runs on SQLite, which has no RLS — `SET LOCAL` there raises a syntax error on EVERY
    # tenant request (previously caught + logged, i.e. per-request warning spam plus a
    # false impression of DB-level isolation). The PRIMARY, always-on guard is the
    # application layer: require_org_access (middleware/deps.py) binds the requested org_id
    # to the caller's membership and every tenant-scoped query filters by that org_id. So
    # only set the RLS context when the bound engine is Postgres, where a policy can
    # actually consult it; on SQLite this is a clean no-op.
    if org_id and db.get_bind().dialect.name == "postgresql":
        try:
            db.execute(
                text("SET LOCAL app.current_org_id = :org_id"),
                {"org_id": org_id},
            )
            logger.debug("RLS context set on session: org_id=%s", org_id)
        except Exception as e:
            logger.warning("Failed to set RLS context: %s", e)

    try:
        yield db
    finally:
        # Session cleanup handled by get_session's own lifecycle
        pass


def get_org_id(request: FastAPIRequest) -> Optional[str]:
    """
    Simple dependency to extract org_id from request state.
    Use when you need org_id but not a full tenant session.
    """
    return getattr(request.state, "org_id", None)

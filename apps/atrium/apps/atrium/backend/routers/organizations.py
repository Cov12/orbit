"""
Atrium Organization Routes

Multi-tenant org management — CRUD for orgs and members.
"""

import os

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from ..middleware.tenant import get_tenant_session
from ..middleware.deps import require_org_access, require_org_admin
from ..models.db import AtriumSubAccount
from ..services.organizations import OrganizationsService
from ..services.subaccount_sync import (
    ATRIUM_SUBACCOUNT_COOKIE,
    BUSINESS_SCOPE_SENTINEL,
    get_sync_status,
    list_active_subaccounts,
    resolve_active_subaccount_id,
)

router = APIRouter(prefix="/api/atrium/orgs", tags=["atrium-organizations"])


def _public_origin() -> Optional[str]:
    """This deployment's canonical public origin, from ATRIUM_PUBLIC_ORIGIN (#B4).

    The frontend needs an EXACT origin to build the Portal returnTo URL that Portal's
    redirect allowlist will accept. window.location.origin is not that: behind a proxy,
    a preview host or a custom domain it can differ from the registered origin, and the
    return hop then silently fails the allowlist. So the server states it.

    Unset / blank / not an http(s) absolute origin -> None, and the frontend falls back
    to window.location.origin. Trailing slash is normalized off so callers can
    concatenate a path directly."""
    raw = os.environ.get("ATRIUM_PUBLIC_ORIGIN", "")
    value = raw.strip().rstrip("/") if isinstance(raw, str) else ""
    if not value:
        return None
    if not (value.startswith("https://") or value.startswith("http://")):
        return None
    return value


class CreateOrgRequest(BaseModel):
    name: str
    slug: str
    workpipe_account_id: Optional[str] = None
    plan: str = "starter"


class AddMemberRequest(BaseModel):
    user_id: str
    role: str = "member"
    department_ids: list[str] = []


@router.get("/")
async def list_organizations(
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """List organizations for user org resolution.

    #35 (GA-safety): on the Portal-authed path this is scoped to the caller's own
    Portal org (portal_auth.org_id == AtriumOrganization.portal_org_id) so it can
    no longer enumerate every tenant's orgs. The unauthenticated dev/OWUI-internal
    fallback (no portal_auth — e.g. the X-Org-Id header path, which is gated to
    non-prod by require_app_access elsewhere) keeps the legacy list-all behavior so
    single-tenant/dev flows are unaffected.
    """
    portal_auth = getattr(request.state, "portal_auth", None)
    portal_cuid = getattr(portal_auth, "org_id", None) if portal_auth else None
    if portal_cuid:
        orgs = OrganizationsService.list_orgs_for_portal(db, portal_cuid)
    else:
        # OWUI-session path (prod): scope to the authenticated user's memberships. Never
        # enumerate other tenants' orgs (cross-tenant leak), and only return orgs the user
        # actually belongs to so the frontend can't pick a foreign org (which then 403s
        # every scoped call). List-all is retained ONLY for the unauthenticated dev/header
        # path (no resolvable OWUI user) — non-prod.
        from ..middleware.deps import _resolve_owui_user_id

        owui_user_id = _resolve_owui_user_id(request)
        if owui_user_id:
            member_org_ids = {
                m.org_id for m in OrganizationsService.get_user_orgs(db, owui_user_id)
            }
            orgs = [
                o for o in OrganizationsService.list_orgs(db) if o.id in member_org_ids
            ]
        else:
            orgs = OrganizationsService.list_orgs(db)
    return [
        {
            "id": o.id,
            "name": o.name,
            "slug": o.slug,
            "plan": o.plan,
            # Org profile captured once at Portal signup, stamped into settings on login.
            # Surfaced top-level so the active-org store carries it and the onboarding wizard
            # can prefill + lock it instead of re-asking.
            "logo": (o.settings or {}).get("logo"),
            "industry": (o.settings or {}).get("industry"),
        }
        for o in orgs
    ]


@router.post("/")
async def create_organization(
    data: CreateOrgRequest,
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """Create a new organization with default departments."""
    existing = OrganizationsService.get_org_by_slug(db, data.slug)
    if existing:
        raise HTTPException(status_code=409, detail="Organization slug already exists")

    # #66 Stage 2 (Approach A): if this create is Portal-authed, stamp the new org with
    # the Portal org CUID (the JWT's org_id claim, surfaced on request.state.portal_auth
    # by JWTAuthMiddleware) so it resolves to its OWN per-org Conductor company. Guarded
    # defensively — a missing/empty portal_auth must never block org creation.
    portal_auth = getattr(request.state, "portal_auth", None)
    portal_org_id = getattr(portal_auth, "org_id", None) if portal_auth else None

    org = OrganizationsService.create_org(
        db, name=data.name, slug=data.slug,
        workpipe_account_id=data.workpipe_account_id, plan=data.plan,
        portal_org_id=portal_org_id or None,
    )
    # Auto-create MVP departments
    departments = OrganizationsService.setup_default_departments(db, org.id)

    return {
        "organization": {"id": org.id, "name": org.name, "slug": org.slug, "plan": org.plan},
        "departments": [{"id": d.id, "slug": d.slug, "name": d.name} for d in departments],
    }


@router.get("/{org_id}", dependencies=[Depends(require_org_access)])
async def get_organization(
    org_id: str,
    db: Session = Depends(get_tenant_session),
):
    """Get organization details."""
    org = OrganizationsService.get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "plan": org.plan,
        "logo": (org.settings or {}).get("logo"),
        "industry": (org.settings or {}).get("industry"),
        "settings": org.settings,
    }


@router.get("/{org_id}/subaccounts", dependencies=[Depends(require_org_access)])
async def list_org_subaccounts(
    org_id: str,
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """List ACTIVE mirrored sub-accounts plus the current chat scope selection."""
    org = OrganizationsService.get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    active_subaccount_id = resolve_active_subaccount_id(
        db, org_id, request.cookies.get(ATRIUM_SUBACCOUNT_COOKIE)
    )
    subaccounts = list_active_subaccounts(db, org_id)
    # #B1: an empty subAccounts list is ambiguous on its own — it means either "this org
    # genuinely has none" or "we never managed to reach Portal". syncOk disambiguates:
    # True only once a pull has actually succeeded for this org. The onboarding nudge must
    # fire on (syncOk && subAccounts == []) and NEVER on (!syncOk), so a Portal outage
    # cannot tell an existing customer they have no sub-accounts.
    synced_at, sync_ok = get_sync_status(db, org_id)
    return {
        "subAccounts": [
            {
                "id": s.id,
                "name": s.name,
                "slug": s.slug,
                "status": s.status,
            }
            for s in subaccounts
        ],
        "activeSubAccountId": active_subaccount_id,
        "syncedAt": synced_at,
        "syncOk": sync_ok,
        "publicOrigin": _public_origin(),
    }


@router.post("/{org_id}/subaccounts/select", dependencies=[Depends(require_org_access)])
async def select_org_subaccount(
    org_id: str,
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """Persist the active Atrium chat scope in an httpOnly cookie."""
    org = OrganizationsService.get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    try:
        body = await request.json()
    except Exception:
        body = {}

    candidate = body.get("subAccountId") if isinstance(body, dict) else None
    sub_account_id = candidate.strip() if isinstance(candidate, str) else None

    cookie_value = BUSINESS_SCOPE_SENTINEL
    selected: str | None = None
    if sub_account_id:
        subaccount = (
            db.query(AtriumSubAccount)
            .filter(AtriumSubAccount.org_id == org_id)
            .filter(AtriumSubAccount.id == sub_account_id)
            .first()
        )
        if not subaccount or (subaccount.status or "").lower() != "active":
            raise HTTPException(status_code=404, detail="Sub-account not found in this organization")
        cookie_value = str(subaccount.id)
        selected = str(subaccount.id)

    response = JSONResponse({"selected": selected})
    response.set_cookie(
        key=ATRIUM_SUBACCOUNT_COOKIE,
        value=cookie_value,
        httponly=True,
        secure=request.url.scheme == "https",
        samesite="lax",
        max_age=60 * 60 * 24 * 365,
        path="/",
    )
    return response


@router.get("/{org_id}/members", dependencies=[Depends(require_org_access)])
async def list_members(
    org_id: str,
    db: Session = Depends(get_tenant_session),
):
    """List organization members."""
    members = OrganizationsService.list_members(db, org_id)
    return {
        "members": [
            {"id": m.id, "user_id": m.user_id, "role": m.role, "department_ids": m.department_ids}
            for m in members
        ],
        "total": len(members),
    }


@router.post(
    "/{org_id}/members",
    dependencies=[Depends(require_org_access), Depends(require_org_admin)],
)
async def add_member(
    org_id: str,
    data: AddMemberRequest,
    db: Session = Depends(get_tenant_session),
):
    """Add a member to an organization.

    AUTHZ (issue #45 PR-3): require_org_access binds {org_id} to the CALLER (IDOR),
    and require_org_admin additionally requires the CALLER be an admin/owner of this
    org — closing the privilege-escalation hole where any member (or, under the dev-flag
    grace, any authed user) could mint arbitrary user_ids with arbitrary roles into the
    tenant. The two identities are DISTINCT: the guards authorize the CALLER (resolved
    from the Portal JWT / OWUI session token), while data.user_id below is the ADDED
    user (who the authorized admin is inviting) — never the caller.

    NB (out of scope, UX follow-up): data.user_id must already be an OWUI user.id; there
    is no 'add by email' resolution here.
    """
    org = OrganizationsService.get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    # data.user_id is the ADDED user (body-supplied), legitimate now that the CALLER is
    # an authorized admin of {org_id}. (Kept as add_member — not upsert_member — to
    # preserve department_ids, which upsert_member does not carry; see deliverable note.)
    member = OrganizationsService.add_member(
        db, org_id=org_id, user_id=data.user_id,
        role=data.role, department_ids=data.department_ids,
    )
    return {"id": member.id, "user_id": member.user_id, "role": member.role}

"""Dashboard Drive read routes (HTTP + JWT, no direct DB reads)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..middleware.deps import require_app_access, require_org_access
from ..middleware.tenant import get_tenant_session
from ..services.organizations import OrganizationsService
from ..services.drive_dashboard import DriveDashboardClient, DriveDashboardError

router = APIRouter(
    prefix="/api/atrium/dashboard/drive",
    tags=["atrium-dashboard-drive"],
    # require_app_access first (DRIVE entitlement), then require_org_access (bind org_id
    # to the caller's membership) — so we only ever mint a token for the caller's own org.
    dependencies=[Depends(require_app_access("DRIVE")), Depends(require_org_access)],
)


def _build_client(
    request: Request, db: Session, org_id: str, sub_account_id: str | None
) -> DriveDashboardClient:
    org = OrganizationsService.get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    portal_auth = getattr(request.state, "portal_auth", None)
    user_id = getattr(request.state, "user_id", None) or getattr(portal_auth, "user_id", None)

    try:
        return DriveDashboardClient(
            portal_org_id=str(org.portal_org_id or ""),
            org_slug=org.slug or "",
            org_name=org.name,
            app_access=list(org.app_access or []),
            user_id=user_id or "atrium-dashboard",
            role=getattr(portal_auth, "role", None),
            email=getattr(portal_auth, "email", None),
            name=getattr(portal_auth, "name", None),
            sub_account_id=sub_account_id,
        )
    except DriveDashboardError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/summary")
async def get_drive_summary(
    request: Request,
    org_id: str,
    sub_account_id: str | None = Query(default=None, alias="subAccountId"),
    db: Session = Depends(get_tenant_session),
):
    client = _build_client(request, db, org_id, sub_account_id)
    try:
        return {"data": await client.get_summary()}
    except DriveDashboardError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

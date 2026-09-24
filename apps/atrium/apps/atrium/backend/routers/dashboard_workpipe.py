"""Dashboard D2 WorkPipe read routes (HTTP + JWT, no direct DB reads)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session

from ..middleware.deps import require_app_access, require_org_access
from ..middleware.tenant import get_tenant_session
from ..services.organizations import OrganizationsService
from ..services.workpipe_dashboard import WorkPipeDashboardClient, WorkPipeDashboardError

router = APIRouter(
    prefix="/api/atrium/dashboard/workpipe",
    tags=["atrium-dashboard-workpipe"],
    # #41: require_app_access first (app entitlement), then require_org_access
    # (bind the requested org_id to the caller's Portal org).
    dependencies=[Depends(require_app_access("WORKPIPE")), Depends(require_org_access)],
)


def _build_client(request: Request, db: Session, org_id: str) -> WorkPipeDashboardClient:
    org = OrganizationsService.get_org_by_id(db, org_id)
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")

    portal_auth = getattr(request.state, "portal_auth", None)
    user_id = getattr(request.state, "user_id", None) or getattr(portal_auth, "user_id", None)

    try:
        return WorkPipeDashboardClient(
            workpipe_business_id=str(org.portal_org_id or ""),
            user_id=user_id or "atrium-dashboard",
            role=getattr(portal_auth, "role", None),
            email=getattr(portal_auth, "email", None),
        )
    except WorkPipeDashboardError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/stats")
async def get_workpipe_stats(
    request: Request,
    org_id: str,
    sub_account_id: str | None = Query(default=None, alias="subAccountId"),
    db: Session = Depends(get_tenant_session),
):
    client = _build_client(request, db, org_id)
    try:
        return {"data": await client.get_stats(sub_account_id=sub_account_id)}
    except WorkPipeDashboardError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/pipelines")
async def get_workpipe_pipelines(
    request: Request,
    org_id: str,
    sub_account_id: str | None = Query(default=None, alias="subAccountId"),
    db: Session = Depends(get_tenant_session),
):
    client = _build_client(request, db, org_id)
    try:
        return {"data": await client.get_pipelines(sub_account_id=sub_account_id)}
    except WorkPipeDashboardError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/contacts")
async def get_workpipe_contacts(
    request: Request,
    org_id: str,
    sub_account_id: str | None = Query(default=None, alias="subAccountId"),
    search: str = "",
    limit: int = 10,
    offset: int = 0,
    db: Session = Depends(get_tenant_session),
):
    client = _build_client(request, db, org_id)
    try:
        return {
            "data": await client.get_contacts(
                sub_account_id=sub_account_id,
                search=search,
                limit=limit,
                offset=offset,
            )
        }
    except WorkPipeDashboardError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/appointments")
async def get_workpipe_appointments(
    request: Request,
    org_id: str,
    sub_account_id: str | None = Query(default=None, alias="subAccountId"),
    db: Session = Depends(get_tenant_session),
):
    client = _build_client(request, db, org_id)
    try:
        return {"data": await client.get_appointments(sub_account_id=sub_account_id)}
    except WorkPipeDashboardError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/invoices")
async def get_workpipe_invoices(
    request: Request,
    org_id: str,
    sub_account_id: str | None = Query(default=None, alias="subAccountId"),
    db: Session = Depends(get_tenant_session),
):
    client = _build_client(request, db, org_id)
    try:
        return {"data": await client.get_invoices(sub_account_id=sub_account_id)}
    except WorkPipeDashboardError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/funnels")
async def get_workpipe_funnels(
    request: Request,
    org_id: str,
    sub_account_id: str | None = Query(default=None, alias="subAccountId"),
    db: Session = Depends(get_tenant_session),
):
    client = _build_client(request, db, org_id)
    try:
        return {"data": await client.get_funnels(sub_account_id=sub_account_id)}
    except WorkPipeDashboardError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@router.get("/trends")
async def get_workpipe_trends(
    request: Request,
    org_id: str,
    sub_account_id: str | None = Query(default=None, alias="subAccountId"),
    days: int = Query(default=30, ge=1, le=90),
    db: Session = Depends(get_tenant_session),
):
    client = _build_client(request, db, org_id)
    try:
        return {"data": await client.get_trends(sub_account_id=sub_account_id, days=days)}
    except WorkPipeDashboardError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

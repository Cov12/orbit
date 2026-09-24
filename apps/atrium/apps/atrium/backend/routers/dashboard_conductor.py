"""Dashboard D4b Conductor read routes (recent run/activity, read-only).

Consumes the merged Conductor bridge /history verb via services.conductor_bridge so
the cross-ecosystem dashboard can show recent Conductor runs. GET only — this is a
view surface; it never mutates and never surfaces bridge errors as failures
(the service degrades to [] on any transport/host problem).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from ..middleware.deps import require_app_access, require_org_access
from ..middleware.tenant import get_tenant_session
from ..services import conductor_bridge

router = APIRouter(
    prefix="/api/atrium/dashboard/conductor",
    tags=["atrium-dashboard-conductor"],
    # #41: require_app_access first (app entitlement), then require_org_access
    # (bind the requested org_id to the caller's Portal org).
    dependencies=[Depends(require_app_access("CONDUCTOR")), Depends(require_org_access)],
)


@router.get("/history")
async def get_conductor_history(
    org_id: str,
    sub_account_id: str | None = Query(default=None, alias="subAccountId"),
    limit: int = Query(default=20, ge=1, le=50),
    db: Session = Depends(get_tenant_session),
):
    """Recent Conductor runs for the org's company (business scope) or the given
    sub-account. `subAccountId` mirrors the WorkPipe D2 routes' query-param
    convention; `limit` is clamped to [1, 50] here (the bridge host clamps too)."""
    runs = await conductor_bridge.fetch_history(
        db,
        org_id=org_id,
        sub_account_id=sub_account_id,
        limit=limit,
    )
    return {"data": runs}

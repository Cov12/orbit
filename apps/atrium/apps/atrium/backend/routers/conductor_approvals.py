"""
Atrium Conductor Approvals Routes (Approval Inbox)

API endpoints for managing Conductor approvals through the Atrium UI.
Provides fast local queries from the read model and proxies actions to Conductor.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from starlette.requests import Request

from ..middleware.tenant import get_tenant_session
from ..middleware.deps import require_app_access, require_org_access
from ..services.conductor_approvals import ConductorApprovalsService
from ..services.conductor_adapter import ConductorError

router = APIRouter(
    prefix="/api/atrium/conductor-approvals",
    tags=["atrium-conductor-approvals"],
    # #41: require_app_access first (app entitlement), then require_org_access
    # (bind the requested org_id to the caller's Portal org).
    dependencies=[Depends(require_app_access("CONDUCTOR")), Depends(require_org_access)],
)

# Service instance (singleton)
_service: Optional[ConductorApprovalsService] = None


def get_service() -> ConductorApprovalsService:
    """Get or create the Conductor approvals service."""
    global _service
    if _service is None:
        _service = ConductorApprovalsService()
    return _service


class ApprovalDecisionRequest(BaseModel):
    """Request to approve or reject an approval."""
    decision_note: Optional[str] = None


class SyncRequest(BaseModel):
    """Request to sync approvals from Conductor."""
    conductor_company_id: str


# ============================================================================
# List & Query Endpoints
# ============================================================================


@router.get("/")
async def list_approvals(
    org_id: str,
    status: Optional[str] = None,
    approval_type: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_tenant_session),
):
    """
    List Conductor approvals from local read model.

    Filter by status (pending, approved, rejected) and/or type (hire_agent, custom).
    """
    service = get_service()
    approvals = service.list_approvals(
        db,
        org_id=org_id,
        status=status,
        approval_type=approval_type,
        limit=limit,
        offset=offset,
    )

    return {
        "approvals": [
            {
                "id": a.id,
                "type": a.approval_type,
                "status": a.status,
                "payload": a.payload,
                "requested_by_agent_id": a.requested_by_agent_id,
                "requested_by_agent_name": a.requested_by_agent_name,
                "decision_note": a.decision_note,
                "decided_by_user_id": a.decided_by_user_id,
                "decided_at": a.decided_at,
                "created_at": a.conductor_created_at,
                "updated_at": a.conductor_updated_at,
                "synced_at": a.synced_at,
            }
            for a in approvals
        ],
        "total": len(approvals),
    }


@router.get("/stats")
async def approval_stats(
    org_id: str,
    db: Session = Depends(get_tenant_session),
):
    """Get approval statistics for badge display and dashboard."""
    service = get_service()
    return service.get_stats(db, org_id)


@router.get("/pending-count")
async def pending_count(
    org_id: str,
    db: Session = Depends(get_tenant_session),
):
    """Get count of pending approvals (for notification badge)."""
    service = get_service()
    count = service.get_pending_count(db, org_id)
    return {"count": count}


@router.get("/{approval_id}")
async def get_approval(
    approval_id: str,
    org_id: str,
    db: Session = Depends(get_tenant_session),
):
    """Get a specific approval with full details."""
    service = get_service()
    approval = service.get_approval(db, approval_id, org_id)

    if not approval:
        raise HTTPException(status_code=404, detail="Approval not found")

    return {
        "id": approval.id,
        "type": approval.approval_type,
        "status": approval.status,
        "payload": approval.payload,
        "requested_by_agent_id": approval.requested_by_agent_id,
        "requested_by_agent_name": approval.requested_by_agent_name,
        "requested_by_user_id": approval.requested_by_user_id,
        "decision_note": approval.decision_note,
        "decided_by_user_id": approval.decided_by_user_id,
        "decided_at": approval.decided_at,
        "created_at": approval.conductor_created_at,
        "updated_at": approval.conductor_updated_at,
        "synced_at": approval.synced_at,
    }


# ============================================================================
# Action Endpoints
# ============================================================================


@router.post("/{approval_id}/approve")
async def approve_approval(
    approval_id: str,
    org_id: str,
    data: ApprovalDecisionRequest,
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """
    Approve a Conductor approval.

    Proxies to Conductor API and updates local read model.
    """
    user_id = request.state.portal_auth.user_id
    service = get_service()

    try:
        approval = await service.approve(
            db,
            approval_id=approval_id,
            org_id=org_id,
            user_id=user_id,
            decision_note=data.decision_note,
        )

        if not approval:
            raise HTTPException(
                status_code=404,
                detail="Approval not found or already processed",
            )

        return {
            "id": approval.id,
            "status": approval.status,
            "decided_by": user_id,
            "message": "Approval approved successfully",
        }

    except ConductorError as e:
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=str(e),
        )


@router.post("/{approval_id}/reject")
async def reject_approval(
    approval_id: str,
    org_id: str,
    data: ApprovalDecisionRequest,
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """
    Reject a Conductor approval.

    Proxies to Conductor API and updates local read model.
    """
    user_id = request.state.portal_auth.user_id
    service = get_service()

    try:
        approval = await service.reject(
            db,
            approval_id=approval_id,
            org_id=org_id,
            user_id=user_id,
            decision_note=data.decision_note,
        )

        if not approval:
            raise HTTPException(
                status_code=404,
                detail="Approval not found or already processed",
            )

        return {
            "id": approval.id,
            "status": approval.status,
            "decided_by": user_id,
            "message": "Approval rejected successfully",
        }

    except ConductorError as e:
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=str(e),
        )


# ============================================================================
# Sync Endpoints
# ============================================================================


@router.post("/sync")
async def sync_approvals(
    org_id: str,
    data: SyncRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_tenant_session),
):
    """
    Manually trigger a sync of approvals from Conductor.

    This is typically called:
    - On initial page load
    - Periodically in the background
    - When user clicks "refresh"
    """
    service = get_service()

    try:
        stats = await service.sync_approvals(
            db,
            org_id=org_id,
            conductor_company_id=data.conductor_company_id,
        )

        return {
            "success": True,
            "stats": stats,
            "message": f"Synced {stats['created']} new, {stats['updated']} updated",
        }

    except ConductorError as e:
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=f"Sync failed: {e}",
        )

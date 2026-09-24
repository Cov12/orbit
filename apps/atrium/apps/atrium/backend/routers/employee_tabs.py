"""
Atrium Employee Tabs Routes

API endpoints for managing dynamic employee chat tabs.
Provides tab state persistence, conversation history, and Conductor sync.
"""

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import Optional, List
from sqlalchemy.orm import Session

from starlette.requests import Request

from ..middleware.tenant import get_tenant_session
from ..middleware.deps import require_app_access, require_org_access
from ..services.employee_tabs import EmployeeTabsService
from ..services.conductor_adapter import ConductorError

router = APIRouter(
    prefix="/api/atrium/employee-tabs",
    tags=["atrium-employee-tabs"],
    # #41: require_app_access first (app entitlement), then require_org_access
    # (bind the requested org_id to the caller's Portal org).
    dependencies=[Depends(require_app_access("CONDUCTOR")), Depends(require_org_access)],
)

# Service instance (singleton)
_service: Optional[EmployeeTabsService] = None


def get_service() -> EmployeeTabsService:
    """Get or create the employee tabs service."""
    global _service
    if _service is None:
        _service = EmployeeTabsService()
    return _service


# ============================================================================
# Request Models
# ============================================================================


class SyncRequest(BaseModel):
    """Request to sync tabs from Conductor."""
    conductor_company_id: str


class ToggleVisibilityRequest(BaseModel):
    """Request to toggle tab visibility."""
    is_visible: bool


class TogglePinRequest(BaseModel):
    """Request to toggle tab pin state."""
    is_pinned: bool


class UpdateSortOrderRequest(BaseModel):
    """Request to update tab sort order."""
    sort_order: int


class AddMessageRequest(BaseModel):
    """Request to add a message to conversation history."""
    role: str  # 'user' or 'assistant'
    content: str


class ReorderTabsRequest(BaseModel):
    """Request to reorder multiple tabs."""
    tab_ids: List[str]  # Ordered list of tab IDs


# ============================================================================
# List & Query Endpoints
# ============================================================================


@router.get("/")
async def list_tabs(
    request: Request,
    org_id: str,
    visible_only: bool = True,
    db: Session = Depends(get_tenant_session),
):
    """
    List employee tabs for the current user.

    Returns tabs sorted by pinned status and sort order.
    """
    user_id = request.state.portal_auth.user_id
    service = get_service()
    tabs = service.list_tabs(
        db,
        org_id=org_id,
        user_id=user_id,
        visible_only=visible_only,
    )

    return {
        "tabs": [
            {
                "id": t.id,
                "agent_id": t.agent_id,
                "agent_name": t.agent_name,
                "agent_icon": t.agent_icon,
                "department": t.department,
                "is_visible": t.is_visible,
                "is_pinned": t.is_pinned,
                "sort_order": t.sort_order,
                "last_interaction_at": t.last_interaction_at,
                "message_count": len(t.conversation_history or []),
                "created_at": t.created_at,
                "updated_at": t.updated_at,
            }
            for t in tabs
        ],
        "total": len(tabs),
    }


@router.get("/{tab_id}")
async def get_tab(
    tab_id: str,
    org_id: str,
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """Get a specific tab with full conversation history."""
    user_id = request.state.portal_auth.user_id
    service = get_service()
    tab = service.get_tab(db, tab_id, org_id, user_id)

    if not tab:
        raise HTTPException(status_code=404, detail="Tab not found")

    return {
        "id": tab.id,
        "agent_id": tab.agent_id,
        "agent_name": tab.agent_name,
        "agent_icon": tab.agent_icon,
        "department": tab.department,
        "is_visible": tab.is_visible,
        "is_pinned": tab.is_pinned,
        "sort_order": tab.sort_order,
        "conversation_history": tab.conversation_history or [],
        "last_interaction_at": tab.last_interaction_at,
        "created_at": tab.created_at,
        "updated_at": tab.updated_at,
    }


@router.get("/by-agent/{agent_id}")
async def get_tab_by_agent(
    agent_id: str,
    org_id: str,
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """Get a tab by Conductor agent ID."""
    user_id = request.state.portal_auth.user_id
    service = get_service()
    tab = service.get_tab_by_agent(db, agent_id, org_id, user_id)

    if not tab:
        raise HTTPException(status_code=404, detail="Tab not found for this agent")

    return {
        "id": tab.id,
        "agent_id": tab.agent_id,
        "agent_name": tab.agent_name,
        "agent_icon": tab.agent_icon,
        "department": tab.department,
        "is_visible": tab.is_visible,
        "is_pinned": tab.is_pinned,
        "conversation_history": tab.conversation_history or [],
        "last_interaction_at": tab.last_interaction_at,
    }


# ============================================================================
# State Management Endpoints
# ============================================================================


@router.post("/{tab_id}/visibility")
async def toggle_visibility(
    tab_id: str,
    org_id: str,
    data: ToggleVisibilityRequest,
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """Toggle tab visibility (show/hide)."""
    user_id = request.state.portal_auth.user_id
    service = get_service()
    tab = service.toggle_visibility(
        db,
        tab_id=tab_id,
        org_id=org_id,
        user_id=user_id,
        is_visible=data.is_visible,
    )

    if not tab:
        raise HTTPException(status_code=404, detail="Tab not found")

    return {
        "id": tab.id,
        "is_visible": tab.is_visible,
        "message": f"Tab {'shown' if tab.is_visible else 'hidden'}",
    }


@router.post("/{tab_id}/pin")
async def toggle_pin(
    tab_id: str,
    org_id: str,
    data: TogglePinRequest,
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """Toggle tab pin state."""
    user_id = request.state.portal_auth.user_id
    service = get_service()
    tab = service.toggle_pin(
        db,
        tab_id=tab_id,
        org_id=org_id,
        user_id=user_id,
        is_pinned=data.is_pinned,
    )

    if not tab:
        raise HTTPException(status_code=404, detail="Tab not found")

    return {
        "id": tab.id,
        "is_pinned": tab.is_pinned,
        "message": f"Tab {'pinned' if tab.is_pinned else 'unpinned'}",
    }


@router.post("/{tab_id}/sort-order")
async def update_sort_order(
    tab_id: str,
    org_id: str,
    data: UpdateSortOrderRequest,
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """Update tab sort order."""
    user_id = request.state.portal_auth.user_id
    service = get_service()
    tab = service.update_sort_order(
        db,
        tab_id=tab_id,
        org_id=org_id,
        user_id=user_id,
        sort_order=data.sort_order,
    )

    if not tab:
        raise HTTPException(status_code=404, detail="Tab not found")

    return {
        "id": tab.id,
        "sort_order": tab.sort_order,
    }


@router.post("/reorder")
async def reorder_tabs(
    org_id: str,
    data: ReorderTabsRequest,
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """Reorder multiple tabs at once."""
    user_id = request.state.portal_auth.user_id
    service = get_service()

    for index, tab_id in enumerate(data.tab_ids):
        service.update_sort_order(
            db,
            tab_id=tab_id,
            org_id=org_id,
            user_id=user_id,
            sort_order=index,
        )

    return {
        "success": True,
        "message": f"Reordered {len(data.tab_ids)} tabs",
    }


# ============================================================================
# Conversation Endpoints
# ============================================================================


@router.post("/{tab_id}/messages")
async def add_message(
    tab_id: str,
    org_id: str,
    data: AddMessageRequest,
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """Add a message to the tab's conversation history."""
    if data.role not in ("user", "assistant"):
        raise HTTPException(status_code=400, detail="Role must be 'user' or 'assistant'")

    user_id = request.state.portal_auth.user_id
    service = get_service()
    tab = service.add_message(
        db,
        tab_id=tab_id,
        org_id=org_id,
        user_id=user_id,
        role=data.role,
        content=data.content,
    )

    if not tab:
        raise HTTPException(status_code=404, detail="Tab not found")

    return {
        "id": tab.id,
        "message_count": len(tab.conversation_history or []),
        "last_interaction_at": tab.last_interaction_at,
    }


@router.delete("/{tab_id}/messages")
async def clear_history(
    tab_id: str,
    org_id: str,
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """Clear conversation history for a tab."""
    user_id = request.state.portal_auth.user_id
    service = get_service()
    tab = service.clear_history(
        db,
        tab_id=tab_id,
        org_id=org_id,
        user_id=user_id,
    )

    if not tab:
        raise HTTPException(status_code=404, detail="Tab not found")

    return {
        "id": tab.id,
        "message": "Conversation history cleared",
    }


# ============================================================================
# Sync Endpoints
# ============================================================================


@router.post("/sync")
async def sync_tabs(
    org_id: str,
    data: SyncRequest,
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """
    Sync employee tabs from Conductor agents.

    Creates tabs for new agents, updates existing ones.
    Does not delete tabs (preserves conversation history).
    """
    user_id = request.state.portal_auth.user_id
    service = get_service()

    try:
        stats = await service.sync_tabs(
            db,
            org_id=org_id,
            user_id=user_id,
            conductor_company_id=data.conductor_company_id,
        )

        return {
            "success": True,
            "stats": stats,
            "message": f"Synced {stats['created']} new tabs, {stats['updated']} updated",
        }

    except ConductorError as e:
        raise HTTPException(
            status_code=e.status_code or 500,
            detail=f"Sync failed: {e}",
        )

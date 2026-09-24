"""
Atrium Proposal Routes (Approval Inbox)

The heart of Delegated Mode — manage action proposals.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from starlette.requests import Request

from ..middleware.tenant import get_tenant_session
from ..middleware.deps import require_org_access
from ..services.proposals import ProposalsService
from ..services.proposal_executor import ProposalExecutor

router = APIRouter(
    prefix="/api/atrium/proposals",
    tags=["atrium-proposals"],
    dependencies=[Depends(require_org_access)],  # #41: bind org_id to caller's Portal org
)


class CreateProposalRequest(BaseModel):
    department_id: str
    title: str
    description: str
    action_type: str
    action_payload: dict = {}
    risk_level: str = "low"
    risk_reasoning: str = ""
    chat_id: Optional[str] = None


class ReviewProposalRequest(BaseModel):
    status: str  # "approved" or "rejected"
    review_note: str = ""


@router.get("/")
async def list_proposals(
    org_id: str,
    status: Optional[str] = None,
    department_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: Session = Depends(get_tenant_session),
):
    """List proposals (approval inbox). Filter by status and/or department."""
    proposals = ProposalsService.list_proposals(
        db, org_id=org_id, status=status,
        department_id=department_id, limit=limit, offset=offset,
    )
    return {
        "proposals": [
            {
                "id": p.id,
                "title": p.title,
                "description": p.description,
                "action_type": p.action_type,
                "risk_level": p.risk_level,
                "status": p.status,
                "department_id": p.department_id,
                "created_by_ai": p.created_by_ai,
                "reviewed_by": p.reviewed_by,
                "created_at": p.created_at,
            }
            for p in proposals
        ],
        "total": len(proposals),
    }


@router.get("/stats")
async def proposal_stats(
    org_id: str,
    db: Session = Depends(get_tenant_session),
):
    """Get proposal statistics for the org."""
    return ProposalsService.get_stats(db, org_id)


@router.get("/{proposal_id}")
async def get_proposal(
    proposal_id: str,
    org_id: str,
    db: Session = Depends(get_tenant_session),
):
    """Get a specific proposal."""
    proposal = ProposalsService.get_proposal(db, proposal_id, org_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return {
        "id": proposal.id,
        "title": proposal.title,
        "description": proposal.description,
        "action_type": proposal.action_type,
        "action_payload": proposal.action_payload,
        "risk_level": proposal.risk_level,
        "risk_reasoning": proposal.risk_reasoning,
        "status": proposal.status,
        "department_id": proposal.department_id,
        "chat_id": proposal.chat_id,
        "created_by_ai": proposal.created_by_ai,
        "reviewed_by": proposal.reviewed_by,
        "review_note": proposal.review_note,
        "execution_result": proposal.execution_result,
        "created_at": proposal.created_at,
        "updated_at": proposal.updated_at,
    }


@router.post("/")
async def create_proposal(
    org_id: str,
    data: CreateProposalRequest,
    db: Session = Depends(get_tenant_session),
):
    """Create a new action proposal (called by AI during chat)."""
    proposal = ProposalsService.create_proposal(
        db, org_id=org_id,
        department_id=data.department_id,
        title=data.title,
        description=data.description,
        action_type=data.action_type,
        action_payload=data.action_payload,
        risk_level=data.risk_level,
        risk_reasoning=data.risk_reasoning,
        chat_id=data.chat_id,
    )
    return {"id": proposal.id, "title": proposal.title, "status": proposal.status}


@router.post("/{proposal_id}/review")
async def review_proposal(
    proposal_id: str,
    org_id: str,
    data: ReviewProposalRequest,
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """Approve or reject a proposal."""
    if data.status not in ("approved", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be 'approved' or 'rejected'")

    proposal = ProposalsService.review_proposal(
        db, proposal_id=proposal_id, org_id=org_id,
        reviewed_by=getattr(request.state, "user_id", "unknown"),
        status=data.status,
        review_note=data.review_note,
    )
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found or not pending")

    return {"id": proposal.id, "status": proposal.status}


class ExecuteProposalRequest(BaseModel):
    """Optional overrides for execution."""
    pass


@router.post("/{proposal_id}/execute")
async def execute_proposal(
    proposal_id: str,
    org_id: str,
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """
    Execute an approved proposal against the CRM backend.

    Call this after approving a proposal. The executor maps action_type
    to CRM adapter calls (create contact, move deal, etc.).
    """
    proposal = ProposalsService.get_proposal(db, proposal_id, org_id)
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    if proposal.status != "approved":
        raise HTTPException(
            status_code=400,
            detail=f"Proposal is '{proposal.status}', must be 'approved' to execute",
        )

    # Get auth token from request (Portal JWT or OpenWebUI token)
    auth_header = request.headers.get("Authorization", "")
    auth_token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else ""

    executor = ProposalExecutor()
    result = await executor.execute(
        db=db,
        proposal=proposal,
        auth_token=auth_token,
        executed_by=getattr(request.state, "user_id", "unknown"),
    )

    if not result["success"]:
        raise HTTPException(status_code=500, detail=result["error"])

    return {
        "id": proposal_id,
        "status": "executed",
        "action_type": result["action_type"],
        "result": result["result"],
    }

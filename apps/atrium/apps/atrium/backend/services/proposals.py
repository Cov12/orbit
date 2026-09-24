"""
Atrium Proposals CRUD Service (Approval Inbox)
"""

import time
import logging
from typing import Optional

from sqlalchemy.orm import Session

from ..models.db import (
    AtriumProposal,
    AtriumAuditLog,
    generate_id,
    now_ms,
)

log = logging.getLogger("atrium.services.proposals")


class ProposalsService:
    """CRUD operations for action proposals (delegated mode)."""

    @staticmethod
    def create_proposal(
        db: Session,
        org_id: str,
        department_id: str,
        title: str,
        description: str,
        action_type: str,
        action_payload: dict = None,
        risk_level: str = "low",
        risk_reasoning: str = "",
        created_by_ai: str = "",
        chat_id: Optional[str] = None,
        expires_at: Optional[int] = None,
    ) -> AtriumProposal:
        proposal = AtriumProposal(
            id=generate_id(),
            org_id=org_id,
            department_id=department_id,
            chat_id=chat_id,
            title=title,
            description=description,
            action_type=action_type,
            action_payload=action_payload or {},
            risk_level=risk_level,
            risk_reasoning=risk_reasoning,
            created_by_ai=created_by_ai,
            expires_at=expires_at,
            created_at=now_ms(),
            updated_at=now_ms(),
        )
        db.add(proposal)

        # Audit log
        audit = AtriumAuditLog(
            id=generate_id(),
            org_id=org_id,
            event_type="proposal_created",
            actor_id=created_by_ai,
            actor_type="ai",
            department_id=department_id,
            proposal_id=proposal.id,
            details={"title": title, "action_type": action_type, "risk_level": risk_level},
            created_at=now_ms(),
        )
        db.add(audit)

        db.commit()
        db.refresh(proposal)
        log.info(f"Proposal created: {title} (risk: {risk_level})")
        return proposal

    @staticmethod
    def get_proposal(db: Session, proposal_id: str, org_id: str) -> Optional[AtriumProposal]:
        return db.query(AtriumProposal).filter_by(id=proposal_id, org_id=org_id).first()

    @staticmethod
    def list_proposals(
        db: Session,
        org_id: str,
        status: Optional[str] = None,
        department_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[AtriumProposal]:
        query = db.query(AtriumProposal).filter_by(org_id=org_id)
        if status:
            query = query.filter_by(status=status)
        if department_id:
            query = query.filter_by(department_id=department_id)
        return query.order_by(AtriumProposal.created_at.desc()).offset(offset).limit(limit).all()

    @staticmethod
    def review_proposal(
        db: Session,
        proposal_id: str,
        org_id: str,
        reviewed_by: str,
        status: str,  # "approved" or "rejected"
        review_note: str = "",
    ) -> Optional[AtriumProposal]:
        proposal = db.query(AtriumProposal).filter_by(id=proposal_id, org_id=org_id).first()
        if not proposal:
            return None
        if proposal.status != "pending":
            log.warning(f"Proposal {proposal_id} is already {proposal.status}")
            return None

        proposal.status = status
        proposal.reviewed_by = reviewed_by
        proposal.review_note = review_note
        proposal.updated_at = now_ms()

        # Audit log
        audit = AtriumAuditLog(
            id=generate_id(),
            org_id=org_id,
            event_type=f"proposal_{status}",
            actor_id=reviewed_by,
            actor_type="user",
            department_id=proposal.department_id,
            proposal_id=proposal_id,
            details={"review_note": review_note},
            created_at=now_ms(),
        )
        db.add(audit)

        db.commit()
        db.refresh(proposal)
        log.info(f"Proposal {proposal_id} {status} by {reviewed_by}")
        return proposal

    @staticmethod
    def mark_executed(
        db: Session,
        proposal_id: str,
        org_id: str,
        execution_result: dict = None,
    ) -> Optional[AtriumProposal]:
        proposal = db.query(AtriumProposal).filter_by(id=proposal_id, org_id=org_id).first()
        if not proposal or proposal.status != "approved":
            return None

        proposal.status = "executed"
        proposal.executed_at = now_ms()
        proposal.execution_result = execution_result or {}
        proposal.updated_at = now_ms()

        # Audit log
        audit = AtriumAuditLog(
            id=generate_id(),
            org_id=org_id,
            event_type="action_executed",
            actor_id="system",
            actor_type="ai",
            department_id=proposal.department_id,
            proposal_id=proposal_id,
            details={"result": execution_result},
            created_at=now_ms(),
        )
        db.add(audit)

        db.commit()
        db.refresh(proposal)
        log.info(f"Proposal {proposal_id} executed")
        return proposal

    @staticmethod
    def get_stats(db: Session, org_id: str) -> dict:
        proposals = db.query(AtriumProposal).filter_by(org_id=org_id).all()
        return {
            "total": len(proposals),
            "pending": sum(1 for p in proposals if p.status == "pending"),
            "approved": sum(1 for p in proposals if p.status == "approved"),
            "rejected": sum(1 for p in proposals if p.status == "rejected"),
            "executed": sum(1 for p in proposals if p.status == "executed"),
            "failed": sum(1 for p in proposals if p.status == "failed"),
        }

"""
Atrium Proposal Executor

Executes approved proposals by mapping action_type to CRM adapter calls.
This is the bridge between the approval inbox and actual CRM operations.

Flow:
1. User approves proposal in UI → review_proposal(status="approved")
2. Frontend calls /execute endpoint → ProposalExecutor.execute()
3. Executor maps action_type → CRM adapter method
4. On success: mark_executed with result
5. On failure: mark_failed with error details
"""

import logging
from typing import Any, Optional

from sqlalchemy.orm import Session

from ..models.db import AtriumProposal, generate_id, now_ms, AtriumAuditLog
from .crm_adapter import CRMAdapter, CRMAdapterError, get_crm_adapter

logger = logging.getLogger("atrium.proposal_executor")


# ── Action Type Registry ───────────────────────────────────────────────────

ACTION_TYPES = {
    # Contact operations
    "create_contact",
    "update_contact",
    # Ticket/deal operations
    "create_ticket",
    "update_ticket",
    "move_ticket",
    "create_deal",      # alias for create_ticket in sales pipeline
    "move_deal",        # alias for move_ticket
    # Communication
    "send_email",
    "send_follow_up",
    # Pipeline
    "update_pipeline",
    # Composite
    "create_contact_and_deal",
}


class ProposalExecutor:
    """
    Executes approved proposals against the CRM backend.
    """

    def __init__(self, crm_adapter: Optional[CRMAdapter] = None):
        self._crm = crm_adapter

    def _get_crm(self, auth_token: str) -> CRMAdapter:
        """Get or create CRM adapter with the given auth token."""
        if self._crm:
            return self._crm
        return get_crm_adapter(auth_token=auth_token)

    async def execute(
        self,
        db: Session,
        proposal: AtriumProposal,
        auth_token: str,
        executed_by: str = "system",
    ) -> dict[str, Any]:
        """
        Execute an approved proposal.

        Returns:
            Dict with 'success', 'result' or 'error', and 'action_type'
        """
        if proposal.status != "approved":
            return {
                "success": False,
                "error": f"Proposal is {proposal.status}, not approved",
                "action_type": proposal.action_type,
            }

        action_type = proposal.action_type
        payload = proposal.action_payload or {}

        logger.info(
            "Executing proposal %s: %s (%s)",
            proposal.id, proposal.title, action_type,
        )

        try:
            crm = self._get_crm(auth_token)
            result = await self._dispatch(crm, action_type, payload)

            # Mark as executed
            proposal.status = "executed"
            proposal.executed_at = now_ms()
            proposal.execution_result = result
            proposal.updated_at = now_ms()

            # Audit log
            db.add(AtriumAuditLog(
                id=generate_id(),
                org_id=proposal.org_id,
                event_type="action_executed",
                actor_id=executed_by,
                actor_type="system",
                department_id=proposal.department_id,
                proposal_id=proposal.id,
                details={"action_type": action_type, "result": result},
                created_at=now_ms(),
            ))
            db.commit()

            logger.info("Proposal %s executed successfully", proposal.id)
            return {"success": True, "result": result, "action_type": action_type}

        except CRMAdapterError as e:
            return await self._mark_failed(db, proposal, str(e), executed_by)
        except Exception as e:
            logger.exception("Unexpected error executing proposal %s", proposal.id)
            return await self._mark_failed(db, proposal, f"Internal error: {e}", executed_by)

    async def _mark_failed(
        self, db: Session, proposal: AtriumProposal, error: str, executed_by: str
    ) -> dict:
        """Mark a proposal as failed with error details."""
        proposal.status = "failed"
        proposal.execution_result = {"error": error}
        proposal.updated_at = now_ms()

        db.add(AtriumAuditLog(
            id=generate_id(),
            org_id=proposal.org_id,
            event_type="action_failed",
            actor_id=executed_by,
            actor_type="system",
            department_id=proposal.department_id,
            proposal_id=proposal.id,
            details={"error": error},
            created_at=now_ms(),
        ))
        db.commit()

        logger.error("Proposal %s failed: %s", proposal.id, error)
        return {"success": False, "error": error, "action_type": proposal.action_type}

    async def _dispatch(
        self, crm: CRMAdapter, action_type: str, payload: dict
    ) -> dict[str, Any]:
        """Map action_type to CRM adapter call and execute."""

        # ── Contact Operations ─────────────────────────────────────────

        if action_type == "create_contact":
            contact = await crm.create_contact(
                sub_account_id=payload["sub_account_id"],
                name=payload["name"],
                email=payload.get("email", ""),
                phone=payload.get("phone", ""),
                company_name=payload.get("company_name", ""),
            )
            return {"contact_id": contact.id, "name": contact.name}

        if action_type == "update_contact":
            fields = {k: v for k, v in payload.items() if k != "contact_id"}
            contact = await crm.update_contact(payload["contact_id"], **fields)
            return {"contact_id": contact.id, "updated_fields": list(fields.keys())}

        # ── Ticket/Deal Operations ─────────────────────────────────────

        if action_type in ("create_ticket", "create_deal"):
            ticket = await crm.create_ticket(
                lane_id=payload["lane_id"],
                name=payload["name"],
                description=payload.get("description", ""),
                value=float(payload.get("value", 0)),
                customer_id=payload.get("customer_id", ""),
                assigned_user_id=payload.get("assigned_user_id", ""),
                tags=payload.get("tags"),
            )
            return {"ticket_id": ticket.id, "name": ticket.name, "lane_id": ticket.lane_id}

        if action_type == "update_ticket":
            fields = {k: v for k, v in payload.items() if k != "ticket_id"}
            ticket = await crm.update_ticket(payload["ticket_id"], **fields)
            return {"ticket_id": ticket.id, "updated_fields": list(fields.keys())}

        if action_type in ("move_ticket", "move_deal"):
            ticket = await crm.move_ticket(
                ticket_id=payload["ticket_id"],
                target_lane_id=payload["target_lane_id"],
            )
            return {"ticket_id": ticket.id, "new_lane_id": ticket.lane_id}

        # ── Communication ──────────────────────────────────────────────

        if action_type in ("send_email", "send_follow_up"):
            # Email execution is deferred — we store the intent and
            # the notification system handles delivery
            return {
                "status": "queued",
                "to": payload.get("to", ""),
                "subject": payload.get("subject", ""),
                "note": "Email delivery is handled by the notification pipeline",
            }

        # ── Composite Operations ───────────────────────────────────────

        if action_type == "create_contact_and_deal":
            # Create contact first, then create deal linked to that contact
            contact = await crm.create_contact(
                sub_account_id=payload["sub_account_id"],
                name=payload["contact_name"],
                email=payload.get("contact_email", ""),
                phone=payload.get("contact_phone", ""),
                company_name=payload.get("company_name", ""),
            )
            ticket = await crm.create_ticket(
                lane_id=payload["lane_id"],
                name=payload["deal_name"],
                description=payload.get("description", ""),
                value=float(payload.get("value", 0)),
                customer_id=contact.id,
                tags=payload.get("tags"),
            )
            return {
                "contact_id": contact.id,
                "ticket_id": ticket.id,
                "contact_name": contact.name,
                "deal_name": ticket.name,
            }

        # ── Unknown ────────────────────────────────────────────────────

        raise ValueError(f"Unknown action_type: {action_type}")

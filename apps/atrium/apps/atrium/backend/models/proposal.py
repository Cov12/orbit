"""
Atrium Action Proposal Models

Core of Delegated Mode — every AI action becomes a proposal that requires human approval.
Flow: AI generates proposal → Approval Inbox → Human approves/rejects → Execute → Log
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
import uuid


class ProposalStatus(str, Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXECUTED = "executed"
    FAILED = "failed"
    EXPIRED = "expired"


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class ActionProposal(BaseModel):
    """An AI-generated action that requires human approval before execution."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    org_id: str
    department_id: str
    chat_id: Optional[str] = None  # OpenWebUI conversation that triggered this

    # What the AI wants to do
    title: str  # e.g., "Send follow-up email to John Smith"
    description: str  # Detailed explanation of the proposed action
    action_type: str  # e.g., "send_email", "update_contact", "create_task"
    action_payload: dict = Field(default_factory=dict)  # Structured action data

    # Risk assessment
    risk_level: RiskLevel = RiskLevel.LOW
    risk_reasoning: str = ""

    # Status tracking
    status: ProposalStatus = ProposalStatus.PENDING
    created_by_ai: str = ""  # Which AI model/dept generated this
    reviewed_by: Optional[str] = None  # User ID of approver/rejector
    review_note: str = ""
    executed_at: Optional[datetime] = None
    execution_result: Optional[dict] = None

    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None  # Auto-expire stale proposals


class ProposalCreate(BaseModel):
    """Schema for AI to create a proposal."""

    department_id: str
    chat_id: Optional[str] = None
    title: str
    description: str
    action_type: str
    action_payload: dict = Field(default_factory=dict)
    risk_level: RiskLevel = RiskLevel.LOW
    risk_reasoning: str = ""


class ProposalReview(BaseModel):
    """Schema for human to approve/reject a proposal."""

    status: ProposalStatus  # approved or rejected
    review_note: str = ""

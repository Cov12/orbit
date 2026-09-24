"""
Conductor API Contract Types

Pydantic models for Atrium ↔ Conductor communication.
Defines request/response payloads for agent management, approvals, and runs.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Optional
from pydantic import BaseModel, Field


# ============================================================================
# Enums
# ============================================================================


class AgentStatus(str, Enum):
    """Agent lifecycle status."""

    PENDING_APPROVAL = "pending_approval"
    ACTIVE = "active"
    PAUSED = "paused"
    TERMINATED = "terminated"


class ApprovalStatus(str, Enum):
    """Approval request status."""

    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    REVISION_REQUESTED = "revision_requested"


class ApprovalType(str, Enum):
    """Types of approval requests."""

    HIRE_AGENT = "hire_agent"
    CUSTOM = "custom"


class RunStatus(str, Enum):
    """Heartbeat run status."""

    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


# ============================================================================
# Agent Models
# ============================================================================


class AgentSummary(BaseModel):
    """Lightweight agent representation for lists."""

    id: str
    name: str
    title: str
    role: str
    status: AgentStatus
    adapter_type: str = Field(alias="adapterType")
    icon: Optional[str] = None
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    class Config:
        populate_by_name = True


class AgentDetail(AgentSummary):
    """Full agent representation with configuration."""

    company_id: str = Field(alias="companyId")
    description: Optional[str] = None
    manager_id: Optional[str] = Field(None, alias="managerId")
    runtime_config: dict[str, Any] = Field(default_factory=dict, alias="runtimeConfig")
    adapter_config: dict[str, Any] = Field(default_factory=dict, alias="adapterConfig")
    permissions: dict[str, Any] = Field(default_factory=dict)


class CreateAgentHireRequest(BaseModel):
    """Request to create a new agent via hire approval."""

    name: str
    title: str
    role: str = "employee"
    adapter_type: str = Field(alias="adapterType")
    description: Optional[str] = None
    manager_id: Optional[str] = Field(None, alias="managerId")
    icon: Optional[str] = None
    runtime_config: dict[str, Any] = Field(default_factory=dict, alias="runtimeConfig")
    adapter_config: dict[str, Any] = Field(default_factory=dict, alias="adapterConfig")

    class Config:
        populate_by_name = True


class AgentHireResponse(BaseModel):
    """Response from creating an agent hire request."""

    approval_id: str = Field(alias="approvalId")
    approval_status: ApprovalStatus = Field(alias="approvalStatus")
    agent_id: Optional[str] = Field(None, alias="agentId")
    message: str

    class Config:
        populate_by_name = True


# ============================================================================
# Approval Models
# ============================================================================


class ApprovalSummary(BaseModel):
    """Lightweight approval representation for lists."""

    id: str
    type: ApprovalType
    status: ApprovalStatus
    company_id: str = Field(alias="companyId")
    requested_by_agent_id: Optional[str] = Field(None, alias="requestedByAgentId")
    requested_by_user_id: Optional[str] = Field(None, alias="requestedByUserId")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    class Config:
        populate_by_name = True


class ApprovalDetail(ApprovalSummary):
    """Full approval with payload and decision info."""

    payload: dict[str, Any] = Field(default_factory=dict)
    decision_note: Optional[str] = Field(None, alias="decisionNote")
    decided_by_user_id: Optional[str] = Field(None, alias="decidedByUserId")
    decided_at: Optional[datetime] = Field(None, alias="decidedAt")


class CreateApprovalRequest(BaseModel):
    """Request to create a new approval."""

    type: ApprovalType
    payload: dict[str, Any] = Field(default_factory=dict)
    requested_by_agent_id: Optional[str] = Field(None, alias="requestedByAgentId")
    issue_ids: list[str] = Field(default_factory=list, alias="issueIds")

    class Config:
        populate_by_name = True


class ResolveApprovalRequest(BaseModel):
    """Request to approve or reject an approval."""

    decision_note: Optional[str] = Field(None, alias="decisionNote")

    class Config:
        populate_by_name = True


# ============================================================================
# Run/Heartbeat Models
# ============================================================================


class RunSummary(BaseModel):
    """Lightweight run representation."""

    id: str
    agent_id: str = Field(alias="agentId")
    status: RunStatus
    trigger_detail: Optional[str] = Field(None, alias="triggerDetail")
    created_at: datetime = Field(alias="createdAt")
    completed_at: Optional[datetime] = Field(None, alias="completedAt")

    class Config:
        populate_by_name = True


class RunDetail(RunSummary):
    """Full run with logs and context."""

    reason: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)
    context_snapshot: dict[str, Any] = Field(default_factory=dict, alias="contextSnapshot")
    log_excerpt: Optional[str] = Field(None, alias="logExcerpt")


class WakeAgentRequest(BaseModel):
    """Request to wake up an agent."""

    reason: str
    payload: dict[str, Any] = Field(default_factory=dict)
    trigger_detail: str = Field("api", alias="triggerDetail")

    class Config:
        populate_by_name = True


class WakeAgentResponse(BaseModel):
    """Response from waking an agent."""

    run_id: str = Field(alias="runId")
    status: RunStatus
    message: str

    class Config:
        populate_by_name = True


# ============================================================================
# Atrium-specific Integration Types
# ============================================================================


class ConductorRouteRequest(BaseModel):
    """Request to route a message through Conductor."""

    message: str
    department: str
    conversation_history: list[dict[str, str]] = Field(
        default_factory=list, alias="conversationHistory"
    )
    context: dict[str, Any] = Field(default_factory=dict)
    org_id: str = Field(alias="orgId")
    user_id: Optional[str] = Field(None, alias="userId")
    sync: bool = True  # True for CONDUCTOR_SYNC, False for CONDUCTOR_ASYNC

    class Config:
        populate_by_name = True


class ConductorRouteResponse(BaseModel):
    """Response from Conductor routing."""

    content: Optional[str] = None
    run_id: Optional[str] = Field(None, alias="runId")
    status: str
    agent_id: Optional[str] = Field(None, alias="agentId")
    agent_name: Optional[str] = Field(None, alias="agentName")
    needs_approval: bool = Field(False, alias="needsApproval")
    approval_id: Optional[str] = Field(None, alias="approvalId")

    class Config:
        populate_by_name = True


class ApprovalSyncEvent(BaseModel):
    """Event for syncing approvals to Atrium read model."""

    approval_id: str = Field(alias="approvalId")
    company_id: str = Field(alias="companyId")
    type: ApprovalType
    status: ApprovalStatus
    payload: dict[str, Any] = Field(default_factory=dict)
    requested_by_agent_id: Optional[str] = Field(None, alias="requestedByAgentId")
    requested_by_agent_name: Optional[str] = Field(None, alias="requestedByAgentName")
    created_at: datetime = Field(alias="createdAt")
    updated_at: datetime = Field(alias="updatedAt")

    class Config:
        populate_by_name = True


class EmployeeTabState(BaseModel):
    """State for a dynamic employee chat tab."""

    agent_id: str = Field(alias="agentId")
    agent_name: str = Field(alias="agentName")
    agent_icon: Optional[str] = Field(None, alias="agentIcon")
    department: str
    status: AgentStatus
    is_visible: bool = Field(True, alias="isVisible")
    has_pending_approval: bool = Field(False, alias="hasPendingApproval")
    last_interaction_at: Optional[datetime] = Field(None, alias="lastInteractionAt")
    conversation_history: list[dict[str, str]] = Field(
        default_factory=list, alias="conversationHistory"
    )

    class Config:
        populate_by_name = True

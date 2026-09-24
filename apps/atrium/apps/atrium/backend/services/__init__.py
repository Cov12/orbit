# Atrium Services
from .orchestrator import Orchestrator
from .proposal_executor import ProposalExecutor
from .crm_adapter import CRMAdapter, WorkPipeAdapter, get_crm_adapter
from .conductor_adapter import ConductorAdapter, ConductorConfig, ConductorError, get_conductor_adapter
from .conductor_types import (
    AgentStatus,
    AgentSummary,
    AgentDetail,
    ApprovalStatus,
    ApprovalType,
    ApprovalSummary,
    ApprovalDetail,
    ApprovalSyncEvent,
    RunStatus,
    RunSummary,
    RunDetail,
    ConductorRouteRequest,
    ConductorRouteResponse,
    EmployeeTabState,
)
from .conductor_approvals import ConductorApprovalsService
from .employee_tabs import EmployeeTabsService

__all__ = [
    "Orchestrator",
    "ProposalExecutor",
    "CRMAdapter",
    "WorkPipeAdapter",
    "get_crm_adapter",
    # Conductor integration
    "ConductorAdapter",
    "ConductorConfig",
    "ConductorError",
    "get_conductor_adapter",
    "AgentStatus",
    "AgentSummary",
    "AgentDetail",
    "ApprovalStatus",
    "ApprovalType",
    "ApprovalSummary",
    "ApprovalDetail",
    "ApprovalSyncEvent",
    "RunStatus",
    "RunSummary",
    "RunDetail",
    "ConductorRouteRequest",
    "ConductorRouteResponse",
    "EmployeeTabState",
    "ConductorApprovalsService",
    "EmployeeTabsService",
]

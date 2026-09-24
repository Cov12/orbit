"""
Atrium Conductor Adapter

Gateway adapter for communicating with the Conductor API.
Handles service-to-service authentication, request routing, and polling for async results.

Flow:
1. Authentication: Uses service-to-service credentials (API key + secret)
2. Request routing: Routes CONDUCTOR_SYNC and CONDUCTOR_ASYNC lane requests
3. Polling: For async requests, polls run status until completion
4. Approval sync: Fetches and syncs approvals to local read model
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Optional

import httpx

from apps.atrium.backend.services.conductor_types import (
    AgentDetail,
    AgentStatus,
    AgentSummary,
    ApprovalDetail,
    ApprovalStatus,
    ApprovalSummary,
    ApprovalSyncEvent,
    ApprovalType,
    ConductorRouteRequest,
    ConductorRouteResponse,
    CreateAgentHireRequest,
    AgentHireResponse,
    CreateApprovalRequest,
    EmployeeTabState,
    ResolveApprovalRequest,
    RunDetail,
    RunStatus,
    RunSummary,
    WakeAgentRequest,
    WakeAgentResponse,
)

logger = logging.getLogger("atrium.conductor_adapter")


@dataclass(slots=True)
class ConductorConfig:
    """Configuration for Conductor API connection."""

    base_url: str = field(default_factory=lambda: os.environ.get("CONDUCTOR_BASE_URL", "http://localhost:4000"))
    api_key: str = field(default_factory=lambda: os.environ.get("CONDUCTOR_API_KEY", ""))
    api_secret: str = field(default_factory=lambda: os.environ.get("CONDUCTOR_API_SECRET", ""))
    timeout_seconds: float = 30.0
    poll_interval_seconds: float = 2.0
    max_poll_attempts: int = 30


class ConductorError(Exception):
    """Base exception for Conductor API errors."""

    def __init__(self, message: str, status_code: Optional[int] = None, details: Optional[dict] = None):
        super().__init__(message)
        self.status_code = status_code
        self.details = details or {}


class ConductorAdapter:
    """
    Gateway adapter for Conductor API communication.

    Handles:
    - Agent management (list, get, hire, pause, resume)
    - Approval management (list, get, approve, reject)
    - Run management (wakeup, status, polling)
    - Approval sync to local read model
    """

    def __init__(self, config: Optional[ConductorConfig] = None) -> None:
        """Initialize adapter with configuration."""
        self.config = config or ConductorConfig()
        self._http_client: Optional[httpx.AsyncClient] = None
        logger.info(
            "ConductorAdapter initialized",
            extra={"base_url": self.config.base_url},
        )

    @property
    def http_client(self) -> httpx.AsyncClient:
        """Lazy-initialize HTTP client."""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(
                base_url=self.config.base_url,
                timeout=self.config.timeout_seconds,
                headers=self._auth_headers(),
            )
        return self._http_client

    def _auth_headers(self) -> dict[str, str]:
        """Build authentication headers for service-to-service auth."""
        headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        if self.config.api_key:
            headers["X-API-Key"] = self.config.api_key
        if self.config.api_secret:
            headers["Authorization"] = f"Bearer {self.config.api_secret}"
        return headers

    async def _request(
        self,
        method: str,
        path: str,
        data: Optional[dict] = None,
        params: Optional[dict] = None,
    ) -> dict[str, Any]:
        """Make an authenticated request to Conductor API."""
        try:
            response = await self.http_client.request(
                method=method,
                url=path,
                json=data,
                params=params,
            )
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            error_body = {}
            try:
                error_body = e.response.json()
            except Exception:
                pass
            raise ConductorError(
                message=error_body.get("error", str(e)),
                status_code=e.response.status_code,
                details=error_body,
            )
        except httpx.RequestError as e:
            raise ConductorError(message=f"Request failed: {e}")

    # ========================================================================
    # Agent Operations
    # ========================================================================

    async def list_agents(self, company_id: str) -> list[AgentSummary]:
        """List all agents for a company."""
        data = await self._request("GET", f"/api/companies/{company_id}/agents")
        return [AgentSummary.model_validate(agent) for agent in data]

    async def get_agent(self, agent_id: str) -> AgentDetail:
        """Get detailed agent information."""
        data = await self._request("GET", f"/api/agents/{agent_id}")
        return AgentDetail.model_validate(data)

    async def hire_agent(
        self,
        company_id: str,
        request: CreateAgentHireRequest,
    ) -> AgentHireResponse:
        """
        Create an agent hire request.

        This creates an approval request that must be approved before
        the agent is actually created.
        """
        data = await self._request(
            "POST",
            f"/api/companies/{company_id}/agent-hires",
            data=request.model_dump(by_alias=True, exclude_none=True),
        )
        return AgentHireResponse.model_validate(data)

    async def pause_agent(self, agent_id: str) -> AgentDetail:
        """Pause an agent."""
        data = await self._request("POST", f"/api/agents/{agent_id}/pause")
        return AgentDetail.model_validate(data)

    async def resume_agent(self, agent_id: str) -> AgentDetail:
        """Resume a paused agent."""
        data = await self._request("POST", f"/api/agents/{agent_id}/resume")
        return AgentDetail.model_validate(data)

    async def wakeup_agent(
        self,
        agent_id: str,
        request: WakeAgentRequest,
    ) -> WakeAgentResponse:
        """Wake up an agent to process a request."""
        data = await self._request(
            "POST",
            f"/api/agents/{agent_id}/wakeup",
            data=request.model_dump(by_alias=True, exclude_none=True),
        )
        return WakeAgentResponse.model_validate(data)

    # ========================================================================
    # Approval Operations
    # ========================================================================

    async def list_approvals(
        self,
        company_id: str,
        status: Optional[str] = None,
    ) -> list[ApprovalSummary]:
        """List approvals for a company."""
        params = {}
        if status:
            params["status"] = status
        data = await self._request(
            "GET",
            f"/api/companies/{company_id}/approvals",
            params=params,
        )
        return [ApprovalSummary.model_validate(approval) for approval in data]

    async def get_approval(self, approval_id: str) -> ApprovalDetail:
        """Get detailed approval information."""
        data = await self._request("GET", f"/api/approvals/{approval_id}")
        return ApprovalDetail.model_validate(data)

    async def approve_approval(
        self,
        approval_id: str,
        decision_note: Optional[str] = None,
    ) -> ApprovalDetail:
        """Approve an approval request."""
        request = ResolveApprovalRequest(decision_note=decision_note)
        data = await self._request(
            "POST",
            f"/api/approvals/{approval_id}/approve",
            data=request.model_dump(by_alias=True, exclude_none=True),
        )
        return ApprovalDetail.model_validate(data)

    async def reject_approval(
        self,
        approval_id: str,
        decision_note: Optional[str] = None,
    ) -> ApprovalDetail:
        """Reject an approval request."""
        request = ResolveApprovalRequest(decision_note=decision_note)
        data = await self._request(
            "POST",
            f"/api/approvals/{approval_id}/reject",
            data=request.model_dump(by_alias=True, exclude_none=True),
        )
        return ApprovalDetail.model_validate(data)

    # ========================================================================
    # Run Operations
    # ========================================================================

    async def get_run(self, run_id: str) -> RunDetail:
        """Get run status and details."""
        data = await self._request("GET", f"/api/heartbeat-runs/{run_id}")
        return RunDetail.model_validate(data)

    async def poll_run_completion(
        self,
        run_id: str,
        timeout_seconds: Optional[float] = None,
    ) -> RunDetail:
        """
        Poll a run until completion or timeout.

        Args:
            run_id: The run to poll
            timeout_seconds: Maximum time to wait (default from config)

        Returns:
            Final run state

        Raises:
            ConductorError: If polling times out or run fails
        """
        timeout = timeout_seconds or (
            self.config.poll_interval_seconds * self.config.max_poll_attempts
        )
        start_time = time.time()
        attempts = 0

        while True:
            run = await self.get_run(run_id)

            if run.status == RunStatus.COMPLETED:
                logger.info(f"Run {run_id} completed after {attempts} polls")
                return run

            if run.status == RunStatus.FAILED:
                raise ConductorError(
                    message=f"Run {run_id} failed",
                    details={"run": run.model_dump()},
                )

            if run.status == RunStatus.CANCELLED:
                raise ConductorError(
                    message=f"Run {run_id} was cancelled",
                    details={"run": run.model_dump()},
                )

            elapsed = time.time() - start_time
            if elapsed >= timeout:
                raise ConductorError(
                    message=f"Run {run_id} polling timed out after {elapsed:.1f}s",
                    details={"run": run.model_dump(), "attempts": attempts},
                )

            attempts += 1
            await asyncio.sleep(self.config.poll_interval_seconds)

    # ========================================================================
    # Routing Operations
    # ========================================================================

    async def route_sync(
        self,
        request: ConductorRouteRequest,
    ) -> ConductorRouteResponse:
        """
        Route a request synchronously through Conductor.

        For CONDUCTOR_SYNC lane: wakes an agent and waits for response.
        """
        # Find appropriate agent for department
        agents = await self.list_agents(request.org_id)
        active_agents = [
            a for a in agents
            if a.status == AgentStatus.ACTIVE
        ]

        if not active_agents:
            return ConductorRouteResponse(
                content=None,
                status="no_active_agents",
                needs_approval=False,
            )

        # For now, pick first active agent (future: smart routing)
        agent = active_agents[0]

        # Wake the agent
        wake_request = WakeAgentRequest(
            reason="atrium_route_sync",
            payload={
                "message": request.message,
                "department": request.department,
                "conversation_history": request.conversation_history,
                "context": request.context,
                "user_id": request.user_id,
            },
            trigger_detail="atrium",
        )

        try:
            wake_response = await self.wakeup_agent(agent.id, wake_request)

            # Poll for completion
            run = await self.poll_run_completion(
                wake_response.run_id,
                timeout_seconds=self.config.timeout_seconds,
            )

            return ConductorRouteResponse(
                content=run.log_excerpt,
                run_id=run.id,
                status="completed",
                agent_id=agent.id,
                agent_name=agent.name,
                needs_approval=False,
            )

        except ConductorError as e:
            logger.warning(f"Sync routing failed: {e}")
            return ConductorRouteResponse(
                content=None,
                status="error",
                agent_id=agent.id,
                agent_name=agent.name,
                needs_approval=False,
            )

    async def route_async(
        self,
        request: ConductorRouteRequest,
    ) -> ConductorRouteResponse:
        """
        Route a request asynchronously through Conductor.

        For CONDUCTOR_ASYNC lane: wakes an agent and returns immediately.
        Caller should poll for results using get_run().
        """
        # Find appropriate agent for department
        agents = await self.list_agents(request.org_id)
        active_agents = [
            a for a in agents
            if a.status == AgentStatus.ACTIVE
        ]

        if not active_agents:
            return ConductorRouteResponse(
                content=None,
                status="no_active_agents",
                needs_approval=False,
            )

        agent = active_agents[0]

        # Wake the agent (don't wait for completion)
        wake_request = WakeAgentRequest(
            reason="atrium_route_async",
            payload={
                "message": request.message,
                "department": request.department,
                "conversation_history": request.conversation_history,
                "context": request.context,
                "user_id": request.user_id,
            },
            trigger_detail="atrium",
        )

        wake_response = await self.wakeup_agent(agent.id, wake_request)

        return ConductorRouteResponse(
            content=None,
            run_id=wake_response.run_id,
            status="running",
            agent_id=agent.id,
            agent_name=agent.name,
            needs_approval=False,
        )

    # ========================================================================
    # Approval Sync Operations
    # ========================================================================

    async def sync_approvals(
        self,
        company_id: str,
        since: Optional[str] = None,
    ) -> list[ApprovalSyncEvent]:
        """
        Fetch approvals for syncing to Atrium read model.

        Args:
            company_id: The company to sync approvals for
            since: Optional ISO timestamp to fetch approvals updated after

        Returns:
            List of approval sync events to mirror locally
        """
        approvals = await self.list_approvals(company_id)
        events: list[ApprovalSyncEvent] = []

        for approval in approvals:
            # Get full details for each approval
            detail = await self.get_approval(approval.id)

            # Build agent name from payload if hire_agent
            agent_name = None
            if detail.type == ApprovalType.HIRE_AGENT:
                agent_name = detail.payload.get("name")

            events.append(
                ApprovalSyncEvent(
                    approval_id=detail.id,
                    company_id=detail.company_id,
                    type=detail.type,
                    status=detail.status,
                    payload=detail.payload,
                    requested_by_agent_id=detail.requested_by_agent_id,
                    requested_by_agent_name=agent_name,
                    created_at=detail.created_at,
                    updated_at=detail.updated_at,
                )
            )

        return events

    async def get_employee_tabs(
        self,
        company_id: str,
    ) -> list[EmployeeTabState]:
        """
        Get employee tab states for dynamic UI.

        Returns active and pending-approval agents as tab states.
        """
        agents = await self.list_agents(company_id)
        approvals = await self.list_approvals(company_id, status="pending")

        # Build pending approval lookup
        pending_agent_ids = set()
        for approval in approvals:
            if approval.type == ApprovalType.HIRE_AGENT:
                if approval.requested_by_agent_id:
                    pending_agent_ids.add(approval.requested_by_agent_id)

        tabs: list[EmployeeTabState] = []
        for agent in agents:
            if agent.status in (AgentStatus.ACTIVE, AgentStatus.PENDING_APPROVAL):
                tabs.append(
                    EmployeeTabState(
                        agent_id=agent.id,
                        agent_name=agent.name,
                        agent_icon=agent.icon,
                        department=agent.role,  # Map role to department
                        status=agent.status,
                        is_visible=True,
                        has_pending_approval=agent.id in pending_agent_ids,
                        last_interaction_at=agent.updated_at,
                        conversation_history=[],  # Load from local state
                    )
                )

        return tabs

    # ========================================================================
    # Cleanup
    # ========================================================================

    async def close(self) -> None:
        """Close HTTP client."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None


# Module-level singleton (lazy-initialized)
_conductor_adapter: Optional[ConductorAdapter] = None


def get_conductor_adapter() -> ConductorAdapter:
    """Get or create the Conductor adapter singleton."""
    global _conductor_adapter
    if _conductor_adapter is None:
        _conductor_adapter = ConductorAdapter()
    return _conductor_adapter

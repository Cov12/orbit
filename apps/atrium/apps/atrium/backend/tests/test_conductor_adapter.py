"""Unit tests for Conductor adapter and types."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from apps.atrium.backend.services.conductor_adapter import (
    ConductorAdapter,
    ConductorConfig,
    ConductorError,
)
from apps.atrium.backend.services.conductor_types import (
    AgentStatus,
    AgentSummary,
    ApprovalStatus,
    ApprovalType,
    ConductorRouteRequest,
    CreateAgentHireRequest,
    RunStatus,
    WakeAgentRequest,
)


@pytest.fixture
def mock_http_client():
    """Create a mock HTTP client."""
    client = AsyncMock()
    client.request = AsyncMock()
    return client


@pytest.fixture
def adapter_with_mock(mock_http_client):
    """Create an adapter with mocked HTTP client."""
    config = ConductorConfig(
        base_url="http://test.conductor.local",
        api_key="test-key",
        api_secret="test-secret",
        timeout_seconds=5.0,
        poll_interval_seconds=0.1,
        max_poll_attempts=3,
    )
    adapter = ConductorAdapter(config)
    adapter._http_client = mock_http_client
    return adapter


class TestConductorConfig:
    def test_default_values(self):
        """Config should have sensible defaults."""
        config = ConductorConfig()
        assert config.timeout_seconds == 30.0
        assert config.poll_interval_seconds == 2.0
        assert config.max_poll_attempts == 30

    def test_custom_values(self):
        """Config should accept custom values."""
        config = ConductorConfig(
            base_url="http://custom.host",
            api_key="my-key",
            timeout_seconds=60.0,
        )
        assert config.base_url == "http://custom.host"
        assert config.api_key == "my-key"
        assert config.timeout_seconds == 60.0


class TestConductorAdapterAgents:
    @pytest.mark.asyncio
    async def test_list_agents_success(self, adapter_with_mock, mock_http_client):
        """Should list agents from company."""
        mock_response = MagicMock()
        mock_response.json.return_value = [
            {
                "id": "agent-1",
                "name": "Sales Bot",
                "title": "Sales Representative",
                "role": "employee",
                "status": "active",
                "adapterType": "claude_local",
                "createdAt": "2024-01-01T00:00:00Z",
                "updatedAt": "2024-01-01T00:00:00Z",
            }
        ]
        mock_response.raise_for_status = MagicMock()
        mock_http_client.request.return_value = mock_response

        agents = await adapter_with_mock.list_agents("company-123")

        assert len(agents) == 1
        assert agents[0].id == "agent-1"
        assert agents[0].name == "Sales Bot"
        assert agents[0].status == AgentStatus.ACTIVE
        mock_http_client.request.assert_called_once_with(
            method="GET",
            url="/api/companies/company-123/agents",
            json=None,
            params=None,
        )

    @pytest.mark.asyncio
    async def test_hire_agent_creates_approval(self, adapter_with_mock, mock_http_client):
        """Should create hire approval request."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "approvalId": "approval-1",
            "approvalStatus": "pending",
            "agentId": None,
            "message": "Hire request submitted for approval",
        }
        mock_response.raise_for_status = MagicMock()
        mock_http_client.request.return_value = mock_response

        request = CreateAgentHireRequest(
            name="New Agent",
            title="Support Rep",
            role="employee",
            adapter_type="claude_local",
        )
        response = await adapter_with_mock.hire_agent("company-123", request)

        assert response.approval_id == "approval-1"
        assert response.approval_status == ApprovalStatus.PENDING
        assert response.agent_id is None

    @pytest.mark.asyncio
    async def test_wakeup_agent_returns_run_id(self, adapter_with_mock, mock_http_client):
        """Should wake agent and return run ID."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "runId": "run-123",
            "status": "queued",
            "message": "Agent wakeup queued",
        }
        mock_response.raise_for_status = MagicMock()
        mock_http_client.request.return_value = mock_response

        request = WakeAgentRequest(
            reason="test_wakeup",
            payload={"message": "Hello"},
        )
        response = await adapter_with_mock.wakeup_agent("agent-1", request)

        assert response.run_id == "run-123"
        assert response.status == RunStatus.QUEUED


class TestConductorAdapterApprovals:
    @pytest.mark.asyncio
    async def test_list_approvals_with_status_filter(self, adapter_with_mock, mock_http_client):
        """Should list approvals with status filter."""
        mock_response = MagicMock()
        mock_response.json.return_value = [
            {
                "id": "approval-1",
                "type": "hire_agent",
                "status": "pending",
                "companyId": "company-123",
                "createdAt": "2024-01-01T00:00:00Z",
                "updatedAt": "2024-01-01T00:00:00Z",
            }
        ]
        mock_response.raise_for_status = MagicMock()
        mock_http_client.request.return_value = mock_response

        approvals = await adapter_with_mock.list_approvals("company-123", status="pending")

        assert len(approvals) == 1
        assert approvals[0].type == ApprovalType.HIRE_AGENT
        assert approvals[0].status == ApprovalStatus.PENDING
        mock_http_client.request.assert_called_once_with(
            method="GET",
            url="/api/companies/company-123/approvals",
            json=None,
            params={"status": "pending"},
        )

    @pytest.mark.asyncio
    async def test_approve_approval_success(self, adapter_with_mock, mock_http_client):
        """Should approve an approval."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "id": "approval-1",
            "type": "hire_agent",
            "status": "approved",
            "companyId": "company-123",
            "payload": {},
            "decisionNote": "Looks good",
            "decidedByUserId": "user-1",
            "decidedAt": "2024-01-02T00:00:00Z",
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-02T00:00:00Z",
        }
        mock_response.raise_for_status = MagicMock()
        mock_http_client.request.return_value = mock_response

        approval = await adapter_with_mock.approve_approval("approval-1", "Looks good")

        assert approval.status == ApprovalStatus.APPROVED
        assert approval.decision_note == "Looks good"


class TestConductorAdapterPolling:
    @pytest.mark.asyncio
    async def test_poll_completes_on_success(self, adapter_with_mock, mock_http_client):
        """Should poll until run completes."""
        # First call: running, second call: completed
        responses = [
            {
                "id": "run-1",
                "agentId": "agent-1",
                "status": "running",
                "createdAt": "2024-01-01T00:00:00Z",
            },
            {
                "id": "run-1",
                "agentId": "agent-1",
                "status": "completed",
                "createdAt": "2024-01-01T00:00:00Z",
                "completedAt": "2024-01-01T00:01:00Z",
                "logExcerpt": "Task completed successfully",
            },
        ]
        call_count = 0

        def mock_request(*args, **kwargs):
            nonlocal call_count
            response = MagicMock()
            response.json.return_value = responses[min(call_count, len(responses) - 1)]
            response.raise_for_status = MagicMock()
            call_count += 1
            return response

        mock_http_client.request.side_effect = mock_request

        run = await adapter_with_mock.poll_run_completion("run-1", timeout_seconds=1.0)

        assert run.status == RunStatus.COMPLETED
        assert run.log_excerpt == "Task completed successfully"
        assert call_count == 2

    @pytest.mark.asyncio
    async def test_poll_raises_on_failure(self, adapter_with_mock, mock_http_client):
        """Should raise error when run fails."""
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "id": "run-1",
            "agentId": "agent-1",
            "status": "failed",
            "createdAt": "2024-01-01T00:00:00Z",
        }
        mock_response.raise_for_status = MagicMock()
        mock_http_client.request.return_value = mock_response

        with pytest.raises(ConductorError) as exc_info:
            await adapter_with_mock.poll_run_completion("run-1")

        assert "failed" in str(exc_info.value).lower()


class TestConductorAdapterRouting:
    @pytest.mark.asyncio
    async def test_route_sync_returns_response(self, adapter_with_mock, mock_http_client):
        """Should route sync and return response."""
        # Mock list_agents
        agents_response = MagicMock()
        agents_response.json.return_value = [
            {
                "id": "agent-1",
                "name": "Sales Bot",
                "title": "Sales Rep",
                "role": "employee",
                "status": "active",
                "adapterType": "claude_local",
                "createdAt": "2024-01-01T00:00:00Z",
                "updatedAt": "2024-01-01T00:00:00Z",
            }
        ]
        agents_response.raise_for_status = MagicMock()

        # Mock wakeup
        wakeup_response = MagicMock()
        wakeup_response.json.return_value = {
            "runId": "run-1",
            "status": "queued",
            "message": "Queued",
        }
        wakeup_response.raise_for_status = MagicMock()

        # Mock poll (completed)
        run_response = MagicMock()
        run_response.json.return_value = {
            "id": "run-1",
            "agentId": "agent-1",
            "status": "completed",
            "createdAt": "2024-01-01T00:00:00Z",
            "completedAt": "2024-01-01T00:01:00Z",
            "logExcerpt": "Hello! How can I help?",
        }
        run_response.raise_for_status = MagicMock()

        mock_http_client.request.side_effect = [
            agents_response,
            wakeup_response,
            run_response,
        ]

        request = ConductorRouteRequest(
            message="Hello",
            department="sales",
            org_id="org-123",
        )
        response = await adapter_with_mock.route_sync(request)

        assert response.status == "completed"
        assert response.agent_id == "agent-1"
        assert response.content == "Hello! How can I help?"

    @pytest.mark.asyncio
    async def test_route_async_returns_run_id(self, adapter_with_mock, mock_http_client):
        """Should route async and return run ID without waiting."""
        # Mock list_agents
        agents_response = MagicMock()
        agents_response.json.return_value = [
            {
                "id": "agent-1",
                "name": "Sales Bot",
                "title": "Sales Rep",
                "role": "employee",
                "status": "active",
                "adapterType": "claude_local",
                "createdAt": "2024-01-01T00:00:00Z",
                "updatedAt": "2024-01-01T00:00:00Z",
            }
        ]
        agents_response.raise_for_status = MagicMock()

        # Mock wakeup
        wakeup_response = MagicMock()
        wakeup_response.json.return_value = {
            "runId": "run-1",
            "status": "queued",
            "message": "Queued",
        }
        wakeup_response.raise_for_status = MagicMock()

        mock_http_client.request.side_effect = [agents_response, wakeup_response]

        request = ConductorRouteRequest(
            message="Do a complex analysis",
            department="operations",
            org_id="org-123",
            sync=False,
        )
        response = await adapter_with_mock.route_async(request)

        assert response.status == "running"
        assert response.run_id == "run-1"
        assert response.content is None  # Not waiting for completion


class TestConductorTypes:
    def test_agent_summary_from_api(self):
        """Should parse agent summary from API response."""
        data = {
            "id": "agent-1",
            "name": "Test Agent",
            "title": "Tester",
            "role": "employee",
            "status": "active",
            "adapterType": "claude_local",
            "icon": "robot",
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z",
        }
        summary = AgentSummary.model_validate(data)

        assert summary.id == "agent-1"
        assert summary.status == AgentStatus.ACTIVE
        assert summary.adapter_type == "claude_local"
        assert summary.icon == "robot"

    def test_route_request_serialization(self):
        """Should serialize route request with aliases."""
        request = ConductorRouteRequest(
            message="Hello",
            department="sales",
            org_id="org-123",
            user_id="user-456",
        )
        data = request.model_dump(by_alias=True)

        assert data["orgId"] == "org-123"
        assert data["userId"] == "user-456"
        assert data["conversationHistory"] == []

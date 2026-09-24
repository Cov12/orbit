"""
E2E Tests for Agent Hire Flow

Tests the complete flow:
1. User requests hire (via Conductor)
2. Approval synced to Atrium
3. User approves in approval inbox
4. Agent becomes active in Conductor
5. Employee tab created on next sync

This tests integration between:
- ConductorApprovalsService
- EmployeeTabsService
- ConductorAdapter
"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from apps.atrium.backend.services.conductor_adapter import ConductorAdapter, ConductorConfig
from apps.atrium.backend.services.conductor_approvals import ConductorApprovalsService
from apps.atrium.backend.services.employee_tabs import EmployeeTabsService
from apps.atrium.backend.services.conductor_types import (
    AgentStatus,
    AgentSummary,
    ApprovalStatus,
    ApprovalType,
    ApprovalDetail,
    ApprovalSyncEvent,
)
from apps.atrium.backend.models.db import (
    AtriumConductorApproval,
    AtriumEmployeeTab,
    generate_id,
    now_ms,
)


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def mock_db_session():
    """Create a mock database session with query/add/commit support."""
    session = MagicMock()

    # Storage for in-memory DB
    _approvals = {}
    _tabs = {}

    class MockQuery:
        def __init__(self, model):
            self.model = model
            self._filters = {}

        def filter_by(self, **kwargs):
            self._filters = kwargs
            return self

        def first(self):
            if self.model == AtriumConductorApproval:
                return _approvals.get(self._filters.get("id"))
            if self.model == AtriumEmployeeTab:
                agent_id = self._filters.get("agent_id")
                for tab in _tabs.values():
                    if tab.agent_id == agent_id:
                        return tab
                return _tabs.get(self._filters.get("id"))
            return None

        def all(self):
            if self.model == AtriumConductorApproval:
                return list(_approvals.values())
            if self.model == AtriumEmployeeTab:
                return list(_tabs.values())
            return []

        def order_by(self, *args):
            return self

        def offset(self, n):
            return self

        def limit(self, n):
            return self

        def count(self):
            if self.model == AtriumConductorApproval:
                return len([a for a in _approvals.values() if a.status == self._filters.get("status")])
            return 0

    def mock_query(model):
        return MockQuery(model)

    def mock_add(obj):
        if isinstance(obj, AtriumConductorApproval):
            _approvals[obj.id] = obj
        elif isinstance(obj, AtriumEmployeeTab):
            _tabs[obj.id] = obj

    session.query.side_effect = mock_query
    session.add.side_effect = mock_add
    session.commit = MagicMock()
    session.refresh = MagicMock()

    # Expose storage for assertions
    session._approvals = _approvals
    session._tabs = _tabs

    return session


@pytest.fixture
def mock_conductor_adapter():
    """Create a mock Conductor adapter with controlled responses."""
    adapter = AsyncMock(spec=ConductorAdapter)
    return adapter


@pytest.fixture
def approvals_service(mock_conductor_adapter):
    """Create an approvals service with mock adapter."""
    service = ConductorApprovalsService(conductor_adapter=mock_conductor_adapter)
    return service


@pytest.fixture
def tabs_service(mock_conductor_adapter):
    """Create a tabs service with mock adapter."""
    service = EmployeeTabsService(conductor_adapter=mock_conductor_adapter)
    return service


# ============================================================================
# E2E Hire Flow Tests
# ============================================================================


class TestHireFlowE2E:
    """Test the complete agent hire approval flow."""

    @pytest.mark.asyncio
    async def test_hire_flow_happy_path(
        self,
        mock_db_session,
        mock_conductor_adapter,
        approvals_service,
        tabs_service,
    ):
        """
        Test complete hire flow:
        1. Sync pending hire approval
        2. Approve the hire
        3. Sync tabs to get new agent
        """
        org_id = "org-123"
        user_id = "user-456"
        company_id = "company-789"
        approval_id = "approval-hire-001"
        agent_id = "agent-new-001"

        # Step 1: Conductor has a pending hire approval
        hire_approval_event = ApprovalSyncEvent(
            approval_id=approval_id,
            company_id=company_id,
            type=ApprovalType.HIRE_AGENT,
            status=ApprovalStatus.PENDING,
            payload={
                "name": "Sales Bot",
                "title": "Sales Representative",
                "role": "employee",
                "adapterType": "claude_local",
            },
            requested_by_agent_id="ceo-agent",
            requested_by_agent_name="CEO",
            created_at=datetime(2024, 1, 1, 12, 0, 0),
            updated_at=datetime(2024, 1, 1, 12, 0, 0),
        )
        mock_conductor_adapter.sync_approvals.return_value = [hire_approval_event]

        # Sync approvals
        sync_stats = await approvals_service.sync_approvals(
            mock_db_session, org_id, company_id
        )

        assert sync_stats["created"] == 1
        assert sync_stats["errors"] == 0
        assert len(mock_db_session._approvals) == 1

        # Verify approval was synced
        synced_approval = mock_db_session._approvals[approval_id]
        assert synced_approval.status == "pending"
        assert synced_approval.approval_type == "hire_agent"

        # Step 2: User approves the hire
        approved_approval = ApprovalDetail(
            id=approval_id,
            type=ApprovalType.HIRE_AGENT,
            status=ApprovalStatus.APPROVED,
            company_id=company_id,
            payload=hire_approval_event.payload,
            decision_note="Looks great, approved!",
            decided_by_user_id=user_id,
            decided_at=datetime(2024, 1, 2, 12, 0, 0),
            created_at=datetime(2024, 1, 1, 12, 0, 0),
            updated_at=datetime(2024, 1, 2, 12, 0, 0),
        )
        mock_conductor_adapter.approve_approval.return_value = approved_approval

        approved = await approvals_service.approve(
            mock_db_session,
            approval_id=approval_id,
            org_id=org_id,
            user_id=user_id,
            decision_note="Looks great, approved!",
        )

        assert approved is not None
        assert approved.status == "approved"
        assert approved.decided_by_user_id == user_id
        mock_conductor_adapter.approve_approval.assert_called_once_with(
            approval_id, "Looks great, approved!"
        )

        # Step 3: Agent is now active in Conductor - sync tabs
        new_agent = AgentSummary(
            id=agent_id,
            name="Sales Bot",
            title="Sales Representative",
            role="employee",
            status=AgentStatus.ACTIVE,
            adapter_type="claude_local",
            icon="robot",
            created_at=datetime(2024, 1, 2, 12, 0, 0),
            updated_at=datetime(2024, 1, 2, 12, 0, 0),
        )
        mock_conductor_adapter.list_agents.return_value = [new_agent]

        tab_stats = await tabs_service.sync_tabs(
            mock_db_session,
            org_id=org_id,
            user_id=user_id,
            conductor_company_id=company_id,
        )

        assert tab_stats["created"] == 1
        assert tab_stats["errors"] == 0
        assert len(mock_db_session._tabs) == 1

        # Verify tab was created for the new agent
        created_tab = list(mock_db_session._tabs.values())[0]
        assert created_tab.agent_id == agent_id
        assert created_tab.agent_name == "Sales Bot"
        assert created_tab.department == "employee"
        assert created_tab.is_visible is True
        assert created_tab.is_pinned is False

    @pytest.mark.asyncio
    async def test_hire_rejected_no_tab_created(
        self,
        mock_db_session,
        mock_conductor_adapter,
        approvals_service,
        tabs_service,
    ):
        """Test that rejecting a hire doesn't create a tab."""
        org_id = "org-123"
        user_id = "user-456"
        company_id = "company-789"
        approval_id = "approval-hire-002"

        # Sync pending approval
        hire_approval = ApprovalSyncEvent(
            approval_id=approval_id,
            company_id=company_id,
            type=ApprovalType.HIRE_AGENT,
            status=ApprovalStatus.PENDING,
            payload={"name": "Bad Bot", "role": "employee"},
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1),
        )
        mock_conductor_adapter.sync_approvals.return_value = [hire_approval]

        await approvals_service.sync_approvals(mock_db_session, org_id, company_id)

        # Reject the hire
        rejected_approval = ApprovalDetail(
            id=approval_id,
            type=ApprovalType.HIRE_AGENT,
            status=ApprovalStatus.REJECTED,
            company_id=company_id,
            payload=hire_approval.payload,
            decision_note="Not needed right now",
            decided_by_user_id=user_id,
            decided_at=datetime(2024, 1, 2),
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 2),
        )
        mock_conductor_adapter.reject_approval.return_value = rejected_approval

        rejected = await approvals_service.reject(
            mock_db_session,
            approval_id=approval_id,
            org_id=org_id,
            user_id=user_id,
            decision_note="Not needed right now",
        )

        assert rejected.status == "rejected"

        # Sync tabs - no active agents
        mock_conductor_adapter.list_agents.return_value = []

        tab_stats = await tabs_service.sync_tabs(
            mock_db_session,
            org_id=org_id,
            user_id=user_id,
            conductor_company_id=company_id,
        )

        assert tab_stats["created"] == 0
        assert len(mock_db_session._tabs) == 0

    @pytest.mark.asyncio
    async def test_existing_agent_tab_updated_on_sync(
        self,
        mock_db_session,
        mock_conductor_adapter,
        tabs_service,
    ):
        """Test that existing tabs are updated when agent info changes."""
        org_id = "org-123"
        user_id = "user-456"
        company_id = "company-789"
        agent_id = "agent-001"

        # Create existing tab
        existing_tab = AtriumEmployeeTab(
            id="tab-001",
            org_id=org_id,
            user_id=user_id,
            agent_id=agent_id,
            agent_name="Old Name",
            agent_icon="old_icon",
            department="employee",
            is_visible=True,
            is_pinned=True,
            sort_order=0,
            conversation_history=[{"role": "user", "content": "Hello"}],
            created_at=now_ms(),
            updated_at=now_ms(),
        )
        mock_db_session._tabs["tab-001"] = existing_tab

        # Agent has updated info
        updated_agent = AgentSummary(
            id=agent_id,
            name="New Name",
            title="Updated Title",
            role="manager",
            status=AgentStatus.ACTIVE,
            adapter_type="claude_local",
            icon="new_icon",
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 2),
        )
        mock_conductor_adapter.list_agents.return_value = [updated_agent]

        stats = await tabs_service.sync_tabs(
            mock_db_session,
            org_id=org_id,
            user_id=user_id,
            conductor_company_id=company_id,
        )

        assert stats["updated"] == 1
        assert stats["created"] == 0

        # Tab should be updated with new info
        tab = mock_db_session._tabs["tab-001"]
        assert tab.agent_name == "New Name"
        assert tab.agent_icon == "new_icon"
        assert tab.department == "manager"
        # Preserved user preferences
        assert tab.is_pinned is True
        # Preserved conversation history
        assert len(tab.conversation_history) == 1

    @pytest.mark.asyncio
    async def test_multiple_pending_approvals_sync(
        self,
        mock_db_session,
        mock_conductor_adapter,
        approvals_service,
    ):
        """Test syncing multiple pending approvals."""
        org_id = "org-123"
        company_id = "company-789"

        approvals = [
            ApprovalSyncEvent(
                approval_id=f"approval-{i}",
                company_id=company_id,
                type=ApprovalType.HIRE_AGENT,
                status=ApprovalStatus.PENDING,
                payload={"name": f"Agent {i}"},
                created_at=datetime(2024, 1, i + 1),
                updated_at=datetime(2024, 1, i + 1),
            )
            for i in range(5)
        ]
        mock_conductor_adapter.sync_approvals.return_value = approvals

        stats = await approvals_service.sync_approvals(mock_db_session, org_id, company_id)

        assert stats["created"] == 5
        assert len(mock_db_session._approvals) == 5

    @pytest.mark.asyncio
    async def test_conductor_error_during_approval_sync(
        self,
        mock_db_session,
        mock_conductor_adapter,
        approvals_service,
    ):
        """Test handling of Conductor errors during sync."""
        from apps.atrium.backend.services.conductor_adapter import ConductorError

        org_id = "org-123"
        company_id = "company-789"

        mock_conductor_adapter.sync_approvals.side_effect = ConductorError("Connection failed")

        stats = await approvals_service.sync_approvals(mock_db_session, org_id, company_id)

        assert stats["errors"] == 1
        assert stats["created"] == 0
        assert len(mock_db_session._approvals) == 0

    @pytest.mark.asyncio
    async def test_conductor_error_during_tab_sync(
        self,
        mock_db_session,
        mock_conductor_adapter,
        tabs_service,
    ):
        """Test handling of Conductor errors during tab sync."""
        from apps.atrium.backend.services.conductor_adapter import ConductorError

        org_id = "org-123"
        user_id = "user-456"
        company_id = "company-789"

        mock_conductor_adapter.list_agents.side_effect = ConductorError("API unavailable")

        stats = await tabs_service.sync_tabs(
            mock_db_session,
            org_id=org_id,
            user_id=user_id,
            conductor_company_id=company_id,
        )

        assert stats["errors"] == 1
        assert stats["created"] == 0


class TestApprovalLifecycle:
    """Test approval state transitions."""

    @pytest.mark.asyncio
    async def test_cannot_approve_already_approved(
        self,
        mock_db_session,
        mock_conductor_adapter,
        approvals_service,
    ):
        """Test that approving an already approved item returns None."""
        org_id = "org-123"
        approval_id = "approval-001"

        # Create already approved item
        approved = AtriumConductorApproval(
            id=approval_id,
            org_id=org_id,
            conductor_company_id="company-123",
            approval_type="hire_agent",
            status="approved",
            payload={},
            conductor_created_at=now_ms(),
            conductor_updated_at=now_ms(),
            synced_at=now_ms(),
        )
        mock_db_session._approvals[approval_id] = approved

        result = await approvals_service.approve(
            mock_db_session,
            approval_id=approval_id,
            org_id=org_id,
            user_id="user-456",
        )

        assert result is None
        mock_conductor_adapter.approve_approval.assert_not_called()

    @pytest.mark.asyncio
    async def test_cannot_reject_already_rejected(
        self,
        mock_db_session,
        mock_conductor_adapter,
        approvals_service,
    ):
        """Test that rejecting an already rejected item returns None."""
        org_id = "org-123"
        approval_id = "approval-001"

        # Create already rejected item
        rejected = AtriumConductorApproval(
            id=approval_id,
            org_id=org_id,
            conductor_company_id="company-123",
            approval_type="hire_agent",
            status="rejected",
            payload={},
            conductor_created_at=now_ms(),
            conductor_updated_at=now_ms(),
            synced_at=now_ms(),
        )
        mock_db_session._approvals[approval_id] = rejected

        result = await approvals_service.reject(
            mock_db_session,
            approval_id=approval_id,
            org_id=org_id,
            user_id="user-456",
        )

        assert result is None
        mock_conductor_adapter.reject_approval.assert_not_called()


class TestTabConversationPersistence:
    """Test conversation history persistence across syncs."""

    @pytest.mark.asyncio
    async def test_conversation_history_preserved_on_sync(
        self,
        mock_db_session,
        mock_conductor_adapter,
        tabs_service,
    ):
        """Test that conversation history is not lost during sync."""
        org_id = "org-123"
        user_id = "user-456"
        company_id = "company-789"
        agent_id = "agent-001"

        # Tab with conversation history
        tab = AtriumEmployeeTab(
            id="tab-001",
            org_id=org_id,
            user_id=user_id,
            agent_id=agent_id,
            agent_name="Sales Bot",
            department="employee",
            is_visible=True,
            is_pinned=False,
            sort_order=0,
            conversation_history=[
                {"role": "user", "content": "Hello"},
                {"role": "assistant", "content": "Hi! How can I help?"},
                {"role": "user", "content": "I need sales data"},
            ],
            last_interaction_at=now_ms(),
            created_at=now_ms(),
            updated_at=now_ms(),
        )
        mock_db_session._tabs["tab-001"] = tab

        # Agent unchanged
        agent = AgentSummary(
            id=agent_id,
            name="Sales Bot",
            title="Sales Rep",
            role="employee",
            status=AgentStatus.ACTIVE,
            adapter_type="claude_local",
            created_at=datetime(2024, 1, 1),
            updated_at=datetime(2024, 1, 1),
        )
        mock_conductor_adapter.list_agents.return_value = [agent]

        await tabs_service.sync_tabs(
            mock_db_session,
            org_id=org_id,
            user_id=user_id,
            conductor_company_id=company_id,
        )

        # Verify history preserved
        synced_tab = mock_db_session._tabs["tab-001"]
        assert len(synced_tab.conversation_history) == 3
        assert synced_tab.conversation_history[2]["content"] == "I need sales data"

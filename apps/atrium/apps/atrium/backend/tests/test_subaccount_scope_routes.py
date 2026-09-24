import pytest
from fastapi import FastAPI, Request
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool
from sqlalchemy.orm import sessionmaker

from open_webui.internal.db import Base
from apps.atrium.backend.middleware.tenant import get_tenant_session
from apps.atrium.backend.models.db import AtriumDepartment, AtriumOrganization, AtriumSubAccount, now_ms
from apps.atrium.backend.routers import departments, organizations


TEST_ORG_ID = "org-test-1"
TEST_SUB_ID = "clsubacctscope0001"
TEST_INACTIVE_SUB_ID = "clsubacctscope0002"


class _StubOrchestrator:
    def __init__(self):
        self.calls = []

    async def route_message(self, **kwargs):
        self.calls.append(kwargs)
        return {
            "status": "ok",
            "department": kwargs.get("department_slug") or "chief",
            "model_tier": "mid",
            "model": "stub/test",
            "content": "ok",
            "proposals": [],
            "usage": {},
        }


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        session.add(
            AtriumOrganization(
                id=TEST_ORG_ID,
                name="Acme",
                slug="acme",
                plan="starter",
                portal_org_id="portal-org-1",
            )
        )
        session.add(
            AtriumDepartment(
                id="dept-sales-1",
                org_id=TEST_ORG_ID,
                slug="sales",
                name="Sales",
                description="",
                model_tier="mid",
                capabilities=[],
                workpipe_modules=[],
                system_prompt="",
                is_active=True,
                created_at=now_ms(),
                updated_at=now_ms(),
            )
        )
        session.add_all(
            [
                AtriumSubAccount(
                    id=TEST_SUB_ID,
                    org_id=TEST_ORG_ID,
                    portal_org_id="portal-org-1",
                    name="Northwind",
                    slug="northwind",
                    status="ACTIVE",
                    created_at=1,
                    updated_at=1,
                    synced_at=1,
                ),
                AtriumSubAccount(
                    id=TEST_INACTIVE_SUB_ID,
                    org_id=TEST_ORG_ID,
                    portal_org_id="portal-org-1",
                    name="Paused",
                    slug="paused",
                    status="paused",
                    created_at=2,
                    updated_at=2,
                    synced_at=2,
                ),
            ]
        )
        session.commit()
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def app(db_session):
    # #41: these routes carry require_org_access. This suite drives the legacy Portal-JWT
    # identity path by injecting a portal_auth context whose org_id matches the seeded
    # org's portal_org_id, so the org-binding dep authorizes the caller (owner, all apps)
    # via real enforcement instead of a dev flag.
    from apps.atrium.backend.middleware.jwt_auth import PortalAuthContext

    app = FastAPI()

    @app.middleware("http")
    async def _inject_state(request: Request, call_next):
        request.state.user_id = "user-1"
        request.state.portal_auth = PortalAuthContext(
            user_id="user-1",
            org_id="portal-org-1",
            role="owner",
            app_access=["ATRIUM", "CONDUCTOR", "DRIVE", "WORKPIPE"],
        )
        return await call_next(request)

    orchestrator = _StubOrchestrator()

    def _get_test_session():
        return db_session

    def _get_stub_orchestrator():
        return orchestrator

    app.dependency_overrides[get_tenant_session] = _get_test_session
    app.dependency_overrides[departments.get_orchestrator] = _get_stub_orchestrator
    app.include_router(organizations.router)
    app.include_router(departments.router)
    app.state.stub_orchestrator = orchestrator
    return app


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)


def test_list_subaccounts_returns_active_only_and_current_selection(client):
    response = client.get(
        f"/api/atrium/orgs/{TEST_ORG_ID}/subaccounts",
        cookies={organizations.ATRIUM_SUBACCOUNT_COOKIE: TEST_SUB_ID},
    )
    assert response.status_code == 200, response.text
    payload = response.json()
    assert payload["activeSubAccountId"] == TEST_SUB_ID
    assert payload["subAccounts"] == [
        {
            "id": TEST_SUB_ID,
            "name": "Northwind",
            "slug": "northwind",
            "status": "ACTIVE",
        }
    ]


def test_list_subaccounts_invalid_cookie_degrades_to_business_scope(client):
    response = client.get(
        f"/api/atrium/orgs/{TEST_ORG_ID}/subaccounts",
        cookies={organizations.ATRIUM_SUBACCOUNT_COOKIE: "missing"},
    )
    assert response.status_code == 200, response.text
    assert response.json()["activeSubAccountId"] is None


def test_select_subaccount_sets_http_only_cookie(client):
    response = client.post(
        f"/api/atrium/orgs/{TEST_ORG_ID}/subaccounts/select",
        json={"subAccountId": TEST_SUB_ID},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"selected": TEST_SUB_ID}
    set_cookie = response.headers["set-cookie"]
    assert f"{organizations.ATRIUM_SUBACCOUNT_COOKIE}={TEST_SUB_ID}" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "SameSite=lax" in set_cookie


def test_select_subaccount_clears_to_business_scope_cookie(client):
    response = client.post(
        f"/api/atrium/orgs/{TEST_ORG_ID}/subaccounts/select",
        json={"subAccountId": None},
    )
    assert response.status_code == 200, response.text
    assert response.json() == {"selected": None}
    assert (
        f"{organizations.ATRIUM_SUBACCOUNT_COOKIE}={organizations.BUSINESS_SCOPE_SENTINEL}"
        in response.headers["set-cookie"]
    )


def test_department_chat_threads_selected_subaccount(client, app):
    response = client.post(
        "/api/atrium/departments/sales/chat",
        params={"org_id": TEST_ORG_ID},
        cookies={organizations.ATRIUM_SUBACCOUNT_COOKIE: TEST_SUB_ID},
        json={"message": "hello", "chat_id": "chat-1", "conversation_history": []},
    )
    assert response.status_code == 200, response.text
    call = app.state.stub_orchestrator.calls[-1]
    assert call["department_slug"] == "sales"
    assert call["sub_account_id"] == TEST_SUB_ID


def test_chief_chat_invalid_cookie_degrades_to_business_scope(client, app):
    response = client.post(
        "/api/atrium/departments/chief/chat",
        params={"org_id": TEST_ORG_ID},
        cookies={organizations.ATRIUM_SUBACCOUNT_COOKIE: "missing"},
        json={"message": "hello", "chat_id": "chat-2", "conversation_history": []},
    )
    assert response.status_code == 200, response.text
    call = app.state.stub_orchestrator.calls[-1]
    assert call["department_slug"] is None
    assert call["sub_account_id"] is None

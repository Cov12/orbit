import time

import httpx
import jwt as pyjwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from open_webui.internal.db import Base
from apps.atrium.backend.middleware import jwt_auth
from apps.atrium.backend.middleware.jwt_auth import JWTAuthMiddleware
from apps.atrium.backend.middleware.tenant import get_tenant_session
from apps.atrium.backend.models.db import AtriumOrganization
from apps.atrium.backend.routers import dashboard_conductor
from apps.atrium.backend.services import conductor_bridge


TEST_JWT_SECRET = "test-conductor-dashboard-secret"
TEST_BRIDGE_SECRET = "test-bridge-shhh"
TEST_ORG_ID = "org-dashboard-1"
TEST_PORTAL_ORG_ID = "portal-biz-cuid-123"
TEST_WORKPIPE_SUBACCOUNT_ID = "subaccount-bound-456"


class _FakeResponse:
    def __init__(self, status_code, payload=None, text=""):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self.text = text

    def json(self):
        return self._payload


class _FakeClient:
    """Records the outbound POST and returns a canned response (or raises)."""

    def __init__(self, response=None, exc=None):
        self.response = response
        self.exc = exc
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return False

    async def post(self, url, json=None, headers=None):
        self.calls.append({"url": url, "json": json or {}, "headers": headers or {}})
        if self.exc:
            raise self.exc
        return self.response


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
                portal_org_id=TEST_PORTAL_ORG_ID,
                workpipe_account_id=TEST_WORKPIPE_SUBACCOUNT_ID,
            )
        )
        session.commit()
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def app(db_session, monkeypatch):
    monkeypatch.setattr(jwt_auth, "JWT_SECRET", TEST_JWT_SECRET)
    monkeypatch.setenv("ORBIT_BRIDGE_SECRET", TEST_BRIDGE_SECRET)

    app = FastAPI()
    app.add_middleware(JWTAuthMiddleware)
    app.dependency_overrides[get_tenant_session] = lambda: db_session
    app.include_router(dashboard_conductor.router)
    return app


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)


def _mint_portal_token(app_access):
    now = int(time.time())
    payload = {
        "sub": "user-77",
        "user_id": "user-77",
        # #41: the JWT's org_id claim (Portal CUID) must match the seeded org's
        # portal_org_id, else require_org_access binds the requested internal org_id
        # to a different Portal org and 403s before the handler runs.
        "org_id": TEST_PORTAL_ORG_ID,
        "role": "owner",
        "email": "owner@example.com",
        "app_access": app_access,
        "iat": now,
        "exp": now + 600,
    }
    return pyjwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


def _patch_httpx(monkeypatch, fake_client):
    monkeypatch.setattr(conductor_bridge.httpx, "AsyncClient", lambda **kwargs: fake_client)


def test_history_route_posts_to_history_with_secret_company_and_subaccount(client, monkeypatch):
    runs = [
        {
            "id": "run-1",
            "status": "completed",
            "agentId": "agent-a",
            "agentName": "Hermes",
            "createdAt": "2026-07-05T12:00:00.000Z",
            "updatedAt": "2026-07-05T12:05:00.000Z",
            "subAccountId": "sub-42",
        }
    ]
    fake = _FakeClient(_FakeResponse(200, {"companyId": "c", "subAccountId": "sub-42", "runs": runs}))
    _patch_httpx(monkeypatch, fake)

    token = _mint_portal_token(["ATRIUM", "CONDUCTOR"])
    response = client.get(
        "/api/atrium/dashboard/conductor/history",
        params={"org_id": TEST_ORG_ID, "subAccountId": "sub-42", "limit": 5},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"data": runs}

    call = fake.calls[0]
    # Same base as /chat, path swapped to /history.
    assert call["url"] == conductor_bridge._history_url()
    assert call["url"].endswith("/api/history")
    assert call["headers"]["x-orbit-bridge-secret"] == TEST_BRIDGE_SECRET
    # companyId resolved the SAME way chat resolves it (portal id -> UUIDv5).
    assert call["json"]["companyId"] == conductor_bridge._resolve_company_id(TEST_PORTAL_ORG_ID)
    assert call["json"]["subAccountId"] == "sub-42"
    assert call["json"]["limit"] == 5


def test_history_route_omits_subaccount_for_business_scope(client, monkeypatch):
    fake = _FakeClient(_FakeResponse(200, {"runs": []}))
    _patch_httpx(monkeypatch, fake)

    token = _mint_portal_token(["ATRIUM", "CONDUCTOR"])
    response = client.get(
        "/api/atrium/dashboard/conductor/history",
        params={"org_id": TEST_ORG_ID},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"data": []}
    assert "subAccountId" not in fake.calls[0]["json"]
    assert fake.calls[0]["json"]["limit"] == 20  # default


def test_history_route_returns_empty_on_timeout_without_raising(client, monkeypatch):
    fake = _FakeClient(exc=httpx.TimeoutException("boom"))
    _patch_httpx(monkeypatch, fake)

    token = _mint_portal_token(["ATRIUM", "CONDUCTOR"])
    response = client.get(
        "/api/atrium/dashboard/conductor/history",
        params={"org_id": TEST_ORG_ID},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"data": []}


def test_history_route_returns_empty_on_bridge_error_status(client, monkeypatch):
    fake = _FakeClient(_FakeResponse(500, {"error": "kaboom"}, text="kaboom"))
    _patch_httpx(monkeypatch, fake)

    token = _mint_portal_token(["ATRIUM", "CONDUCTOR"])
    response = client.get(
        "/api/atrium/dashboard/conductor/history",
        params={"org_id": TEST_ORG_ID},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"data": []}


def test_history_route_requires_conductor_app_access(client, monkeypatch):
    fake = _FakeClient(_FakeResponse(200, {"runs": []}))
    _patch_httpx(monkeypatch, fake)

    token = _mint_portal_token(["ATRIUM", "WORKPIPE"])
    response = client.get(
        "/api/atrium/dashboard/conductor/history",
        params={"org_id": TEST_ORG_ID},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert response.status_code == 403, response.text
    assert not fake.calls

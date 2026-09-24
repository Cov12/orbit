"""Onboarding P4b route tests (epic atrium#97): opt-in starter tasks.

Mirrors test_onboarding_agents_routes.py (in-memory SQLite + the real router behind
JWTAuthMiddleware, a minted Portal JWT, and a fake httpx client recording the outbound
bridge POST).

The load-bearing behaviours here:
  - the cleaned tasks reach Conductor's seed-tasks with the resolved companyId, and the
    filed issues come back;
  - a failing/unreachable bridge is a 502 (the user launched these), a Conductor 400 is
    relayed as a 400;
  - shape validation (non-empty list, <= 20, non-blank titles) answers 400 locally;
  - require_org_access binds {org_id} to the caller.
"""

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
from apps.atrium.backend.routers import onboarding
from apps.atrium.backend.services import conductor_bridge


TEST_JWT_SECRET = "test-onboarding-secret-long-enough-for-hs256"
TEST_BRIDGE_SECRET = "test-bridge-shhh"
TEST_ORG_ID = "org-onboarding-tasks-1"
TEST_PORTAL_ORG_ID = "portal-onboarding-tasks-cuid-123"

OTHER_ORG_ID = "org-onboarding-tasks-2"
OTHER_PORTAL_ORG_ID = "portal-onboarding-tasks-cuid-999"

TASKS = [
    {"title": "Follow up with last month's leads", "description": "Top 10 only", "priority": "high"},
    {"title": "Draft the spring promo email"},
]
ISSUES = [
    {"id": "iss-1", "identifier": "ACM-1", "title": "Follow up with last month's leads"},
    {"id": "iss-2", "identifier": "ACM-2", "title": "Draft the spring promo email"},
]

TASKS_URL = f"/api/atrium/orgs/{TEST_ORG_ID}/onboarding/tasks"


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
                # Pre-existing keys (one unrelated, one written by P1) to prove the
                # task marker write is additive and does not clobber completion.
                settings={
                    "subaccountsSyncedAt": "2026-01-01T00:00:00Z",
                    "onboarding": {"completed": True, "completedAt": 1, "version": 1},
                },
            )
        )
        session.add(
            AtriumOrganization(
                id=OTHER_ORG_ID,
                name="Other",
                slug="other",
                plan="starter",
                portal_org_id=OTHER_PORTAL_ORG_ID,
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
    app.include_router(onboarding.router)
    return app


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)


def _mint_portal_token(portal_org_id=TEST_PORTAL_ORG_ID):
    now = int(time.time())
    payload = {
        "sub": "user-77",
        "user_id": "user-77",
        "org_id": portal_org_id,
        "role": "owner",
        "email": "owner@example.com",
        "app_access": ["ATRIUM"],
        "iat": now,
        "exp": now + 600,
    }
    return pyjwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


def _patch_httpx(monkeypatch, fake_client):
    monkeypatch.setattr(conductor_bridge.httpx, "AsyncClient", lambda **kwargs: fake_client)


def _auth(portal_org_id=TEST_PORTAL_ORG_ID):
    return {"Authorization": f"Bearer {_mint_portal_token(portal_org_id)}"}


def _settings(db_session, org_id=TEST_ORG_ID):
    db_session.expire_all()
    org = db_session.query(AtriumOrganization).filter_by(id=org_id).one()
    return org.settings or {}


# --- happy path --------------------------------------------------------------

def test_forwards_tasks_and_returns_the_issues(client, monkeypatch):
    fake = _FakeClient(_FakeResponse(200, {"issues": ISSUES}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(TASKS_URL, json={"tasks": TASKS}, headers=_auth())

    assert response.status_code == 200, response.text
    assert response.json() == {"issues": ISSUES}

    call = fake.calls[0]
    assert call["url"] == conductor_bridge._seed_tasks_url()
    assert call["url"].endswith("/api/bridge/seed-tasks")
    assert call["headers"]["x-orbit-bridge-secret"] == TEST_BRIDGE_SECRET
    assert call["json"]["companyId"] == conductor_bridge._resolve_company_id(TEST_PORTAL_ORG_ID)
    assert call["json"]["tasks"] == TASKS


def test_uses_the_forwarder(client, monkeypatch):
    """The route's only Conductor dependency is conductor_bridge.seed_tasks."""
    seen = {}

    async def _fake(db, org_id, tasks):
        seen["org_id"] = org_id
        seen["tasks"] = tasks
        return {"ok": True, "issues": ISSUES}

    monkeypatch.setattr(conductor_bridge, "seed_tasks", _fake)

    response = client.post(TASKS_URL, json={"tasks": TASKS}, headers=_auth())

    assert response.status_code == 200, response.text
    assert response.json() == {"issues": ISSUES}
    assert seen == {"org_id": TEST_ORG_ID, "tasks": TASKS}


def test_trims_values_and_drops_blank_optionals_and_unknown_keys(client, monkeypatch):
    fake = _FakeClient(_FakeResponse(200, {"issues": []}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(
        TASKS_URL,
        json={"tasks": [
            {"title": "  Call Bob  ", "description": "   ", "priority": " low ", "x": 1},
            {"title": "Plan", "description": None},
        ]},
        headers=_auth(),
    )

    assert response.status_code == 200, response.text
    assert fake.calls[0]["json"]["tasks"] == [
        {"title": "Call Bob", "priority": "low"},
        {"title": "Plan"},
    ]


def test_records_a_marker_in_settings_additively(client, db_session, monkeypatch):
    _patch_httpx(monkeypatch, _FakeClient(_FakeResponse(200, {"issues": ISSUES})))

    assert client.post(TASKS_URL, json={"tasks": TASKS}, headers=_auth()).status_code == 200

    settings = _settings(db_session)
    assert settings["onboardingTasks"]["count"] == 2
    assert isinstance(settings["onboardingTasks"]["seededAt"], int)
    assert settings["subaccountsSyncedAt"] == "2026-01-01T00:00:00Z"
    assert settings["onboarding"]["completed"] is True


# --- error mapping -----------------------------------------------------------

def test_relays_a_conductor_400(client, db_session, monkeypatch):
    _patch_httpx(monkeypatch, _FakeClient(_FakeResponse(400, {"error": "bad priority: urgent!"})))

    response = client.post(
        TASKS_URL, json={"tasks": [{"title": "x", "priority": "urgent!"}]}, headers=_auth()
    )

    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "bad priority: urgent!"
    assert "onboardingTasks" not in _settings(db_session)


@pytest.mark.parametrize(
    "make_fake",
    [
        lambda: _FakeClient(_FakeResponse(500, {"error": "kaboom"}, text="kaboom")),
        lambda: _FakeClient(_FakeResponse(401, {"error": "bad secret"})),
        lambda: _FakeClient(exc=httpx.TimeoutException("boom")),
        lambda: _FakeClient(exc=httpx.RequestError("no route")),
        lambda: _FakeClient(_FakeResponse(200, {"ok": True})),  # no issues list
    ],
    ids=["non-2xx", "conductor-401", "timeout", "transport-error", "malformed-body"],
)
def test_502_when_the_bridge_fails(client, db_session, monkeypatch, make_fake):
    """The user launched these tasks, so a failure surfaces (retryable) — never a 200."""
    _patch_httpx(monkeypatch, make_fake())

    response = client.post(TASKS_URL, json={"tasks": TASKS}, headers=_auth())

    assert response.status_code == 502, response.text
    assert response.json()["error"]
    assert "onboardingTasks" not in _settings(db_session)


def test_502_when_the_forwarder_reports_failure(client, monkeypatch):
    async def _fake(db, org_id, tasks):
        return {"ok": False, "error": "unreachable", "status": None}

    monkeypatch.setattr(conductor_bridge, "seed_tasks", _fake)

    response = client.post(TASKS_URL, json={"tasks": TASKS}, headers=_auth())

    assert response.status_code == 502, response.text
    assert response.json() == {"error": "unreachable"}


def test_502_when_the_bridge_secret_is_missing(client, monkeypatch):
    monkeypatch.delenv("ORBIT_BRIDGE_SECRET", raising=False)
    fake = _FakeClient(_FakeResponse(200, {"issues": ISSUES}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(TASKS_URL, json={"tasks": TASKS}, headers=_auth())

    assert response.status_code == 502, response.text
    assert fake.calls == []


# --- request validation (shape only) -----------------------------------------

@pytest.mark.parametrize(
    "body",
    [
        {"tasks": []},
        {},
        {"tasks": None},
        {"tasks": "do stuff"},
        {"tasks": {"title": "x"}},
        {"tasks": ["do stuff"]},
        {"tasks": [{"title": ""}]},
        {"tasks": [{"title": "   "}]},
        {"tasks": [{"description": "no title"}]},
        {"tasks": [{"title": 7}]},
        {"tasks": [{"title": "x", "description": 7}]},
        {"tasks": [{"title": "x", "priority": ["high"]}]},
        {"tasks": [{"title": f"t{i}"} for i in range(21)]},
    ],
    ids=[
        "empty-list", "missing", "null", "string", "dict", "non-object-entry",
        "empty-title", "blank-title", "missing-title", "non-string-title",
        "non-string-description", "non-string-priority", "too-many",
    ],
)
def test_400_for_malformed_tasks(client, monkeypatch, body):
    fake = _FakeClient(_FakeResponse(200, {"issues": ISSUES}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(TASKS_URL, json=body, headers=_auth())

    assert response.status_code == 400, response.text
    assert response.json()["detail"]
    assert fake.calls == []  # rejected before any bridge call


def test_twenty_tasks_is_allowed(client, monkeypatch):
    fake = _FakeClient(_FakeResponse(200, {"issues": []}))
    _patch_httpx(monkeypatch, fake)

    tasks = [{"title": f"t{i}"} for i in range(20)]
    response = client.post(TASKS_URL, json={"tasks": tasks}, headers=_auth())

    assert response.status_code == 200, response.text
    assert len(fake.calls[0]["json"]["tasks"]) == 20


def test_unknown_org_is_rejected(client):
    response = client.post(
        "/api/atrium/orgs/org-does-not-exist/onboarding/tasks",
        json={"tasks": TASKS},
        headers=_auth(),
    )
    assert response.status_code in (403, 404), response.text


# --- auth --------------------------------------------------------------------

def test_route_requires_auth(client):
    assert client.post(TASKS_URL, json={"tasks": TASKS}).status_code == 403


def test_cannot_seed_another_orgs_tasks(client, db_session, monkeypatch):
    """IDOR: a caller authed for one Portal org cannot file tasks into another org."""
    fake = _FakeClient(_FakeResponse(200, {"issues": ISSUES}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(
        f"/api/atrium/orgs/{OTHER_ORG_ID}/onboarding/tasks",
        json={"tasks": TASKS},
        headers=_auth(TEST_PORTAL_ORG_ID),
    )

    assert response.status_code == 403, response.text
    assert fake.calls == []
    assert "onboardingTasks" not in _settings(db_session, OTHER_ORG_ID)

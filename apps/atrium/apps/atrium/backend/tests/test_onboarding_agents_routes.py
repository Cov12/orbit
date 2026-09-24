"""Onboarding P2a route tests (epic atrium#97): explicit specialist-agent provisioning.

Mirrors test_onboarding_routes.py's style (in-memory SQLite + the real router mounted
behind JWTAuthMiddleware, a minted Portal JWT for auth, and a fake httpx client recording
the outbound bridge POST).

The load-bearing behaviours here:
  - the roles reach Conductor verbatim (deduped, trimmed) and the roster comes back;
  - the route is TAXONOMY-AGNOSTIC — it never judges a role, it relays Conductor's 400;
  - an unreachable/failing bridge is a 502, NOT a silent success (unlike P1 seeding);
  - the provisioned roster lands in org.settings additively, alongside P1's keys;
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
TEST_ORG_ID = "org-onboarding-agents-1"
TEST_PORTAL_ORG_ID = "portal-onboarding-agents-cuid-123"

OTHER_ORG_ID = "org-onboarding-agents-2"
OTHER_PORTAL_ORG_ID = "portal-onboarding-agents-cuid-999"

ROLES = ["sales", "marketing", "operations"]
AGENTS = [
    {"role": "sales", "agentId": "agent-sales", "created": True},
    {"role": "marketing", "agentId": "agent-marketing", "created": True},
    {"role": "operations", "agentId": "agent-ops", "created": False},
]

AGENTS_URL = f"/api/atrium/orgs/{TEST_ORG_ID}/onboarding/agents"


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
                # provisioning write is additive and does not clobber completion.
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

def test_provisions_roles_and_returns_the_roster(client, monkeypatch):
    fake = _FakeClient(_FakeResponse(200, {"agents": AGENTS}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(AGENTS_URL, json={"roles": ROLES}, headers=_auth())

    assert response.status_code == 200, response.text
    assert response.json() == {"ok": True, "agents": AGENTS, "roles": ROLES}

    call = fake.calls[0]
    assert call["url"] == conductor_bridge._ensure_department_agents_url()
    assert call["url"].endswith("/api/bridge/ensure-department-agents")
    assert call["headers"]["x-orbit-bridge-secret"] == TEST_BRIDGE_SECRET
    assert call["json"]["companyId"] == conductor_bridge._resolve_company_id(TEST_PORTAL_ORG_ID)
    assert call["json"]["roles"] == ROLES


def test_trims_and_dedupes_roles_preserving_order(client, monkeypatch):
    fake = _FakeClient(_FakeResponse(200, {"agents": []}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(
        AGENTS_URL,
        json={"roles": ["  sales ", "marketing", "sales", "   "]},
        headers=_auth(),
    )

    assert response.status_code == 200, response.text
    assert fake.calls[0]["json"]["roles"] == ["sales", "marketing"]
    assert response.json()["roles"] == ["sales", "marketing"]


def test_records_the_roster_in_settings_additively(client, db_session, monkeypatch):
    _patch_httpx(monkeypatch, _FakeClient(_FakeResponse(200, {"agents": AGENTS})))

    response = client.post(AGENTS_URL, json={"roles": ROLES}, headers=_auth())
    assert response.status_code == 200, response.text

    settings = _settings(db_session)
    assert settings["onboardingAgents"]["provisionedRoles"] == ROLES
    assert isinstance(settings["onboardingAgents"]["agentsProvisionedAt"], int)
    assert settings["onboardingAgents"]["agentsProvisionedAt"] > 0
    # Additive: the unrelated key AND P1's completion state both survive.
    assert settings["subaccountsSyncedAt"] == "2026-01-01T00:00:00Z"
    assert settings["onboarding"]["completed"] is True


def test_reprovisioning_replaces_the_recorded_roster(client, db_session, monkeypatch):
    """Conductor is idempotent (created:false on a repeat); the recorded roster tracks the
    latest request rather than accumulating."""
    _patch_httpx(monkeypatch, _FakeClient(_FakeResponse(200, {"agents": AGENTS})))
    assert client.post(AGENTS_URL, json={"roles": ROLES}, headers=_auth()).status_code == 200

    _patch_httpx(monkeypatch, _FakeClient(_FakeResponse(200, {"agents": []})))
    assert client.post(AGENTS_URL, json={"roles": ["sales"]}, headers=_auth()).status_code == 200

    assert _settings(db_session)["onboardingAgents"]["provisionedRoles"] == ["sales"]


def test_uses_the_forwarder(client, monkeypatch):
    """The route's only Conductor dependency is conductor_bridge.ensure_department_agents."""
    seen = {}

    async def _fake(db, org_id, roles):
        seen["org_id"] = org_id
        seen["roles"] = roles
        return {"ok": True, "agents": AGENTS}

    monkeypatch.setattr(conductor_bridge, "ensure_department_agents", _fake)

    response = client.post(AGENTS_URL, json={"roles": ROLES}, headers=_auth())

    assert response.status_code == 200, response.text
    assert seen == {"org_id": TEST_ORG_ID, "roles": ROLES}


# --- error mapping -----------------------------------------------------------

def test_relays_a_conductor_400_for_an_unknown_role(client, db_session, monkeypatch):
    """The route does NOT hardcode the canonical enum; Conductor rejects unknown roles
    (and ceo/default) and we relay its message so the wizard can name the offender."""
    fake = _FakeClient(_FakeResponse(400, {"error": "unknown role: wizard"}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(AGENTS_URL, json={"roles": ["wizard"]}, headers=_auth())

    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "unknown role: wizard"
    # The role still went to Conductor — validation here is shape-only.
    assert fake.calls[0]["json"]["roles"] == ["wizard"]
    # Nothing recorded for a failed provisioning.
    assert "onboardingAgents" not in _settings(db_session)


def test_relays_a_conductor_400_for_a_reserved_role(client, monkeypatch):
    _patch_httpx(monkeypatch, _FakeClient(_FakeResponse(400, {"error": "role not allowed: ceo"})))

    response = client.post(AGENTS_URL, json={"roles": ["ceo"]}, headers=_auth())

    assert response.status_code == 400, response.text
    assert response.json()["detail"] == "role not allowed: ceo"


@pytest.mark.parametrize(
    "make_fake",
    [
        lambda: _FakeClient(_FakeResponse(500, {"error": "kaboom"}, text="kaboom")),
        lambda: _FakeClient(exc=httpx.TimeoutException("boom")),
        lambda: _FakeClient(exc=httpx.RequestError("no route")),
        lambda: _FakeClient(_FakeResponse(200, {"ok": True})),  # no agents list
    ],
    ids=["non-2xx", "timeout", "transport-error", "malformed-body"],
)
def test_502_when_the_bridge_fails(client, db_session, monkeypatch, make_fake):
    """Unlike P1 seeding, provisioning failure is NOT swallowed into a success — the user
    asked for agents and got none."""
    _patch_httpx(monkeypatch, make_fake())

    response = client.post(AGENTS_URL, json={"roles": ROLES}, headers=_auth())

    assert response.status_code == 502, response.text
    assert response.json()["error"]
    assert "onboardingAgents" not in _settings(db_session)


def test_502_when_the_bridge_secret_is_missing(client, db_session, monkeypatch):
    monkeypatch.delenv("ORBIT_BRIDGE_SECRET", raising=False)
    fake = _FakeClient(_FakeResponse(200, {"agents": AGENTS}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(AGENTS_URL, json={"roles": ROLES}, headers=_auth())

    assert response.status_code == 502, response.text
    assert fake.calls == []  # never left the process
    assert "onboardingAgents" not in _settings(db_session)


# --- request validation (shape only) -----------------------------------------

@pytest.mark.parametrize(
    "body",
    [
        {"roles": []},
        {"roles": ["", "   "]},
        {},
        {"roles": None},
        {"roles": "sales"},
        {"roles": {"a": "sales"}},
        {"roles": ["sales", 7]},
        {"roles": [["sales"]]},
        {"roles": [f"role-{i}" for i in range(33)]},
    ],
    ids=[
        "empty-list", "blank-strings", "missing", "null", "string", "dict",
        "non-string-entry", "nested-list", "too-many",
    ],
)
def test_400_for_malformed_roles(client, monkeypatch, body):
    fake = _FakeClient(_FakeResponse(200, {"agents": AGENTS}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(AGENTS_URL, json=body, headers=_auth())

    assert response.status_code == 400, response.text
    assert response.json()["detail"]
    assert fake.calls == []  # rejected before any bridge call


def test_unknown_org_is_rejected(client):
    response = client.post(
        "/api/atrium/orgs/org-does-not-exist/onboarding/agents",
        json={"roles": ROLES},
        headers=_auth(),
    )
    # require_org_access fails closed on an org that isn't the caller's before the handler runs.
    assert response.status_code in (403, 404), response.text


# --- auth --------------------------------------------------------------------

def test_route_requires_auth(client):
    assert client.post(AGENTS_URL, json={"roles": ROLES}).status_code == 403


def test_cannot_provision_another_orgs_agents(client, db_session, monkeypatch):
    """IDOR: a caller authed for one Portal org cannot provision another org's agents."""
    fake = _FakeClient(_FakeResponse(200, {"agents": AGENTS}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(
        f"/api/atrium/orgs/{OTHER_ORG_ID}/onboarding/agents",
        json={"roles": ROLES},
        headers=_auth(TEST_PORTAL_ORG_ID),
    )

    assert response.status_code == 403, response.text
    assert fake.calls == []
    assert "onboardingAgents" not in _settings(db_session, OTHER_ORG_ID)

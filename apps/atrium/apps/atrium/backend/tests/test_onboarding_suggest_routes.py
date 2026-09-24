"""Onboarding P3a route tests (epic atrium#97): assisted "I'm not sure" role suggestion.

Mirrors test_onboarding_agents_routes.py (in-memory SQLite + the real router mounted
behind JWTAuthMiddleware, a minted Portal JWT for auth). The Conductor dependency is
conductor_bridge.suggest_roles, mocked here; its transport is pinned in test_suggest_roles.py.

The load-bearing behaviours here:
  - the answers (and maxRoles) reach the forwarder and roles/suggestions/model come back;
  - a forwarder failure (Conductor unreachable) is a 502 so the wizard falls back to manual;
  - it is READ-ONLY — nothing is provisioned or written to org.settings;
  - bad shapes are a 400 before any bridge call; require_org_access binds {org_id}.
"""

import time

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
TEST_ORG_ID = "org-onboarding-suggest-1"
TEST_PORTAL_ORG_ID = "portal-onboarding-suggest-cuid-123"

OTHER_ORG_ID = "org-onboarding-suggest-2"
OTHER_PORTAL_ORG_ID = "portal-onboarding-suggest-cuid-999"

SUGGEST_URL = f"/api/atrium/orgs/{TEST_ORG_ID}/onboarding/suggest"

ANSWERS = {"whatBusinessDoes": "We install solar panels", "painPoints": "lead follow-up"}
ROLES = ["sales", "marketing"]
SUGGESTIONS = [
    {"role": "sales", "rationale": "lead follow-up", "first_task_hints": ["triage leads"]},
    {"role": "marketing", "rationale": "demand", "first_task_hints": []},
]
ORIGINAL_SETTINGS = {"subaccountsSyncedAt": "2026-01-01T00:00:00Z"}


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
                settings=dict(ORIGINAL_SETTINGS),
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

    app = FastAPI()
    app.add_middleware(JWTAuthMiddleware)
    app.dependency_overrides[get_tenant_session] = lambda: db_session
    app.include_router(onboarding.router)
    return app


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def forwarder(monkeypatch):
    """Replace conductor_bridge.suggest_roles; records calls and returns `result`.
    Also fails the test if provisioning is ever touched from this route."""
    state = {
        "calls": [],
        "result": {
            "ok": True, "roles": ROLES, "suggestions": SUGGESTIONS, "model": "gpt-x",
        },
    }

    async def _fake(db, org_id, answers, max_roles=None):
        state["calls"].append({"org_id": org_id, "answers": answers, "max_roles": max_roles})
        return state["result"]

    async def _never(*args, **kwargs):  # pragma: no cover - failure path only
        raise AssertionError("suggest must not provision agents")

    monkeypatch.setattr(conductor_bridge, "suggest_roles", _fake)
    monkeypatch.setattr(conductor_bridge, "ensure_department_agents", _never)
    return state


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


def _auth(portal_org_id=TEST_PORTAL_ORG_ID):
    return {"Authorization": f"Bearer {_mint_portal_token(portal_org_id)}"}


def _settings(db_session, org_id=TEST_ORG_ID):
    db_session.expire_all()
    org = db_session.query(AtriumOrganization).filter_by(id=org_id).one()
    return org.settings or {}


# --- happy path --------------------------------------------------------------

def test_forwards_answers_and_returns_suggestions(client, db_session, forwarder):
    response = client.post(SUGGEST_URL, json={"answers": ANSWERS}, headers=_auth())

    assert response.status_code == 200, response.text
    assert response.json() == {"roles": ROLES, "suggestions": SUGGESTIONS, "model": "gpt-x"}
    assert forwarder["calls"] == [
        {"org_id": TEST_ORG_ID, "answers": ANSWERS, "max_roles": None}
    ]
    # Read-only: nothing persisted.
    assert _settings(db_session) == ORIGINAL_SETTINGS


def test_forwards_max_roles(client, forwarder):
    response = client.post(
        SUGGEST_URL, json={"answers": ANSWERS, "maxRoles": 3}, headers=_auth()
    )
    assert response.status_code == 200, response.text
    assert forwarder["calls"][0]["max_roles"] == 3


def test_empty_suggestion_is_a_200(client, forwarder):
    forwarder["result"] = {
        "ok": True, "roles": [], "suggestions": [], "model": "rules-fallback",
    }
    response = client.post(SUGGEST_URL, json={"answers": ANSWERS}, headers=_auth())
    assert response.status_code == 200, response.text
    assert response.json() == {"roles": [], "suggestions": [], "model": "rules-fallback"}


# --- error mapping -----------------------------------------------------------

def test_502_when_the_forwarder_fails(client, db_session, forwarder):
    forwarder["result"] = {"ok": False, "error": "role-map request error: no route"}

    response = client.post(SUGGEST_URL, json={"answers": ANSWERS}, headers=_auth())

    assert response.status_code == 502, response.text
    assert response.json() == {"error": "role-map request error: no route"}
    assert _settings(db_session) == ORIGINAL_SETTINGS


def test_502_end_to_end_when_conductor_is_unreachable(client, monkeypatch):
    """Real forwarder, no secret configured → never leaves the process → 502."""
    monkeypatch.delenv("ORBIT_BRIDGE_SECRET", raising=False)
    response = client.post(SUGGEST_URL, json={"answers": ANSWERS}, headers=_auth())
    assert response.status_code == 502, response.text
    assert response.json()["error"]


# --- request validation ------------------------------------------------------

@pytest.mark.parametrize(
    "body",
    [
        {},
        {"answers": None},
        {"answers": {}},
        {"answers": "solar"},
        {"answers": ["solar"]},
        {"answers": ANSWERS, "maxRoles": 0},
        {"answers": ANSWERS, "maxRoles": -2},
        {"answers": ANSWERS, "maxRoles": "3"},
        {"answers": ANSWERS, "maxRoles": 2.5},
        {"answers": ANSWERS, "maxRoles": True},
    ],
    ids=[
        "missing", "null", "empty", "string", "list",
        "max-zero", "max-negative", "max-string", "max-float", "max-bool",
    ],
)
def test_400_for_malformed_body(client, forwarder, body):
    response = client.post(SUGGEST_URL, json=body, headers=_auth())

    assert response.status_code == 400, response.text
    assert response.json()["detail"]
    assert forwarder["calls"] == []  # rejected before any bridge call


# --- auth --------------------------------------------------------------------

def test_route_requires_auth(client, forwarder):
    assert client.post(SUGGEST_URL, json={"answers": ANSWERS}).status_code == 403
    assert forwarder["calls"] == []


def test_cannot_suggest_for_another_org(client, forwarder):
    response = client.post(
        f"/api/atrium/orgs/{OTHER_ORG_ID}/onboarding/suggest",
        json={"answers": ANSWERS},
        headers=_auth(TEST_PORTAL_ORG_ID),
    )
    assert response.status_code == 403, response.text
    assert forwarder["calls"] == []

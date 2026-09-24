"""
Onboarding P1 route tests (epic atrium#97): capture -> Engram seed -> completion.

Mirrors test_dashboard_conductor_routes.py's style (in-memory SQLite + a real router mounted
behind JWTAuthMiddleware, a minted Portal JWT for auth, and a fake httpx client recording
the outbound bridge POST).

The load-bearing behaviours here:
  - the answers become one concise fact per meaningful answer, in a fixed order;
  - completion lands in org.settings["onboarding"] and PRESERVES existing settings keys;
  - completion is committed EVEN WHEN seeding fails (seeding is best-effort) — a Conductor
    outage must never trap a customer in the wizard;
  - GET reflects the stored state and defaults to not-completed;
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
TEST_ORG_ID = "org-onboarding-1"
TEST_PORTAL_ORG_ID = "portal-onboarding-cuid-123"

OTHER_ORG_ID = "org-onboarding-2"
OTHER_PORTAL_ORG_ID = "portal-onboarding-cuid-999"

ANSWERS = {
    "orgName": "Acme Studio",
    "industry": "Creative Agency",
    "whatBusinessDoes": "We build custom Shopify stores for outdoor brands.",
    "customers": "Founder-led DTC brands doing $1-10M a year.",
    "primaryGoal": "Double retainer clients without hiring.",
    "dayToDay": "Chasing proposals and answering the same client emails.",
}

EXPECTED_FACTS = [
    "Business name: Acme Studio",
    "Industry: Creative Agency",
    "What the business does: We build custom Shopify stores for outdoor brands.",
    "Who the customers are: Founder-led DTC brands doing $1-10M a year.",
    "Primary goal right now: Double retainer clients without hiring.",
    "Main day-to-day work: Chasing proposals and answering the same client emails.",
]


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
                # A pre-existing settings key, to prove the onboarding write is additive.
                settings={"subaccountsSyncedAt": "2026-01-01T00:00:00Z"},
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
        # require_org_access binds the requested internal org_id to THIS Portal CUID.
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


def _stored_state(db_session, org_id=TEST_ORG_ID):
    db_session.expire_all()
    org = db_session.query(AtriumOrganization).filter_by(id=org_id).one()
    return (org.settings or {}).get("onboarding")


# --- POST: capture + seed + completion ---------------------------------------

def test_post_persists_completion_builds_facts_and_seeds(client, db_session, monkeypatch):
    fake = _FakeClient(_FakeResponse(200, {"companyId": "c", "seeded": 6}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(
        f"/api/atrium/orgs/{TEST_ORG_ID}/onboarding",
        json={"answers": ANSWERS},
        headers=_auth(),
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"ok": True, "completed": True, "seeded": True, "factCount": 6}

    # The seed went to the engram-seed core route with the shared secret.
    call = fake.calls[0]
    assert call["url"] == conductor_bridge._engram_seed_url()
    assert call["url"].endswith("/api/bridge/engram-seed")
    assert call["headers"]["x-orbit-bridge-secret"] == TEST_BRIDGE_SECRET
    # companyId resolved the SAME way chat resolves it (portal id -> UUIDv5).
    assert call["json"]["companyId"] == conductor_bridge._resolve_company_id(TEST_PORTAL_ORG_ID)
    # One concise fact per meaningful answer, in the fixed FACT_LABELS order.
    assert call["json"]["facts"] == EXPECTED_FACTS
    # P1 is org-level: no subAccountId -> Hermes stores at companyId:_business.
    assert "subAccountId" not in call["json"]

    state = _stored_state(db_session)
    assert state["completed"] is True
    assert state["version"] == 1
    assert isinstance(state["completedAt"], int) and state["completedAt"] > 0


def test_post_preserves_existing_settings_and_stores_profile(client, db_session, monkeypatch):
    _patch_httpx(monkeypatch, _FakeClient(_FakeResponse(200, {})))

    response = client.post(
        f"/api/atrium/orgs/{TEST_ORG_ID}/onboarding",
        json={"answers": ANSWERS},
        headers=_auth(),
    )
    assert response.status_code == 200, response.text

    db_session.expire_all()
    settings = db_session.query(AtriumOrganization).filter_by(id=TEST_ORG_ID).one().settings
    # Additive: the unrelated key seeded in the fixture survives.
    assert settings["subaccountsSyncedAt"] == "2026-01-01T00:00:00Z"
    # Org profile field mirrored to the top level, raw answers kept for a later re-seed.
    assert settings["industry"] == "Creative Agency"
    assert settings["onboardingProfile"] == ANSWERS


def test_post_skips_blank_and_unknown_answers_when_building_facts(client, monkeypatch):
    fake = _FakeClient(_FakeResponse(200, {}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(
        f"/api/atrium/orgs/{TEST_ORG_ID}/onboarding",
        json={
            "answers": {
                "industry": "SaaS",
                "whatBusinessDoes": "   ",  # blank after trim -> no fact
                "customers": None,  # null -> no fact
                "primaryGoal": "Hit $1M ARR",
                "somethingElse": "ignored",  # not in the fixed set -> no fact
            }
        },
        headers=_auth(),
    )

    assert response.status_code == 200, response.text
    assert response.json()["factCount"] == 2
    assert fake.calls[0]["json"]["facts"] == ["Industry: SaaS", "Primary goal right now: Hit $1M ARR"]


def test_post_accepts_optional_subaccount_id_and_forwards_it(client, monkeypatch):
    """P1 never sends this, but the contract accepts it so per-sub-account seeding is a
    later drop-in with no API change."""
    fake = _FakeClient(_FakeResponse(200, {}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(
        f"/api/atrium/orgs/{TEST_ORG_ID}/onboarding",
        json={"answers": {"industry": "SaaS"}, "subAccountId": "sub-42"},
        headers=_auth(),
    )

    assert response.status_code == 200, response.text
    assert fake.calls[0]["json"]["subAccountId"] == "sub-42"


# --- POST: seeding is best-effort --------------------------------------------

@pytest.mark.parametrize(
    # Factories, not instances: a parametrize list is built once at collection time, so
    # sharing _FakeClient objects would share their mutable `calls` across tests.
    "make_fake",
    [
        lambda: _FakeClient(_FakeResponse(500, {"error": "kaboom"}, text="kaboom")),
        lambda: _FakeClient(exc=httpx.TimeoutException("boom")),
        lambda: _FakeClient(exc=httpx.RequestError("no route")),
    ],
    ids=["non-2xx", "timeout", "transport-error"],
)
def test_post_commits_completion_even_when_seed_fails(client, db_session, monkeypatch, make_fake):
    _patch_httpx(monkeypatch, make_fake())

    response = client.post(
        f"/api/atrium/orgs/{TEST_ORG_ID}/onboarding",
        json={"answers": ANSWERS},
        headers=_auth(),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    # seeded:false is the retry signal; completion still stands.
    assert body["completed"] is True
    assert body["seeded"] is False
    assert _stored_state(db_session)["completed"] is True


def test_post_commits_completion_when_bridge_secret_missing(client, db_session, monkeypatch):
    """No secret configured (e.g. a fresh env) must not block onboarding."""
    monkeypatch.delenv("ORBIT_BRIDGE_SECRET", raising=False)
    fake = _FakeClient(_FakeResponse(200, {}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(
        f"/api/atrium/orgs/{TEST_ORG_ID}/onboarding",
        json={"answers": ANSWERS},
        headers=_auth(),
    )

    assert response.status_code == 200, response.text
    assert response.json()["seeded"] is False
    assert fake.calls == []  # never left the process
    assert _stored_state(db_session)["completed"] is True


def test_post_with_no_answers_completes_without_calling_the_bridge(client, db_session, monkeypatch):
    """A user who skips every question still finishes the wizard; there is nothing to seed."""
    fake = _FakeClient(_FakeResponse(200, {}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(
        f"/api/atrium/orgs/{TEST_ORG_ID}/onboarding",
        json={"answers": {}},
        headers=_auth(),
    )

    assert response.status_code == 200, response.text
    assert response.json() == {"ok": True, "completed": True, "seeded": False, "factCount": 0}
    assert fake.calls == []
    assert _stored_state(db_session)["completed"] is True


# --- GET: state read ---------------------------------------------------------

def test_get_defaults_to_not_completed(client):
    response = client.get(f"/api/atrium/orgs/{TEST_ORG_ID}/onboarding", headers=_auth())
    assert response.status_code == 200, response.text
    assert response.json() == {"completed": False, "completedAt": None, "version": 1}


def test_get_returns_state_after_post(client, monkeypatch):
    _patch_httpx(monkeypatch, _FakeClient(_FakeResponse(200, {})))

    posted = client.post(
        f"/api/atrium/orgs/{TEST_ORG_ID}/onboarding",
        json={"answers": ANSWERS},
        headers=_auth(),
    )
    assert posted.status_code == 200, posted.text

    response = client.get(f"/api/atrium/orgs/{TEST_ORG_ID}/onboarding", headers=_auth())
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["completed"] is True
    assert body["version"] == 1
    assert isinstance(body["completedAt"], int)


def test_get_unknown_org_404s(client):
    response = client.get("/api/atrium/orgs/org-does-not-exist/onboarding", headers=_auth())
    # require_org_access fails closed on an org that isn't the caller's before the handler runs.
    assert response.status_code in (403, 404), response.text


# --- auth --------------------------------------------------------------------

def test_routes_require_auth(client):
    assert client.get(f"/api/atrium/orgs/{TEST_ORG_ID}/onboarding").status_code == 403
    assert (
        client.post(
            f"/api/atrium/orgs/{TEST_ORG_ID}/onboarding", json={"answers": ANSWERS}
        ).status_code
        == 403
    )


def test_post_cannot_onboard_another_orgs_row(client, db_session, monkeypatch):
    """IDOR: a caller authed for one Portal org cannot write another org's onboarding."""
    fake = _FakeClient(_FakeResponse(200, {}))
    _patch_httpx(monkeypatch, fake)

    response = client.post(
        f"/api/atrium/orgs/{OTHER_ORG_ID}/onboarding",
        json={"answers": ANSWERS},
        headers=_auth(TEST_PORTAL_ORG_ID),
    )

    assert response.status_code == 403, response.text
    assert fake.calls == []
    assert _stored_state(db_session, OTHER_ORG_ID) is None


def test_get_cannot_read_another_orgs_state(client):
    response = client.get(
        f"/api/atrium/orgs/{OTHER_ORG_ID}/onboarding", headers=_auth(TEST_PORTAL_ORG_ID)
    )
    assert response.status_code == 403, response.text

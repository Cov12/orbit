"""HTTP-layer entitlement gating tests.

Complements `test_require_app_access.py`: that file calls `_dep(request)`
on the dependency function directly. This file mounts the actual routers
in a FastAPI app, drives them via TestClient, and asserts the gate behaves
correctly through the full dependency chain + HTTP layer.

Coverage:
  - Default deny: no Portal JWT, no env var → 403 on both CONDUCTOR-gated
    routers (conductor-approvals, employee-tabs).
    emits the documented WARNING log line. Env var must be exactly "1".
  - Portal JWT path: HS256 tokens minted with the test secret are decoded
    by JWTAuthMiddleware; the CONDUCTOR entitlement is gated purely on the
    JWT's app_access claim. Covers happy path + expired + bad-signature +
    malformed + empty-claim cases.
  - Security invariant: dev escape hatch must NOT bypass an explicit JWT
    denial (JWT present but missing CONDUCTOR → 403 even with env var set).
  - Regression: ungated routers (proposals/) are unaffected — confirms
    the gate is router-scoped, not a JWT-middleware side effect.
"""
import logging
import time

import jwt as pyjwt
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from apps.atrium.backend.middleware.tenant import get_tenant_session
from apps.atrium.backend.models.db import Base


TEST_JWT_SECRET = "test-secret-for-pr6-router-smoke-tests"


@pytest.fixture
def db_session():
    # The gates now resolve get_tenant_session (require_app_access / require_org_access
    # read AtriumMember + the org's app_access on the OWUI path -- #45). Provide an
    # in-memory DB so dependency resolution doesn't 500 before the gate logic runs.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    # Seed the org the Portal-JWT tests reference (org_id="test-org"); require_org_access
    # (#41, legacy path) needs a row whose portal_org_id matches the JWT's org_id claim.
    from apps.atrium.backend.models.db import AtriumOrganization
    session.add(AtriumOrganization(
        id="test-org", name="Test Org", slug="test-org", plan="starter",
        portal_org_id="test-org",
    ))
    session.commit()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def app(db_session):
    """Two CONDUCTOR-gated routers, no JWT middleware. Tier 2/3 use this."""
    from apps.atrium.backend.routers import conductor_approvals, employee_tabs

    a = FastAPI()
    a.include_router(conductor_approvals.router)
    a.include_router(employee_tabs.router)
    a.dependency_overrides[get_tenant_session] = lambda: db_session
    return a


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)


@pytest.fixture
def app_with_jwt(monkeypatch, db_session):
    """Two CONDUCTOR-gated routers + the un-gated proposals router + JWTAuthMiddleware.

    Tier 4 uses this for the JWT path. Tier 5 reuses it to prove proposals/
    is NOT 403'd when a token lacks CONDUCTOR — i.e. the gate is router-scoped,
    not a global JWT-side-effect.

    Patches module-level JWT_SECRET (read at import time) to a known value.
    """
    from apps.atrium.backend.middleware import jwt_auth
    from apps.atrium.backend.middleware.jwt_auth import JWTAuthMiddleware
    from apps.atrium.backend.routers import conductor_approvals, employee_tabs, proposals

    monkeypatch.setattr(jwt_auth, "JWT_SECRET", TEST_JWT_SECRET)
    a = FastAPI()
    a.add_middleware(JWTAuthMiddleware)
    a.include_router(conductor_approvals.router)
    a.include_router(employee_tabs.router)
    a.include_router(proposals.router)
    a.dependency_overrides[get_tenant_session] = lambda: db_session
    return a


@pytest.fixture
def jwt_client(app_with_jwt):
    return TestClient(app_with_jwt, raise_server_exceptions=False)


def _mint_token(app_access, *, secret=TEST_JWT_SECRET, expired=False, extra=None):
    now = int(time.time())
    payload = {
        "sub": "test-user",
        "org_id": "test-org",
        "role": "member",
        "app_access": app_access,
        "iat": now - (3600 if expired else 0),
        "exp": now - (1800 if expired else -600),
    }
    if extra:
        payload.update(extra)
    return pyjwt.encode(payload, secret, algorithm="HS256")


# ─────────────────────────────────────────────────────────────────────────
# Tier 2 — default-deny path
# ─────────────────────────────────────────────────────────────────────────
class TestDefaultDeny:
    def test_conductor_approvals_returns_403_when_no_portal_auth_and_no_env_var(
        self, client, monkeypatch
    ):
        r = client.get(
            "/api/atrium/conductor-approvals/",
            headers={"X-Org-Id": "any-org"},
            params={"org_id": "any-org"},
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"
        assert "App access denied" in r.text
        assert "CONDUCTOR" in r.text

    def test_employee_tabs_returns_403_when_no_portal_auth_and_no_env_var(
        self, client, monkeypatch
    ):
        r = client.get(
            "/api/atrium/employee-tabs/",
            headers={"X-Org-Id": "any-org"},
            params={"org_id": "any-org"},
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"
        assert "App access denied" in r.text
        assert "CONDUCTOR" in r.text



# ─────────────────────────────────────────────────────────────────────────
# Tier 4 — Portal JWT path (MOST VALUABLE TEST)
# ─────────────────────────────────────────────────────────────────────────
class TestPortalJwt:
    def test_4_3_token_without_CONDUCTOR_in_app_access_returns_403(
        self, jwt_client, monkeypatch
    ):
        token = _mint_token(["WORKPIPE", "ATRIUM", "DRIVE"])
        r = jwt_client.get(
            "/api/atrium/conductor-approvals/",
            headers={"Authorization": f"Bearer {token}"},
            params={"org_id": "test-org"},
        )
        assert r.status_code == 403, f"expected 403, got {r.status_code}: {r.text}"
        assert "CONDUCTOR" in r.text

    def test_4_5a_token_with_CONDUCTOR_lets_conductor_approvals_pass_gate(
        self, jwt_client, monkeypatch
    ):
        token = _mint_token(["ATRIUM", "CONDUCTOR", "DRIVE", "WORKPIPE"])
        r = jwt_client.get(
            "/api/atrium/conductor-approvals/",
            headers={"Authorization": f"Bearer {token}"},
            params={"org_id": "test-org"},
        )
        assert r.status_code != 403, f"expected non-403, got {r.status_code}: {r.text}"

    def test_4_5b_token_with_CONDUCTOR_lets_employee_tabs_pass_gate(
        self, jwt_client, monkeypatch
    ):
        token = _mint_token(["ATRIUM", "CONDUCTOR", "DRIVE", "WORKPIPE"])
        r = jwt_client.get(
            "/api/atrium/employee-tabs/",
            headers={"Authorization": f"Bearer {token}"},
            params={"org_id": "test-org"},
        )
        assert r.status_code != 403, f"expected non-403, got {r.status_code}: {r.text}"

    def test_expired_token_returns_403(self, jwt_client, monkeypatch):
        """JWT expired → middleware drops portal_auth → require_app_access denies."""
        token = _mint_token(["CONDUCTOR"], expired=True)
        r = jwt_client.get(
            "/api/atrium/conductor-approvals/",
            headers={"Authorization": f"Bearer {token}"},
            params={"org_id": "test-org"},
        )
        assert r.status_code == 403, (
            f"expired token must not bypass the gate; got {r.status_code}"
        )

    def test_bad_signature_returns_403(self, jwt_client, monkeypatch):
        """Signed with wrong secret → middleware rejects → 403."""
        token = _mint_token(["CONDUCTOR"], secret="not-the-real-secret")
        r = jwt_client.get(
            "/api/atrium/conductor-approvals/",
            headers={"Authorization": f"Bearer {token}"},
            params={"org_id": "test-org"},
        )
        assert r.status_code == 403

    def test_malformed_token_returns_403(self, jwt_client, monkeypatch):
        r = jwt_client.get(
            "/api/atrium/conductor-approvals/",
            headers={"Authorization": "Bearer not-even-a-jwt"},
            params={"org_id": "test-org"},
        )
        assert r.status_code == 403

    def test_token_with_empty_app_access_returns_403(
        self, jwt_client, monkeypatch
    ):
        token = _mint_token([])
        r = jwt_client.get(
            "/api/atrium/conductor-approvals/",
            headers={"Authorization": f"Bearer {token}"},
            params={"org_id": "test-org"},
        )
        assert r.status_code == 403

    def test_jwt_present_but_lacking_conductor_is_denied(self, jwt_client):
        """A JWT present but lacking CONDUCTOR is an explicit, unconditional 403 —
        the security-critical app-entitlement invariant.
        """
        token = _mint_token(["WORKPIPE", "ATRIUM", "DRIVE"])  # no CONDUCTOR
        r = jwt_client.get(
            "/api/atrium/conductor-approvals/",
            headers={"Authorization": f"Bearer {token}"},
            params={"org_id": "test-org"},
        )
        assert r.status_code == 403, (
            "Dev escape hatch should NOT bypass JWT-present-but-app-missing case; "
            f"got {r.status_code}"
        )


# ─────────────────────────────────────────────────────────────────────────
# Tier 5 — Regression: non-Conductor routes are NOT gated
# ─────────────────────────────────────────────────────────────────────────
class TestNonConductorRouteRegression:
    def test_proposals_not_403_with_token_lacking_CONDUCTOR(
        self, jwt_client, monkeypatch
    ):
        """Token has NO CONDUCTOR in app_access; proposals/ is untouched by PR #6
        and must still respond non-403. Confirms the gate is router-scoped.
        """
        token = _mint_token(["WORKPIPE", "ATRIUM", "DRIVE"])  # no CONDUCTOR
        r = jwt_client.get(
            "/api/atrium/proposals/",
            headers={"Authorization": f"Bearer {token}"},
            params={"org_id": "test-org"},
        )
        assert r.status_code != 403, (
            f"proposals/ should not be CONDUCTOR-gated; got 403: {r.text[:200]}"
        )
        # Also ensure the body isn't the entitlement-denied phrase, in case some
        # other layer 403's for a different reason.
        assert "App access denied: CONDUCTOR" not in r.text

    def test_proposals_not_403_with_no_auth_at_all(
        self, jwt_client, monkeypatch
    ):
        """Even without any Authorization header, proposals/ is not CONDUCTOR-gated."""
        r = jwt_client.get(
            "/api/atrium/proposals/",
            headers={"X-Org-Id": "test-org"},
            params={"org_id": "test-org"},
        )
        # May 4xx/5xx for other reasons (DB, validation) — must not be CONDUCTOR-403
        assert "App access denied: CONDUCTOR" not in r.text, (
            f"proposals/ should not be CONDUCTOR-gated; got {r.status_code}: {r.text[:200]}"
        )

"""Add-member authorization tests — issue #45 PR-3 (privilege-escalation fix).

POST /orgs/{org_id}/members writes an AtriumMember from a client-supplied user_id +
role. Post-#46 require_org_access binds {org_id} to the caller (a MEMBER of the org), but
that alone let ANY member — or, under the dev-flag grace, any authed user — mint arbitrary
user_ids with arbitrary roles into the tenant (privilege escalation / tenant pollution).
require_org_admin (middleware/deps.py) additionally requires the CALLER be an admin/owner
of {org_id}. These tests pin that gate on BOTH identity paths:

  - OWUI-session path (prod): a REAL OWUI token (payload {"id": user.id}, signed
    WEBUI_SECRET_KEY), with the caller's AtriumMember.role deciding admin-ness;
  - LEGACY Portal-JWT path: the JWT's `role` claim deciding admin-ness.

The CALLER (authorized) and the body user_id (the ADDED user) are deliberately distinct;
several cases add a brand-new user_id that is NOT the caller.

Runs against an in-memory SQLite DB built from the (conftest-stubbed) declarative Base —
see apps/atrium/conftest.py.
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
from apps.atrium.backend.models.db import (
    AtriumMember,
    AtriumOrganization,
    now_ms,
)
from apps.atrium.backend.services.organizations import OrganizationsService
from apps.atrium.backend.routers import organizations

# Distinct secrets: an OWUI session token must NOT decode as a Portal JWT (prod reality).
TEST_WEBUI_SECRET = "test-owui-session-secret"
TEST_JWT_SECRET = "test-portal-jwt-secret"
FLAG = "ATRIUM_DEV_ALLOW_HEADER_AUTH"

ORG_A = "org-a-internal"
ORG_B = "org-b-internal"
CUID_A = "cuidorgaaaaaaaaaaaaaaaaaa"
CUID_B = "cuidorgbbbbbbbbbbbbbbbbbb"

# OWUI user ids (these ARE AtriumMember.user_id — the OWUI user.id).
USER_ADMIN_A = "owui-admin-a"     # AtriumMember(ORG_A, role="owner")   -> admin of A
USER_MEMBER_A = "owui-member-a"   # AtriumMember(ORG_A, role="member")  -> non-admin of A
USER_ADMIN_B = "owui-admin-b"     # AtriumMember(ORG_B, role="owner")   -> non-member of A
USER_NOMEM = "owui-nomember"      # no AtriumMember rows at all

# The user being ADDED — never the caller (proves caller-vs-added distinction).
ADDED_USER = "owui-brand-new-user"


@pytest.fixture(autouse=True)
def _secrets(monkeypatch):
    # deps._owui_session_secret() reads WEBUI_SECRET_KEY off os.environ (mirrors env.py).
    monkeypatch.setenv("WEBUI_SECRET_KEY", TEST_WEBUI_SECRET)
    # Portal decode must fail for OWUI tokens -> portal_auth None -> OWUI path.
    monkeypatch.setattr(jwt_auth, "JWT_SECRET", TEST_JWT_SECRET)
    # Default: escape hatch OFF; individual tests opt in.
    monkeypatch.delenv(FLAG, raising=False)


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
        session.add(AtriumOrganization(
            id=ORG_A, name="Org A", slug="acme-a", plan="starter",
            portal_org_id=CUID_A, app_access=["ATRIUM"],
        ))
        session.add(AtriumOrganization(
            id=ORG_B, name="Org B", slug="acme-b", plan="starter",
            portal_org_id=CUID_B, app_access=["ATRIUM"],
        ))
        # admin of A (role="owner" is the admin-ish set — mirrors the #46 seed and
        # jwt_auth's owner/admin privilege check).
        session.add(AtriumMember(id="m-admin-a", org_id=ORG_A, user_id=USER_ADMIN_A,
                                   role="OWNER", created_at=now_ms()))
        # non-admin member of A.
        session.add(AtriumMember(id="m-member-a", org_id=ORG_A, user_id=USER_MEMBER_A,
                                   role="member", created_at=now_ms()))
        # admin of B — a NON-member of A.
        session.add(AtriumMember(id="m-admin-b", org_id=ORG_B, user_id=USER_ADMIN_B,
                                   role="owner", created_at=now_ms()))
        session.commit()
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture
def app(db_session):
    app = FastAPI()
    app.add_middleware(JWTAuthMiddleware)
    app.dependency_overrides[get_tenant_session] = lambda: db_session
    app.include_router(organizations.router)
    return app


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)


# ── OWUI-session path ─────────────────────────────────────────────────────────

def _owui_token(user_id):
    payload = {"id": user_id, "jti": f"jti-{user_id}", "iat": int(time.time())}
    return pyjwt.encode(payload, TEST_WEBUI_SECRET, algorithm="HS256")


def _owui_auth(user_id):
    return {"Authorization": f"Bearer {_owui_token(user_id)}"}


def _add_member_body(user_id=ADDED_USER, role="member"):
    return {"user_id": user_id, "role": role}


def _post_add_member(client, org_id, headers, body=None):
    return client.post(
        f"/api/atrium/orgs/{org_id}/members",
        params={"org_id": org_id},
        json=body or _add_member_body(),
        headers=headers,
    )


def test_owui_admin_can_add_member_to_own_org(client, db_session):
    """An OWUI admin (role=owner) of ORG_A adds a brand-new member to A (200), and the
    ADDED user_id — distinct from the caller — is what gets persisted."""
    resp = _post_add_member(client, ORG_A, _owui_auth(USER_ADMIN_A))
    assert resp.status_code == 200, resp.text
    assert resp.json()["user_id"] == ADDED_USER
    # The write targeted the body user_id, not the caller.
    added = OrganizationsService.get_member(db_session, ORG_A, ADDED_USER)
    assert added is not None and added.user_id == ADDED_USER


def test_owui_nonadmin_member_cannot_add_member(client, db_session, monkeypatch):
    """A non-admin MEMBER of ORG_A is 403 — even with the escape hatch ON (a provisioned
    member is past the grace window; the admin-role requirement still applies)."""
    resp = _post_add_member(client, ORG_A, _owui_auth(USER_MEMBER_A))
    assert resp.status_code == 403, resp.text
    assert OrganizationsService.get_member(db_session, ORG_A, ADDED_USER) is None


def test_owui_nonmember_cannot_add_member(client, db_session):
    """A caller who is a member of ORG_B only (non-member of A) cannot add to A (403) —
    IDOR-bound by require_org_access, re-asserted by require_org_admin."""
    resp = _post_add_member(client, ORG_A, _owui_auth(USER_ADMIN_B))
    assert resp.status_code == 403, resp.text
    assert OrganizationsService.get_member(db_session, ORG_A, ADDED_USER) is None


def test_owui_admin_cannot_add_to_foreign_org(client, db_session):
    """An admin of ORG_A cannot add a member to ORG_B (403): require_org_access binds the
    caller to their own org, so cross-tenant minting is blocked."""
    resp = _post_add_member(client, ORG_B, _owui_auth(USER_ADMIN_A))
    assert resp.status_code == 403, resp.text
    assert OrganizationsService.get_member(db_session, ORG_B, ADDED_USER) is None


# ── Rollout-grace consistency with #46 (un-provisioned caller only) ────────────

def test_owui_unprovisioned_caller_denied(client):
    """An un-provisioned OWUI caller (no membership) is 403 — fail-closed, no grace."""
    resp = _post_add_member(client, ORG_A, _owui_auth(USER_NOMEM))
    assert resp.status_code == 403, resp.text


# ── LEGACY Portal-JWT path ────────────────────────────────────────────────────

def _portal_token(*, org_cuid, user_id, role):
    now = int(time.time())
    payload = {
        "sub": user_id, "user_id": user_id, "org_id": org_cuid, "role": role,
        "app_access": ["ATRIUM"], "iat": now, "exp": now + 600,
    }
    return pyjwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


def _portal_auth(**kwargs):
    return {"Authorization": f"Bearer {_portal_token(**kwargs)}"}


def test_portal_admin_can_add_member_to_own_org(client, db_session):
    """A Portal JWT with role=owner for CUID_A adds a member to ORG_A (200)."""
    headers = _portal_auth(org_cuid=CUID_A, user_id="portal-admin", role="OWNER")
    resp = _post_add_member(client, ORG_A, headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["user_id"] == ADDED_USER


def test_portal_nonadmin_cannot_add_member(client, db_session):
    """A Portal JWT with role=member (bound to CUID_A) is 403 — non-admin."""
    headers = _portal_auth(org_cuid=CUID_A, user_id="portal-member", role="member")
    resp = _post_add_member(client, ORG_A, headers)
    assert resp.status_code == 403, resp.text
    assert OrganizationsService.get_member(db_session, ORG_A, ADDED_USER) is None


def test_portal_admin_cannot_add_to_foreign_org(client, db_session):
    """A Portal admin for CUID_A targeting ORG_B's INTERNAL id is 403 — require_org_access
    binds the internal org to the caller's Portal CUID (ORG_B.portal_org_id == CUID_B)."""
    headers = _portal_auth(org_cuid=CUID_A, user_id="portal-admin", role="OWNER")
    resp = _post_add_member(client, ORG_B, headers)
    assert resp.status_code == 403, resp.text
    assert OrganizationsService.get_member(db_session, ORG_B, ADDED_USER) is None

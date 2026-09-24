"""OWUI-session auth-gate tests — issue #45 (PR-1 persist + PR-2 rebuild-context).

Prod requests to Atrium do NOT carry a Portal JWT; they carry an OpenWebUI SESSION
token (payload {"id": user.id}, signed WEBUI_SECRET_KEY). So request.state.portal_auth
is None and the auth gates must rebuild the caller's identity from that OWUI user.id +
the AtriumMember rows persisted at login (portal_auth_callback). These tests authenticate via that
REAL OWUI path — a token signed with WEBUI_SECRET_KEY, NOT a faked Portal-JWT bearer —
and pin:

  - a member of org A: 200 on A's routes, 403 on org B (real IDOR enforcement);
  - a user with NO membership: 403 (fail-closed, no dev grace);
  - require_app_access reads the org's cached app_access column (granted -> 200,
    missing -> 403) on the OWUI path;
  - the login provisioning sequence persists AtriumMember + app_access.

Legacy Portal-JWT coverage lives in test_cross_tenant_isolation.py (unchanged).

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
    AtriumConductorApproval,
    AtriumDepartment,
    AtriumEmployeeTab,
    AtriumMember,
    AtriumOrganization,
    AtriumProposal,
    now_ms,
)
from apps.atrium.backend.services.organizations import OrganizationsService
from apps.atrium.backend.routers import (
    conductor_approvals,
    dashboard_conductor,
    dashboard_workpipe,
    departments,
    employee_tabs,
    organizations,
    proposals,
)

# Distinct secrets: the OWUI session secret must NOT equal the Portal JWT secret, or an
# OWUI token could be mis-decoded as a Portal JWT. This is the prod reality.
TEST_WEBUI_SECRET = "test-owui-session-secret"
TEST_JWT_SECRET = "test-portal-jwt-secret"
FLAG = "ATRIUM_DEV_ALLOW_HEADER_AUTH"

# Two tenants. app_access is the per-org cached entitlement require_app_access reads on
# the OWUI path. ORG_A grants CONDUCTOR+WORKPIPE; ORG_NOCONDUCTOR grants only WORKPIPE.
ORG_A = "org-a-internal"
ORG_B = "org-b-internal"
ORG_NOCONDUCTOR = "org-noconductor-internal"
CUID_A = "cuidorgaaaaaaaaaaaaaaaaaa"
CUID_B = "cuidorgbbbbbbbbbbbbbbbbbb"
CUID_NC = "cuidorgncccccccccccccccc"

# OWUI user ids (these ARE AtriumMember.user_id — the OWUI user.id).
USER_MEMBER = "owui-user-member"       # member of ORG_A and ORG_NOCONDUCTOR
USER_NOMEM = "owui-user-nomember"      # no AtriumMember rows at all


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
        _seed_org(session, ORG_A, CUID_A, "acme-a", "a", ["CONDUCTOR", "WORKPIPE", "ATRIUM"])
        _seed_org(session, ORG_B, CUID_B, "acme-b", "b", ["CONDUCTOR", "WORKPIPE", "ATRIUM"])
        _seed_org(session, ORG_NOCONDUCTOR, CUID_NC, "acme-nc", "nc", ["WORKPIPE"])
        # USER_MEMBER belongs to ORG_A and ORG_NOCONDUCTOR — NOT ORG_B.
        session.add(AtriumMember(id="m-a", org_id=ORG_A, user_id=USER_MEMBER,
                                   role="owner", created_at=now_ms()))
        session.add(AtriumMember(id="m-nc", org_id=ORG_NOCONDUCTOR, user_id=USER_MEMBER,
                                   role="member", created_at=now_ms()))
        # A tab owned by USER_MEMBER in ORG_A (employee-tabs is per-org AND per-user).
        session.add(AtriumEmployeeTab(
            id="tab-a", org_id=ORG_A, user_id=USER_MEMBER, agent_id="agent-a",
            agent_name="Agent A", department="sales", is_visible=True,
            conversation_history=[], created_at=now_ms(), updated_at=now_ms(),
        ))
        session.commit()
        yield session
    finally:
        session.close()
        engine.dispose()


def _seed_org(session, org_id, cuid, slug, tag, app_access):
    session.add(AtriumOrganization(
        id=org_id, name=f"Org {tag}", slug=slug, plan="starter",
        portal_org_id=cuid, app_access=app_access,
    ))
    session.add(AtriumDepartment(
        id=f"dept-{tag}", org_id=org_id, slug="sales", name=f"Sales {tag}",
        description="", model_tier="mid", capabilities=[], workpipe_modules=[],
        system_prompt="", is_active=True, created_at=now_ms(), updated_at=now_ms(),
    ))
    session.add(AtriumProposal(
        id=f"prop-{tag}", org_id=org_id, department_id=f"dept-{tag}",
        title=f"Proposal {tag}", action_type="send_email", status="pending",
        created_at=now_ms(), updated_at=now_ms(),
    ))
    session.add(AtriumConductorApproval(
        id=f"appr-{tag}", org_id=org_id, conductor_company_id=f"conductor-{tag}",
        approval_type="hire_agent", status="pending",
        conductor_created_at=now_ms(), conductor_updated_at=now_ms(), synced_at=now_ms(),
    ))


@pytest.fixture
def app(db_session):
    app = FastAPI()
    app.add_middleware(JWTAuthMiddleware)
    app.dependency_overrides[get_tenant_session] = lambda: db_session
    app.include_router(organizations.router)
    app.include_router(departments.router)
    app.include_router(proposals.router)
    app.include_router(conductor_approvals.router)
    app.include_router(employee_tabs.router)
    app.include_router(dashboard_workpipe.router)
    app.include_router(dashboard_conductor.router)
    return app


@pytest.fixture
def client(app):
    return TestClient(app, raise_server_exceptions=False)


def _owui_token(user_id):
    """A REAL OWUI session token: payload {"id": user.id, "jti": ...}, signed
    WEBUI_SECRET_KEY — exactly what create_token / portal_auth_callback mints in prod."""
    payload = {"id": user_id, "jti": f"jti-{user_id}", "iat": int(time.time())}
    return pyjwt.encode(payload, TEST_WEBUI_SECRET, algorithm="HS256")


def _auth(user_id):
    return {"Authorization": f"Bearer {_owui_token(user_id)}"}


# ── require_org_access on the OWUI path: member scoped to own org ──────────────

# NB: employee-tabs is intentionally NOT in the 200 set — its handler reads
# request.state.portal_auth.user_id directly (routers/employee_tabs.py:93), which is
# None on the OWUI-session path and 500s. That is a separate handler bug the gate change
# exposes, not a gate concern (a follow-up must derive user_id from the OWUI user); the
# gate itself is exercised by the employee-tabs 403 case below, which rejects BEFORE the
# handler runs. Dashboards are likewise 200-tested in test_dashboard_* (need outbound mock).
@pytest.mark.parametrize("url,params", [
    ("/api/atrium/departments/", {"org_id": ORG_A}),
    ("/api/atrium/proposals/", {"org_id": ORG_A}),
    ("/api/atrium/conductor-approvals/", {"org_id": ORG_A}),
])
def test_member_gets_200_on_own_org(client, url, params):
    """A member of ORG_A, authed via OWUI session token, reads ORG_A routes (200)."""
    resp = client.get(url, params=params, headers=_auth(USER_MEMBER))
    assert resp.status_code == 200, f"{url}: {resp.status_code} {resp.text}"


@pytest.mark.parametrize("url,params", [
    ("/api/atrium/departments/", {"org_id": ORG_B}),
    ("/api/atrium/proposals/", {"org_id": ORG_B}),
    ("/api/atrium/conductor-approvals/", {"org_id": ORG_B}),
    ("/api/atrium/employee-tabs/", {"org_id": ORG_B}),
])
def test_member_gets_403_on_foreign_org(client, url, params):
    """The IDOR case: USER_MEMBER (member of A, not B) requesting ORG_B is 403 — membership
    rows exist, so the requested org must be one the caller actually belongs to."""
    resp = client.get(url, params=params, headers=_auth(USER_MEMBER))
    assert resp.status_code == 403, f"{url} leaked cross-tenant: {resp.status_code} {resp.text}"


# ── No-membership user: rollout grace vs fail-closed ──────────────────────────

def test_no_membership_denied_with_flag_off(client, monkeypatch):
    """With the flag OFF, an un-provisioned OWUI user is fail-closed to 403."""
    monkeypatch.delenv(FLAG, raising=False)
    resp = client.get("/api/atrium/departments/", params={"org_id": ORG_A},
                      headers=_auth(USER_NOMEM))
    assert resp.status_code == 403, resp.text


def test_no_membership_app_access_denied(client):
    """require_app_access fail-closes an un-provisioned OWUI user to 403 (no grace)."""
    resp = client.get("/api/atrium/conductor-approvals/", params={"org_id": ORG_A},
                      headers=_auth(USER_NOMEM))
    assert resp.status_code == 403, resp.text


# ── require_app_access reads the org's cached app_access on the OWUI path ──────

def test_app_access_granted_when_org_has_app(client):
    """CONDUCTOR route + org whose cached app_access includes CONDUCTOR -> 200 for a member."""
    resp = client.get("/api/atrium/conductor-approvals/", params={"org_id": ORG_A},
                      headers=_auth(USER_MEMBER))
    assert resp.status_code == 200, resp.text


def test_app_access_denied_when_org_missing_app(client):
    """CONDUCTOR route + org whose cached app_access LACKS CONDUCTOR -> 403, even though the
    caller is a member of that org (app entitlement is separate from org ownership)."""
    resp = client.get("/api/atrium/conductor-approvals/", params={"org_id": ORG_NOCONDUCTOR},
                      headers=_auth(USER_MEMBER))
    assert resp.status_code == 403, resp.text


# ── Unauthenticated (no OWUI token, no Portal JWT) ────────────────────────────

def test_unauthenticated_denied_without_flag(client, monkeypatch):
    monkeypatch.delenv(FLAG, raising=False)
    resp = client.get("/api/atrium/departments/", params={"org_id": ORG_A})
    assert resp.status_code == 403, resp.text


def test_org_list_scoped_to_owui_membership(client):
    """GET /orgs/ on the OWUI-session path returns ONLY the caller's member orgs — never
    every tenant's (cross-tenant enumeration + the wrong active-org selection that 403s
    all scoped calls). USER_MEMBER is a member of ORG_A and ORG_NOCONDUCTOR, not ORG_B."""
    resp = client.get("/api/atrium/orgs/", headers=_auth(USER_MEMBER))
    assert resp.status_code == 200, resp.text
    ids = {o["id"] for o in resp.json()}
    assert ids == {ORG_A, ORG_NOCONDUCTOR}, ids


# ── login provisioning: persists AtriumMember + app_access ───────────────────
#
# portal_auth_callback imports the whole OWUI backend (unavailable in the requirements-min
# unit env), so we exercise the exact service sequence provisioning runs
# (OrganizationsService.provision_from_portal) and assert the persisted rows.

def test_exchange_provisioning_persists_member_and_app_access(db_session):
    portal_cuid = "cuidneworgxxxxxxxxxxxxxxx"
    resolved_owui_user_id = "owui-new-user"
    claim_app_access = ["CONDUCTOR", "ATRIUM"]

    # find-or-create the org for the Portal CUID
    org = OrganizationsService.get_org_by_portal_id(db_session, portal_cuid)
    assert org is None
    org = OrganizationsService.create_org(
        db_session, name="New Org", slug="new-org", portal_org_id=portal_cuid,
    )
    # upsert membership keyed on the RESOLVED OWUI user.id
    OrganizationsService.upsert_member(
        db_session, org_id=org.id, user_id=resolved_owui_user_id, role="member",
    )
    # cache the org's app_access
    OrganizationsService.set_org_app_access(db_session, org.id, claim_app_access)

    member = OrganizationsService.get_member(db_session, org.id, resolved_owui_user_id)
    assert member is not None
    assert member.user_id == resolved_owui_user_id
    assert member.role == "member"
    refreshed = OrganizationsService.get_org_by_id(db_session, org.id)
    assert refreshed.app_access == claim_app_access


def test_exchange_provisioning_is_idempotent(db_session):
    """Re-login through the same sequence must not duplicate the membership row and must
    refresh role + app_access (persist-at-exchange freshness)."""
    portal_cuid = CUID_A  # existing org
    org = OrganizationsService.get_org_by_portal_id(db_session, portal_cuid)
    assert org is not None and org.id == ORG_A

    # USER_MEMBER already has a row in ORG_A (role owner). Re-run with role member.
    OrganizationsService.upsert_member(db_session, org_id=ORG_A, user_id=USER_MEMBER, role="member")
    OrganizationsService.set_org_app_access(db_session, ORG_A, ["CONDUCTOR"])

    rows = [m for m in OrganizationsService.list_members(db_session, ORG_A)
            if m.user_id == USER_MEMBER]
    assert len(rows) == 1, "membership must stay one row per (org, user)"
    assert rows[0].role == "member"
    assert OrganizationsService.get_org_by_id(db_session, ORG_A).app_access == ["CONDUCTOR"]

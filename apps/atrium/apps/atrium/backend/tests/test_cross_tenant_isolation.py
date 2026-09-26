"""Cross-tenant (org) isolation tests — issue #35 (GA-safety).

Atrium runs SQLite (webui.db) in dev AND prod, so the tenant middleware's
Postgres `SET LOCAL app.current_org_id` RLS is a silent no-op. Tenant isolation
therefore rests ENTIRELY on explicit `filter_by(org_id=...)` in each handler/
service. These tests pin that contract: a request scoped to org B must never see
org A's rows, a sub-account from another org is rejected, and the org-list
endpoint (fixed in #35) no longer enumerates every tenant's orgs.

Runs against an in-memory SQLite DB built from the (conftest-stubbed) declarative
Base — see apps/atrium/conftest.py.
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
    AtriumOrganization,
    AtriumProposal,
    AtriumSubAccount,
    now_ms,
)
from apps.atrium.backend.routers import (
    conductor_approvals,
    dashboard_conductor,
    dashboard_workpipe,
    departments,
    employee_tabs,
    organizations,
    proposals,
)

TEST_JWT_SECRET = "test-cross-tenant-secret"

# Two distinct tenants. Each `org_id` (internal row id) is the tenant key the
# handlers filter on; each `portal_org_id` (CUID) is what a Portal JWT carries.
ORG_A = "org-a-internal"
ORG_B = "org-b-internal"
CUID_A = "cuidorgaaaaaaaaaaaaaaaaaa"
CUID_B = "cuidorgbbbbbbbbbbbbbbbbbb"
USER_A = "user-a"
USER_B = "user-b"
SUB_A = "subaccount-a-0001"
SUB_B = "subaccount-b-0001"


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
        _seed_org(session, ORG_A, CUID_A, "acme-a", USER_A, SUB_A, "a")
        _seed_org(session, ORG_B, CUID_B, "acme-b", USER_B, SUB_B, "b")
        session.commit()
        yield session
    finally:
        session.close()
        engine.dispose()


def _seed_org(session, org_id, cuid, slug, user_id, sub_id, tag):
    """Seed one tenant with a full set of org-owned rows."""
    session.add(
        AtriumOrganization(
            id=org_id, name=f"Org {tag}", slug=slug, plan="starter",
            portal_org_id=cuid,
        )
    )
    session.add(
        AtriumDepartment(
            id=f"dept-{tag}", org_id=org_id, slug="sales", name=f"Sales {tag}",
            description="", model_tier="mid", capabilities=[], workpipe_modules=[],
            system_prompt="", is_active=True, created_at=now_ms(), updated_at=now_ms(),
        )
    )
    session.add(
        AtriumProposal(
            id=f"prop-{tag}", org_id=org_id, department_id=f"dept-{tag}",
            title=f"Proposal {tag}", action_type="send_email", status="pending",
            created_at=now_ms(), updated_at=now_ms(),
        )
    )
    session.add(
        AtriumConductorApproval(
            id=f"appr-{tag}", org_id=org_id, conductor_company_id=f"conductor-{tag}",
            approval_type="hire_agent", status="pending",
            conductor_created_at=now_ms(), conductor_updated_at=now_ms(), synced_at=now_ms(),
        )
    )
    session.add(
        AtriumEmployeeTab(
            id=f"tab-{tag}", org_id=org_id, user_id=user_id, agent_id=f"agent-{tag}",
            agent_name=f"Agent {tag}", department="sales", is_visible=True,
            conversation_history=[], created_at=now_ms(), updated_at=now_ms(),
        )
    )
    session.add(
        AtriumSubAccount(
            id=sub_id, org_id=org_id, portal_org_id=cuid, name=f"Sub {tag}",
            slug=f"sub-{tag}", status="ACTIVE", created_at=1, updated_at=1, synced_at=1,
        )
    )


@pytest.fixture
def app(db_session, monkeypatch):
    monkeypatch.setattr(jwt_auth, "JWT_SECRET", TEST_JWT_SECRET)

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


def _token(*, org_cuid, user_id, app_access):
    now = int(time.time())
    payload = {
        "sub": user_id,
        "user_id": user_id,
        "org_id": org_cuid,
        "role": "owner",
        "app_access": app_access,
        "iat": now,
        "exp": now + 600,
    }
    return pyjwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


def _auth(**kwargs):
    return {"Authorization": f"Bearer {_token(**kwargs)}"}


# ── Per-endpoint org scoping: a B-scoped read never returns A's rows ──────────


def test_proposals_list_scoped_to_org(client):
    """org_id=B returns only B's proposal; A's never leaks in."""
    headers = _auth(org_cuid=CUID_B, user_id=USER_B, app_access=["ATRIUM"])
    resp = client.get("/api/atrium/proposals/", params={"org_id": ORG_B}, headers=headers)
    assert resp.status_code == 200, resp.text
    ids = [p["id"] for p in resp.json()["proposals"]]
    assert ids == ["prop-b"]
    assert "prop-a" not in ids


def test_proposal_get_cross_org_is_404(client):
    """Fetching org A's proposal id while scoped to org B is a 404, not a leak."""
    headers = _auth(org_cuid=CUID_B, user_id=USER_B, app_access=["ATRIUM"])
    resp = client.get("/api/atrium/proposals/prop-a", params={"org_id": ORG_B}, headers=headers)
    assert resp.status_code == 404, resp.text


def test_departments_list_scoped_to_org(client):
    headers = _auth(org_cuid=CUID_B, user_id=USER_B, app_access=["ATRIUM"])
    resp = client.get("/api/atrium/departments/", params={"org_id": ORG_B}, headers=headers)
    assert resp.status_code == 200, resp.text
    ids = [d["id"] for d in resp.json()["departments"]]
    assert ids == ["dept-b"]


def test_conductor_approvals_list_scoped_to_org(client):
    """CONDUCTOR-gated route: org_id=B returns only B's approval."""
    headers = _auth(org_cuid=CUID_B, user_id=USER_B, app_access=["CONDUCTOR"])
    resp = client.get("/api/atrium/conductor-approvals/", params={"org_id": ORG_B}, headers=headers)
    assert resp.status_code == 200, resp.text
    ids = [a["id"] for a in resp.json()["approvals"]]
    assert ids == ["appr-b"]
    assert "appr-a" not in ids


def test_conductor_approval_get_cross_org_is_404(client):
    headers = _auth(org_cuid=CUID_B, user_id=USER_B, app_access=["CONDUCTOR"])
    resp = client.get("/api/atrium/conductor-approvals/appr-a", params={"org_id": ORG_B}, headers=headers)
    assert resp.status_code == 404, resp.text


def test_employee_tabs_scoped_to_org_and_user(client):
    """Tabs are per-org AND per-user: B's user sees only B's tab, never A's."""
    headers = _auth(org_cuid=CUID_B, user_id=USER_B, app_access=["CONDUCTOR"])
    resp = client.get("/api/atrium/employee-tabs/", params={"org_id": ORG_B}, headers=headers)
    assert resp.status_code == 200, resp.text
    ids = [t["id"] for t in resp.json()["tabs"]]
    assert ids == ["tab-b"]

    # A tab id from org A is invisible even to a same-org user with the CONDUCTOR app.
    resp2 = client.get("/api/atrium/employee-tabs/tab-a", params={"org_id": ORG_B}, headers=headers)
    assert resp2.status_code == 404, resp2.text


# ── list_organizations binding (the #35 fix): no cross-tenant enumeration ─────


def test_list_organizations_scoped_to_caller_portal_org(client):
    """A Portal JWT for org A's CUID lists ONLY org A — org B is not enumerated."""
    headers = _auth(org_cuid=CUID_A, user_id=USER_A, app_access=["ATRIUM"])
    resp = client.get("/api/atrium/orgs/", headers=headers)
    assert resp.status_code == 200, resp.text
    slugs = {o["slug"] for o in resp.json()}
    assert slugs == {"acme-a"}
    assert "acme-b" not in slugs


def test_list_organizations_unknown_cuid_returns_empty(client):
    """A CUID that owns no org row gets [] (fail-closed), never another tenant's."""
    headers = _auth(org_cuid="cuidnobodyxxxxxxxxxxxxxx", user_id="ghost", app_access=["ATRIUM"])
    resp = client.get("/api/atrium/orgs/", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json() == []


def test_list_organizations_anonymous_is_rejected(client):
    """No Portal JWT and no workspace session: 401, never the list of every org."""
    resp = client.get("/api/atrium/orgs/")
    assert resp.status_code == 401, resp.text


def test_create_organization_anonymous_is_rejected(client, db_session):
    """An anonymous POST must not create an organization."""
    resp = client.post("/api/atrium/orgs/", json={"name": "Anon Co", "slug": "anon-co"})
    assert resp.status_code == 401, resp.text
    db_session.expire_all()
    assert db_session.query(AtriumOrganization).filter_by(slug="anon-co").count() == 0


# ── Sub-account cross-org rejection ──────────────────────────────────────────


def test_select_foreign_subaccount_rejected(client):
    """Selecting org A's sub-account while operating on org B is a 404."""
    headers = _auth(org_cuid=CUID_B, user_id=USER_B, app_access=["ATRIUM"])
    resp = client.post(
        f"/api/atrium/orgs/{ORG_B}/subaccounts/select",
        params={"org_id": ORG_B},
        json={"subAccountId": SUB_A},
        headers=headers,
    )
    assert resp.status_code == 404, resp.text


def test_list_subaccounts_scoped_to_org(client):
    """org B's sub-account roster contains only B's sub-account."""
    headers = _auth(org_cuid=CUID_B, user_id=USER_B, app_access=["ATRIUM"])
    resp = client.get(
        f"/api/atrium/orgs/{ORG_B}/subaccounts",
        params={"org_id": ORG_B},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    ids = [s["id"] for s in resp.json()["subAccounts"]]
    assert ids == [SUB_B]
    assert SUB_A not in ids


# ── #41 org-binding: A's JWT + B's INTERNAL org_id → 403 on every scoped route ─
#
# The pre-#41 vuln: require_app_access only proved the JWT granted the app; nothing
# proved the requested internal org_id belonged to the caller's Portal org. So an
# authed user of org A could read org B's rows by passing B's internal id. Each case
# below sends user A's Portal JWT (CUID_A) but targets org B's internal id (ORG_B);
# require_org_access must 403 BEFORE the handler runs (no leak, and — for the
# dashboard routes — no outbound call). ALL Portal apps granted so the block is
# require_org_access, not require_app_access.

# (method, url, extra query params). org B is targeted via the `org_id` query param
# (or the {org_id} path segment for /orgs/{id}).
_CROSS_TENANT_ROUTES = [
    ("get", "/api/atrium/departments/", {"org_id": ORG_B}),
    ("get", "/api/atrium/proposals/", {"org_id": ORG_B}),
    ("get", "/api/atrium/proposals/stats", {"org_id": ORG_B}),
    ("get", "/api/atrium/conductor-approvals/", {"org_id": ORG_B}),
    ("get", "/api/atrium/employee-tabs/", {"org_id": ORG_B}),
    ("get", "/api/atrium/dashboard/workpipe/stats", {"org_id": ORG_B}),
    ("get", "/api/atrium/dashboard/conductor/history", {"org_id": ORG_B}),
    # /orgs/{id}: internal id in the PATH (no org_id query param).
    ("get", f"/api/atrium/orgs/{ORG_B}", None),
    ("get", f"/api/atrium/orgs/{ORG_B}/subaccounts", {"org_id": ORG_B}),
    ("get", f"/api/atrium/orgs/{ORG_B}/members", {"org_id": ORG_B}),
]


@pytest.mark.parametrize("method,url,params", _CROSS_TENANT_ROUTES)
def test_cross_tenant_org_id_is_403(client, method, url, params):
    """User A (CUID_A) passing org B's internal id is fail-closed to 403 everywhere."""
    headers = _auth(
        org_cuid=CUID_A, user_id=USER_A,
        app_access=["ATRIUM", "CONDUCTOR", "WORKPIPE"],
    )
    resp = client.request(method, url, params=params, headers=headers)
    assert resp.status_code == 403, f"{url} leaked cross-tenant: {resp.status_code} {resp.text}"


# ── Positive path: A's JWT + A's OWN internal org_id → 200 (binding lets it through) ─
#
# Same DB-backed, no-outbound routes as above, proving require_org_access is a binding
# and not a blanket deny. (The dashboard routes' 200 path needs mocked outbound HTTP;
# it is covered in test_dashboard_{conductor,workpipe}_routes.py, updated for #41.)
_SAME_TENANT_OK_ROUTES = [
    ("get", "/api/atrium/departments/", {"org_id": ORG_A}),
    ("get", "/api/atrium/proposals/", {"org_id": ORG_A}),
    ("get", "/api/atrium/conductor-approvals/", {"org_id": ORG_A}),
    ("get", "/api/atrium/employee-tabs/", {"org_id": ORG_A}),
    ("get", f"/api/atrium/orgs/{ORG_A}", None),
    ("get", f"/api/atrium/orgs/{ORG_A}/subaccounts", {"org_id": ORG_A}),
    ("get", f"/api/atrium/orgs/{ORG_A}/members", {"org_id": ORG_A}),
]


@pytest.mark.parametrize("method,url,params", _SAME_TENANT_OK_ROUTES)
def test_same_tenant_org_id_is_200(client, method, url, params):
    """User A (CUID_A) on A's OWN internal org_id still gets through (200)."""
    headers = _auth(
        org_cuid=CUID_A, user_id=USER_A,
        app_access=["ATRIUM", "CONDUCTOR", "WORKPIPE"],
    )
    resp = client.request(method, url, params=params, headers=headers)
    assert resp.status_code == 200, f"{url} blocked same-tenant caller: {resp.status_code} {resp.text}"


# ── #43 (security): a NULL-portal_org_id legacy org is NOT claimable on a read ─
#
# The trust-on-first-use gap: get_tenant_session used to stamp portal_org_id onto a
# NULL row BEFORE require_org_access ran, so the first Portal caller to reference an
# unstamped legacy org CLAIMED it and was served its data. With the request-path
# stamp removed, that org now fails closed (require_org_access → 403) and its
# portal_org_id stays NULL — ownership is never assigned on a data-serving read.

ORG_LEGACY = "org-legacy-internal-null"


def test_null_portal_org_is_403_and_not_claimed_on_portal_read(client, db_session):
    """A Portal caller referencing an unstamped (portal_org_id NULL) org is 403'd, and
    the org is NOT stamped/claimed as a side effect of the read (fail-closed)."""
    db_session.add(
        AtriumOrganization(
            id=ORG_LEGACY, name="Legacy", slug="legacy-null", plan="starter",
            portal_org_id=None,
        )
    )
    db_session.commit()

    headers = _auth(
        org_cuid=CUID_A, user_id=USER_A,
        app_access=["ATRIUM", "CONDUCTOR", "WORKPIPE"],
    )
    # Path-param route (/orgs/{id}) and a query-param scoped route both fail closed.
    resp = client.get(f"/api/atrium/orgs/{ORG_LEGACY}", headers=headers)
    assert resp.status_code == 403, resp.text
    resp2 = client.get(
        "/api/atrium/proposals/", params={"org_id": ORG_LEGACY}, headers=headers
    )
    assert resp2.status_code == 403, resp2.text

    # The read did NOT assign ownership: the row is still NULL (never claimed).
    db_session.expire_all()
    row = db_session.query(AtriumOrganization).filter_by(id=ORG_LEGACY).one()
    assert row.portal_org_id is None


# ── #43 / #71-A: org creation on the Portal path stamps portal_org_id ─────────


def test_create_org_on_portal_path_stamps_caller_cuid(client, db_session):
    """POST /orgs on a Portal-authed request provisions the row with the caller's
    Portal CUID (ownership assigned AT provisioning, the only place it should be)."""
    headers = _auth(org_cuid=CUID_A, user_id=USER_A, app_access=["ATRIUM"])
    resp = client.post(
        "/api/atrium/orgs/",
        json={"name": "Fresh Co", "slug": "fresh-co"},
        headers=headers,
    )
    assert resp.status_code == 200, resp.text
    new_id = resp.json()["organization"]["id"]

    db_session.expire_all()
    row = db_session.query(AtriumOrganization).filter_by(id=new_id).one()
    assert row.portal_org_id == CUID_A

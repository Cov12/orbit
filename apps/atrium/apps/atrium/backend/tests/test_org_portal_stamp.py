"""#66 Stage 2 — auto-populate atrium_organization.portal_org_id.

Covers:
  * Approach A: create_org stamps the Portal CUID at provisioning (and leaves it
    NULL when unknown).
  * Second-org resolution: a newly provisioned org with its own Portal CUID
    resolves via conductor_bridge to its OWN uuid5 company — NOT the Orbit default …c0de.
  * Approach B: the idempotent reconcile HELPER stamps NULL rows, never overwrites a
    non-null value, and leaves the 'default' (Orbit-pinned) org untouched. It is now an
    OUT-OF-BAND backfill helper only (see migrations/004).
  * #43 (security): the reconcile no longer runs on the get_tenant_session read path —
    a Portal-authed request referencing a NULL org does NOT claim it (fail-closed).

Runs against an in-memory SQLite DB built from the (conftest-stubbed) declarative
Base — see apps/atrium/conftest.py.
"""

import types
import uuid

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from open_webui.internal.db import Base
from apps.atrium.backend.models.db import AtriumOrganization
from apps.atrium.backend.services import conductor_bridge
from apps.atrium.backend.services.organizations import OrganizationsService
from apps.atrium.backend.middleware.tenant import get_tenant_session


# Locked namespace outputs (mirrors test_conductor_bridge).
_ORBIT_CUID = "cdemoorg00000000000000001"
_C0DE = "00000000-0000-4000-a000-000000000001"
# A DISTINCT second Portal org (a CUID, not a UUID → routed through uuid5).
_SECOND_CUID = "clsecondorg0000abcd1234wxyz"


@pytest.fixture
def db():
    """In-memory SQLite session with the Atrium tables created."""
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    # Pure derivation: no override, default company == …c0de.
    monkeypatch.delenv("PORTAL_COMPANY_OVERRIDES", raising=False)
    monkeypatch.delenv("ORBIT_COMPANY_ID", raising=False)


# --- Approach A: stamp at org-create -----------------------------------------

def test_create_org_stamps_portal_org_id_when_provided(db):
    org = OrganizationsService.create_org(
        db, name="Acme", slug="acme", portal_org_id=_SECOND_CUID
    )
    assert org.portal_org_id == _SECOND_CUID
    # Persisted, not just set on the transient instance.
    fetched = OrganizationsService.get_org_by_id(db, org.id)
    assert fetched.portal_org_id == _SECOND_CUID


def test_create_org_leaves_portal_org_id_null_when_absent(db):
    org = OrganizationsService.create_org(db, name="NoPortal", slug="noportal")
    assert org.portal_org_id is None
    # Empty string is normalized to NULL, never stored as "".
    org2 = OrganizationsService.create_org(
        db, name="Empty", slug="empty", portal_org_id=""
    )
    assert org2.portal_org_id is None


# --- Second org resolves to its OWN company (not the Orbit default) ------------

def test_second_org_resolves_to_own_uuid5_not_orbit_default(db):
    """The core issue-#23 assertion: a distinct second org resolves to its own
    per-org uuid5 company, NOT collapsing onto the Orbit default …c0de."""
    # Orbit default org (pinned) + a distinct second org, both provisioned via A.
    OrganizationsService.create_org(
        db, name="My Organization", slug="default", portal_org_id=_ORBIT_CUID
    )
    second = OrganizationsService.create_org(
        db, name="Acme", slug="acme", portal_org_id=_SECOND_CUID
    )

    expected = str(
        uuid.uuid5(conductor_bridge._PORTAL_ORG_UUID_NAMESPACE, _SECOND_CUID)
    )
    resolved = conductor_bridge._resolve_company_for_chat(db, second.id)

    assert resolved == expected
    assert resolved != _C0DE  # NOT collapsed onto the Orbit default pin
    # And it is genuinely distinct from the Orbit org's derived company.
    orbit_derived = str(
        uuid.uuid5(conductor_bridge._PORTAL_ORG_UUID_NAMESPACE, _ORBIT_CUID)
    )
    assert resolved != orbit_derived


# --- Approach B: idempotent reconcile helper ---------------------------------

def test_stamp_reconcile_stamps_null_row(db):
    org = OrganizationsService.create_org(db, name="Legacy", slug="legacy")
    assert org.portal_org_id is None

    stamped = OrganizationsService.stamp_portal_org_id(db, org.id, _SECOND_CUID)
    assert stamped is True
    assert OrganizationsService.get_org_by_id(db, org.id).portal_org_id == _SECOND_CUID


def test_stamp_reconcile_never_overwrites_non_null(db):
    org = OrganizationsService.create_org(
        db, name="Already", slug="already", portal_org_id=_SECOND_CUID
    )
    # A different CUID must NOT clobber the existing value.
    stamped = OrganizationsService.stamp_portal_org_id(db, org.id, "clOTHERvalue0000zzzz")
    assert stamped is False
    assert OrganizationsService.get_org_by_id(db, org.id).portal_org_id == _SECOND_CUID


def test_stamp_reconcile_leaves_default_org_untouched(db):
    # NULL 'default' row (e.g. migration 002 not yet applied) is still left alone.
    org = OrganizationsService.create_org(db, name="My Organization", slug="default")
    stamped = OrganizationsService.stamp_portal_org_id(db, org.id, _ORBIT_CUID)
    assert stamped is False
    assert OrganizationsService.get_org_by_id(db, org.id).portal_org_id is None


def test_stamp_reconcile_unaffected_by_slug_refresh(db):
    """#79 follow-up non-interference: the identity refresh may rename a BOUND org's
    slug away from 'default'. That cannot re-open this backfill, because the non-null
    portal_org_id check short-circuits BEFORE the slug check (organizations.py:86) —
    so a renamed bound row is still refused, and its binding is never overwritten."""
    org = OrganizationsService.create_org(
        db, name="My Organization", slug="default", portal_org_id=_ORBIT_CUID
    )
    org.slug = "orbit"  # what the refresh does to a bound placeholder
    db.commit()

    assert OrganizationsService.stamp_portal_org_id(db, org.id, _SECOND_CUID) is False
    assert OrganizationsService.get_org_by_id(db, org.id).portal_org_id == _ORBIT_CUID


def test_stamp_reconcile_unknown_row_is_noop(db):
    assert OrganizationsService.stamp_portal_org_id(db, "does-not-exist", _SECOND_CUID) is False


def test_stamp_reconcile_guards_empty_inputs(db):
    assert OrganizationsService.stamp_portal_org_id(db, "", _SECOND_CUID) is False
    assert OrganizationsService.stamp_portal_org_id(db, "x", "") is False


# --- #43: get_tenant_session must NEVER stamp on a read (fail-closed) ---------
#
# The old #66 Approach-B request-path reconcile stamped portal_org_id here, which
# let the FIRST Portal caller CLAIM an unstamped legacy org (trust-on-first-use).
# That call has been removed: the tenant-session read now assigns NO ownership. A
# NULL row stays NULL and fails closed downstream at require_org_access (#41).

class _FakeState:
    def __init__(self, portal_cuid, state_org_id, portal_token=None):
        self.portal_auth = types.SimpleNamespace(org_id=portal_cuid) if portal_cuid else None
        self.org_id = state_org_id
        self.portal_token = portal_token


class _FakeRequest:
    """Minimal stand-in for the pieces get_tenant_session reads."""

    def __init__(self, portal_cuid=None, query_org_id=None, state_org_id=None, portal_token=None):
        self.state = _FakeState(portal_cuid, state_org_id, portal_token)
        self.query_params = {"org_id": query_org_id} if query_org_id else {}


def _drive(request, db):
    """Run the get_tenant_session generator body (up to yield) and close it."""
    gen = get_tenant_session(request, db)
    next(gen)  # (no-longer-stamping) hook + SET LOCAL (Postgres-only; skipped on SQLite)
    gen.close()


def test_tenant_session_does_not_stamp_null_org_on_portal_read(db):
    """#43 TOFU fix: a Portal-authed request (CUID on the JWT, internal id in ?org_id=)
    referencing a NULL-portal_org_id org MUST NOT claim it — the row stays NULL so the
    downstream require_org_access binding fails closed instead of serving the org."""
    org = OrganizationsService.create_org(db, name="Legacy", slug="legacy")
    assert org.portal_org_id is None
    # JWT carries the CUID; the frontend passes the INTERNAL org id as ?org_id=.
    req = _FakeRequest(portal_cuid=_SECOND_CUID, query_org_id=org.id)
    _drive(req, db)
    # Unchanged: the read did not assign ownership.
    assert OrganizationsService.get_org_by_id(db, org.id).portal_org_id is None


def test_tenant_session_no_stamp_without_portal_auth(db):
    """Phase-1 (no Portal JWT) request must not stamp anything."""
    org = OrganizationsService.create_org(db, name="Legacy", slug="legacy")
    req = _FakeRequest(portal_cuid=None, query_org_id=org.id, state_org_id=org.id)
    _drive(req, db)
    assert OrganizationsService.get_org_by_id(db, org.id).portal_org_id is None


def test_tenant_session_no_stamp_without_query_param(db):
    """Portal JWT present but no ?org_id= (can't map CUID -> row) → no stamp."""
    org = OrganizationsService.create_org(db, name="Legacy", slug="legacy")
    req = _FakeRequest(portal_cuid=_SECOND_CUID, query_org_id=None)
    _drive(req, db)
    assert OrganizationsService.get_org_by_id(db, org.id).portal_org_id is None


def test_tenant_session_skips_rls_on_sqlite(db, caplog):
    """#69: RLS `SET LOCAL` is Postgres-only. On SQLite (prod) get_tenant_session must
    NOT execute it — no RLS statement runs and no 'Failed to set RLS context' warning is
    logged (previously it raised + was caught on every tenant request)."""
    import logging

    assert db.get_bind().dialect.name == "sqlite"  # sanity: this is the prod dialect
    org = OrganizationsService.create_org(
        db, name="Legacy", slug="legacy", portal_org_id=_SECOND_CUID
    )

    executed: list[str] = []
    original_execute = db.execute

    def _spy(statement, *args, **kwargs):
        executed.append(str(statement))
        return original_execute(statement, *args, **kwargs)

    db.execute = _spy
    caplog.set_level(logging.WARNING, logger="atrium.middleware.tenant")
    # org_id present on state so the RLS branch is reached (and correctly skipped).
    req = _FakeRequest(portal_cuid=_SECOND_CUID, query_org_id=org.id, state_org_id=org.id)
    _drive(req, db)

    assert not any("SET LOCAL" in s for s in executed), executed
    assert not any(
        "Failed to set RLS context" in r.getMessage() for r in caplog.records
    ), [r.getMessage() for r in caplog.records]

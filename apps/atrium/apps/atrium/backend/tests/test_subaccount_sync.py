"""A1 (#27) — mirror an org's Portal sub-accounts into Atrium.

Covers the acceptance criteria:
  (a) a Portal response with 2 sub-accounts upserts 2 rows, ids == Portal ids VERBATIM;
  (b) re-sync is idempotent (no dupes; mutable fields update in place);
  (c) HTTP failure / empty list => no rows, no exception.

Plus: throttling (maybe_sync backs off per-org) and the read helper.

The Portal HTTP call is mocked by monkeypatching subaccount_sync._fetch_subaccounts,
so no network happens. Runs against an in-memory SQLite DB built from the
(conftest-stubbed) declarative Base — see apps/atrium/conftest.py.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from open_webui.internal.db import Base
from apps.atrium.backend.models.db import AtriumSubAccount
from apps.atrium.backend.services.organizations import OrganizationsService
from apps.atrium.backend.services import subaccount_sync


_PORTAL_CUID = "cdemoorg00000000000000001"
# Portal SubAccount ids are CUIDs — the exact strings we must store verbatim.
_SA1 = "clsubacct0001aaaabbbbcccc"
_SA2 = "clsubacct0002ddddeeeeffff"
_TOKEN = "portal.jwt.token"


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
def _reset_throttle():
    # The in-process throttle is module state; clear it between tests.
    subaccount_sync._last_attempt_ms.clear()
    yield
    subaccount_sync._last_attempt_ms.clear()


def _org(db):
    return OrganizationsService.create_org(
        db, name="Acme", slug="acme", portal_org_id=_PORTAL_CUID
    )


def _rows(db, org_id):
    return (
        db.query(AtriumSubAccount)
        .filter(AtriumSubAccount.org_id == org_id)
        .all()
    )


# --- (a) two sub-accounts upsert two rows with verbatim ids ------------------

def test_sync_upserts_two_rows_with_verbatim_ids(db, monkeypatch):
    org = _org(db)
    payload = [
        {"id": _SA1, "name": "Northwind", "slug": "northwind", "status": "active"},
        {"id": _SA2, "name": "Globex", "slug": "globex", "status": "active"},
    ]
    monkeypatch.setattr(subaccount_sync, "_fetch_subaccounts", lambda token: payload)

    n = subaccount_sync.sync_org_subaccounts(db, org.id, _PORTAL_CUID, _TOKEN)
    assert n == 2

    rows = _rows(db, org.id)
    assert {r.id for r in rows} == {_SA1, _SA2}  # ids stored VERBATIM, not minted
    by_id = {r.id: r for r in rows}
    assert by_id[_SA1].name == "Northwind"
    assert by_id[_SA1].slug == "northwind"
    assert by_id[_SA1].status == "active"
    # Ownership binding is recorded both ways (internal id + Portal CUID).
    assert by_id[_SA1].org_id == org.id
    assert by_id[_SA1].portal_org_id == _PORTAL_CUID


# --- (b) re-sync is idempotent (no dupes; updates fields) --------------------

def test_resync_is_idempotent_and_updates_fields(db, monkeypatch):
    org = _org(db)
    first = [
        {"id": _SA1, "name": "Northwind", "slug": "northwind", "status": "active"},
        {"id": _SA2, "name": "Globex", "slug": "globex", "status": "active"},
    ]
    monkeypatch.setattr(subaccount_sync, "_fetch_subaccounts", lambda token: first)
    subaccount_sync.sync_org_subaccounts(db, org.id, _PORTAL_CUID, _TOKEN)

    created_at_before = {r.id: r.created_at for r in _rows(db, org.id)}

    # Second pull: same ids, one renamed + status changed. No new rows expected.
    second = [
        {"id": _SA1, "name": "Northwind Traders", "slug": "northwind", "status": "paused"},
        {"id": _SA2, "name": "Globex", "slug": "globex", "status": "active"},
    ]
    monkeypatch.setattr(subaccount_sync, "_fetch_subaccounts", lambda token: second)
    n = subaccount_sync.sync_org_subaccounts(db, org.id, _PORTAL_CUID, _TOKEN)
    assert n == 2

    rows = _rows(db, org.id)
    assert len(rows) == 2  # NO duplicates
    by_id = {r.id: r for r in rows}
    assert by_id[_SA1].name == "Northwind Traders"  # updated in place
    assert by_id[_SA1].status == "paused"
    # created_at preserved (update, not re-create).
    assert by_id[_SA1].created_at == created_at_before[_SA1]


# --- (c) HTTP failure / empty => no rows, no exception -----------------------

def test_fetch_failure_is_noop(db, monkeypatch):
    org = _org(db)
    # _fetch_subaccounts returns None on any HTTP/network/shape failure.
    monkeypatch.setattr(subaccount_sync, "_fetch_subaccounts", lambda token: None)
    n = subaccount_sync.sync_org_subaccounts(db, org.id, _PORTAL_CUID, _TOKEN)
    assert n == 0
    assert _rows(db, org.id) == []


def test_empty_list_is_noop(db, monkeypatch):
    org = _org(db)
    monkeypatch.setattr(subaccount_sync, "_fetch_subaccounts", lambda token: [])
    n = subaccount_sync.sync_org_subaccounts(db, org.id, _PORTAL_CUID, _TOKEN)
    assert n == 0
    assert _rows(db, org.id) == []


def test_missing_token_is_noop(db, monkeypatch):
    org = _org(db)
    # No token -> we never even call Portal.
    called = {"n": 0}

    def _fetch(token):
        called["n"] += 1
        return [{"id": _SA1, "name": "x"}]

    monkeypatch.setattr(subaccount_sync, "_fetch_subaccounts", _fetch)
    n = subaccount_sync.sync_org_subaccounts(db, org.id, _PORTAL_CUID, None)
    assert n == 0
    assert called["n"] == 0
    assert _rows(db, org.id) == []


def test_entry_without_id_is_skipped(db, monkeypatch):
    org = _org(db)
    payload = [
        {"id": _SA1, "name": "Northwind"},
        {"name": "no-id-here"},  # malformed -> skipped, never minted
        {"id": "   ", "name": "blank-id"},  # blank -> skipped
    ]
    monkeypatch.setattr(subaccount_sync, "_fetch_subaccounts", lambda token: payload)
    n = subaccount_sync.sync_org_subaccounts(db, org.id, _PORTAL_CUID, _TOKEN)
    assert n == 1
    assert {r.id for r in _rows(db, org.id)} == {_SA1}


# --- throttling --------------------------------------------------------------

def test_maybe_sync_throttles_per_org(db, monkeypatch):
    org = _org(db)
    calls = {"n": 0}

    def _fetch(token):
        calls["n"] += 1
        return [{"id": _SA1, "name": "Northwind"}]

    monkeypatch.setattr(subaccount_sync, "_fetch_subaccounts", _fetch)

    subaccount_sync.maybe_sync(db, org.id, _PORTAL_CUID, _TOKEN)
    subaccount_sync.maybe_sync(db, org.id, _PORTAL_CUID, _TOKEN)
    subaccount_sync.maybe_sync(db, org.id, _PORTAL_CUID, _TOKEN)

    # Only the first attempt within the TTL window actually pulled.
    assert calls["n"] == 1
    assert len(_rows(db, org.id)) == 1


def test_maybe_sync_backs_off_even_on_failure(db, monkeypatch):
    """A failing Portal must also back off — the attempt timestamp is recorded
    before the pull, so we don't hammer an unreachable Portal every request."""
    org = _org(db)
    calls = {"n": 0}

    def _fetch(token):
        calls["n"] += 1
        return None  # simulate Portal down

    monkeypatch.setattr(subaccount_sync, "_fetch_subaccounts", _fetch)

    subaccount_sync.maybe_sync(db, org.id, _PORTAL_CUID, _TOKEN)
    subaccount_sync.maybe_sync(db, org.id, _PORTAL_CUID, _TOKEN)

    assert calls["n"] == 1  # throttled despite the first attempt failing
    assert _rows(db, org.id) == []


# --- response-shape normalization -------------------------------------------

def test_extract_list_accepts_bare_array_and_envelopes():
    assert subaccount_sync._extract_list([{"id": "a"}]) == [{"id": "a"}]
    assert subaccount_sync._extract_list({"data": [{"id": "b"}]}) == [{"id": "b"}]
    assert subaccount_sync._extract_list({"subAccounts": [{"id": "c"}]}) == [{"id": "c"}]
    assert subaccount_sync._extract_list({}) == []  # empty object -> no sub-accounts
    # The prod bug (#67): an org with 0 sub-accounts returns {"subAccounts": []}. The empty
    # list must parse as [] (no sub-accounts), NOT be misread as an unexpected/absent shape.
    assert subaccount_sync._extract_list({"subAccounts": []}) == []
    assert subaccount_sync._extract_list({"data": []}) == []
    assert subaccount_sync._extract_list([]) == []
    # Unexpected shapes -> None (treated as a failure by the caller).
    assert subaccount_sync._extract_list("nope") is None
    assert subaccount_sync._extract_list({"data": "notalist"}) is None


def test_sync_refuses_cross_tenant_reassignment(db, monkeypatch):
    """Defense-in-depth: a sub-account row already owned by one Portal org must never be
    STOLEN by a sync running for a DIFFERENT Portal org (a mismatched (org, token) call).
    Its org binding stays put; the offending sync skips that id."""
    org_a = OrganizationsService.create_org(db, name="A", slug="a", portal_org_id="cmportalaaaa0000aaaa0000")
    org_b = OrganizationsService.create_org(db, name="B", slug="b", portal_org_id="cmportalbbbb0000bbbb0000")

    # Org A legitimately owns SA1.
    monkeypatch.setattr(subaccount_sync, "_fetch_subaccounts",
                        lambda token: [{"id": _SA1, "name": "A-sub", "status": "active"}])
    subaccount_sync.sync_org_subaccounts(db, org_a.id, "cmportalaaaa0000aaaa0000", _TOKEN)
    row = db.query(AtriumSubAccount).filter_by(id=_SA1).one()
    assert row.org_id == org_a.id and row.portal_org_id == "cmportalaaaa0000aaaa0000"

    # A sync for org B that (wrongly) returns SA1 must NOT move it to B.
    subaccount_sync._last_attempt_ms.clear()
    subaccount_sync.sync_org_subaccounts(db, org_b.id, "cmportalbbbb0000bbbb0000", _TOKEN)
    row = db.query(AtriumSubAccount).filter_by(id=_SA1).one()
    assert row.org_id == org_a.id, "cross-tenant reassignment must be refused"
    assert row.portal_org_id == "cmportalaaaa0000aaaa0000"
    # And B did not gain a bogus copy.
    assert _rows(db, org_b.id) == []


# --- read helpers ------------------------------------------------------------

def test_list_subaccounts_returns_mirror(db, monkeypatch):
    org = _org(db)
    payload = [
        {"id": _SA1, "name": "Northwind"},
        {"id": _SA2, "name": "Globex"},
    ]
    monkeypatch.setattr(subaccount_sync, "_fetch_subaccounts", lambda token: payload)
    subaccount_sync.sync_org_subaccounts(db, org.id, _PORTAL_CUID, _TOKEN)

    listed = subaccount_sync.list_subaccounts(db, org.id)
    assert {r.id for r in listed} == {_SA1, _SA2}
    # Unknown org -> empty, never a crash.
    assert subaccount_sync.list_subaccounts(db, "no-such-org") == []


def test_list_active_subaccounts_filters_case_insensitively(db, monkeypatch):
    org = _org(db)
    org_id = str(org.id)
    payload = [
        {"id": _SA1, "name": "Northwind", "status": "ACTIVE"},
        {"id": _SA2, "name": "Globex", "status": "paused"},
        {"id": "clsubacct0003mixedcase", "name": "Initech", "status": "Active"},
    ]
    monkeypatch.setattr(subaccount_sync, "_fetch_subaccounts", lambda token: payload)
    subaccount_sync.sync_org_subaccounts(db, org_id, _PORTAL_CUID, _TOKEN)

    listed = subaccount_sync.list_active_subaccounts(db, org_id)
    assert {r.id for r in listed} == {_SA1, "clsubacct0003mixedcase"}


def test_resolve_active_subaccount_id_degrades_invalid_state_to_business_scope(db, monkeypatch):
    org = _org(db)
    org_id = str(org.id)
    payload = [
        {"id": _SA1, "name": "Northwind", "status": "active"},
        {"id": _SA2, "name": "Globex", "status": "paused"},
    ]
    monkeypatch.setattr(subaccount_sync, "_fetch_subaccounts", lambda token: payload)
    subaccount_sync.sync_org_subaccounts(db, org_id, _PORTAL_CUID, _TOKEN)

    assert subaccount_sync.resolve_active_subaccount_id(db, org_id, None) is None
    assert (
        subaccount_sync.resolve_active_subaccount_id(
            db, org_id, subaccount_sync.BUSINESS_SCOPE_SENTINEL
        )
        is None
    )
    assert subaccount_sync.resolve_active_subaccount_id(db, org_id, _SA1) == _SA1
    assert subaccount_sync.resolve_active_subaccount_id(db, org_id, _SA2) is None
    assert subaccount_sync.resolve_active_subaccount_id(db, org_id, "missing") is None
    assert subaccount_sync.resolve_active_subaccount_id(db, "other-org", _SA1) is None

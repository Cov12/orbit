"""Callback-path provisioning tests — atrium#50.

The deployed Atrium login is the server-side route
`apps/atrium/backend/routers/auth_callback.py::portal_auth_callback`
(GET /atrium/auth/callback). Historically the Portal->Atrium provisioning
(AtriumMember + per-org app_access, #45) lived ONLY in a `portal_token_exchange`
endpoint prod never called (it was hit by an unused Svelte page, since removed). So
provisioning never ran in prod: users were created but no
membership / app_access rows, and every OWUI-session auth gate fell through to the
ATRIUM_DEV_ALLOW_HEADER_AUTH rollout grace.

These tests pin the fix: a shared `OrganizationsService.provision_from_portal` helper,
exercised directly AND invoked from the REAL callback path (portal_auth_callback).
"""

import asyncio
import sys
import types

import jwt as pyjwt
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from open_webui.internal.db import Base
from apps.atrium.backend.models.db import (
    AtriumMember,
    AtriumOrganization,
)
from apps.atrium.backend.services.organizations import OrganizationsService

CUID = "cuidprovisionaaaaaaaaaaaa"
UID = "owui-user-provision"


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _payload(**over):
    p = {
        "sub": "user_clerk_x",
        "email": "owner@acme.test",
        "name": "Acme Owner",
        "org_id": CUID,
        "org_slug": "acme",
        "org_name": "Acme Inc",
        "role": "OWNER",  # Portal sends UPPERCASE — the helper must lowercase it.
        "app_access": ["ATRIUM", "DRIVE", "WORKPIPE"],
    }
    p.update(over)
    return p


# ---------------------------------------------------------------- helper unit tests

def test_provision_creates_org_member_and_app_access(db):
    OrganizationsService.provision_from_portal(db, UID, _payload())

    org = OrganizationsService.get_org_by_portal_id(db, CUID)
    assert org is not None and org.portal_org_id == CUID
    assert org.app_access == ["ATRIUM", "DRIVE", "WORKPIPE"]

    mem = db.query(AtriumMember).filter_by(org_id=org.id, user_id=UID).all()
    assert len(mem) == 1
    assert mem[0].role == "owner"  # normalized from "OWNER"


def test_provision_reuses_existing_org(db):
    db.add(
        AtriumOrganization(
            id="org-x", name="Acme", slug="acme", portal_org_id=CUID, app_access=[]
        )
    )
    db.commit()

    OrganizationsService.provision_from_portal(db, UID, _payload())

    orgs = db.query(AtriumOrganization).filter_by(portal_org_id=CUID).all()
    assert len(orgs) == 1 and orgs[0].id == "org-x"
    assert orgs[0].app_access == ["ATRIUM", "DRIVE", "WORKPIPE"]


# ------------------- #79 follow-up: refresh a bound org's name/slug from the token
#
# The find-or-create above only wrote name/slug on the CREATE branch, so an org the
# frontend auto-created as 'My Organization'/'default' and that was LATER bound to a
# real Portal org kept the placeholder identity on every subsequent login. These pin
# the refresh AND its guards (slug is UNIQUE — an unguarded update would raise and roll
# back the whole login-path provisioning).

# A distinct second Portal org, mirroring test_org_portal_stamp's _SECOND_CUID.
OTHER_CUID = "clsecondorg0000abcd1234wxyz"
# Portal org ids may be UUID-shaped too — the guards must not assume CUID.
UUID_ORG_ID = "3f1a7c62-9d84-4a11-b0c3-2f5e6a7b8c90"

Orbit = {"org_name": "Orbit", "org_slug": "orbit"}


def _seed(db, **over):
    """Seed the bound-but-placeholder org: name/slug the frontend auto-creates."""
    fields = dict(
        id="org-x",
        name="My Organization",
        slug="default",
        portal_org_id=CUID,
        app_access=[],
        updated_at=111,
    )
    fields.update(over)
    org = AtriumOrganization(**fields)
    db.add(org)
    db.commit()
    return org


def _assert_provisioned(db, org_id):
    """Regression guard: membership + app_access are applied whatever the refresh did."""
    mem = db.query(AtriumMember).filter_by(org_id=org_id, user_id=UID).all()
    assert len(mem) == 1 and mem[0].role == "owner"
    assert OrganizationsService.get_org_by_id(db, org_id).app_access == [
        "ATRIUM", "DRIVE", "WORKPIPE"
    ]


def test_provision_refreshes_placeholder_name_and_slug(db):
    """The bug: 'My Organization' / 'default' bound to a real Portal org stayed that way."""
    _seed(db)

    OrganizationsService.provision_from_portal(db, UID, _payload(**Orbit))

    org = OrganizationsService.get_org_by_portal_id(db, CUID)
    assert (org.name, org.slug) == ("Orbit", "orbit")
    assert org.portal_org_id == CUID  # binding never touched by the refresh
    assert db.query(AtriumOrganization).count() == 1  # refreshed in place, not re-created
    _assert_provisioned(db, org.id)


def test_provision_adopts_slug_when_slug_is_the_portal_org_id(db):
    """create_org's fallback slug IS the Portal org id — also a placeholder."""
    _seed(db, slug=CUID)

    OrganizationsService.provision_from_portal(db, UID, _payload(**Orbit))

    org = OrganizationsService.get_org_by_portal_id(db, CUID)
    assert org.slug == "orbit"
    assert org.portal_org_id == CUID


def test_provision_adopts_slug_when_slug_is_the_internal_id(db):
    _seed(db, id="org-selfslug", slug="org-selfslug")

    OrganizationsService.provision_from_portal(db, UID, _payload(**Orbit))

    org = OrganizationsService.get_org_by_portal_id(db, CUID)
    assert org.slug == "orbit"
    assert org.portal_org_id == CUID


def test_provision_refreshes_uuid_shaped_portal_org(db):
    """Portal ids can be UUIDs; the placeholder guards compare values, not shapes."""
    _seed(db, id="org-uuid", slug=UUID_ORG_ID, portal_org_id=UUID_ORG_ID)

    OrganizationsService.provision_from_portal(
        db, UID, _payload(org_id=UUID_ORG_ID, **Orbit)
    )

    org = OrganizationsService.get_org_by_portal_id(db, UUID_ORG_ID)
    assert (org.name, org.slug) == ("Orbit", "orbit")
    assert org.portal_org_id == UUID_ORG_ID


def test_identity_refresh_is_a_noop_when_nothing_changed(db):
    """A second identical login compares equal and writes NOTHING — not even updated_at.

    Asserted on the refresh helper directly: provision_from_portal's set_org_app_access
    bumps updated_at unconditionally, which would mask a spurious write here.
    """
    org = _seed(db, name="Orbit", slug="orbit", updated_at=111)

    changed = OrganizationsService._refresh_org_identity(db, org, _payload(**Orbit))

    assert changed is False
    fresh = OrganizationsService.get_org_by_id(db, "org-x")
    assert (fresh.name, fresh.slug, fresh.updated_at) == ("Orbit", "orbit", 111)
    assert fresh.portal_org_id == CUID


def test_provision_slug_collision_keeps_existing_slug(db):
    """slug is UNIQUE: when another row already holds the incoming slug we must keep
    ours, log, and let provisioning finish — never raise into the login path."""
    _seed(db)
    db.add(
        AtriumOrganization(
            id="org-other", name="Someone Else", slug="orbit",
            portal_org_id=OTHER_CUID, app_access=[],
        )
    )
    db.commit()

    OrganizationsService.provision_from_portal(db, UID, _payload(**Orbit))

    org = OrganizationsService.get_org_by_portal_id(db, CUID)
    assert org.slug == "default"        # kept — no IntegrityError, no theft
    assert org.name == "Orbit"           # display name still refreshed
    assert org.portal_org_id == CUID
    # The colliding row is untouched, and provisioning completed regardless.
    other = OrganizationsService.get_org_by_id(db, "org-other")
    assert (other.slug, other.name, other.portal_org_id) == (
        "orbit", "Someone Else", OTHER_CUID
    )
    _assert_provisioned(db, org.id)


def test_provision_does_not_adopt_placeholder_incoming_slug(db):
    """An incoming 'default' / id-as-slug is itself a placeholder — never adopted."""
    for incoming in ("default", CUID, "", "   ", None):
        db.query(AtriumMember).delete()
        db.query(AtriumOrganization).delete()
        db.commit()
        _seed(db, slug="org-x-slug")

        OrganizationsService.provision_from_portal(
            db, UID, _payload(org_name="Orbit", org_slug=incoming)
        )

        org = OrganizationsService.get_org_by_portal_id(db, CUID)
        assert org.slug == "org-x-slug", f"adopted placeholder slug {incoming!r}"
        assert org.portal_org_id == CUID
        _assert_provisioned(db, org.id)


def test_provision_never_renames_a_real_slug(db):
    """A deliberately chosen slug is routing-visible — a token must not rename it."""
    _seed(db, name="Acme", slug="acme")

    OrganizationsService.provision_from_portal(db, UID, _payload(**Orbit))

    org = OrganizationsService.get_org_by_portal_id(db, CUID)
    assert org.slug == "acme"   # not a placeholder -> untouched
    assert org.name == "Orbit"   # name is display-only -> still refreshed
    assert org.portal_org_id == CUID
    _assert_provisioned(db, org.id)


def test_provision_keeps_name_when_incoming_is_blank(db):
    _seed(db, name="Acme", slug="acme")

    OrganizationsService.provision_from_portal(
        db, UID, _payload(org_name="", org_slug="acme")
    )

    org = OrganizationsService.get_org_by_portal_id(db, CUID)
    assert org.name == "Acme"
    assert org.portal_org_id == CUID


def test_identity_refresh_failure_does_not_break_provisioning(db, monkeypatch):
    """Never-raises contract: even if the refresh blows up, login-path provisioning
    (membership + app_access) still completes."""
    _seed(db)

    def boom(_db, slug):
        raise RuntimeError("slug lookup exploded")

    monkeypatch.setattr(
        OrganizationsService, "get_org_by_slug", staticmethod(boom)
    )

    OrganizationsService.provision_from_portal(db, UID, _payload(**Orbit))

    org = OrganizationsService.get_org_by_portal_id(db, CUID)
    assert org.slug == "default"
    assert org.portal_org_id == CUID
    _assert_provisioned(db, org.id)


def test_provision_idempotent_updates_role_no_dup(db):
    OrganizationsService.provision_from_portal(db, UID, _payload(role="MEMBER"))
    OrganizationsService.provision_from_portal(db, UID, _payload(role="OWNER"))

    org = OrganizationsService.get_org_by_portal_id(db, CUID)
    mem = db.query(AtriumMember).filter_by(org_id=org.id, user_id=UID).all()
    assert len(mem) == 1
    assert mem[0].role == "owner"


def test_provision_skips_without_org_id(db):
    OrganizationsService.provision_from_portal(db, UID, _payload(org_id=None))
    assert db.query(AtriumOrganization).count() == 0
    assert db.query(AtriumMember).count() == 0


# ------------------------------------------------- the REAL deployed path (the fix)

def _install_owui_stubs_for_callback():
    """auth_callback.py imports several open_webui submodules the unit-test conftest
    doesn't stub (models.users/auths, utils.auth/groups/misc, env). Stub ONLY the ones
    that aren't already importable, so a full-deps env exercises the real modules and a
    min-deps env can still import + run this test (the whole point: test the REAL path).
    The test monkeypatches the behaviors it cares about; these stubs only satisfy import.
    """
    def _importable(name):
        try:
            __import__(name)
            return True
        except Exception:
            return False

    sys.modules.setdefault("open_webui", types.ModuleType("open_webui"))
    for pkg in ("open_webui.models", "open_webui.utils"):
        sys.modules.setdefault(pkg, types.ModuleType(pkg))

    if not _importable("open_webui.models.users"):
        m = types.ModuleType("open_webui.models.users")

        class Users:
            @staticmethod
            def get_user_by_email(email, db=None):
                return None

            @staticmethod
            def has_users(db=None):
                return True

            @staticmethod
            def update_user_by_id(uid, data, db=None):
                return None

        m.Users = Users
        sys.modules["open_webui.models.users"] = m

    if not _importable("open_webui.models.auths"):
        m = types.ModuleType("open_webui.models.auths")

        class Auths:
            @staticmethod
            def insert_new_auth(**kwargs):
                return None

        m.Auths = Auths
        sys.modules["open_webui.models.auths"] = m

    if not _importable("open_webui.utils.auth"):
        m = types.ModuleType("open_webui.utils.auth")
        m.get_password_hash = lambda pw: "hash"
        m.create_token = lambda **kwargs: "tok"
        sys.modules["open_webui.utils.auth"] = m

    if not _importable("open_webui.utils.groups"):
        m = types.ModuleType("open_webui.utils.groups")
        m.apply_default_group_assignment = lambda *a, **k: None
        sys.modules["open_webui.utils.groups"] = m

    if not _importable("open_webui.utils.misc"):
        m = types.ModuleType("open_webui.utils.misc")
        m.parse_duration = lambda v: None
        sys.modules["open_webui.utils.misc"] = m

    if not _importable("open_webui.env"):
        m = types.ModuleType("open_webui.env")
        m.WEBUI_AUTH_COOKIE_SAME_SITE = "lax"
        m.WEBUI_AUTH_COOKIE_SECURE = False
        sys.modules["open_webui.env"] = m


def test_portal_auth_callback_invokes_provisioning(monkeypatch, db):
    """The bug: portal_auth_callback (the path prod uses) never provisioned. Assert it
    now calls provision_from_portal with the resolved OWUI user.id and decoded claims."""
    _install_owui_stubs_for_callback()
    from apps.atrium.backend.routers import auth_callback

    monkeypatch.setenv("JWT_SECRET", "test-portal-secret")

    # User resolution isn't the subject — return an existing OWUI user.
    fake_user = types.SimpleNamespace(id=UID, name="Acme Owner")
    monkeypatch.setattr(
        auth_callback.Users,
        "get_user_by_email",
        staticmethod(lambda email, db=None: fake_user),
    )
    monkeypatch.setattr(auth_callback, "create_token", lambda **k: "owui-token")
    monkeypatch.setattr(auth_callback, "parse_duration", lambda v: None)
    # Point the callback's `next(get_session())` at our in-memory session.
    monkeypatch.setattr(auth_callback, "get_session", lambda: iter([db]))

    captured = {}

    def spy(_db, user_id, payload):
        captured["user_id"] = user_id
        captured["payload"] = payload

    monkeypatch.setattr(
        OrganizationsService, "provision_from_portal", staticmethod(spy)
    )

    token = pyjwt.encode(_payload(), "test-portal-secret", algorithm="HS256")
    req = types.SimpleNamespace(
        app=types.SimpleNamespace(
            state=types.SimpleNamespace(
                config=types.SimpleNamespace(
                    DEFAULT_GROUP_ID=None, JWT_EXPIRES_IN="1h"
                )
            )
        ),
        url="http://test/atrium/auth/callback",
    )

    resp = asyncio.run(auth_callback.portal_auth_callback(request=req, token=token))

    assert resp.status_code == 303
    assert captured.get("user_id") == UID
    assert captured["payload"]["org_id"] == CUID
    assert captured["payload"]["app_access"] == ["ATRIUM", "DRIVE", "WORKPIPE"]
    assert captured["payload"]["role"] == "OWNER"


def test_portal_auth_callback_syncs_subaccounts(monkeypatch, db):
    """Sub-account mirror sync must run at LOGIN (the only place with the raw Portal JWT),
    not on the OWUI request path — else the mirror stays empty and the dashboard shows 0
    sub-accounts (atrium#67). Assert the callback calls maybe_sync with the resolved
    internal org id, the Portal CUID, and the RAW token."""
    _install_owui_stubs_for_callback()
    from apps.atrium.backend.routers import auth_callback
    from apps.atrium.backend.services import subaccount_sync

    monkeypatch.setenv("JWT_SECRET", "test-portal-secret")
    fake_user = types.SimpleNamespace(id=UID, name="Acme Owner")
    monkeypatch.setattr(auth_callback.Users, "get_user_by_email",
                        staticmethod(lambda email, db=None: fake_user))
    monkeypatch.setattr(auth_callback, "create_token", lambda **k: "owui-token")
    monkeypatch.setattr(auth_callback, "parse_duration", lambda v: None)
    monkeypatch.setattr(auth_callback, "get_session", lambda: iter([db]))
    # provisioning creates the org row so get_org_by_portal_id resolves it
    monkeypatch.setattr(
        OrganizationsService, "provision_from_portal",
        staticmethod(lambda _db, uid, payload: db.add(AtriumOrganization(
            id="org-synced", name="Acme", slug="acme", portal_org_id=CUID)) or db.commit()),
    )

    captured = {}
    monkeypatch.setattr(subaccount_sync, "maybe_sync",
                        lambda _db, org_id, cuid, tok: captured.update(
                            org_id=org_id, cuid=cuid, tok=tok))

    token = pyjwt.encode(_payload(), "test-portal-secret", algorithm="HS256")
    req = types.SimpleNamespace(
        app=types.SimpleNamespace(state=types.SimpleNamespace(
            config=types.SimpleNamespace(DEFAULT_GROUP_ID=None, JWT_EXPIRES_IN="1h"))),
        url="http://test/atrium/auth/callback",
    )
    resp = asyncio.run(auth_callback.portal_auth_callback(request=req, token=token))
    assert resp.status_code == 303
    assert captured.get("org_id") == "org-synced"
    assert captured.get("cuid") == CUID
    assert captured.get("tok") == token   # the RAW Portal JWT, not the OWUI token

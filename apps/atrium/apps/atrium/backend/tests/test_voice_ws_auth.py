"""Voice WS authorization tests — atrium#55.

`voice._authorize_voice_ws` must bind a voice WS to the caller's REAL identity —
mirroring middleware/deps.require_org_access — with NO unauthenticated fallback.
Previously the handler accepted any token and trusted the query-param org_id.
"""

import time

import pytest
from jose import jwt as jose_jwt
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from open_webui.internal.db import Base
from apps.atrium.backend.models.db import (
    AtriumMember,
    AtriumOrganization,
    now_ms,
)
from apps.atrium.backend.routers import voice

PORTAL_SECRET = "test-portal-secret"
OWUI_SECRET = "test-owui-secret"
ORG_A = "org-internal-a"          # Atrium-internal id
CUID_A = "cuidorgaaaaaaaaaaaaaaaaaa"  # its Portal CUID
ORG_B = "org-internal-b"
CUID_B = "cuidorgbbbbbbbbbbbbbbbbbb"
USER = "owui-user-1"              # member of ORG_A only


@pytest.fixture(autouse=True)
def _secrets(monkeypatch):
    # Distinct secrets: Portal decode must fail for an OWUI token and vice-versa.
    monkeypatch.setattr(voice, "JWT_SECRET", PORTAL_SECRET)
    monkeypatch.setenv("WEBUI_SECRET_KEY", OWUI_SECRET)


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    session.add(AtriumOrganization(id=ORG_A, name="A", slug="a", portal_org_id=CUID_A))
    session.add(AtriumOrganization(id=ORG_B, name="B", slug="b", portal_org_id=CUID_B))
    session.add(
        AtriumMember(id="m1", org_id=ORG_A, user_id=USER, role="member", created_at=now_ms())
    )
    session.commit()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _portal_token(org_cuid, sub="user_clerk"):
    return jose_jwt.encode(
        {"sub": sub, "org_id": org_cuid, "exp": int(time.time()) + 300},
        PORTAL_SECRET, algorithm="HS256",
    )


def _owui_token(user_id):
    return jose_jwt.encode(
        {"id": user_id, "exp": int(time.time()) + 300}, OWUI_SECRET, algorithm="HS256"
    )


# ---- Portal-JWT path ----

def test_portal_jwt_matching_org_authorized(db):
    assert voice._authorize_voice_ws(_portal_token(CUID_A), ORG_A, db) == "user_clerk"


def test_portal_jwt_wrong_org_rejected(db):
    # Token minted for CUID_A but requesting ORG_B (a different org) → reject.
    assert voice._authorize_voice_ws(_portal_token(CUID_A), ORG_B, db) is None


# ---- OWUI-session path ----

def test_owui_member_authorized(db):
    assert voice._authorize_voice_ws(_owui_token(USER), ORG_A, db) == USER


def test_owui_nonmember_rejected(db):
    # USER is a member of ORG_A, not ORG_B → reject (the IDOR case).
    assert voice._authorize_voice_ws(_owui_token(USER), ORG_B, db) is None


def test_owui_unknown_user_rejected(db):
    assert voice._authorize_voice_ws(_owui_token("stranger"), ORG_A, db) is None


# ---- no unauthenticated fallback ----

def test_garbage_token_rejected(db):
    assert voice._authorize_voice_ws("not-a-jwt", ORG_A, db) is None


def test_owui_token_signed_with_wrong_secret_rejected(db):
    forged = jose_jwt.encode({"id": USER}, "attacker-secret", algorithm="HS256")
    assert voice._authorize_voice_ws(forged, ORG_A, db) is None

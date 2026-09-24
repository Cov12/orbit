"""Engram (mem0) seed forwarder — conductor_bridge.seed_engram.

Onboarding P1 seeds the org's captured context into Hermes' long-term memory through a
Conductor core route. The contract this file pins:
  - URL is derived from the bridge ORIGIN (like ensure-agent), env-overridable;
  - the shared x-orbit-bridge-secret authenticates it, and companyId resolves exactly as
    chat resolves it;
  - subAccountId is omitted unless supplied (company/business scope by default);
  - EVERY failure mode degrades to {ok: False, error} and NEVER raises — onboarding must
    not break because seeding did.
"""

import asyncio

import httpx
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from open_webui.internal.db import Base
from apps.atrium.backend.models.db import AtriumOrganization
from apps.atrium.backend.services import conductor_bridge

ORG = "org-internal-seed"
CUID = "cmorgseedxxxxxxxxxxxxxxxx"
SECRET = "seed-secret"
FACTS = ["Industry: SaaS", "Primary goal right now: Hit $1M ARR"]


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    session.add(AtriumOrganization(id=ORG, name="X", slug="x", portal_org_id=CUID))
    session.commit()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


class _FakeResponse:
    def __init__(self, status_code, payload=None, raise_json=False):
        self.status_code = status_code
        self._payload = payload if payload is not None else {}
        self._raise_json = raise_json
        self.text = ""

    def json(self):
        if self._raise_json:
            raise ValueError("not json")
        return self._payload


class _FakeClient:
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


def _patch(monkeypatch, fake):
    monkeypatch.setenv("ORBIT_BRIDGE_SECRET", SECRET)
    monkeypatch.setattr(conductor_bridge.httpx, "AsyncClient", lambda **kw: fake)
    return fake


# --- URL resolution ----------------------------------------------------------

def test_seed_url_is_core_route_derived_from_bridge_origin(monkeypatch):
    monkeypatch.setattr(
        conductor_bridge, "_bridge_url",
        lambda: "https://conductor.example/api/plugins/pid/api/chat",
    )
    monkeypatch.delenv("CONDUCTOR_ENGRAM_SEED_URL", raising=False)
    assert conductor_bridge._engram_seed_url() == "https://conductor.example/api/bridge/engram-seed"


def test_seed_url_env_override(monkeypatch):
    monkeypatch.setenv("CONDUCTOR_ENGRAM_SEED_URL", "https://x.example/seed")
    assert conductor_bridge._engram_seed_url() == "https://x.example/seed"


# --- happy path --------------------------------------------------------------

def test_seed_posts_company_facts_and_secret(db, monkeypatch):
    fake = _patch(monkeypatch, _FakeClient(_FakeResponse(200, {"seeded": 2, "scope": "business"})))

    result = asyncio.run(conductor_bridge.seed_engram(db, ORG, FACTS))

    assert result == {"ok": True, "seeded": 2, "scope": "business"}
    call = fake.calls[0]
    assert call["url"] == conductor_bridge._engram_seed_url()
    assert call["headers"]["x-orbit-bridge-secret"] == SECRET
    assert call["json"]["companyId"] == conductor_bridge._resolve_company_id(CUID)
    assert call["json"]["facts"] == FACTS
    # Default is company/business scope, matching how /chat scopes memory.
    assert "subAccountId" not in call["json"]


def test_seed_forwards_sub_account_id_when_given(db, monkeypatch):
    fake = _patch(monkeypatch, _FakeClient(_FakeResponse(201, {})))

    result = asyncio.run(conductor_bridge.seed_engram(db, ORG, FACTS, sub_account_id="sub-9"))

    assert result["ok"] is True
    assert fake.calls[0]["json"]["subAccountId"] == "sub-9"


def test_seed_passes_structured_facts_through_unchanged(db, monkeypatch):
    """Conductor accepts {fact, kind, confidence} objects as well as plain strings."""
    fake = _patch(monkeypatch, _FakeClient(_FakeResponse(200, {})))
    structured = [{"fact": "Industry: SaaS", "kind": "profile", "confidence": 0.9}]

    assert asyncio.run(conductor_bridge.seed_engram(db, ORG, structured))["ok"] is True
    assert fake.calls[0]["json"]["facts"] == structured


def test_seed_wraps_non_dict_json_body(db, monkeypatch):
    _patch(monkeypatch, _FakeClient(_FakeResponse(200, ["a", "b"])))
    assert asyncio.run(conductor_bridge.seed_engram(db, ORG, FACTS)) == {
        "ok": True,
        "result": ["a", "b"],
    }


# --- non-fatal failure modes -------------------------------------------------

def test_seed_without_secret_is_a_noop(db, monkeypatch):
    fake = _FakeClient(_FakeResponse(200, {}))
    monkeypatch.delenv("ORBIT_BRIDGE_SECRET", raising=False)
    monkeypatch.setattr(conductor_bridge.httpx, "AsyncClient", lambda **kw: fake)

    result = asyncio.run(conductor_bridge.seed_engram(db, ORG, FACTS))

    assert result["ok"] is False
    assert fake.calls == []  # never left the process


def test_seed_with_no_facts_is_a_noop(db, monkeypatch):
    fake = _patch(monkeypatch, _FakeClient(_FakeResponse(200, {})))
    assert asyncio.run(conductor_bridge.seed_engram(db, ORG, []))["ok"] is False
    assert fake.calls == []


@pytest.mark.parametrize(
    "make_fake",
    [
        lambda: _FakeClient(_FakeResponse(500, {"error": "kaboom"})),
        lambda: _FakeClient(_FakeResponse(404, {})),
        lambda: _FakeClient(exc=httpx.TimeoutException("slow")),
        lambda: _FakeClient(exc=httpx.RequestError("no route")),
        lambda: _FakeClient(exc=RuntimeError("unexpected")),
        lambda: _FakeClient(_FakeResponse(200, raise_json=True)),
    ],
    ids=["500", "404", "timeout", "transport", "unexpected", "non-json"],
)
def test_seed_degrades_without_raising(db, monkeypatch, make_fake):
    _patch(monkeypatch, make_fake())

    result = asyncio.run(conductor_bridge.seed_engram(db, ORG, FACTS))

    assert result["ok"] is False
    assert result["error"]


def test_seed_falls_back_to_default_company_without_db(monkeypatch):
    """No db/org (or an unknown org) still seeds — at the default company, like chat."""
    fake = _patch(monkeypatch, _FakeClient(_FakeResponse(200, {})))

    assert asyncio.run(conductor_bridge.seed_engram(None, None, FACTS))["ok"] is True
    assert fake.calls[0]["json"]["companyId"] == conductor_bridge._default_company_id()

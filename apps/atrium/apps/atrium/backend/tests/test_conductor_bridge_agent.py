"""Per-company Conductor assistant resolution — the bridge must not send a hardcoded
agent id (it 404s for any company but Orbit). It resolves a cached per-org agent, else
the Orbit pin for the default company, else provisions one via ensure-agent and caches it;
and re-provisions + retries once on a bridge 404.
"""

import asyncio

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from open_webui.internal.db import Base
from apps.atrium.backend.models.db import AtriumOrganization
from apps.atrium.backend.services import conductor_bridge

ORG = "org-internal-x"
CUID = "cmorgxxxxxxxxxxxxxxxxxxxx"


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


def _async(value):
    async def _fn(*a, **k):
        return value
    return _fn


def test_resolve_uses_cached_agent(db, monkeypatch):
    db.query(AtriumOrganization).filter_by(id=ORG).update({"conductor_agent_id": "cached-agent"})
    db.commit()
    calls = []
    async def _ensure(cid):
        calls.append(cid)
        return "new-agent"
    monkeypatch.setattr(conductor_bridge, "_ensure_company_agent", _ensure)
    agent = asyncio.run(conductor_bridge._resolve_agent_id(db, ORG, "some-company"))
    assert agent == "cached-agent"
    assert calls == []  # cached → no provisioning call


def test_resolve_default_company_uses_orbit_pin(db, monkeypatch):
    monkeypatch.setenv("ORBIT_AGENT_ID", "orbit-agent-14d3")
    monkeypatch.setattr(conductor_bridge, "_default_company_id", lambda: "orbit-company")
    calls = []
    async def _ensure(cid):
        calls.append(cid)
        return "x"
    monkeypatch.setattr(conductor_bridge, "_ensure_company_agent", _ensure)
    agent = asyncio.run(conductor_bridge._resolve_agent_id(db, ORG, "orbit-company"))
    assert agent == "orbit-agent-14d3"
    assert calls == []  # pinned → no provisioning call


def test_resolve_provisions_and_caches(db, monkeypatch):
    monkeypatch.delenv("ORBIT_AGENT_ID", raising=False)
    monkeypatch.setattr(conductor_bridge, "_default_company_id", lambda: "orbit-company")
    monkeypatch.setattr(conductor_bridge, "_ensure_company_agent", _async("provisioned-agent"))
    agent = asyncio.run(conductor_bridge._resolve_agent_id(db, ORG, "some-other-company"))
    assert agent == "provisioned-agent"
    row = db.query(AtriumOrganization).filter_by(id=ORG).first()
    assert row.conductor_agent_id == "provisioned-agent"  # cached for next time


def test_handle_chat_reprovisions_and_retries_on_404(db, monkeypatch):
    calls = {"send": 0, "ensure": 0}

    async def _send(**kw):
        calls["send"] += 1
        if calls["send"] == 1:
            return {"ok": False, "error": "bridge returned 404", "status_code": 404}
        return {"ok": True, "response": "the launch is Q4", "sessionId": "s1"}

    async def _ensure(cid):
        calls["ensure"] += 1
        return "reprovisioned-agent"

    monkeypatch.setattr(conductor_bridge, "_send", _send)
    monkeypatch.setattr(conductor_bridge, "_ensure_company_agent", _ensure)
    monkeypatch.setattr(conductor_bridge, "_resolve_company_for_chat", lambda db, org: "company-x")
    monkeypatch.setattr(conductor_bridge, "_resolve_agent_id", _async("stale-agent"))
    monkeypatch.setattr(conductor_bridge, "_load_session_id", lambda db, cid: None)
    monkeypatch.setattr(conductor_bridge, "_save_session_id", lambda *a, **k: None)

    result = asyncio.run(conductor_bridge.handle_chat("hi", ORG, chat_id="c1", db=db))
    assert result["status"] == "ok"
    assert result["content"] == "the launch is Q4"
    assert calls["send"] == 2   # retried after 404
    assert calls["ensure"] == 1  # re-provisioned once


def test_ensure_agent_url_is_core_route(monkeypatch):
    monkeypatch.setattr(
        conductor_bridge, "_bridge_url",
        lambda: "https://conductor.example/api/plugins/pid/api/chat",
    )
    monkeypatch.delenv("CONDUCTOR_ENSURE_AGENT_URL", raising=False)
    assert conductor_bridge._ensure_agent_url() == "https://conductor.example/api/bridge/ensure-agent"


def test_ensure_agent_url_env_override(monkeypatch):
    monkeypatch.setenv("CONDUCTOR_ENSURE_AGENT_URL", "https://x.example/ensure")
    assert conductor_bridge._ensure_agent_url() == "https://x.example/ensure"

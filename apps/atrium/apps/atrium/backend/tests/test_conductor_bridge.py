import pytest
from unittest.mock import AsyncMock, MagicMock

from apps.atrium.backend.services import conductor_bridge


class _FakeResponse:
    def __init__(self, status_code, payload=None, raise_json=False):
        self.status_code = status_code
        self._payload = payload or {}
        self._raise_json = raise_json

    def json(self):
        if self._raise_json:
            raise ValueError("no json")
        return self._payload


class _FakeClient:
    """Stands in for httpx.AsyncClient(...) used as an async context manager."""

    def __init__(self, resp=None, exc=None):
        self._resp = resp
        self._exc = exc
        self.calls = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *a):
        return False

    async def post(self, url, json=None, headers=None):
        self.calls.append({"url": url, "json": json, "headers": headers})
        if self._exc:
            raise self._exc
        return self._resp


def _patch_client(monkeypatch, fake):
    monkeypatch.setattr(conductor_bridge.httpx, "AsyncClient", lambda **kw: fake)


def test_is_enabled(monkeypatch):
    monkeypatch.delenv("ORBIT_BRIDGE_ENABLED", raising=False)
    assert conductor_bridge.is_enabled() is False
    for v in ("1", "true", "TRUE", "yes", "on"):
        monkeypatch.setenv("ORBIT_BRIDGE_ENABLED", v)
        assert conductor_bridge.is_enabled() is True
    monkeypatch.setenv("ORBIT_BRIDGE_ENABLED", "false")
    assert conductor_bridge.is_enabled() is False


@pytest.mark.asyncio
async def test_send_missing_config(monkeypatch):
    monkeypatch.delenv("ORBIT_BRIDGE_SECRET", raising=False)
    out = await conductor_bridge._send("hi", "co", "ag", None)
    assert out["ok"] is False and "SECRET" in out["error"]

    monkeypatch.setenv("ORBIT_BRIDGE_SECRET", "s")
    out = await conductor_bridge._send("hi", "", "ag", None)
    assert out["ok"] is False and "COMPANY" in out["error"]


@pytest.mark.asyncio
async def test_send_success_threads_session_and_secret(monkeypatch):
    monkeypatch.setenv("ORBIT_BRIDGE_SECRET", "secret")
    fake = _FakeClient(
        _FakeResponse(201, {"response": "hello", "sessionId": "s1", "runId": "r1", "created": True})
    )
    _patch_client(monkeypatch, fake)

    out = await conductor_bridge._send("hi", "co1", "ag1", "prev-session")
    assert out == {
        "ok": True,
        "response": "hello",
        "sessionId": "s1",
        "runId": "r1",
        "created": True,
    }
    body = fake.calls[0]["json"]
    assert body == {
        "companyId": "co1",
        "agentId": "ag1",
        "prompt": "hi",
        "sessionId": "prev-session",
    }
    assert fake.calls[0]["headers"]["x-orbit-bridge-secret"] == "secret"


@pytest.mark.asyncio
async def test_send_omits_session_when_none(monkeypatch):
    monkeypatch.setenv("ORBIT_BRIDGE_SECRET", "secret")
    fake = _FakeClient(_FakeResponse(201, {"response": "x", "sessionId": "s"}))
    _patch_client(monkeypatch, fake)
    await conductor_bridge._send("hi", "co", "ag", None)
    assert "sessionId" not in fake.calls[0]["json"]


@pytest.mark.asyncio
async def test_send_includes_subaccount_when_present(monkeypatch):
    monkeypatch.setenv("ORBIT_BRIDGE_SECRET", "secret")
    fake = _FakeClient(_FakeResponse(201, {"response": "x"}))
    _patch_client(monkeypatch, fake)
    await conductor_bridge._send("hi", "co", "ag", None, "sub-9")
    assert fake.calls[0]["json"]["subAccountId"] == "sub-9"


@pytest.mark.asyncio
async def test_send_omits_subaccount_when_none(monkeypatch):
    monkeypatch.setenv("ORBIT_BRIDGE_SECRET", "secret")
    fake = _FakeClient(_FakeResponse(201, {"response": "x"}))
    _patch_client(monkeypatch, fake)
    await conductor_bridge._send("hi", "co", "ag", None, None)
    assert "subAccountId" not in fake.calls[0]["json"]


@pytest.mark.asyncio
async def test_send_non_2xx(monkeypatch):
    monkeypatch.setenv("ORBIT_BRIDGE_SECRET", "secret")
    _patch_client(monkeypatch, _FakeClient(_FakeResponse(502, {})))
    out = await conductor_bridge._send("hi", "co", "ag", None)
    assert out["ok"] is False and out["status_code"] == 502


@pytest.mark.asyncio
async def test_send_timeout(monkeypatch):
    monkeypatch.setenv("ORBIT_BRIDGE_SECRET", "secret")
    _patch_client(monkeypatch, _FakeClient(exc=conductor_bridge.httpx.TimeoutException("t")))
    out = await conductor_bridge._send("hi", "co", "ag", None)
    assert out["ok"] is False and "timed out" in out["error"]


@pytest.mark.asyncio
async def test_handle_chat_success_shapes_and_saves_session(monkeypatch):
    monkeypatch.setattr(conductor_bridge, "_load_session_id", lambda db, chat_id: None)
    saved = {}
    monkeypatch.setattr(
        conductor_bridge,
        "_save_session_id",
        lambda db, chat_id, org_id, sid: saved.update(
            {"chat_id": chat_id, "org_id": org_id, "sid": sid}
        ),
    )
    monkeypatch.setattr(
        conductor_bridge,
        "_send",
        AsyncMock(return_value={"ok": True, "response": "hi there", "sessionId": "new-sess"}),
    )

    out = await conductor_bridge.handle_chat(
        "build me X", org_id="org1", chat_id="chat1", db=object(), department_slug="sales"
    )
    assert out["status"] == "ok"
    assert out["content"] == "hi there"
    assert out["model"] == "conductor/orbit-assistant"
    assert out["department"] == "sales"
    assert out["proposals"] == [] and out["usage"] == {}
    assert saved == {"chat_id": "chat1", "org_id": "org1", "sid": "new-sess"}


@pytest.mark.asyncio
async def test_handle_chat_reused_session_not_resaved(monkeypatch):
    monkeypatch.setattr(conductor_bridge, "_load_session_id", lambda db, chat_id: "same")
    save = MagicMock()
    monkeypatch.setattr(conductor_bridge, "_save_session_id", save)
    monkeypatch.setattr(
        conductor_bridge,
        "_send",
        AsyncMock(return_value={"ok": True, "response": "ok", "sessionId": "same"}),
    )
    out = await conductor_bridge.handle_chat("hi", org_id="o", chat_id="c", db=object())
    assert out["status"] == "ok"
    save.assert_not_called()  # unchanged session id -> no rewrite


@pytest.mark.asyncio
async def test_handle_chat_error_returns_friendly_message(monkeypatch):
    monkeypatch.setattr(conductor_bridge, "_load_session_id", lambda db, chat_id: None)
    monkeypatch.setattr(
        conductor_bridge, "_send", AsyncMock(return_value={"ok": False, "error": "boom"})
    )
    out = await conductor_bridge.handle_chat("hi", org_id="o", chat_id="c", db=object())
    assert out["status"] == "error"
    assert "trouble reaching" in out["content"]
    assert out["model"] == "conductor/orbit-assistant"


# --- per-org company resolution (#66 Stage 1) --------------------------------

# Locked UUIDv5 outputs for the shared namespace. If these change, the namespace
# drifted from Conductor's resolvePortalCompany and every org's company would remap.
_ORBIT_CUID = "cdemoorg00000000000000001"
_ORBIT_DERIVED = "3b0b2fe9-ac4a-54a0-a4b8-244560583ba1"
_C0DE = "00000000-0000-4000-a000-000000000001"


def test_resolve_company_id_no_org_falls_back_to_default(monkeypatch):
    monkeypatch.delenv("ORBIT_COMPANY_ID", raising=False)
    monkeypatch.delenv("PORTAL_COMPANY_OVERRIDES", raising=False)
    assert conductor_bridge._resolve_company_id(None) == _C0DE
    assert conductor_bridge._resolve_company_id("") == _C0DE
    monkeypatch.setenv("ORBIT_COMPANY_ID", "pinned-co")
    assert conductor_bridge._resolve_company_id(None) == "pinned-co"


def test_resolve_company_id_cuid_is_deterministic_uuidv5(monkeypatch):
    monkeypatch.delenv("PORTAL_COMPANY_OVERRIDES", raising=False)
    out = conductor_bridge._resolve_company_id(_ORBIT_CUID)
    assert out == _ORBIT_DERIVED
    assert out == conductor_bridge._resolve_company_id(_ORBIT_CUID)  # stable


def test_resolve_company_id_uuid_passthrough(monkeypatch):
    monkeypatch.delenv("PORTAL_COMPANY_OVERRIDES", raising=False)
    assert conductor_bridge._resolve_company_id(_C0DE) == _C0DE


def test_resolve_company_id_override_wins(monkeypatch):
    monkeypatch.setenv("PORTAL_COMPANY_OVERRIDES", f"{_ORBIT_CUID}={_C0DE}")
    # override pins Orbit's CUID to …c0de instead of the derived UUID
    assert conductor_bridge._resolve_company_id(_ORBIT_CUID) == _C0DE


def test_company_overrides_parsing(monkeypatch):
    # value with two '=' splits on the FIRST; invalid-UUID value is dropped
    monkeypatch.setenv(
        "PORTAL_COMPANY_OVERRIDES",
        f"a=b=c, {_ORBIT_CUID}={_C0DE} ,bad=not-a-uuid,",
    )
    ov = conductor_bridge._company_overrides()
    assert ov == {_ORBIT_CUID: _C0DE}  # "a" dropped (b=c not a uuid), "bad" dropped


class _FakeOrgRow:
    def __init__(self, portal_org_id):
        self.portal_org_id = portal_org_id


class _FakeOrgDB:
    """Minimal stand-in: db.query(Model).filter(...).one_or_none() -> row/None."""

    def __init__(self, row):
        self._row = row

    def query(self, *a):
        return self

    def filter(self, *a):
        return self

    def one_or_none(self):
        return self._row


def test_resolve_company_for_chat_uses_stored_portal_id(monkeypatch):
    monkeypatch.delenv("PORTAL_COMPANY_OVERRIDES", raising=False)
    db = _FakeOrgDB(_FakeOrgRow(_ORBIT_CUID))
    # internal org id is ignored for derivation; the STORED portal CUID drives it
    assert (
        conductor_bridge._resolve_company_for_chat(db, "internal-uuid-xyz") == _ORBIT_DERIVED
    )


def test_resolve_company_for_chat_unstamped_org_falls_back_to_pin(monkeypatch):
    monkeypatch.setenv("ORBIT_COMPANY_ID", "pinned-co")
    db = _FakeOrgDB(_FakeOrgRow(None))  # org exists but portal_org_id NULL
    assert conductor_bridge._resolve_company_for_chat(db, "internal") == "pinned-co"


def test_resolve_company_for_chat_unknown_org_and_no_db(monkeypatch):
    monkeypatch.setenv("ORBIT_COMPANY_ID", "pinned-co")
    assert conductor_bridge._resolve_company_for_chat(_FakeOrgDB(None), "x") == "pinned-co"
    assert conductor_bridge._resolve_company_for_chat(None, "x") == "pinned-co"


@pytest.mark.asyncio
async def test_handle_chat_threads_resolved_company_to_send(monkeypatch):
    monkeypatch.delenv("PORTAL_COMPANY_OVERRIDES", raising=False)
    monkeypatch.setattr(conductor_bridge, "_load_session_id", lambda db, chat_id: None)
    monkeypatch.setattr(conductor_bridge, "_save_session_id", lambda *a, **k: None)
    sent = {}

    async def _fake_send(prompt, company_id, agent_id, session_id, sub_account_id=None):
        sent["company_id"] = company_id
        sent["sub_account_id"] = sub_account_id
        return {"ok": True, "response": "hi", "sessionId": "s"}

    monkeypatch.setattr(conductor_bridge, "_send", _fake_send)
    monkeypatch.setattr(conductor_bridge, "_portal_org_id_for", lambda db, oid: _ORBIT_CUID)
    monkeypatch.setattr(conductor_bridge, "_subaccount_id_for", lambda db, oid: "sub-x")
    out = await conductor_bridge.handle_chat(
        "hi", org_id="internal", chat_id="c", db=object()
    )
    assert out["status"] == "ok"
    assert sent["company_id"] == _ORBIT_DERIVED
    # Request-scoped selection owns sub-account routing now; missing selection
    # degrades to business scope instead of falling back to an org-bound id.
    assert sent["sub_account_id"] is None

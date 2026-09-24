"""Role-map forwarder — conductor_bridge.suggest_roles (onboarding P3a).

The contract this file pins:
  - URL is derived from the bridge ORIGIN (like engram-seed / ensure-department-agents),
    env-overridable with CONDUCTOR_ROLE_MAP_URL;
  - the shared x-orbit-bridge-secret authenticates it; the body is {answers, maxRoles?} and
    carries NO companyId (it is a pure mapping call);
  - a 200 with a roles list is {ok: True, roles, suggestions, model}; everything else is
    {ok: False, error} — and it never RAISES into the request path.
"""

import asyncio

import httpx
import pytest

from apps.atrium.backend.services import conductor_bridge

SECRET = "role-map-secret"
ANSWERS = {"whatBusinessDoes": "We sell solar panels", "painPoints": "lead follow-up"}
PAYLOAD = {
    "object": "role_map",
    "roles": ["sales", "marketing"],
    "suggestions": [
        {"role": "sales", "rationale": "leads", "first_task_hints": ["follow up"]},
        {"role": "marketing", "rationale": "demand", "first_task_hints": []},
    ],
    "model": "rules-fallback",
}


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

def test_url_is_core_route_derived_from_bridge_origin(monkeypatch):
    monkeypatch.setattr(
        conductor_bridge, "_bridge_url",
        lambda: "https://conductor.example/api/plugins/pid/api/chat",
    )
    monkeypatch.delenv("CONDUCTOR_ROLE_MAP_URL", raising=False)
    assert conductor_bridge._role_map_url() == "https://conductor.example/api/bridge/role-map"


def test_url_env_override(monkeypatch):
    monkeypatch.setenv("CONDUCTOR_ROLE_MAP_URL", "https://x.example/role-map")
    assert conductor_bridge._role_map_url() == "https://x.example/role-map"


# --- happy path --------------------------------------------------------------

def test_posts_answers_and_secret_without_company(monkeypatch):
    fake = _patch(monkeypatch, _FakeClient(_FakeResponse(200, PAYLOAD)))

    result = asyncio.run(conductor_bridge.suggest_roles(None, "org-1", ANSWERS, max_roles=3))

    assert result == {
        "ok": True,
        "roles": PAYLOAD["roles"],
        "suggestions": PAYLOAD["suggestions"],
        "model": "rules-fallback",
    }
    call = fake.calls[0]
    assert call["url"] == conductor_bridge._role_map_url()
    assert call["headers"]["x-orbit-bridge-secret"] == SECRET
    assert call["json"] == {"answers": ANSWERS, "maxRoles": 3}  # no companyId


def test_omits_max_roles_when_not_given(monkeypatch):
    fake = _patch(monkeypatch, _FakeClient(_FakeResponse(200, PAYLOAD)))
    asyncio.run(conductor_bridge.suggest_roles(None, None, ANSWERS))
    assert fake.calls[0]["json"] == {"answers": ANSWERS}


def test_empty_roles_is_still_a_success(monkeypatch):
    _patch(monkeypatch, _FakeClient(_FakeResponse(200, {"roles": []})))
    assert asyncio.run(conductor_bridge.suggest_roles(None, None, ANSWERS)) == {
        "ok": True, "roles": [], "suggestions": [], "model": None,
    }


# --- failures ----------------------------------------------------------------

def test_without_secret_is_a_noop_failure(monkeypatch):
    fake = _FakeClient(_FakeResponse(200, PAYLOAD))
    monkeypatch.delenv("ORBIT_BRIDGE_SECRET", raising=False)
    monkeypatch.setattr(conductor_bridge.httpx, "AsyncClient", lambda **kw: fake)

    assert asyncio.run(conductor_bridge.suggest_roles(None, None, ANSWERS))["ok"] is False
    assert fake.calls == []


@pytest.mark.parametrize(
    "make_fake",
    [
        lambda: _FakeClient(_FakeResponse(500, {"error": "kaboom"})),
        lambda: _FakeClient(_FakeResponse(401, {})),
        lambda: _FakeClient(exc=httpx.TimeoutException("slow")),
        lambda: _FakeClient(exc=httpx.RequestError("no route")),
        lambda: _FakeClient(exc=RuntimeError("unexpected")),
        lambda: _FakeClient(_FakeResponse(200, raise_json=True)),
        lambda: _FakeClient(_FakeResponse(200, {"suggestions": []})),
        lambda: _FakeClient(_FakeResponse(200, ["not", "a", "dict"])),
    ],
    ids=["500", "401", "timeout", "transport", "unexpected", "non-json", "no-roles", "non-dict"],
)
def test_degrades_to_ok_false_without_raising(monkeypatch, make_fake):
    _patch(monkeypatch, make_fake())

    result = asyncio.run(conductor_bridge.suggest_roles(None, None, ANSWERS))

    assert result["ok"] is False
    assert result["error"]

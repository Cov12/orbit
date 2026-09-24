"""
Atrium -> Conductor Orbit bridge caller (thin transport).

When enabled, this forwards a user's chat turn to the Conductor Orbit Assistant via
the bridge plugin's block-and-return endpoint and returns the assistant's reply.
It bypasses the legacy lane_router / intent_classifier / model_router stack
entirely (Option B) -- Atrium is just a transport; Conductor is the brain.

Multi-turn continuity: the bridge returns a `sessionId`. We persist it per OWUI
`chat_id` (atrium_conductor_session) and replay it on later turns so Hermes keeps
the same conversation. Turn 1 has no sessionId -> bridge creates one; turns 2+
send it back -> bridge reuses it.
"""

import logging
import os
import re
import uuid
from typing import Optional

import httpx
from sqlalchemy.orm import Session

logger = logging.getLogger("atrium.conductor_bridge")

# Per-org company resolution. These MUST stay in lockstep with Conductor's
# resolvePortalCompany (orbit-conductor: server/src/routes/portal-callback.ts) so both
# services derive the SAME company UUID for a given Portal org id. The namespace and
# the PORTAL_COMPANY_OVERRIDES format are identical on both sides; Python's stdlib
# uuid.uuid5 is RFC-4122 v5 (SHA-1) and matches Conductor's inline implementation exactly
# (verified). NEVER change the namespace — it would remap every org's company.
_PORTAL_ORG_UUID_NAMESPACE = uuid.UUID("1d3a9b6e-0c4f-4a2d-9e7b-5f8c2a1e6d40")
_DEFAULT_PORTAL_COMPANY_ID = "00000000-0000-4000-a000-000000000001"
_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)

# Points at the installed Orbit bridge plugin on Conductor prod; override per-env.
_DEFAULT_BRIDGE_URL = (
    "https://conductor.orbit.example"
    "/api/plugins/00000000-0000-4000-a000-00000000b003/api/chat"
)
_DEFAULT_AGENT_ID = "00000000-0000-4000-a000-0000000a9e01"
# The bridge blocks up to 120s (ORBIT_BRIDGE_RUN_TIMEOUT_MS); give the client headroom.
_DEFAULT_TIMEOUT_S = 125.0

_ERROR_REPLY = (
    "Sorry — I'm having trouble reaching the team right now. "
    "Please try again in a moment."
)


# --- config (env) ------------------------------------------------------------

def is_enabled() -> bool:
    """Route chat through the Conductor bridge instead of the legacy local stack."""
    return os.environ.get("ORBIT_BRIDGE_ENABLED", "").strip().lower() in (
        "1", "true", "yes", "on",
    )


def _bridge_url() -> str:
    return os.environ.get("CONDUCTOR_BRIDGE_URL", _DEFAULT_BRIDGE_URL)


def _history_url() -> str:
    """The bridge's /history verb is a sibling of /chat on the same plugin base,
    so we derive it from _bridge_url() by swapping the trailing /chat segment for
    /history. This keeps one env override (CONDUCTOR_BRIDGE_URL) driving both verbs —
    no second URL to configure or drift."""
    base = _bridge_url()
    if base.endswith("/chat"):
        return base[: -len("/chat")] + "/history"
    return base.rstrip("/") + "/history"


def _bridge_secret() -> str:
    return os.environ.get("ORBIT_BRIDGE_SECRET", "")


def _agent_id() -> str:
    return os.environ.get("ORBIT_AGENT_ID", _DEFAULT_AGENT_ID)


def _default_company_id() -> str:
    """Company used when an org has no stored Portal id. ORBIT_COMPANY_ID (if set)
    stays the back-compat pin; otherwise the shared default company (…c0de)."""
    return os.environ.get("ORBIT_COMPANY_ID", "").strip() or _DEFAULT_PORTAL_COMPANY_ID


def _is_uuid(value: str) -> bool:
    return bool(_UUID_RE.match(value))


def _company_overrides() -> dict:
    """Parse PORTAL_COMPANY_OVERRIDES ("<orgId>=<companyUuid>,...") — same env and
    format Conductor reads, so a Portal org pinned to an existing company (e.g. Orbit ->
    …c0de) resolves identically on both sides. Split on the FIRST '=' only."""
    raw = os.environ.get("PORTAL_COMPANY_OVERRIDES", "")
    out: dict = {}
    for pair in raw.split(","):
        pair = pair.strip()
        if not pair:
            continue
        idx = pair.find("=")
        if idx <= 0:
            continue
        key = pair[:idx].strip()
        val = pair[idx + 1 :].strip()
        if key and _is_uuid(val):
            out[key] = val
    return out


def _resolve_company_id(portal_org_id: Optional[str]) -> str:
    """Map a Portal org id (CUID) to its Conductor company UUID. MUST match Conductor's
    resolvePortalCompany:
      - no id            -> default company (ORBIT_COMPANY_ID env or …c0de)
      - override match    -> pinned company UUID
      - already a UUID    -> used as-is
      - a CUID (today)    -> deterministic UUIDv5 (shared namespace)
    """
    oid = (portal_org_id or "").strip()
    if not oid:
        return _default_company_id()
    override = _company_overrides().get(oid)
    if override:
        return override
    if _is_uuid(oid):
        return oid
    return str(uuid.uuid5(_PORTAL_ORG_UUID_NAMESPACE, oid))


def _portal_org_id_for(
    db: Optional[Session], internal_org_id: Optional[str]
) -> Optional[str]:
    """Look up the stored Portal org id (CUID) for an Atrium-internal org id.
    Returns None if db/id missing, org unknown, or column unset — caller then falls
    back to the default company. Never raises into the chat path."""
    if db is None or not internal_org_id:
        return None
    try:
        from ..models.db import AtriumOrganization

        row = (
            db.query(AtriumOrganization)
            .filter(AtriumOrganization.id == internal_org_id)
            .one_or_none()
        )
        return (row.portal_org_id or None) if row else None
    except Exception as e:  # never let company resolution break a chat
        logger.warning(
            f"conductor_bridge: portal_org_id lookup failed for org {internal_org_id}: {e}"
        )
        # If the SELECT aborted the transaction (e.g. code deployed before the
        # 002 migration adds the column), roll back so the later session-save in
        # this same request isn't poisoned. Falls back to the pin regardless.
        try:
            db.rollback()
        except Exception:
            pass
        return None


def _subaccount_id_for(
    db: Optional[Session], internal_org_id: Optional[str]
) -> Optional[str]:
    """The org's bound WorkPipe sub-account id, used to partition the Orbit
    assistant's long-term memory per sub-account (Conductor composes the Hermes
    session key as companyId:subAccountId). This is the SAME sub-account whose CRM
    data the agent operates on (see services/crm_adapter + workpipe), so memory
    and operational scope stay aligned. None (no binding / unknown org) →
    company/business scope, unchanged. Never raises into the chat path."""
    if db is None or not internal_org_id:
        return None
    try:
        from ..models.db import AtriumOrganization

        row = (
            db.query(AtriumOrganization)
            .filter(AtriumOrganization.id == internal_org_id)
            .one_or_none()
        )
        return (row.workpipe_account_id or None) if row else None
    except Exception as e:  # never let memory scoping break a chat
        logger.warning(
            f"conductor_bridge: subaccount lookup failed for org {internal_org_id}: {e}"
        )
        try:
            db.rollback()
        except Exception:
            pass
        return None


def _resolve_company_for_chat(
    db: Optional[Session], internal_org_id: Optional[str]
) -> str:
    """Resolve the Conductor company UUID for one chat turn.

    A chat request carries the Atrium-INTERNAL org id (the query param / OWUI
    session org), NOT the Portal CUID — so we look up the org's stored Portal id and
    run THAT through the shared resolver, yielding the same UUID Conductor provisioned
    for the Portal org. An org with no stored Portal id (or an unknown org) falls
    back to the ORBIT_COMPANY_ID pin, preserving pre-#66 behavior. This is the fix
    for the first #66 attempt, which mis-resolved the internal id directly."""
    portal_org_id = _portal_org_id_for(db, internal_org_id)
    if portal_org_id:
        return _resolve_company_id(portal_org_id)
    return _default_company_id()


def _timeout_s() -> float:
    try:
        return float(os.environ.get("CONDUCTOR_BRIDGE_TIMEOUT_S", _DEFAULT_TIMEOUT_S))
    except ValueError:
        return _DEFAULT_TIMEOUT_S


# --- session threading (chat_id -> conductor sessionId) -------------------------

def _load_session_id(db: Optional[Session], chat_id: Optional[str]) -> Optional[str]:
    if db is None or not chat_id:
        return None
    try:
        from ..models.db import AtriumConductorSession

        row = (
            db.query(AtriumConductorSession)
            .filter(AtriumConductorSession.chat_id == chat_id)
            .one_or_none()
        )
        return row.conductor_session_id if row else None
    except Exception as e:  # never let session lookup break a chat
        logger.warning(f"conductor_bridge: load session failed for chat {chat_id}: {e}")
        return None


def _save_session_id(
    db: Optional[Session],
    chat_id: Optional[str],
    org_id: Optional[str],
    session_id: Optional[str],
) -> None:
    if db is None or not chat_id or not session_id:
        return
    try:
        from ..models.db import AtriumConductorSession, now_ms

        row = (
            db.query(AtriumConductorSession)
            .filter(AtriumConductorSession.chat_id == chat_id)
            .one_or_none()
        )
        if row is None:
            db.add(
                AtriumConductorSession(
                    chat_id=chat_id,
                    org_id=org_id,
                    conductor_session_id=session_id,
                )
            )
        else:
            row.conductor_session_id = session_id
            row.updated_at = now_ms()
        db.commit()
    except Exception as e:  # persistence is best-effort; degrade to fresh session
        logger.warning(f"conductor_bridge: save session failed for chat {chat_id}: {e}")
        try:
            db.rollback()
        except Exception:
            pass


# --- HTTP call ---------------------------------------------------------------

async def _send(
    prompt: str,
    company_id: str,
    agent_id: str,
    session_id: Optional[str],
    sub_account_id: Optional[str] = None,
) -> dict:
    secret = _bridge_secret()
    if not secret:
        return {"ok": False, "error": "ORBIT_BRIDGE_SECRET not configured"}
    if not company_id:
        return {"ok": False, "error": "ORBIT_COMPANY_ID not configured"}

    body = {"companyId": company_id, "agentId": agent_id, "prompt": prompt}
    if session_id:
        body["sessionId"] = session_id
    # Partition the assistant's long-term memory per sub-account: Conductor composes
    # the Hermes session key as companyId:subAccountId. Omitted when unset →
    # company-level (business) scope, unchanged.
    if sub_account_id:
        body["subAccountId"] = sub_account_id

    headers = {"Content-Type": "application/json", "x-orbit-bridge-secret": secret}

    try:
        async with httpx.AsyncClient(timeout=_timeout_s()) as client:
            resp = await client.post(_bridge_url(), json=body, headers=headers)
    except httpx.TimeoutException:
        return {"ok": False, "error": "bridge request timed out"}
    except httpx.RequestError as e:
        return {"ok": False, "error": f"bridge request error: {e}"}

    if resp.status_code not in (200, 201):
        return {
            "ok": False,
            "error": f"bridge returned {resp.status_code}",
            "status_code": resp.status_code,
        }

    try:
        data = resp.json()
    except ValueError:
        return {"ok": False, "error": "bridge returned non-JSON body"}

    return {
        "ok": True,
        "response": data.get("response") or "",
        "sessionId": data.get("sessionId"),
        "runId": data.get("runId"),
        "created": data.get("created", False),
    }


def _ensure_agent_url() -> str:
    """Conductor CORE route (not a plugin verb): POST {conductor-origin}/api/bridge/ensure-agent,
    authed by the same x-orbit-bridge-secret as /chat. Derived from the bridge URL's origin;
    override with CONDUCTOR_ENSURE_AGENT_URL. (The plugin runs in an isolated worker with no
    agent-create RPC, and the plugin path 404s a missing company before the handler runs, so
    provisioning lives in a core route.)"""
    override = os.environ.get("CONDUCTOR_ENSURE_AGENT_URL", "").strip()
    if override:
        return override
    m = re.match(r"^(https?://[^/]+)", _bridge_url())
    origin = m.group(1) if m else _bridge_url().rstrip("/")
    return origin + "/api/bridge/ensure-agent"


async def _ensure_company_agent(company_id: str) -> Optional[str]:
    """Ask Conductor to guarantee this company has its assistant agent (idempotent) and
    return the agent id. Conductor creates the company + clones the template agent on the
    first call. Returns None on any failure — never raises into the chat path."""
    secret = _bridge_secret()
    if not secret or not company_id:
        return None
    headers = {"Content-Type": "application/json", "x-orbit-bridge-secret": secret}
    try:
        async with httpx.AsyncClient(timeout=_timeout_s()) as client:
            resp = await client.post(
                _ensure_agent_url(), json={"companyId": company_id}, headers=headers
            )
    except httpx.RequestError as e:
        logger.warning(f"conductor_bridge: ensure-agent request error: {e}")
        return None
    if resp.status_code not in (200, 201):
        logger.warning(f"conductor_bridge: ensure-agent returned {resp.status_code}")
        return None
    try:
        return (resp.json() or {}).get("agentId") or None
    except ValueError:
        return None


def _cached_agent_id(db: Optional[Session], org_id: Optional[str]) -> Optional[str]:
    if db is None or not org_id:
        return None
    try:
        from ..models.db import AtriumOrganization

        row = db.query(AtriumOrganization).filter_by(id=org_id).first()
        return getattr(row, "conductor_agent_id", None) if row else None
    except Exception:
        return None


def _store_agent_id(
    db: Optional[Session], org_id: Optional[str], agent_id: Optional[str]
) -> None:
    """Cache (or clear, when agent_id is None) the org's resolved Conductor agent id."""
    if db is None or not org_id:
        return
    try:
        from ..models.db import AtriumOrganization

        row = db.query(AtriumOrganization).filter_by(id=org_id).first()
        if row is not None and getattr(row, "conductor_agent_id", None) != agent_id:
            row.conductor_agent_id = agent_id
            db.commit()
    except Exception:
        try:
            db.rollback()
        except Exception:
            pass


async def _resolve_agent_id(db: Optional[Session], org_id: str, company_id: str) -> str:
    """Resolve the assistant agent id for this org's Conductor company: a cached per-org id,
    else the Orbit pin for the default company, else provision idempotently via ensure-agent
    (caching the result). Falls back to the configured default agent if provisioning fails
    (behaviour no worse than before this change)."""
    cached = _cached_agent_id(db, org_id)
    if cached:
        return cached
    if company_id == _default_company_id() and os.environ.get("ORBIT_AGENT_ID", "").strip():
        return os.environ["ORBIT_AGENT_ID"].strip()
    provisioned = await _ensure_company_agent(company_id)
    if provisioned:
        _store_agent_id(db, org_id, provisioned)
        return provisioned
    return _agent_id()


# --- high-level entry --------------------------------------------------------

async def handle_chat(
    message: str,
    org_id: str,
    chat_id: Optional[str] = None,
    db: Optional[Session] = None,
    department_slug: Optional[str] = None,
    sub_account_id: Optional[str] = None,
) -> dict:
    """
    Forward one chat turn to the Orbit Assistant and return a result dict in the
    same shape the orchestrator's local path returns, so the frontend renders it
    unchanged.
    """
    session_id = _load_session_id(db, chat_id)
    company_id = _resolve_company_for_chat(db, org_id)
    agent_id = await _resolve_agent_id(db, org_id, company_id)
    result = await _send(
        prompt=message,
        company_id=company_id,
        agent_id=agent_id,
        session_id=session_id,
        sub_account_id=sub_account_id,
    )

    # A 404 means the agent is not in this company (deleted, or a first use raced the
    # cache). Re-provision the company assistant and retry once.
    if not result.get("ok") and result.get("status_code") == 404:
        logger.info("conductor_bridge: agent 404 — re-provisioning company assistant")
        _store_agent_id(db, org_id, None)
        agent_id = await _ensure_company_agent(company_id)
        if agent_id:
            _store_agent_id(db, org_id, agent_id)
            result = await _send(
                prompt=message,
                company_id=company_id,
                agent_id=agent_id,
                session_id=session_id,
                sub_account_id=sub_account_id,
            )

    if not result.get("ok"):
        logger.warning(f"conductor_bridge: chat failed: {result.get('error')}")
        return _shape(department_slug, _ERROR_REPLY, status="error")

    new_session_id = result.get("sessionId")
    if new_session_id and new_session_id != session_id:
        _save_session_id(db, chat_id, org_id, new_session_id)

    return _shape(department_slug, result.get("response", ""), status="ok")


def _shape(department_slug: Optional[str], content: str, status: str) -> dict:
    return {
        "department": department_slug,
        "model_tier": "conductor_bridge",
        "model": "conductor/orbit-assistant",
        "content": content,
        "proposals": [],
        "usage": {},
        "status": status,
    }


# --- read: recent run history (Dashboard D4b) --------------------------------

async def fetch_history(
    db: Optional[Session],
    org_id: Optional[str],
    sub_account_id: Optional[str] = None,
    limit: int = 20,
) -> list:
    """Fetch recent Conductor runs for one org's company (and optional sub-account)
    scope, for the read-only dashboard. Resolves companyId the SAME way chat does
    (_resolve_company_for_chat), then POSTs to the bridge's /history verb with the
    shared x-orbit-bridge-secret.

    Defensive by design — this feeds a widget, never a mutation: it NEVER raises
    into the request. Missing secret, timeout, transport error, non-2xx, or a
    non-JSON/malformed body all degrade to [] (mirrors _send / _subaccount_id_for).
    subAccountId is omitted when None → company/business scope, matching /chat.
    """
    secret = _bridge_secret()
    if not secret:
        logger.warning("conductor_bridge: history skipped — ORBIT_BRIDGE_SECRET not configured")
        return []

    company_id = _resolve_company_for_chat(db, org_id)
    if not company_id:
        return []

    body: dict = {"companyId": company_id, "limit": limit}
    if sub_account_id:
        body["subAccountId"] = sub_account_id

    headers = {"Content-Type": "application/json", "x-orbit-bridge-secret": secret}

    try:
        async with httpx.AsyncClient(timeout=_timeout_s()) as client:
            resp = await client.post(_history_url(), json=body, headers=headers)
    except httpx.TimeoutException:
        logger.warning("conductor_bridge: history request timed out")
        return []
    except httpx.RequestError as e:
        logger.warning(f"conductor_bridge: history request error: {e}")
        return []

    if resp.status_code not in (200, 201):
        logger.warning(f"conductor_bridge: history returned {resp.status_code}")
        return []

    try:
        data = resp.json()
    except ValueError:
        logger.warning("conductor_bridge: history returned non-JSON body")
        return []

    runs = data.get("runs") if isinstance(data, dict) else None
    return runs if isinstance(runs, list) else []


# --- write: seed Engram (mem0) long-term memory ----------------------------

def _engram_seed_url() -> str:
    """Conductor CORE route (not a plugin verb): POST {conductor-origin}/api/bridge/engram-seed,
    authed by the same x-orbit-bridge-secret as /chat. Derived from the bridge URL's origin
    exactly like _ensure_agent_url(), so one env (CONDUCTOR_BRIDGE_URL) keeps driving every
    core verb; override with CONDUCTOR_ENGRAM_SEED_URL."""
    override = os.environ.get("CONDUCTOR_ENGRAM_SEED_URL", "").strip()
    if override:
        return override
    m = re.match(r"^(https?://[^/]+)", _bridge_url())
    origin = m.group(1) if m else _bridge_url().rstrip("/")
    return origin + "/api/bridge/engram-seed"


async def seed_engram(
    db: Optional[Session],
    org_id: Optional[str],
    facts: list,
    sub_account_id: Optional[str] = None,
) -> dict:
    """Seed onboarding facts into the org's Engram (mem0) long-term memory via Conductor.

    Resolves companyId the SAME way chat does (_resolve_company_for_chat), then POSTs
    {companyId, subAccountId?, facts} to the engram-seed core route with the shared
    x-orbit-bridge-secret. `facts` entries are plain strings or {fact, kind, confidence}
    objects — passed through as given; Conductor/Hermes owns the memory write.

    subAccountId is OMITTED when None → Hermes stores at company/business scope
    (companyId:_business), matching how /chat scopes memory. The parameter exists so
    per-sub-account seeding is a later drop-in; P1 only wires the org-level flow.

    NON-FATAL by contract — onboarding must never fail because seeding did. Missing
    secret, no facts, timeout, transport error, non-2xx, or a non-JSON body all return
    {ok: False, error: ...} with a warning logged; it NEVER raises into the caller.
    Returns {ok: True, **hermesResult} on success so callers can record what landed.
    """
    secret = _bridge_secret()
    if not secret:
        logger.warning("conductor_bridge: engram-seed skipped — ORBIT_BRIDGE_SECRET not configured")
        return {"ok": False, "error": "ORBIT_BRIDGE_SECRET not configured"}

    if not facts:
        return {"ok": False, "error": "no facts to seed"}

    company_id = _resolve_company_for_chat(db, org_id)
    if not company_id:
        logger.warning("conductor_bridge: engram-seed skipped — no company resolved")
        return {"ok": False, "error": "no company resolved for org"}

    body: dict = {"companyId": company_id, "facts": facts}
    if sub_account_id:
        body["subAccountId"] = sub_account_id

    headers = {"Content-Type": "application/json", "x-orbit-bridge-secret": secret}

    try:
        async with httpx.AsyncClient(timeout=_timeout_s()) as client:
            resp = await client.post(_engram_seed_url(), json=body, headers=headers)
    except httpx.TimeoutException:
        logger.warning("conductor_bridge: engram-seed request timed out")
        return {"ok": False, "error": "engram-seed request timed out"}
    except httpx.RequestError as e:
        logger.warning(f"conductor_bridge: engram-seed request error: {e}")
        return {"ok": False, "error": f"engram-seed request error: {e}"}
    except Exception as e:  # defensive: seeding must never break onboarding
        logger.warning(f"conductor_bridge: engram-seed unexpected error: {e}")
        return {"ok": False, "error": f"engram-seed unexpected error: {e}"}

    if resp.status_code not in (200, 201):
        logger.warning(f"conductor_bridge: engram-seed returned {resp.status_code}")
        return {
            "ok": False,
            "error": f"engram-seed returned {resp.status_code}",
            "status_code": resp.status_code,
        }

    try:
        data = resp.json()
    except ValueError:
        logger.warning("conductor_bridge: engram-seed returned non-JSON body")
        return {"ok": False, "error": "engram-seed returned non-JSON body"}

    return {"ok": True, **(data if isinstance(data, dict) else {"result": data})}


# --- write: provision a company's specialist agents (onboarding P2a) ---------

def _ensure_department_agents_url() -> str:
    """Conductor CORE route (not a plugin verb): POST
    {conductor-origin}/api/bridge/ensure-department-agents, authed by the same
    x-orbit-bridge-secret as /chat. Derived from the bridge URL's origin exactly like
    _ensure_agent_url() / _engram_seed_url(), so one env (CONDUCTOR_BRIDGE_URL) keeps
    driving every core verb; override with CONDUCTOR_ENSURE_DEPT_AGENTS_URL."""
    override = os.environ.get("CONDUCTOR_ENSURE_DEPT_AGENTS_URL", "").strip()
    if override:
        return override
    m = re.match(r"^(https?://[^/]+)", _bridge_url())
    origin = m.group(1) if m else _bridge_url().rstrip("/")
    return origin + "/api/bridge/ensure-department-agents"


def _error_message(payload, fallback: str) -> str:
    """Pull Conductor's own message out of an error body so the caller can relay it
    verbatim (its 400s name the offending role). Falls back when the body is not a
    dict or carries no recognised message key."""
    if isinstance(payload, dict):
        for key in ("error", "message", "detail"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    return fallback


async def ensure_department_agents(
    db: Optional[Session],
    org_id: Optional[str],
    roles: list,
) -> dict:
    """Provision one specialist agent per canonical role for this org's Conductor company.

    Resolves companyId the SAME way chat does (_resolve_company_for_chat), then POSTs
    {companyId, roles} to the ensure-department-agents core route with the shared
    x-orbit-bridge-secret. Conductor is idempotent (re-calling returns the existing agents
    with created:false) and owns the canonical role TAXONOMY — it rejects unknown roles,
    `ceo` and `default` with a 400. We deliberately do NOT duplicate that enum here, so
    the taxonomy lives in exactly one place.

    UNLIKE seed_engram, a failure here is MEANINGFUL: the user asked for agents and
    got none, so failures are reported, never swallowed into a success. Returns
    {ok: True, agents: [{role, agentId, created}, ...]} or
    {ok: False, error: str, status: int | None}, where `status` is Conductor's HTTP status
    when it answered (so the caller can relay a 4xx as a 400 and treat everything else
    as a bad gateway) and None when the request never got an answer.

    It still NEVER raises into the request path — every transport/parse failure is
    returned as {ok: False}.
    """
    secret = _bridge_secret()
    if not secret:
        logger.warning(
            "conductor_bridge: ensure-department-agents skipped — ORBIT_BRIDGE_SECRET not configured"
        )
        return {"ok": False, "error": "ORBIT_BRIDGE_SECRET not configured", "status": None}

    if not roles:
        return {"ok": False, "error": "no roles to provision", "status": None}

    company_id = _resolve_company_for_chat(db, org_id)
    if not company_id:
        logger.warning("conductor_bridge: ensure-department-agents skipped — no company resolved")
        return {"ok": False, "error": "no company resolved for org", "status": None}

    body = {"companyId": company_id, "roles": roles}
    headers = {"Content-Type": "application/json", "x-orbit-bridge-secret": secret}

    try:
        async with httpx.AsyncClient(timeout=_timeout_s()) as client:
            resp = await client.post(
                _ensure_department_agents_url(), json=body, headers=headers
            )
    except httpx.TimeoutException:
        logger.warning("conductor_bridge: ensure-department-agents request timed out")
        return {"ok": False, "error": "ensure-department-agents request timed out", "status": None}
    except httpx.RequestError as e:
        logger.warning(f"conductor_bridge: ensure-department-agents request error: {e}")
        return {
            "ok": False,
            "error": f"ensure-department-agents request error: {e}",
            "status": None,
        }
    except Exception as e:  # defensive: provisioning must never raise into the route
        logger.warning(f"conductor_bridge: ensure-department-agents unexpected error: {e}")
        return {
            "ok": False,
            "error": f"ensure-department-agents unexpected error: {e}",
            "status": None,
        }

    try:
        data = resp.json()
    except ValueError:
        data = None

    if resp.status_code not in (200, 201):
        message = _error_message(
            data, f"ensure-department-agents returned {resp.status_code}"
        )
        logger.warning(
            "conductor_bridge: ensure-department-agents returned %s: %s",
            resp.status_code, message,
        )
        return {"ok": False, "error": message, "status": resp.status_code}

    if data is None:
        logger.warning("conductor_bridge: ensure-department-agents returned non-JSON body")
        return {
            "ok": False,
            "error": "ensure-department-agents returned non-JSON body",
            "status": resp.status_code,
        }

    agents = data.get("agents") if isinstance(data, dict) else None
    if not isinstance(agents, list):
        logger.warning("conductor_bridge: ensure-department-agents returned no agents list")
        return {
            "ok": False,
            "error": "ensure-department-agents returned no agents",
            "status": resp.status_code,
        }

    return {"ok": True, "agents": agents}


# --- read: suggest departments from interview answers (onboarding P3a) -------

def _role_map_url() -> str:
    """Conductor CORE route (not a plugin verb): POST {conductor-origin}/api/bridge/role-map,
    authed by the same x-orbit-bridge-secret as /chat. Derived from the bridge URL's origin
    exactly like _ensure_department_agents_url(), so one env (CONDUCTOR_BRIDGE_URL) keeps
    driving every core verb; override with CONDUCTOR_ROLE_MAP_URL."""
    override = os.environ.get("CONDUCTOR_ROLE_MAP_URL", "").strip()
    if override:
        return override
    m = re.match(r"^(https?://[^/]+)", _bridge_url())
    origin = m.group(1) if m else _bridge_url().rstrip("/")
    return origin + "/api/bridge/role-map"


async def suggest_roles(
    db: Optional[Session],
    org_id: Optional[str],
    answers: dict,
    max_roles: Optional[int] = None,
) -> dict:
    """Map the assisted-onboarding interview answers to suggested canonical roles.

    POSTs {answers, maxRoles?} to the role-map core route with the shared
    x-orbit-bridge-secret. It is a PURE mapping call — no companyId, nothing provisioned —
    so unlike the write verbs it does not resolve a company; db/org_id are accepted for
    symmetry with the other forwarders and used only for logging.

    Conductor enum-filters to canonical roles and has its own deterministic rules fallback
    (model:"rules-fallback"), so a reachable Conductor always answers 200 with a (possibly
    empty) roles list. Any failure here therefore means Conductor is unreachable or broken.

    Returns {ok: True, roles, suggestions, model} or {ok: False, error}. NEVER raises.
    """
    secret = _bridge_secret()
    if not secret:
        logger.warning("conductor_bridge: role-map skipped — ORBIT_BRIDGE_SECRET not configured")
        return {"ok": False, "error": "ORBIT_BRIDGE_SECRET not configured"}

    if not isinstance(answers, dict) or not answers:
        return {"ok": False, "error": "no answers to map"}

    body: dict = {"answers": answers}
    if max_roles is not None:
        body["maxRoles"] = max_roles
    headers = {"Content-Type": "application/json", "x-orbit-bridge-secret": secret}

    try:
        async with httpx.AsyncClient(timeout=_timeout_s()) as client:
            resp = await client.post(_role_map_url(), json=body, headers=headers)
    except httpx.TimeoutException:
        logger.warning("conductor_bridge: role-map request timed out (org %s)", org_id)
        return {"ok": False, "error": "role-map request timed out"}
    except httpx.RequestError as e:
        logger.warning(f"conductor_bridge: role-map request error: {e}")
        return {"ok": False, "error": f"role-map request error: {e}"}
    except Exception as e:  # defensive: a suggestion must never raise into the route
        logger.warning(f"conductor_bridge: role-map unexpected error: {e}")
        return {"ok": False, "error": f"role-map unexpected error: {e}"}

    try:
        data = resp.json()
    except ValueError:
        data = None

    if resp.status_code not in (200, 201):
        message = _error_message(data, f"role-map returned {resp.status_code}")
        logger.warning("conductor_bridge: role-map returned %s: %s", resp.status_code, message)
        return {"ok": False, "error": message}

    roles = data.get("roles") if isinstance(data, dict) else None
    if not isinstance(roles, list):
        logger.warning("conductor_bridge: role-map returned a malformed body")
        return {"ok": False, "error": "role-map returned a malformed body"}

    suggestions = data.get("suggestions")
    model = data.get("model")
    return {
        "ok": True,
        "roles": roles,
        "suggestions": suggestions if isinstance(suggestions, list) else [],
        "model": model if isinstance(model, str) else None,
    }


# --- write: file the user's opt-in starter tasks (onboarding P4b) -----------

def _seed_tasks_url() -> str:
    """Conductor CORE route (not a plugin verb): POST {conductor-origin}/api/bridge/seed-tasks,
    authed by the same x-orbit-bridge-secret as /chat. Derived from the bridge URL's origin
    exactly like _ensure_department_agents_url(), so one env (CONDUCTOR_BRIDGE_URL) keeps
    driving every core verb; override with CONDUCTOR_SEED_TASKS_URL."""
    override = os.environ.get("CONDUCTOR_SEED_TASKS_URL", "").strip()
    if override:
        return override
    m = re.match(r"^(https?://[^/]+)", _bridge_url())
    origin = m.group(1) if m else _bridge_url().rstrip("/")
    return origin + "/api/bridge/seed-tasks"


async def seed_tasks(
    db: Optional[Session],
    org_id: Optional[str],
    tasks: list,
) -> dict:
    """File the user's confirmed starter tasks as issues in this org's Conductor company.

    Resolves companyId the SAME way chat does (_resolve_company_for_chat), then POSTs
    {companyId, tasks: [{title, description?, priority?}]} to the seed-tasks core route
    with the shared x-orbit-bridge-secret. Conductor files each task as a CEO-assigned todo.

    Like ensure_department_agents, a failure here is MEANINGFUL (the user launched these
    tasks), so it is reported, never swallowed. Returns
    {ok: True, issues: [{id, identifier, title}, ...]} or
    {ok: False, error: str, status: int | None}, where `status` is Conductor's HTTP status
    when it answered and None when the request never got an answer.

    It NEVER raises into the request path — every transport/parse failure is returned
    as {ok: False}.
    """
    secret = _bridge_secret()
    if not secret:
        logger.warning("conductor_bridge: seed-tasks skipped — ORBIT_BRIDGE_SECRET not configured")
        return {"ok": False, "error": "ORBIT_BRIDGE_SECRET not configured", "status": None}

    if not tasks:
        return {"ok": False, "error": "no tasks to seed", "status": None}

    company_id = _resolve_company_for_chat(db, org_id)
    if not company_id:
        logger.warning("conductor_bridge: seed-tasks skipped — no company resolved")
        return {"ok": False, "error": "no company resolved for org", "status": None}

    body = {"companyId": company_id, "tasks": tasks}
    headers = {"Content-Type": "application/json", "x-orbit-bridge-secret": secret}

    try:
        async with httpx.AsyncClient(timeout=_timeout_s()) as client:
            resp = await client.post(_seed_tasks_url(), json=body, headers=headers)
    except httpx.TimeoutException:
        logger.warning("conductor_bridge: seed-tasks request timed out")
        return {"ok": False, "error": "seed-tasks request timed out", "status": None}
    except httpx.RequestError as e:
        logger.warning(f"conductor_bridge: seed-tasks request error: {e}")
        return {"ok": False, "error": f"seed-tasks request error: {e}", "status": None}
    except Exception as e:  # defensive: seeding must never raise into the route
        logger.warning(f"conductor_bridge: seed-tasks unexpected error: {e}")
        return {"ok": False, "error": f"seed-tasks unexpected error: {e}", "status": None}

    try:
        data = resp.json()
    except ValueError:
        data = None

    if resp.status_code not in (200, 201):
        message = _error_message(data, f"seed-tasks returned {resp.status_code}")
        logger.warning(
            "conductor_bridge: seed-tasks returned %s: %s", resp.status_code, message
        )
        return {"ok": False, "error": message, "status": resp.status_code}

    issues = data.get("issues") if isinstance(data, dict) else None
    if not isinstance(issues, list):
        logger.warning("conductor_bridge: seed-tasks returned no issues list")
        return {
            "ok": False,
            "error": "seed-tasks returned no issues",
            "status": resp.status_code,
        }

    return {"ok": True, "issues": issues}

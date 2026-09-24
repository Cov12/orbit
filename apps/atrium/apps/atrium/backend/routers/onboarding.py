"""
Atrium Onboarding Routes (P1 — capture + seed + completion)

The "warm assistant day one" slice: capture the org's onboarding context once, seed it
into Engram (mem0) through the Conductor bridge so the assistant already knows the
business on the first turn, and record completion server-side.

Completion used to live in an ephemeral frontend store (onboardingComplete), so it was
lost on reload and never shared across devices. It now lives in
AtriumOrganization.settings["onboarding"] — a JSON column that already exists
(models/db.py), so this ships with NO migration.

SCOPE (P1): org-level only. The question set is small and FIXED — no LLM here (the
assisted path is P3) and no agent provisioning (P2). Seeding is best-effort: completion
is committed even when the seed call fails, and the response reports `seeded` so a
later drop can retry.
"""

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..middleware.tenant import get_tenant_session
from ..middleware.deps import require_org_access
from ..models.db import AtriumOrganization, now_ms
from ..services import conductor_bridge

logger = logging.getLogger("atrium.onboarding")

router = APIRouter(prefix="/api/atrium/orgs", tags=["atrium-onboarding"])

# Key inside AtriumOrganization.settings holding completion state. Deliberately a
# JSON-column key, not a new column (same call as subaccount_sync's synced-at marker).
ONBOARDING_KEY = "onboarding"
# Bump when the captured question set changes, so a later version can re-ask/re-seed.
ONBOARDING_VERSION = 1

# Key holding the raw captured answers, kept so seeding can be retried later without
# re-interviewing the user (P1 never retries; it just records enough to make that easy).
ONBOARDING_PROFILE_KEY = "onboardingProfile"

# Key holding the roster of specialist agents provisioned for this org (P2a). It is a
# SIBLING of ONBOARDING_KEY, not a field inside it, on purpose: complete_onboarding
# REPLACES settings[ONBOARDING_KEY] wholesale, so a roster nested there would be silently
# dropped whenever the wizard completes after provisioning. A separate key makes the two
# writes order-independent (the P2b wizard calls both).
ONBOARDING_AGENTS_KEY = "onboardingAgents"

# Key holding a lightweight marker of the starter tasks filed for this org (P4b). Same
# sibling-key reasoning as ONBOARDING_AGENTS_KEY: never nested inside ONBOARDING_KEY.
ONBOARDING_TASKS_KEY = "onboardingTasks"

# Cap on one starter-task request — the wizard offers a handful; this stops an abusive
# payload from filing an unbounded number of issues.
_MAX_TASKS = 20

# Defensive cap on one provisioning request. Conductor owns the canonical role taxonomy and
# it is far smaller than this; the cap only stops an abusive payload from fanning out.
_MAX_ROLES = 32

# The FIXED P1 question set: answer key -> the fact label seeded into Engram. Order is
# the seeding order, so the memory reads top-down like a briefing. Adding a question means
# adding one row here and one field in the wizard — nothing else.
FACT_LABELS: list[tuple[str, str]] = [
    ("orgName", "Business name"),
    ("industry", "Industry"),
    ("whatBusinessDoes", "What the business does"),
    ("customers", "Who the customers are"),
    ("primaryGoal", "Primary goal right now"),
    ("dayToDay", "Main day-to-day work"),
]

# Org profile fields worth mirroring to the top level of settings (read by other
# surfaces); everything else stays inside ONBOARDING_PROFILE_KEY.
PROFILE_FIELDS = ("industry",)

# Defensive cap on one answer, so a pasted essay can't bloat the settings JSON or the
# seeded memory. Answers are user free text.
_MAX_ANSWER_CHARS = 2000


class OnboardingRequest(BaseModel):
    answers: dict = {}
    # OPTIONAL and unwired in P1: the org-level flow never sends it, so seeding lands at
    # company/business scope (Hermes stores it under companyId:_business). Accepted now so
    # per-sub-account seeding is a later drop-in with no contract change.
    subAccountId: Optional[str] = None


def _clean_answer(value) -> Optional[str]:
    """Normalize one raw answer to a concise string, or None if it carries no signal.
    Non-string scalars are stringified (a select may send a number/bool); dicts/lists are
    dropped — P1 captures free text and selects only."""
    if value is None or isinstance(value, (dict, list)):
        return None
    text = value.strip() if isinstance(value, str) else str(value).strip()
    if not text:
        return None
    return text[:_MAX_ANSWER_CHARS]


def _build_facts(answers: dict) -> list[str]:
    """Turn the captured answers into one concise fact string per meaningful answer
    ("Industry: SaaS"), in FACT_LABELS order. Empty/blank/unknown keys are skipped, so a
    user who answers two of six questions seeds exactly two facts."""
    if not isinstance(answers, dict):
        return []
    facts: list[str] = []
    for key, label in FACT_LABELS:
        text = _clean_answer(answers.get(key))
        if text:
            facts.append(f"{label}: {text}")
    return facts


def _captured_profile(answers: dict) -> dict:
    """The cleaned subset of answers we persist — only the known P1 keys, so an arbitrary
    client payload can't write unbounded junk into org.settings."""
    if not isinstance(answers, dict):
        return {}
    out: dict = {}
    for key, _label in FACT_LABELS:
        text = _clean_answer(answers.get(key))
        if text:
            out[key] = text
    return out


def _get_org(db: Session, org_id: str) -> AtriumOrganization:
    org = (
        db.query(AtriumOrganization)
        .filter(AtriumOrganization.id == org_id)
        .one_or_none()
    )
    if org is None:
        raise HTTPException(status_code=404, detail="Organization not found")
    return org


def _onboarding_state(org: AtriumOrganization) -> dict:
    """Read completion state out of settings, defaulting to not-completed. Tolerates a
    NULL/non-dict settings column and a legacy non-dict onboarding value."""
    settings = org.settings if isinstance(org.settings, dict) else {}
    state = settings.get(ONBOARDING_KEY)
    if not isinstance(state, dict):
        return {"completed": False, "completedAt": None, "version": ONBOARDING_VERSION}
    return {
        "completed": bool(state.get("completed", False)),
        "completedAt": state.get("completedAt"),
        "version": state.get("version", ONBOARDING_VERSION),
    }


@router.get("/{org_id}/onboarding", dependencies=[Depends(require_org_access)])
async def get_onboarding(
    org_id: str,
    db: Session = Depends(get_tenant_session),
):
    """Whether this org has finished onboarding — the gate the LockScreen reads instead
    of the old ephemeral client store."""
    return _onboarding_state(_get_org(db, org_id))


@router.post("/{org_id}/onboarding", dependencies=[Depends(require_org_access)])
async def complete_onboarding(
    org_id: str,
    data: OnboardingRequest,
    db: Session = Depends(get_tenant_session),
):
    """Capture the onboarding answers, seed them into Engram, and mark onboarding done.

    Ordering matters: we seed BEFORE committing completion so `seeded` reflects this
    request's real outcome, but completion is committed either way — a Conductor outage must
    not trap a paying customer in the wizard. `seeded: false` is the retry signal.
    """
    org = _get_org(db, org_id)

    facts = _build_facts(data.answers)
    profile = _captured_profile(data.answers)

    sub_account_id = (data.subAccountId or "").strip() or None

    # Best-effort by contract: seed_engram swallows every failure into {ok: False}.
    seed_result = await conductor_bridge.seed_engram(
        db, org_id, facts, sub_account_id=sub_account_id
    )
    seeded = bool(seed_result.get("ok"))
    if not seeded:
        logger.warning(
            "onboarding: engram seed failed for org %s (%s facts): %s",
            org_id, len(facts), seed_result.get("error"),
        )

    # The JSON column is not mutation-tracked — assign a NEW dict, never mutate in place,
    # or the write is silently dropped. Existing settings keys are preserved.
    current = org.settings if isinstance(org.settings, dict) else {}
    updated = {**current}
    if profile:
        updated[ONBOARDING_PROFILE_KEY] = profile
        for field in PROFILE_FIELDS:
            if profile.get(field):
                updated[field] = profile[field]
    updated[ONBOARDING_KEY] = {
        "completed": True,
        "completedAt": now_ms(),
        "version": ONBOARDING_VERSION,
    }
    org.settings = updated
    org.updated_at = now_ms()
    db.commit()

    return {
        "ok": True,
        "completed": True,
        "seeded": seeded,
        "factCount": len(facts),
    }


# --- P2a: explicit specialist-agent provisioning -----------------------------


class ProvisionAgentsRequest(BaseModel):
    # Typed `Any`, not list[str], so a malformed payload lands on the explicit checks in
    # _clean_roles() and answers 400 (pydantic would 422 it before the handler runs).
    roles: Any = None


def _clean_roles(raw: Any) -> list[str]:
    """Validate and normalize the requested roles, or 400.

    Deliberately taxonomy-AGNOSTIC: it only enforces shape (a non-empty list of non-blank
    strings, deduped, order preserved, capped). WHICH roles are legal is Conductor's call —
    it rejects unknown roles, `ceo` and `default` — so the canonical enum lives in exactly
    one place instead of drifting between the two services.
    """
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="roles must be a list of strings")

    roles: list[str] = []
    for entry in raw:
        if not isinstance(entry, str):
            raise HTTPException(status_code=400, detail="roles must be a list of strings")
        role = entry.strip()
        if not role:
            continue
        if role not in roles:  # dedupe, preserving the caller's order
            roles.append(role)

    if not roles:
        raise HTTPException(status_code=400, detail="roles must not be empty")
    if len(roles) > _MAX_ROLES:
        raise HTTPException(
            status_code=400, detail=f"too many roles (max {_MAX_ROLES})"
        )
    return roles


@router.post("/{org_id}/onboarding/agents", dependencies=[Depends(require_org_access)])
async def provision_onboarding_agents(
    org_id: str,
    data: ProvisionAgentsRequest,
    db: Session = Depends(get_tenant_session),
):
    """Provision this org's specialist agents, one per canonical role.

    Its own endpoint, NOT part of complete-onboarding: provisioning is explicit (the user
    picked these roles) and its failure is meaningful, whereas completion must land even
    when Conductor is down. The P2b wizard calls both.

    Conductor is idempotent, so a re-submit returns the same roster with created:false.

    Error mapping:
      400 — bad shape here, or a role Conductor rejected (unknown / ceo / default), relayed
            with Conductor's own message so the wizard can name the offending role;
      502 — the bridge is unreachable, unconfigured, or failed (5xx / malformed body);
      200 — {ok, agents: [{role, agentId, created}], roles}.
    """
    org = _get_org(db, org_id)
    roles = _clean_roles(data.roles)

    result = await conductor_bridge.ensure_department_agents(db, org_id, roles)

    if not result.get("ok"):
        error = result.get("error") or "agent provisioning failed"
        status = result.get("status")
        logger.warning(
            "onboarding: agent provisioning failed for org %s (roles=%s, status=%s): %s",
            org_id, roles, status, error,
        )
        # A Conductor 4xx is a REQUEST problem (an unrecognised role) — relay it as a 400 so
        # the caller fixes the payload. Everything else is an upstream problem: 502.
        if isinstance(status, int) and 400 <= status < 500:
            raise HTTPException(status_code=400, detail=error)
        return JSONResponse(status_code=502, content={"ok": False, "error": error})

    agents = result.get("agents") or []

    # Record the roster for later display (P2b). The JSON column is not mutation-tracked —
    # assign a NEW dict, never mutate in place. Additive: every existing settings key,
    # including P1's onboarding/onboardingProfile, is preserved.
    current = org.settings if isinstance(org.settings, dict) else {}
    updated = {**current}
    updated[ONBOARDING_AGENTS_KEY] = {
        "provisionedRoles": roles,
        "agentsProvisionedAt": now_ms(),
    }
    org.settings = updated
    org.updated_at = now_ms()
    db.commit()

    return {"ok": True, "agents": agents, "roles": roles}


# --- P3a: assisted "I'm not sure" path — suggest departments -----------------


class SuggestRolesRequest(BaseModel):
    # Typed `Any` so malformed payloads hit the explicit checks below and answer 400
    # (pydantic would 422 them before the handler runs) — same call as P2a.
    answers: Any = None
    maxRoles: Any = None


def _clean_max_roles(raw: Any) -> Optional[int]:
    """maxRoles is optional; when present it must be a positive int (bool excluded —
    it is an int subclass). Capped at _MAX_ROLES, the same defensive ceiling as P2a."""
    if raw is None:
        return None
    if isinstance(raw, bool) or not isinstance(raw, int) or raw < 1:
        raise HTTPException(status_code=400, detail="maxRoles must be a positive integer")
    return min(raw, _MAX_ROLES)


@router.post("/{org_id}/onboarding/suggest", dependencies=[Depends(require_org_access)])
async def suggest_onboarding_roles(
    org_id: str,
    data: SuggestRolesRequest,
    db: Session = Depends(get_tenant_session),
):
    """Suggest departments (canonical roles) from the assisted-interview answers.

    Read-only: it forwards the answers to Conductor's role-map and returns what it proposes.
    Nothing is provisioned or persisted — once the user confirms, the wizard calls
    /onboarding/agents as usual.

    Conductor never fails a reachable request (it has a rules fallback), so:
      200 — {roles, suggestions, model} (roles may be empty);
      400 — answers missing / not a non-empty object, or a bad maxRoles;
      502 — the bridge is unreachable, unconfigured, or answered badly; the wizard
            falls back to manual department selection.
    """
    _get_org(db, org_id)

    if not isinstance(data.answers, dict) or not data.answers:
        raise HTTPException(status_code=400, detail="answers must be a non-empty object")
    max_roles = _clean_max_roles(data.maxRoles)

    result = await conductor_bridge.suggest_roles(db, org_id, data.answers, max_roles)

    if not result.get("ok"):
        error = result.get("error") or "role suggestion failed"
        logger.warning("onboarding: role suggestion failed for org %s: %s", org_id, error)
        return JSONResponse(status_code=502, content={"error": error})

    return {
        "roles": result.get("roles") or [],
        "suggestions": result.get("suggestions") or [],
        "model": result.get("model"),
    }


# --- P4b: opt-in starter tasks -----------------------------------------------


class SeedTasksRequest(BaseModel):
    # Typed `Any` so malformed payloads hit the explicit checks in _clean_tasks() and
    # answer 400 (pydantic would 422 them before the handler runs) — same call as P2a.
    tasks: Any = None


def _clean_tasks(raw: Any) -> list[dict]:
    """Validate and normalize the requested tasks, or 400.

    Shape only: a non-empty list (capped) of objects, each with a non-blank string
    `title` and optional string `description`/`priority`. Values are trimmed, blank
    optionals are dropped, and unknown keys are not forwarded. Which priorities are legal
    is Conductor's call — it 400s a bad one and we relay that.
    """
    if not isinstance(raw, list):
        raise HTTPException(status_code=400, detail="tasks must be a list")
    if not raw:
        raise HTTPException(status_code=400, detail="tasks must not be empty")
    if len(raw) > _MAX_TASKS:
        raise HTTPException(status_code=400, detail=f"too many tasks (max {_MAX_TASKS})")

    tasks: list[dict] = []
    for entry in raw:
        if not isinstance(entry, dict):
            raise HTTPException(status_code=400, detail="each task must be an object")
        title = entry.get("title")
        if not isinstance(title, str) or not title.strip():
            raise HTTPException(status_code=400, detail="each task needs a non-empty title")
        task = {"title": title.strip()}
        for key in ("description", "priority"):
            value = entry.get(key)
            if value is None:
                continue
            if not isinstance(value, str):
                raise HTTPException(status_code=400, detail=f"task {key} must be a string")
            if value.strip():
                task[key] = value.strip()
        tasks.append(task)
    return tasks


@router.post("/{org_id}/onboarding/tasks", dependencies=[Depends(require_org_access)])
async def seed_onboarding_tasks(
    org_id: str,
    data: SeedTasksRequest,
    db: Session = Depends(get_tenant_session),
):
    """File the user's confirmed starter tasks as CEO-assigned todo issues in Conductor.

    Explicit and opt-in: the user launched these, so a failure surfaces (the wizard shows
    a retryable notice) rather than being swallowed like P1 seeding.

    Error mapping:
      400 — bad shape here, or a Conductor 400 relayed with its own message;
      502 — the bridge is unreachable, unconfigured, or failed (5xx / malformed body);
      200 — {issues: [{id, identifier, title}]}.
    """
    org = _get_org(db, org_id)
    tasks = _clean_tasks(data.tasks)

    result = await conductor_bridge.seed_tasks(db, org_id, tasks)

    if not result.get("ok"):
        error = result.get("error") or "starter task seeding failed"
        status = result.get("status")
        logger.warning(
            "onboarding: starter task seeding failed for org %s (%s tasks, status=%s): %s",
            org_id, len(tasks), status, error,
        )
        # Only a Conductor 400 is a REQUEST problem; anything else (incl. a 401 from a
        # mismatched bridge secret) is upstream, so the wizard can offer a retry.
        if status == 400:
            raise HTTPException(status_code=400, detail=error)
        return JSONResponse(status_code=502, content={"error": error})

    issues = result.get("issues") or []

    # Lightweight marker only — the issues themselves live in Conductor. New dict, never an
    # in-place mutation (the JSON column is not mutation-tracked); every key is preserved.
    current = org.settings if isinstance(org.settings, dict) else {}
    updated = {**current}
    updated[ONBOARDING_TASKS_KEY] = {"seededAt": now_ms(), "count": len(issues)}
    org.settings = updated
    org.updated_at = now_ms()
    db.commit()

    return {"issues": issues}

"""
Portal sub-account mirror sync (issue #27 / A1).

Portal is the source of truth for an org's sub-accounts. Atrium runs its OWN
SQLite (webui.db) and cannot share Portal's Postgres, so — exactly like WorkPipe
pulls CRM rows — it PULLs the list over HTTP and mirrors it locally into
AtriumSubAccount, keyed by Portal's SubAccount.id (a CUID) stored VERBATIM. That
keeps Atrium keying the SAME sub-account identity as WorkPipe/Drive/Portal.

Design constraints (mirrors services/conductor_bridge defensive style):
  * NEVER raise into the request path. Any network/HTTP/DB failure -> log + no-op,
    so an unreachable Portal degrades Atrium to business-scope-only (empty list),
    never a 500.
  * Ids are Portal's, verbatim. We create-if-missing and update name/slug/status on
    change; we NEVER mint a sub-account id locally.
  * Throttled: the sync hook runs on Portal-authed requests, so we back off per-org
    (in-process TTL) to avoid hammering Portal on every request. See maybe_sync().

Auth + base URL (verified against the codebase, not guessed):
  * PORTAL_URL — the Portal base URL env, default https://portal.orbit.example, the same
    var routers/auth_callback.py + middleware/auth_redirect.py already read.
  * The raw, validated Portal JWT is stashed on request.state.portal_token by
    middleware/jwt_auth.py; we forward it as `Authorization: Bearer <jwt>` so Portal
    authorizes the call as the same user.
"""

from __future__ import annotations

import datetime
import logging
import os
from typing import Optional

import httpx
from sqlalchemy import func
from sqlalchemy.orm import Session

logger = logging.getLogger("atrium.subaccount_sync")

ATRIUM_SUBACCOUNT_COOKIE = "atrium_subaccount"
BUSINESS_SCOPE_SENTINEL = "__business__"

# Key inside AtriumOrganization.settings (a JSON column, so NO migration) holding the
# ISO-8601 UTC timestamp of the last SUCCESSFUL Portal pull for this org (#B1). Its
# presence is what lets a caller tell "Portal says this org genuinely has 0 sub-accounts"
# from "we have never managed to reach Portal" — the two states the mirror otherwise
# renders identically (an empty list), and which must NOT produce the same UI.
SUBACCOUNTS_SYNCED_AT_KEY = "subaccountsSyncedAt"

_DEFAULT_PORTAL_URL = "https://portal.orbit.example"
_DEFAULT_TIMEOUT_S = 8.0
# Per-org back-off between pulls. One sync every 15 min per org is plenty for a
# roster that changes rarely; overridable per-env.
_DEFAULT_TTL_S = 900.0

# In-process, best-effort throttle: org (internal id) -> last attempt (ms). Not
# shared across workers/restarts by design — the worst case is one redundant pull
# after a restart, which is idempotent and cheap. Avoids a schema column AND a DB
# write on the hot request path (a plain dict lookup instead).
_last_attempt_ms: dict[str, int] = {}


# --- config (env) ------------------------------------------------------------

def _portal_base_url() -> str:
    return os.environ.get("PORTAL_URL", _DEFAULT_PORTAL_URL).rstrip("/")


def _subaccounts_url() -> str:
    return f"{_portal_base_url()}/api/subaccounts"


def _timeout_s() -> float:
    try:
        return float(os.environ.get("SUBACCOUNT_SYNC_TIMEOUT_S", _DEFAULT_TIMEOUT_S))
    except ValueError:
        return _DEFAULT_TIMEOUT_S


def _ttl_ms() -> int:
    try:
        return int(float(os.environ.get("SUBACCOUNT_SYNC_TTL_S", _DEFAULT_TTL_S)) * 1000)
    except ValueError:
        return int(_DEFAULT_TTL_S * 1000)


# --- HTTP fetch --------------------------------------------------------------

def _fetch_subaccounts(token: str) -> Optional[list[dict]]:
    """GET Portal /api/subaccounts as the JWT's user. Returns a list of sub-account
    dicts, or None on ANY failure (missing token, network error, non-2xx, non-JSON,
    unexpected shape). Never raises.

    Portal may return either a bare array or a wrapped envelope
    ({"data": [...]} / {"subAccounts": [...]}); both are accepted."""
    if not token:
        return None
    url = _subaccounts_url()
    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json",
    }
    try:
        with httpx.Client(timeout=_timeout_s()) as client:
            resp = client.get(url, headers=headers)
    except httpx.HTTPError as e:  # timeout, connect error, etc.
        logger.warning("subaccount_sync: fetch failed (%s): %s", url, e)
        return None

    if resp.status_code not in (200, 201):
        logger.warning(
            "subaccount_sync: Portal returned %s for %s", resp.status_code, url
        )
        return None

    try:
        data = resp.json()
    except ValueError:
        logger.warning("subaccount_sync: Portal returned non-JSON body for %s", url)
        return None

    items = _extract_list(data)
    if items is None:
        logger.warning("subaccount_sync: unexpected Portal payload shape for %s", url)
        return None
    return items


def _extract_list(data) -> Optional[list[dict]]:
    """Normalize Portal's response into a list of dicts. None if it isn't one.

    Portal returns a wrapped envelope, e.g. {"subAccounts": [...]}. Pick the wrapper by
    KEY PRESENCE, not truthiness — an empty list [] is a valid "no sub-accounts" answer and
    must NOT be misread as an absent key (the `x.get(k) or ...` idiom does exactly that,
    since [] is falsy, and mislabels a 0-sub-account org as an 'unexpected payload shape')."""
    if isinstance(data, list):
        candidate = data
    elif isinstance(data, dict):
        candidate = None
        for key in ("data", "subAccounts", "subaccounts"):
            if key in data:
                candidate = data[key]
                break
        if candidate is None:
            # No known wrapper key present: an empty object {} means "no sub-accounts";
            # anything else is an unexpected shape.
            return [] if not data else None
    else:
        return None
    if not isinstance(candidate, list):
        return None
    return [x for x in candidate if isinstance(x, dict)]


# --- upsert ------------------------------------------------------------------

def sync_org_subaccounts(
    db: Optional[Session],
    internal_org_id: Optional[str],
    portal_org_id: Optional[str],
    token: Optional[str],
) -> int:
    """Pull the org's sub-accounts from Portal and upsert them into the mirror.

    Returns the number of sub-accounts upserted (0 on any failure / empty list).
    Ids are stored VERBATIM as Portal's SubAccount.id. Never raises into the
    request path — on error it rolls back and swallows, mirroring conductor_bridge.

    #B1: a None result (Portal unreachable / non-2xx / unparseable) and an empty
    list (Portal answered: this org has no sub-accounts) are NOT the same thing,
    even though both leave the mirror with 0 rows. Only the non-None case stamps
    the org-level success marker, so a consumer can distinguish "genuinely zero"
    (safe to nudge the user to create their first sub-account) from "we have no
    idea, Portal was down" (must NOT nudge)."""
    if db is None or not internal_org_id or not token:
        return 0

    items = _fetch_subaccounts(token)
    if items is None:
        # Portal failure: mirror untouched, NO success marker. syncOk stays as it was.
        return 0
    if not items:
        # Valid empty answer — a known-good zero. Stamp the marker even though there
        # is nothing to upsert; this is the whole point of splitting the branches.
        _mark_sync_success(db, internal_org_id)
        return 0

    try:
        from ..models.db import AtriumSubAccount, now_ms

        upserted = 0
        for sa in items:
            sid = (sa.get("id") or "").strip()
            if not sid:
                continue  # never mint an id locally; skip malformed entries
            name = sa.get("name")
            slug = sa.get("slug")
            status = sa.get("status")
            ts = now_ms()

            row = (
                db.query(AtriumSubAccount)
                .filter(AtriumSubAccount.id == sid)
                .one_or_none()
            )
            # Defense-in-depth: never STEAL a sub-account row across Portal orgs. Portal
            # ids are globally unique and each org's sync only fetches its own, so this
            # should never trigger — but if a mismatched (org, token) call ever occurred it
            # must not reassign a row that belongs to a DIFFERENT Portal org. A re-provision
            # under a new Atrium internal id keeps the SAME portal_org_id, so that legit
            # case still updates (only a DIFFERENT portal_org_id is refused).
            if (
                row is not None
                and row.portal_org_id
                and portal_org_id
                and row.portal_org_id != portal_org_id
            ):
                logger.warning(
                    "subaccount_sync: sub-account %s already owned by portal_org %s, not %s"
                    " — refusing cross-tenant reassignment",
                    sid, row.portal_org_id, portal_org_id,
                )
                continue
            if row is None:
                db.add(
                    AtriumSubAccount(
                        id=sid,  # Portal's id, verbatim
                        org_id=internal_org_id,
                        portal_org_id=portal_org_id,
                        name=name,
                        slug=slug,
                        status=status,
                        created_at=ts,
                        updated_at=ts,
                        synced_at=ts,
                    )
                )
            else:
                changed = (
                    row.name != name
                    or row.slug != slug
                    or row.status != status
                    or row.org_id != internal_org_id
                    or row.portal_org_id != portal_org_id
                )
                row.name = name
                row.slug = slug
                row.status = status
                # Keep the ownership binding fresh (an org re-provisioned under a new
                # internal id would otherwise leave stale rows pointing elsewhere).
                row.org_id = internal_org_id
                row.portal_org_id = portal_org_id
                row.synced_at = ts
                if changed:
                    row.updated_at = ts
            upserted += 1

        db.commit()
        # The pull succeeded end-to-end: record the known-good marker (#B1).
        _mark_sync_success(db, internal_org_id)
        logger.info(
            "subaccount_sync: upserted %d sub-account(s) for org %s",
            upserted,
            internal_org_id,
        )
        return upserted
    except Exception as e:  # never let the mirror break a request
        logger.warning(
            "subaccount_sync: upsert failed for org %s: %s", internal_org_id, e
        )
        try:
            db.rollback()
        except Exception:
            pass
        return 0


# --- sync-freshness marker (#B1) ---------------------------------------------

def _utc_now_iso() -> str:
    """ISO-8601 UTC with a trailing Z — the shape the frontend's Date parser expects."""
    return (
        datetime.datetime.now(datetime.timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


def _mark_sync_success(
    db: Optional[Session], internal_org_id: Optional[str]
) -> Optional[str]:
    """Stamp settings[SUBACCOUNTS_SYNCED_AT_KEY] on the org row. Returns the stamp, or
    None if it could not be written.

    Deliberately a JSON-column key rather than a new column: AtriumOrganization.settings
    already exists (models/db.py:58), so this ships with NO migration. The JSON column is
    not mutation-tracked, so we must assign a NEW dict — mutating org.settings in place
    would never be flushed. Never raises; a failed stamp just leaves syncOk unknown."""
    if db is None or not internal_org_id:
        return None
    try:
        from ..models.db import AtriumOrganization, now_ms

        org = (
            db.query(AtriumOrganization)
            .filter(AtriumOrganization.id == internal_org_id)
            .one_or_none()
        )
        if org is None:
            return None
        stamp = _utc_now_iso()
        current = org.settings if isinstance(org.settings, dict) else {}
        org.settings = {**current, SUBACCOUNTS_SYNCED_AT_KEY: stamp}  # new dict, not in-place
        org.updated_at = now_ms()
        db.commit()
        return stamp
    except Exception as e:
        logger.warning(
            "subaccount_sync: could not stamp sync marker for org %s: %s",
            internal_org_id, e,
        )
        try:
            db.rollback()
        except Exception:
            pass
        return None


def get_sync_status(
    db: Optional[Session], internal_org_id: Optional[str]
) -> tuple[Optional[str], bool]:
    """Read the org's mirror-freshness signal as (synced_at_iso, sync_ok).

    sync_ok is True only when a successful pull has been recorded at some point —
    i.e. the mirror is KNOWN-good, so an empty sub-account list means the org really
    has none. False means unknown/never-succeeded (Portal outage, brand-new org whose
    first sync failed): callers must treat an empty list as "no information", not as
    "zero sub-accounts". Note this is last-known-good, not liveness: a sync that
    succeeded and later starts failing keeps the older stamp."""
    if db is None or not internal_org_id:
        return None, False
    try:
        from ..models.db import AtriumOrganization

        org = (
            db.query(AtriumOrganization)
            .filter(AtriumOrganization.id == internal_org_id)
            .one_or_none()
        )
        settings = getattr(org, "settings", None) if org is not None else None
        if not isinstance(settings, dict):
            return None, False
        stamp = settings.get(SUBACCOUNTS_SYNCED_AT_KEY)
        if not isinstance(stamp, str) or not stamp:
            return None, False
        return stamp, True
    except Exception as e:
        logger.warning(
            "subaccount_sync: sync-status read failed for org %s: %s",
            internal_org_id, e,
        )
        try:
            db.rollback()
        except Exception:
            pass
        return None, False


# --- throttled request-path entry --------------------------------------------

def maybe_sync(
    db: Optional[Session],
    internal_org_id: Optional[str],
    portal_org_id: Optional[str],
    token: Optional[str],
) -> None:
    """Throttled wrapper called from the request path (middleware.tenant
    get_tenant_session). Backs off per-org so a Portal-authed request stream does
    not pull on every hit. Never raises.

    The attempt timestamp is recorded BEFORE the pull, so a failing/unreachable
    Portal also backs off for the TTL instead of being retried every request —
    exactly the "degrade to business-scope-only" behavior we want."""
    if db is None or not internal_org_id or not token:
        return
    try:
        now = _now_ms()
        last = _last_attempt_ms.get(internal_org_id)
        if last is not None and (now - last) < _ttl_ms():
            return  # throttled
        _last_attempt_ms[internal_org_id] = now
        sync_org_subaccounts(db, internal_org_id, portal_org_id, token)
    except Exception as e:  # belt-and-suspenders: request path must never 500 here
        logger.warning(
            "subaccount_sync: maybe_sync failed for org %s: %s", internal_org_id, e
        )


def force_sync(
    db: Optional[Session],
    internal_org_id: Optional[str],
    portal_org_id: Optional[str],
    token: Optional[str],
) -> int:
    """Pull NOW, ignoring the per-org back-off (#B2).

    maybe_sync's 900s TTL is right for the ambient login/request stream but wrong for the
    one moment we KNOW the roster just changed: the user returning from Portal having just
    created a sub-account. Throttled, that return would show a stale mirror (no new
    sub-account) for up to 15 minutes. So the return hop calls this instead.

    The attempt is still recorded in the throttle map, so a forced pull also resets the
    back-off window rather than leaving a stale timestamp that would allow an immediate
    second pull. Never raises — the caller is the login path."""
    if db is None or not internal_org_id or not token:
        return 0
    try:
        _last_attempt_ms[internal_org_id] = _now_ms()
        return sync_org_subaccounts(db, internal_org_id, portal_org_id, token)
    except Exception as e:  # login must never 500 because Portal misbehaved
        logger.warning(
            "subaccount_sync: force_sync failed for org %s: %s", internal_org_id, e
        )
        return 0


def _now_ms() -> int:
    from ..models.db import now_ms

    return now_ms()


# --- read helper (Atrium as read-only consumer) ----------------------------

def list_subaccounts(db: Optional[Session], internal_org_id: Optional[str]) -> list:
    """List the mirrored sub-accounts for an Atrium-internal org id. Returns []
    on missing input or any error — a degraded mirror is business-scope-only, never
    a crash."""
    if db is None or not internal_org_id:
        return []
    try:
        from ..models.db import AtriumSubAccount

        return (
            db.query(AtriumSubAccount)
            .filter(AtriumSubAccount.org_id == internal_org_id)
            .order_by(AtriumSubAccount.created_at.asc())
            .all()
        )
    except Exception as e:
        logger.warning(
            "subaccount_sync: list failed for org %s: %s", internal_org_id, e
        )
        try:
            db.rollback()
        except Exception:
            pass
        return []


def list_active_subaccounts(db: Optional[Session], internal_org_id: Optional[str]) -> list:
    """List only ACTIVE mirrored sub-accounts for an org, oldest-first.

    Portal has historically emitted status values with varying case, so ACTIVE is
    treated case-insensitively. Any DB failure degrades to [] instead of raising.
    """
    if db is None or not internal_org_id:
        return []
    try:
        from ..models.db import AtriumSubAccount

        return (
            db.query(AtriumSubAccount)
            .filter(AtriumSubAccount.org_id == internal_org_id)
            .filter(func.lower(func.coalesce(AtriumSubAccount.status, "")) == "active")
            .order_by(AtriumSubAccount.created_at.asc())
            .all()
        )
    except Exception as e:
        logger.warning(
            "subaccount_sync: active-list failed for org %s: %s", internal_org_id, e
        )
        try:
            db.rollback()
        except Exception:
            pass
        return []


def resolve_active_subaccount_id(
    db: Optional[Session], internal_org_id: Optional[str], cookie_value: Optional[str]
) -> Optional[str]:
    """Resolve the chat's active sub-account from the selector cookie.

    Semantics for Atrium chat:
      * missing cookie => business scope (None)
      * BUSINESS sentinel => explicit business scope (None)
      * any id => only honored if it names an ACTIVE mirrored sub-account of this org

    Invalid / stale / cross-org cookie values fail closed to business scope.
    """
    if not cookie_value or cookie_value == BUSINESS_SCOPE_SENTINEL:
        return None
    for row in list_active_subaccounts(db, internal_org_id):
        if row.id == cookie_value:
            return row.id
    return None

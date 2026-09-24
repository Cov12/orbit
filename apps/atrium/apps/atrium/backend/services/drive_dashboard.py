"""Dashboard Drive read client (HTTP + JWT) — mirrors workpipe_dashboard.

Calls Drive's read-only GET /api/drive/summary with an org-scoped service JWT. Drive verifies
it with the shared JWT_SECRET (verifyPortalToken) + DRIVE entitlement (hasDriveAccess) and
scopes by the token's org_id / sub_account_id claims. We mint a FULL Portal-shape token (Drive
rejects a minimal one), signed with the same JWT_SECRET Portal uses. Org membership is enforced
upstream by require_org_access before this client is ever built.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Any, Optional

import httpx
import jwt as pyjwt

logger = logging.getLogger("atrium.drive_dashboard")

JWT_SECRET = os.environ.get("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
DEFAULT_DRIVE_API_URL = os.environ.get("DRIVE_API_URL", "https://drive.orbit.example")
DRIVE_TIMEOUT_SECONDS = float(os.environ.get("DRIVE_TIMEOUT_SECONDS", "15"))


class DriveDashboardError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


class DriveDashboardClient:
    """Thin HTTP client for the Dashboard Drive summary read."""

    def __init__(
        self,
        *,
        portal_org_id: str,
        org_slug: str,
        app_access: list[str],
        user_id: str,
        org_name: str | None = None,
        role: str | None = None,
        email: str | None = None,
        name: str | None = None,
        sub_account_id: str | None = None,
        base_url: str | None = None,
    ):
        org_id = (portal_org_id or "").strip()
        if not org_id:
            raise DriveDashboardError("Organization is not linked to Drive", status_code=409)
        if not JWT_SECRET:
            raise DriveDashboardError("JWT_SECRET not configured for Drive dashboard auth", status_code=503)

        self.portal_org_id = org_id
        self.org_slug = (org_slug or "").strip() or "org"
        self.org_name = org_name
        self.app_access = list(app_access or [])
        self.user_id = (user_id or "atrium-dashboard").strip() or "atrium-dashboard"
        self.role = role or "member"
        self.email = email
        self.name = name
        self.sub_account_id = sub_account_id
        self.base_url = (base_url or DEFAULT_DRIVE_API_URL).rstrip("/")

    def _mint_token(self) -> str:
        now = int(time.time())
        # FULL Portal claim shape — Drive's isPortalJwtPayload rejects a minimal token.
        payload: dict[str, Any] = {
            "sub": self.user_id,
            "org_id": self.portal_org_id,
            "org_slug": self.org_slug,
            "org_name": self.org_name or self.org_slug,
            "role": self.role,
            "email": self.email or f"dashboard@{self.org_slug}.atrium",
            "name": self.name or "Atrium Dashboard",
            "app_access": self.app_access,
            "subscriptions": [],
            "iat": now,
            "exp": now + 300,
        }
        if self.sub_account_id:
            payload["sub_account_id"] = self.sub_account_id
        return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    async def _get(self, path: str) -> dict[str, Any]:
        token = self._mint_token()
        headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
        url = f"{self.base_url}/api/drive{path}"
        try:
            async with httpx.AsyncClient(timeout=DRIVE_TIMEOUT_SECONDS) as client:
                response = await client.get(url, headers=headers)
        except httpx.TimeoutException as exc:
            raise DriveDashboardError("Drive request timed out", status_code=504) from exc
        except httpx.HTTPError as exc:
            raise DriveDashboardError(f"Drive request failed: {exc}", status_code=502) from exc

        if response.status_code >= 400:
            detail = response.text
            try:
                body = response.json()
                if isinstance(body, dict):
                    detail = body.get("error") or body.get("detail") or detail
            except ValueError:
                pass
            raise DriveDashboardError(f"Drive API error {response.status_code}: {detail}", status_code=response.status_code)

        try:
            body = response.json()
        except ValueError as exc:
            raise DriveDashboardError("Drive returned invalid JSON", status_code=502) from exc
        if not isinstance(body, dict):
            raise DriveDashboardError("Drive returned an unexpected payload", status_code=502)
        return body

    async def get_summary(self) -> dict[str, Any]:
        return await self._get("/summary")

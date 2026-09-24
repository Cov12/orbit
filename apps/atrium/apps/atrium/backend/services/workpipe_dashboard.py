from __future__ import annotations

import logging
import os
import time
from typing import Any, Optional

import httpx
import jwt as pyjwt

logger = logging.getLogger("atrium.workpipe_dashboard")

JWT_SECRET = os.environ.get("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
DEFAULT_WORKPIPE_API_URL = os.environ.get("WORKPIPE_API_URL", "https://workpipe.orbit.example")
WORKPIPE_TIMEOUT_SECONDS = float(os.environ.get("WORKPIPE_TIMEOUT_SECONDS", "15"))


class WorkPipeDashboardError(Exception):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


class WorkPipeDashboardClient:
    """Thin HTTP client for Dashboard D2 WorkPipe reads."""

    def __init__(
        self,
        *,
        workpipe_business_id: str,
        user_id: str,
        base_url: str | None = None,
        role: str | None = None,
        email: str | None = None,
    ):
        business_id = (workpipe_business_id or "").strip()
        if not business_id:
            raise WorkPipeDashboardError("Organization is not linked to WorkPipe", status_code=409)
        if not JWT_SECRET:
            raise WorkPipeDashboardError("JWT_SECRET not configured for WorkPipe dashboard auth", status_code=503)

        self.base_url = (base_url or DEFAULT_WORKPIPE_API_URL).rstrip("/")
        self.workpipe_business_id = business_id
        self.user_id = (user_id or "atrium-dashboard").strip() or "atrium-dashboard"
        self.role = role or "member"
        self.email = email

    def _mint_token(self) -> str:
        now = int(time.time())
        payload: dict[str, Any] = {
            "org_id": self.workpipe_business_id,
            "user_id": self.user_id,
            "sub": self.user_id,
            "role": self.role,
            "iat": now,
            "exp": now + 300,
        }
        if self.email:
            payload["email"] = self.email
        return pyjwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    async def _get(self, path: str, *, params: Optional[dict[str, Any]] = None) -> dict[str, Any]:
        token = self._mint_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Accept": "application/json",
        }
        url = f"{self.base_url}/api/internal{path}"

        try:
            async with httpx.AsyncClient(timeout=WORKPIPE_TIMEOUT_SECONDS) as client:
                response = await client.get(url, headers=headers, params=params)
        except httpx.TimeoutException as exc:
            raise WorkPipeDashboardError("WorkPipe request timed out", status_code=504) from exc
        except httpx.HTTPError as exc:
            raise WorkPipeDashboardError(f"WorkPipe request failed: {exc}", status_code=502) from exc

        if response.status_code >= 400:
            detail = response.text
            try:
                payload = response.json()
                if isinstance(payload, dict):
                    detail = payload.get("error") or payload.get("detail") or detail
            except ValueError:
                pass
            raise WorkPipeDashboardError(
                f"WorkPipe API error {response.status_code}: {detail}",
                status_code=response.status_code,
            )

        try:
            payload = response.json()
        except ValueError as exc:
            raise WorkPipeDashboardError("WorkPipe returned invalid JSON", status_code=502) from exc

        if not isinstance(payload, dict):
            raise WorkPipeDashboardError("WorkPipe returned an unexpected payload", status_code=502)
        return payload

    async def get_stats(self, *, sub_account_id: str | None = None) -> dict[str, Any]:
        payload = await self._get("/stats", params=_subaccount_params(sub_account_id))
        contacts_raw = payload.get("contacts")
        tickets_raw = payload.get("tickets")
        pipelines_raw = payload.get("pipelines")
        contacts: dict[str, Any] = contacts_raw if isinstance(contacts_raw, dict) else {}
        tickets: dict[str, Any] = tickets_raw if isinstance(tickets_raw, dict) else {}
        pipelines: dict[str, Any] = pipelines_raw if isinstance(pipelines_raw, dict) else {}
        by_lane = tickets.get("byLane")
        return {
            "contacts": {
                "total": int(contacts.get("total") or 0),
                "recentCount": int(contacts.get("recentCount") or 0),
            },
            "tickets": {
                "total": int(tickets.get("total") or 0),
                "totalValue": float(tickets.get("totalValue") or 0),
                "byLane": by_lane if isinstance(by_lane, dict) else {},
            },
            "pipelines": {
                "count": int(pipelines.get("count") or 0),
            },
        }

    async def get_pipelines(self, *, sub_account_id: str | None = None) -> dict[str, Any]:
        payload = await self._get("/pipelines", params=_subaccount_params(sub_account_id))
        pipelines = payload.get("pipelines")
        if not isinstance(pipelines, list):
            pipelines = []
        return {
            "pipelines": pipelines,
            "count": len(pipelines),
        }

    async def get_contacts(
        self,
        *,
        sub_account_id: str | None = None,
        search: str = "",
        limit: int = 10,
        offset: int = 0,
    ) -> dict[str, Any]:
        params = _subaccount_params(sub_account_id)
        params["limit"] = max(1, min(limit, 100))
        params["offset"] = max(0, offset)
        cleaned_search = search.strip()
        if cleaned_search:
            params["search"] = cleaned_search

        payload = await self._get("/contacts", params=params)
        contacts = payload.get("contacts")
        if not isinstance(contacts, list):
            contacts = []
        total = payload.get("total")
        return {
            "contacts": contacts,
            "total": int(total) if isinstance(total, (int, float)) else len(contacts),
        }

    async def get_appointments(self, *, sub_account_id: str | None = None) -> dict[str, Any]:
        payload = await self._get("/appointments", params=_subaccount_params(sub_account_id))
        upcoming = payload.get("upcoming")
        return {
            "upcoming": upcoming if isinstance(upcoming, list) else [],
            "upcomingCount": int(payload.get("upcomingCount") or 0),
        }

    async def get_invoices(self, *, sub_account_id: str | None = None) -> dict[str, Any]:
        payload = await self._get("/invoices", params=_subaccount_params(sub_account_id))
        recent = payload.get("recent")
        return {
            "count": int(payload.get("count") or 0),
            "totalDue": float(payload.get("totalDue") or 0),
            "dueSoonCount": int(payload.get("dueSoonCount") or 0),
            "recent": recent if isinstance(recent, list) else [],
        }

    async def get_funnels(self, *, sub_account_id: str | None = None) -> dict[str, Any]:
        payload = await self._get("/funnels", params=_subaccount_params(sub_account_id))
        recent = payload.get("recent")
        return {
            "count": int(payload.get("count") or 0),
            "publishedCount": int(payload.get("publishedCount") or 0),
            "totalVisits": int(payload.get("totalVisits") or 0),
            "recent": recent if isinstance(recent, list) else [],
        }

    async def get_trends(self, *, sub_account_id: str | None = None, days: int = 30) -> dict[str, Any]:
        params = _subaccount_params(sub_account_id)
        params["days"] = max(1, min(int(days), 90))
        payload = await self._get("/trends", params=params)
        series = payload.get("series")
        totals = payload.get("totals")
        return {
            "days": int(payload.get("days") or 30),
            "series": series if isinstance(series, list) else [],
            "totals": totals if isinstance(totals, dict) else {},
        }


def _subaccount_params(sub_account_id: str | None) -> dict[str, Any]:
    cleaned = (sub_account_id or "").strip()
    return {"subAccountId": cleaned} if cleaned else {}

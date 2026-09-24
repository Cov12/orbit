"""
CRM Adapter Interface

Abstract interface for CRM operations. Department engines call this interface,
not WorkPipe directly. This allows swapping CRM backends (WorkPipe, GHL, etc.)
without changing department logic.

Phase 2A: WorkPipeAdapter (default) — calls WorkPipe Internal API
Phase 3: GHLAdapter — calls GoHighLevel via MCP
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger("atrium.crm_adapter")


# ── Data Models ────────────────────────────────────────────────────────────

@dataclass
class CRMContact:
    id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company_name: Optional[str] = None
    tags: list[str] = field(default_factory=list)
    created_at: Optional[str] = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class CRMTicket:
    id: str
    name: str
    lane_id: str
    lane_name: Optional[str] = None
    value: float = 0.0
    description: Optional[str] = None
    assigned_user_id: Optional[str] = None
    customer_id: Optional[str] = None
    tags: list[str] = field(default_factory=list)
    order: int = 0
    created_at: Optional[str] = None
    extra: dict[str, Any] = field(default_factory=dict)


@dataclass
class CRMPipeline:
    id: str
    name: str
    lanes: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class CRMStats:
    contacts_total: int = 0
    contacts_recent: int = 0
    tickets_total: int = 0
    tickets_value: float = 0.0
    tickets_by_lane: dict[str, int] = field(default_factory=dict)
    pipelines_count: int = 0


@dataclass
class CRMListResult:
    items: list[Any] = field(default_factory=list)
    total: int = 0


# ── Abstract Interface ─────────────────────────────────────────────────────

class CRMAdapter(ABC):
    """Abstract CRM adapter. All department engines use this interface."""

    @abstractmethod
    async def get_contacts(
        self, sub_account_id: str, *, search: str = "", limit: int = 50, offset: int = 0
    ) -> CRMListResult:
        ...

    @abstractmethod
    async def create_contact(
        self, sub_account_id: str, *, name: str, email: str = "", phone: str = "", company_name: str = ""
    ) -> CRMContact:
        ...

    @abstractmethod
    async def update_contact(self, contact_id: str, **fields) -> CRMContact:
        ...

    @abstractmethod
    async def get_pipelines(self, sub_account_id: str) -> list[CRMPipeline]:
        ...

    @abstractmethod
    async def get_tickets(self, pipeline_id: str) -> list[CRMTicket]:
        ...

    @abstractmethod
    async def create_ticket(
        self,
        lane_id: str,
        *,
        name: str,
        description: str = "",
        value: float = 0.0,
        customer_id: str = "",
        assigned_user_id: str = "",
        tags: list[str] | None = None,
    ) -> CRMTicket:
        ...

    @abstractmethod
    async def update_ticket(self, ticket_id: str, **fields) -> CRMTicket:
        ...

    @abstractmethod
    async def move_ticket(self, ticket_id: str, target_lane_id: str) -> CRMTicket:
        ...

    @abstractmethod
    async def get_stats(self, sub_account_id: str) -> CRMStats:
        ...


# ── WorkPipe Adapter (calls WorkPipe Internal API) ────────────────────────

class WorkPipeAdapter(CRMAdapter):
    """
    Default CRM adapter — calls WorkPipe's Internal REST API.
    Requires WORKPIPE_API_URL and a valid Portal JWT for auth.
    """

    def __init__(self, base_url: str, auth_token: str):
        self.base_url = base_url.rstrip("/")
        self.auth_token = auth_token
        self._headers = {
            "Authorization": f"Bearer {auth_token}",
            "Content-Type": "application/json",
        }
        logger.info("WorkPipeAdapter initialized: %s", self.base_url)

    async def _request(self, method: str, path: str, **kwargs) -> dict:
        import httpx

        url = f"{self.base_url}/api/internal{path}"
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.request(method, url, headers=self._headers, **kwargs)
            if resp.status_code >= 400:
                data = resp.json() if resp.headers.get("content-type", "").startswith("application/json") else {}
                raise CRMAdapterError(
                    f"WorkPipe API error {resp.status_code}: {data.get('error', resp.text)}",
                    status=resp.status_code,
                )
            return resp.json()

    # ── Contacts ───────────────────────────────────────────────────────

    async def get_contacts(self, sub_account_id: str, *, search: str = "", limit: int = 50, offset: int = 0) -> CRMListResult:
        params = {"subAccountId": sub_account_id, "limit": limit, "offset": offset}
        if search:
            params["search"] = search
        data = await self._request("GET", "/contacts", params=params)
        contacts = [CRMContact(id=c["id"], name=c["name"], email=c.get("email"), phone=c.get("phone"), company_name=c.get("companyName")) for c in data.get("contacts", [])]
        return CRMListResult(items=contacts, total=data.get("total", len(contacts)))

    async def create_contact(self, sub_account_id: str, *, name: str, email: str = "", phone: str = "", company_name: str = "") -> CRMContact:
        body = {"subAccountId": sub_account_id, "name": name}
        if email: body["email"] = email
        if phone: body["phone"] = phone
        if company_name: body["companyName"] = company_name
        data = await self._request("POST", "/contacts", json=body)
        c = data["contact"]
        return CRMContact(id=c["id"], name=c["name"], email=c.get("email"), phone=c.get("phone"), company_name=c.get("companyName"))

    async def update_contact(self, contact_id: str, **fields) -> CRMContact:
        data = await self._request("PATCH", f"/contacts/{contact_id}", json=fields)
        c = data["contact"]
        return CRMContact(id=c["id"], name=c["name"], email=c.get("email"), phone=c.get("phone"), company_name=c.get("companyName"))

    # ── Pipelines ──────────────────────────────────────────────────────

    async def get_pipelines(self, sub_account_id: str) -> list[CRMPipeline]:
        data = await self._request("GET", "/pipelines", params={"subAccountId": sub_account_id})
        return [CRMPipeline(id=p["id"], name=p["name"], lanes=p.get("Lane", [])) for p in data.get("pipelines", [])]

    async def get_tickets(self, pipeline_id: str) -> list[CRMTicket]:
        data = await self._request("GET", f"/pipelines/{pipeline_id}/tickets")
        return [
            CRMTicket(
                id=t["id"], name=t["name"], lane_id=t["laneId"],
                value=float(t.get("value", 0)), description=t.get("description"),
                tags=[tag["name"] for tag in t.get("Tags", [])],
            )
            for t in data.get("tickets", [])
        ]

    # ── Tickets ────────────────────────────────────────────────────────

    async def create_ticket(self, lane_id: str, *, name: str, description: str = "", value: float = 0.0, customer_id: str = "", assigned_user_id: str = "", tags: list[str] | None = None) -> CRMTicket:
        body: dict[str, Any] = {"laneId": lane_id, "name": name}
        if description: body["description"] = description
        if value: body["value"] = value
        if customer_id: body["customerId"] = customer_id
        if assigned_user_id: body["assignedUserId"] = assigned_user_id
        if tags: body["tags"] = tags
        data = await self._request("POST", "/tickets", json=body)
        t = data["ticket"]
        return CRMTicket(id=t["id"], name=t["name"], lane_id=t["laneId"], value=float(t.get("value", 0)))

    async def update_ticket(self, ticket_id: str, **fields) -> CRMTicket:
        data = await self._request("PATCH", f"/tickets/{ticket_id}", json=fields)
        t = data["ticket"]
        return CRMTicket(id=t["id"], name=t["name"], lane_id=t["laneId"], value=float(t.get("value", 0)))

    async def move_ticket(self, ticket_id: str, target_lane_id: str) -> CRMTicket:
        return await self.update_ticket(ticket_id, laneId=target_lane_id)

    # ── Stats ──────────────────────────────────────────────────────────

    async def get_stats(self, sub_account_id: str) -> CRMStats:
        data = await self._request("GET", "/stats", params={"subAccountId": sub_account_id})
        return CRMStats(
            contacts_total=data.get("contacts", {}).get("total", 0),
            contacts_recent=data.get("contacts", {}).get("recentCount", 0),
            tickets_total=data.get("tickets", {}).get("total", 0),
            tickets_value=float(data.get("tickets", {}).get("totalValue", 0)),
            tickets_by_lane=data.get("tickets", {}).get("byLane", {}),
            pipelines_count=data.get("pipelines", {}).get("count", 0),
        )


# ── Errors ─────────────────────────────────────────────────────────────────

class CRMAdapterError(Exception):
    def __init__(self, message: str, status: int = 500):
        super().__init__(message)
        self.status = status


# ── Factory ────────────────────────────────────────────────────────────────

def get_crm_adapter(auth_token: str, adapter_type: str = "workpipe") -> CRMAdapter:
    """
    Factory function to get the appropriate CRM adapter.
    
    Args:
        auth_token: Portal JWT for authenticating API calls
        adapter_type: "workpipe" (default) or "ghl" (Phase 3)
    """
    import os

    if adapter_type == "workpipe":
        base_url = os.environ.get("WORKPIPE_API_URL", "https://workpipe.orbit.example")
        return WorkPipeAdapter(base_url=base_url, auth_token=auth_token)
    elif adapter_type == "ghl":
        raise NotImplementedError("GHL adapter planned for Phase 3")
    else:
        raise ValueError(f"Unknown CRM adapter type: {adapter_type}")

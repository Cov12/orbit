"""
Atrium Organization Models

Multi-tenant org structure. Each org gets isolated department data via RLS.
"""

from datetime import datetime
from enum import Enum
from typing import Optional
from pydantic import BaseModel, Field
import uuid


class OrgRole(str, Enum):
    EXECUTIVE = "executive"
    DEPARTMENT_HEAD = "department_head"
    MANAGER = "manager"
    MEMBER = "member"


class Organization(BaseModel):
    """Top-level tenant — one per customer."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    slug: str  # Used for routing: orgslug@in.atrium.yourdomain
    workpipe_account_id: Optional[str] = None  # Link to WorkPipe subscription
    plan: str = "starter"  # starter | growth | enterprise
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    settings: dict = Field(default_factory=dict)


class OrganizationMember(BaseModel):
    """Maps users to orgs with roles."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    org_id: str
    user_id: str  # References OpenWebUI user
    role: OrgRole = OrgRole.MEMBER
    department_ids: list[str] = Field(default_factory=list)  # Which depts they belong to
    created_at: datetime = Field(default_factory=datetime.utcnow)


class OrganizationCreate(BaseModel):
    """Schema for creating a new org."""

    name: str
    slug: str
    workpipe_account_id: Optional[str] = None
    plan: str = "starter"


class OrganizationMemberCreate(BaseModel):
    """Schema for adding a member to an org."""

    user_id: str
    role: OrgRole = OrgRole.MEMBER
    department_ids: list[str] = Field(default_factory=list)

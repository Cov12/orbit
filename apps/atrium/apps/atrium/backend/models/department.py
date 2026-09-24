"""
Atrium Department Models

Each department has its own scoped knowledge base and AI configuration.
Departments cannot access each other's data — enforced at query level.
"""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field
import uuid


class Department(BaseModel):
    """A department within an organization."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    org_id: str
    slug: str  # e.g., "sales_admin", "customer", "back_office"
    name: str
    description: str = ""
    model_tier: str = "mid"  # premium | mid | local
    knowledge_scope: str = ""  # RAG namespace for this dept
    capabilities: list[str] = Field(default_factory=list)
    workpipe_modules: list[str] = Field(default_factory=list)
    system_prompt: str = ""  # Department-specific system prompt
    is_active: bool = True
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DepartmentKnowledge(BaseModel):
    """Knowledge base entry scoped to a department (for RAG)."""

    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    department_id: str
    org_id: str
    title: str
    content: str
    metadata: dict = Field(default_factory=dict)
    embedding: Optional[list[float]] = None  # pgvector
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class DepartmentCreate(BaseModel):
    """Schema for creating a department."""

    slug: str
    name: str
    description: str = ""
    model_tier: str = "mid"
    system_prompt: str = ""

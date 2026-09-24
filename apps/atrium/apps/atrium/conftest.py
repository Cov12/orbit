"""Test infrastructure for Atrium unit tests.

`apps/atrium/backend/middleware/__init__.py` eagerly imports every
middleware module, including `tenant.py`, which transitively pulls in
`open_webui` and its dep tree (markdown, sqlalchemy, alembic, peewee, ...).
Any unit test that imports anything from `middleware` therefore needs the
full backend dep set installed, defeating unit-level scoping.

This conftest installs a stub for the `open_webui.internal.db` surface that
`middleware/tenant.py` and `backend/models/db.py` need at module-load time —
specifically a real (not Mock) `Base = declarative_base()` so SQLAlchemy
classes like `class AtriumProposal(Base):` keep working, plus a JSON
column alias.

With this stub in place the Atrium unit tests run against
`backend/requirements-min.txt` + `pytest pytest-asyncio pyjwt typer httpx`
instead of the full `backend/requirements.txt` (~150 packages).

Long-term: defer the `open_webui.internal.db` import inside `tenant.py`
to function bodies and this stub becomes unnecessary.
"""
from __future__ import annotations

import sys
import types

from sqlalchemy import JSON
from sqlalchemy.orm import declarative_base


# Build real (not Mock) stubs for the bits of open_webui the codebase imports
# at module load time. Using real classes is essential — SQLAlchemy
# `class AtriumProposal(Base):` requires Base to be a proper declarative
# base, not a MagicMock attribute, or type annotations like `Optional[X]`
# fail at class-construction time.
_owui = types.ModuleType("open_webui")
_internal = types.ModuleType("open_webui.internal")
_db = types.ModuleType("open_webui.internal.db")

Base = declarative_base()
def get_session():
    raise RuntimeError("open_webui.internal.db.get_session stubbed for unit tests")
def get_db():
    raise RuntimeError("open_webui.internal.db.get_db stubbed for unit tests")

_db.Base = Base
_db.JSONField = JSON
_db.get_session = get_session
_db.get_db = get_db

_owui.internal = _internal
_internal.db = _db

sys.modules.setdefault("open_webui", _owui)
sys.modules.setdefault("open_webui.internal", _internal)
sys.modules.setdefault("open_webui.internal.db", _db)

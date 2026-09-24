"""ensure_columns() — the durable fix (atrium#66) for the recurring "model adds a Column,
create_all doesn't ALTER, missed migration -> prod 500 (no such column)" trap. A model column
absent from an EXISTING table must be added on mount; present columns/absent tables are no-ops;
re-running is idempotent.
"""

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import StaticPool

from apps.atrium.backend import db_schema
from apps.atrium.backend.models.db import AtriumOrganization


def _engine():
    # One shared in-memory DB across every connection (CREATE, ALTER, inspect).
    return create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
    )


def test_ensure_columns_adds_missing_columns():
    engine = _engine()
    # Simulate an OLD prod schema: the table exists but predates conductor_agent_id / app_access.
    with engine.begin() as c:
        c.execute(
            text("CREATE TABLE atrium_organization (id TEXT PRIMARY KEY, name TEXT, slug TEXT)")
        )

    db_schema.ensure_columns(engine, [AtriumOrganization.__table__])

    cols = {c["name"] for c in inspect(engine).get_columns("atrium_organization")}
    # The two columns that took down prod are now present — no more "no such column" 500.
    assert "conductor_agent_id" in cols
    assert "app_access" in cols
    assert "settings" in cols


def test_ensure_columns_is_idempotent():
    engine = _engine()
    with engine.begin() as c:
        c.execute(text("CREATE TABLE atrium_organization (id TEXT PRIMARY KEY, name TEXT, slug TEXT)"))
    db_schema.ensure_columns(engine, [AtriumOrganization.__table__])
    before = {c["name"] for c in inspect(engine).get_columns("atrium_organization")}
    # Second run must not error and must not change anything.
    db_schema.ensure_columns(engine, [AtriumOrganization.__table__])
    after = {c["name"] for c in inspect(engine).get_columns("atrium_organization")}
    assert before == after


def test_ensure_columns_skips_absent_table():
    engine = _engine()  # table never created
    db_schema.ensure_columns(engine, [AtriumOrganization.__table__])  # must not raise
    assert "atrium_organization" not in set(inspect(engine).get_table_names())


def test_json_server_default_renders_as_quoted_literal():
    # A JSON default like [] must be emitted as a quoted SQLite literal, not bare DDL.
    assert db_schema._default_sql(AtriumOrganization.__table__.c.app_access) == "'[]'"
    assert db_schema._default_sql(AtriumOrganization.__table__.c.settings) == "'{}'"
    # A plain nullable column with no server_default -> no DEFAULT clause.
    assert db_schema._default_sql(AtriumOrganization.__table__.c.conductor_agent_id) is None


def test_added_json_column_carries_its_default():
    engine = _engine()
    with engine.begin() as c:
        c.execute(text("CREATE TABLE atrium_organization (id TEXT PRIMARY KEY, name TEXT, slug TEXT)"))
        c.execute(text("INSERT INTO atrium_organization (id, name, slug) VALUES ('o1','O','o')"))
    db_schema.ensure_columns(engine, [AtriumOrganization.__table__])
    with engine.begin() as c:
        val = c.execute(text("SELECT app_access FROM atrium_organization WHERE id='o1'")).scalar()
    assert val == "[]"  # existing row got the JSON default, not NULL

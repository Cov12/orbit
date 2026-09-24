"""Idempotent schema-ensure for Atrium tables (atrium#66).

`Base.metadata.create_all()` creates missing TABLES but never ALTERs existing ones. So when
a model gains a `Column`, the DB column must be added by a hand-run migration — and a missed
migration makes every query `SELECT ... <newcol>` fail with `no such column`, taking down core
endpoints with a 500 (this bit prod twice: `app_access` and `conductor_agent_id`).

`ensure_columns()` runs right after `create_all()` at mount: it diffs each Atrium table's
model columns against the live schema and `ALTER TABLE ... ADD COLUMN`s any that are missing,
so a model column-add self-applies on deploy. Idempotent (only adds absent columns), scoped to
the Atrium tables passed in (never OWUI's), and best-effort (a failure on one column logs and
continues, never blocking mount). SQLite `ADD COLUMN` supports nullable columns and constant
defaults, which is all the Atrium columns use.
"""

import logging

from sqlalchemy import inspect, text

logger = logging.getLogger("atrium")


def _default_sql(col) -> str | None:
    """Render a column's server_default as a SQLite DEFAULT literal, or None. Only constant
    string defaults (the Atrium JSON '{}' / '[]') are emitted; anything else is skipped so we
    never generate invalid DDL — existing rows then get NULL, which the readers tolerate."""
    sd = getattr(col, "server_default", None)
    if sd is None:
        return None
    arg = getattr(sd, "arg", None)
    raw = getattr(arg, "text", None)  # SQLAlchemy wraps a str server_default in a text() clause
    if not isinstance(raw, str):
        raw = arg if isinstance(arg, str) else None
    if not isinstance(raw, str) or not raw.strip():
        return None
    return "'" + raw.strip().replace("'", "''") + "'"


def ensure_columns(engine, tables) -> None:
    """Add any model columns missing from their (already-existing) DB tables. See module doc."""
    try:
        insp = inspect(engine)
        existing = set(insp.get_table_names())
    except Exception as e:
        logger.warning(f"Atrium ensure-columns: inspect failed, skipping: {e}")
        return

    for table in tables:
        if table.name not in existing:
            continue  # a brand-new table was just fully created by create_all()
        try:
            have = {c["name"] for c in insp.get_columns(table.name)}
        except Exception as e:
            logger.warning(f"Atrium ensure-columns: could not read {table.name}: {e}")
            continue
        for col in table.columns:
            if col.name in have:
                continue
            try:
                coltype = col.type.compile(dialect=engine.dialect)
                ddl = f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {coltype}'
                default_sql = _default_sql(col)
                if default_sql is not None:
                    ddl += f" DEFAULT {default_sql}"
                with engine.begin() as conn:
                    conn.execute(text(ddl))
                logger.info(f"Atrium ensure-columns: added {table.name}.{col.name}")
            except Exception as e:
                logger.warning(
                    f"Atrium ensure-columns: could not add {table.name}.{col.name}: {e}"
                )

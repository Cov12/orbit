-- 005_add_org_app_access.sql
--
-- Adds atrium_organization.app_access — the per-org Portal app entitlement, cached
-- from the Portal JWT at portal-exchange (backend/open_webui/routers/auths.py
-- portal_token_exchange). This is what require_app_access reads on the OWUI-SESSION
-- auth path (apps/atrium/backend/middleware/deps.py, issue #45): a prod request
-- carries an OWUI session token (payload {"id": user.id}) that has NO app_access claim,
-- so the entitlement must live server-side, per org. Mirrors why Conductor persists
-- app_access. NULL / [] means "no apps entitled" (fail-closed).
--
-- ⚠️ Atrium prod runs on SQLite, NOT Postgres — do NOT run this with psql.
--   Atrium is an OpenWebUI fork. With no DATABASE_URL set, OpenWebUI falls back to
--   sqlite:///{DATA_DIR}/webui.db (backend/open_webui/env.py). On Render that file
--   lives on a MOUNTED DISK at /app/backend/data/webui.db, so it persists across deploys.
--   There is no Neon/Postgres database for Atrium.
--
-- SQLite notes: ALTER TABLE ... ADD COLUMN has no IF NOT EXISTS (run it exactly once),
-- and create_all (mount.py) only creates MISSING tables — it never ALTERs — so on an
-- already-provisioned webui.db the column is added by hand. On a FRESH deploy the app
-- creates atrium_organization WITH this column from the model at startup, so this
-- file is only needed for DBs that predate the column.
--
-- Apply from the Atrium service shell. Neither psql nor the sqlite3 CLI is installed in
-- the container; python3 is (the app runs on it):
--
--   # back up first (a SQLite backup is just a file copy)
--   cp /app/backend/data/webui.db /app/backend/data/webui.db.bak
--
--   # add the column (default [] so existing rows read as "no apps" until a re-login
--   # through portal-exchange caches the real entitlement)
--   python3 -c "import sqlite3; c=sqlite3.connect('/app/backend/data/webui.db'); \
--     c.execute(\"ALTER TABLE atrium_organization ADD COLUMN app_access JSON DEFAULT '[]'\"); \
--     c.commit(); \
--     print(c.execute('SELECT id, slug, app_access FROM atrium_organization').fetchall())"
--
-- The equivalent SQL (SQLite dialect) is below, if a sqlite3 client is available:
--   sqlite3 /app/backend/data/webui.db < 005_add_org_app_access.sql

ALTER TABLE atrium_organization ADD COLUMN app_access JSON DEFAULT '[]';

-- No backfill needed: app_access repopulates lazily on each user's next Portal login
-- (portal-exchange caches payload.app_access onto their org). An empty column simply
-- means require_app_access denies CONDUCTOR/WORKPIPE-gated routes for that org until the
-- first re-login — fail-closed by design.

-- Verify (expect every row to carry app_access, defaulting to '[]'):
--   SELECT id, slug, app_access FROM atrium_organization;

-- Rollback (SQLite 3.35+ supports DROP COLUMN; older requires a table rebuild):
--   ALTER TABLE atrium_organization DROP COLUMN app_access;

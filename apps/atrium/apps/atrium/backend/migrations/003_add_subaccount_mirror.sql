-- 003_add_subaccount_mirror.sql
--
-- Adds atrium_subaccount — a local mirror of each org's Portal sub-accounts
-- (issue #27 / A1). Portal is the source of truth; Atrium PULLs the roster over
-- HTTP (services/subaccount_sync.py -> Portal GET /api/subaccounts) and mirrors it
-- here, keyed by Portal's SubAccount.id (a CUID) stored VERBATIM — so Atrium keys
-- the SAME sub-account identity as WorkPipe/Drive/Portal.
--
-- ⚠️ Atrium prod runs on SQLite, NOT Postgres — do NOT run this with psql.
--   Atrium is an OpenWebUI fork. With no DATABASE_URL set, OpenWebUI falls back to
--   sqlite:///{DATA_DIR}/webui.db (backend/open_webui/env.py:283). On Render that file
--   lives on a MOUNTED DISK at /app/backend/data/webui.db, so it persists across deploys.
--   There is no Neon/Postgres database for Atrium.
--
-- SQLite notes: create_all (mount.py) creates MISSING tables automatically, so on a
--   fresh deploy this whole table is created for you by the app at startup — this file
--   is the explicit record + the manual path if you are adding it to an already-running
--   webui.db that predates the model. CREATE TABLE IF NOT EXISTS is safe to run once.
--
-- Apply from the Atrium service shell. Neither psql nor the sqlite3 CLI is installed in
-- the container; python3 is (the app runs on it):
--
--   # back up first (a SQLite backup is just a file copy)
--   cp /app/backend/data/webui.db /app/backend/data/webui.db.bak
--
--   # create the table + indexes
--   python3 - <<'PY'
--   import sqlite3
--   c = sqlite3.connect('/app/backend/data/webui.db')
--   c.executescript('''
--   CREATE TABLE IF NOT EXISTS atrium_subaccount (
--       id            VARCHAR PRIMARY KEY,
--       org_id        VARCHAR NOT NULL REFERENCES atrium_organization(id),
--       portal_org_id VARCHAR,
--       name          VARCHAR,
--       slug          VARCHAR,
--       status        VARCHAR,
--       created_at    BIGINT,
--       updated_at    BIGINT,
--       synced_at     BIGINT
--   );
--   CREATE INDEX IF NOT EXISTS atrium_subaccount_org_idx ON atrium_subaccount(org_id);
--   CREATE INDEX IF NOT EXISTS atrium_subaccount_portal_org_idx ON atrium_subaccount(portal_org_id);
--   ''')
--   c.commit()
--   print(c.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='atrium_subaccount'").fetchall())
--   PY
--
-- No backfill: the table populates lazily on the next Portal-authed request per org
-- (middleware/tenant.py get_tenant_session -> subaccount_sync.maybe_sync). An empty
-- table simply means Atrium operates at business scope until the first sync.
--
-- The equivalent SQL (SQLite dialect) is below, if a sqlite3 client is available:
--   sqlite3 /app/backend/data/webui.db < 003_add_subaccount_mirror.sql

CREATE TABLE IF NOT EXISTS atrium_subaccount (
    id            VARCHAR PRIMARY KEY,   -- Portal SubAccount.id (CUID), verbatim
    org_id        VARCHAR NOT NULL REFERENCES atrium_organization(id),
    portal_org_id VARCHAR,
    name          VARCHAR,
    slug          VARCHAR,
    status        VARCHAR,
    created_at    BIGINT,
    updated_at    BIGINT,
    synced_at     BIGINT
);

CREATE INDEX IF NOT EXISTS atrium_subaccount_org_idx ON atrium_subaccount(org_id);
CREATE INDEX IF NOT EXISTS atrium_subaccount_portal_org_idx ON atrium_subaccount(portal_org_id);

-- Verify (expect the table + two indexes to exist):
--   SELECT name FROM sqlite_master WHERE name LIKE 'atrium_subaccount%';

-- Rollback:
--   DROP TABLE IF EXISTS atrium_subaccount;

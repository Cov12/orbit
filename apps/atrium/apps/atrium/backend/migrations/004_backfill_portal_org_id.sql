-- 004_backfill_portal_org_id.sql
--
-- One-time backfill of atrium_organization.portal_org_id for LEGIT legacy orgs whose
-- value is still NULL, closing issue #43 (security / defense-in-depth).
--
-- WHY THIS EXISTS
--   #43 removed the request-path auto-stamp (middleware/tenant.py get_tenant_session no
--   longer calls OrganizationsService.stamp_portal_org_id). That auto-stamp was a trust-
--   on-first-use hole: the FIRST Portal caller to reference an unstamped org claimed it.
--   Ownership is now set ONLY at provisioning (services/organizations.create_org, #71
--   Approach A). Consequence: a legacy org left with portal_org_id NULL now fails closed
--   at require_org_access (#41 → 403) instead of being claimed on a read. This script
--   backfills those legit legacy rows FROM A TRUSTED SOURCE so their real owners regain
--   access — it never infers ownership from a live request.
--
-- ⚠️ Atrium prod runs on SQLite, NOT Postgres — do NOT run this with psql.
--   Atrium is an OpenWebUI fork. With no DATABASE_URL set, OpenWebUI falls back to
--   sqlite:///{DATA_DIR}/webui.db (backend/open_webui/env.py:283). On Render that file
--   lives on a MOUNTED DISK at /app/backend/data/webui.db, so it persists across deploys.
--   There is no Neon/Postgres database for Atrium.
--
-- ⚠️ PROD IS SINGLE-TENANT. Per migration 002, Atrium prod has exactly ONE org row —
--   the OpenWebUI default org (slug 'default'), already backfilled to Orbit's Portal CUID
--   'cdemoorg00000000000000001' by 002. If 002 has been applied, there is NOTHING to do
--   here in prod — Step 0 below simply re-asserts it idempotently. This file matters for
--   any environment that has since acquired additional NULL org rows.
--
-- ─────────────────────────────────────────────────────────────────────────────────────
-- THE HARD PART: recovering each legacy org's Portal CUID
-- ─────────────────────────────────────────────────────────────────────────────────────
-- portal_org_id is a Portal org CUID. It is NOT derivable from atrium_organization
-- alone (workpipe_account_id is a WorkPipe id, not a Portal CUID; slug/name are not the
-- CUID). There is exactly ONE trusted in-Atrium source of the (org -> CUID) mapping:
--
--   atrium_subaccount.portal_org_id — every mirrored sub-account row stores its owning
--   org's Portal CUID alongside org_id (models/db.py:352, migration 003). These rows were
--   written by the Portal-authed sub-account sync (services/subaccount_sync.py) using the
--   caller's own validated JWT, so the CUID they carry is trustworthy for that org_id.
--
-- Recoverability is therefore PARTIAL and must be handled per-org:
--   (A) org has ≥1 sub-account row, all agreeing on ONE portal_org_id  -> backfill (safe).
--   (B) org has sub-account rows with >1 DISTINCT portal_org_id        -> AMBIGUOUS: STOP.
--   (C) org has NO sub-account rows                                    -> UNRESOLVED: STOP.
--
-- For (B)/(C) the CUID is NOT mechanically determinable from Atrium data. Do NOT guess
-- — an incorrect CUID would hand the org to the wrong Portal tenant. Resolve those out of
-- band (Portal admin: look up the org's owning Portal org CUID) and stamp explicitly, or
-- leave NULL (the row stays fail-closed / inaccessible, which is the safe default).
--
-- ─────────────────────────────────────────────────────────────────────────────────────
-- RUNBOOK (run from the Atrium service shell; only python3 is available in-container)
-- ─────────────────────────────────────────────────────────────────────────────────────
--
--   # back up first (a SQLite backup is just a file copy)
--   cp /app/backend/data/webui.db /app/backend/data/webui.db.bak
--
--   python3 - <<'PY'
--   import sqlite3
--   DB = "/app/backend/data/webui.db"
--   ORBIT_CUID = "cdemoorg00000000000000001"
--   c = sqlite3.connect(DB)
--
--   # Step 0 — re-assert the default org's CUID (idempotent with migration 002).
--   c.execute(
--       "UPDATE atrium_organization SET portal_org_id=? "
--       "WHERE slug='default' AND portal_org_id IS NULL",
--       (ORBIT_CUID,),
--   )
--
--   # Step 1 — classify every remaining NULL, non-default org by its sub-account mirror.
--   nulls = c.execute(
--       "SELECT id, slug FROM atrium_organization "
--       "WHERE portal_org_id IS NULL AND slug != 'default'"
--   ).fetchall()
--
--   backfilled, ambiguous, unresolved = [], [], []
--   for org_id, slug in nulls:
--       cuids = [r[0] for r in c.execute(
--           "SELECT DISTINCT portal_org_id FROM atrium_subaccount "
--           "WHERE org_id=? AND portal_org_id IS NOT NULL", (org_id,)
--       ).fetchall()]
--       if len(cuids) == 1:
--           # (A) unambiguous, trusted mapping -> backfill
--           c.execute(
--               "UPDATE atrium_organization SET portal_org_id=? "
--               "WHERE id=? AND portal_org_id IS NULL",
--               (cuids[0], org_id),
--           )
--           backfilled.append((org_id, slug, cuids[0]))
--       elif len(cuids) > 1:
--           ambiguous.append((org_id, slug, cuids))   # (B) STOP — needs a decision
--       else:
--           unresolved.append((org_id, slug))         # (C) STOP — needs a Portal lookup
--
--   c.commit()
--   print("BACKFILLED:", backfilled)
--   print("AMBIGUOUS  (leave NULL, resolve via Portal admin):", ambiguous)
--   print("UNRESOLVED (leave NULL, resolve via Portal admin):", unresolved)
--   print("VERIFY:", c.execute(
--       "SELECT id, slug, portal_org_id FROM atrium_organization").fetchall())
--   PY
--
-- Any org printed under AMBIGUOUS / UNRESOLVED is a STOP condition: it stays NULL (fail-
-- closed, inaccessible to Portal callers) until its true owning Portal CUID is confirmed
-- out of band and stamped explicitly, e.g.:
--
--   python3 -c "import sqlite3; c=sqlite3.connect('/app/backend/data/webui.db'); \
--     c.execute('UPDATE atrium_organization SET portal_org_id=? \
--       WHERE id=? AND portal_org_id IS NULL', ('<confirmed_cuid>','<org_id>')); \
--     c.commit()"
--
-- ─────────────────────────────────────────────────────────────────────────────────────
-- Equivalent SQL (SQLite dialect), if a sqlite3 client is available. Covers Step 0 and
-- case (A) only; (B)/(C) cannot be expressed as a safe automatic UPDATE and are left NULL
-- by design (see the runbook above to resolve them).
-- ─────────────────────────────────────────────────────────────────────────────────────

-- Step 0: re-assert the Orbit default org (idempotent with 002).
UPDATE atrium_organization
    SET portal_org_id = 'cdemoorg00000000000000001'
    WHERE slug = 'default'
      AND portal_org_id IS NULL;

-- Case (A): backfill NULL, non-default orgs whose sub-account mirror agrees on exactly
-- ONE Portal CUID. The GROUP BY ... HAVING COUNT(DISTINCT ...) = 1 guard makes ambiguous
-- (case B) orgs skip themselves; orgs with no sub-accounts (case C) are absent from the
-- subquery entirely, so they are never touched.
UPDATE atrium_organization
    SET portal_org_id = (
        SELECT sa.portal_org_id
        FROM atrium_subaccount sa
        WHERE sa.org_id = atrium_organization.id
          AND sa.portal_org_id IS NOT NULL
        GROUP BY sa.org_id
        HAVING COUNT(DISTINCT sa.portal_org_id) = 1
    )
    WHERE portal_org_id IS NULL
      AND slug != 'default'
      AND id IN (
          SELECT sa.org_id
          FROM atrium_subaccount sa
          WHERE sa.portal_org_id IS NOT NULL
          GROUP BY sa.org_id
          HAVING COUNT(DISTINCT sa.portal_org_id) = 1
      );

-- Verify (NULL rows remaining are the STOP conditions — leave them fail-closed):
--   SELECT id, slug, portal_org_id FROM atrium_organization ORDER BY portal_org_id;
--
-- Rollback: this only POPULATES NULLs; to revert a specific row set it back to NULL:
--   UPDATE atrium_organization SET portal_org_id = NULL WHERE id = '<org_id>';

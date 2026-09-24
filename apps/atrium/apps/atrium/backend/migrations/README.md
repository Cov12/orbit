# Atrium RLS Migration

This directory contains SQL migrations for Atrium database security.

## Apply migration

From this directory:

```bash
psql -f 001_rls_policies.sql
```

Or provide your connection details explicitly:

```bash
psql "$DATABASE_URL" -f apps/atrium/backend/migrations/001_rls_policies.sql
```

## Verify policies

Check that policies were created:

```sql
SELECT *
FROM pg_policies
WHERE tablename LIKE 'atrium_%';
```

## Test tenant isolation

In a SQL session, set a tenant context and query tables:

```sql
BEGIN;
SET LOCAL app.current_org_id = 'your-org-id';
SELECT * FROM atrium_organization;
SELECT * FROM atrium_member;
COMMIT;
```

Expected behavior:
- When `app.current_org_id` is set, only rows for that org are visible.
- When `app.current_org_id` is empty or unset, all rows are visible (admin/migration mode).

## Rollback

A rollback section is included at the bottom of `001_rls_policies.sql`.

To rollback:
1. Open `001_rls_policies.sql`
2. Uncomment the `ROLLBACK` section
3. Run the script again

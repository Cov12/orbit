-- Atrium Multi-tenant Row Level Security (RLS)
-- Uses session variable: app.current_org_id
-- If app.current_org_id is empty or unset, policy allows full access (admin/migrations).
-- If app.current_org_id is set, rows are restricted to that tenant.

-- Enable RLS on all Atrium tables
ALTER TABLE atrium_organization ENABLE ROW LEVEL SECURITY;
ALTER TABLE atrium_member ENABLE ROW LEVEL SECURITY;
ALTER TABLE atrium_department ENABLE ROW LEVEL SECURITY;
ALTER TABLE atrium_knowledge ENABLE ROW LEVEL SECURITY;
ALTER TABLE atrium_proposal ENABLE ROW LEVEL SECURITY;
ALTER TABLE atrium_audit_log ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners
ALTER TABLE atrium_organization FORCE ROW LEVEL SECURITY;
ALTER TABLE atrium_member FORCE ROW LEVEL SECURITY;
ALTER TABLE atrium_department FORCE ROW LEVEL SECURITY;
ALTER TABLE atrium_knowledge FORCE ROW LEVEL SECURITY;
ALTER TABLE atrium_proposal FORCE ROW LEVEL SECURITY;
ALTER TABLE atrium_audit_log FORCE ROW LEVEL SECURITY;

-- Drop any previous policies before creating (idempotent reruns)
DROP POLICY IF EXISTS org_tenant_policy ON atrium_organization;
DROP POLICY IF EXISTS member_tenant_policy ON atrium_member;
DROP POLICY IF EXISTS department_tenant_policy ON atrium_department;
DROP POLICY IF EXISTS knowledge_tenant_policy ON atrium_knowledge;
DROP POLICY IF EXISTS proposal_tenant_policy ON atrium_proposal;
DROP POLICY IF EXISTS audit_tenant_policy ON atrium_audit_log;

-- Organization: restrict by organization id
CREATE POLICY org_tenant_policy ON atrium_organization
    FOR ALL
    USING (
        current_setting('app.current_org_id', true) = ''
        OR current_setting('app.current_org_id', true) IS NULL
        OR id = current_setting('app.current_org_id', true)
    );

-- All other tables: restrict by org_id
CREATE POLICY member_tenant_policy ON atrium_member
    FOR ALL
    USING (
        current_setting('app.current_org_id', true) = ''
        OR current_setting('app.current_org_id', true) IS NULL
        OR org_id = current_setting('app.current_org_id', true)
    );

CREATE POLICY department_tenant_policy ON atrium_department
    FOR ALL
    USING (
        current_setting('app.current_org_id', true) = ''
        OR current_setting('app.current_org_id', true) IS NULL
        OR org_id = current_setting('app.current_org_id', true)
    );

CREATE POLICY knowledge_tenant_policy ON atrium_knowledge
    FOR ALL
    USING (
        current_setting('app.current_org_id', true) = ''
        OR current_setting('app.current_org_id', true) IS NULL
        OR org_id = current_setting('app.current_org_id', true)
    );

CREATE POLICY proposal_tenant_policy ON atrium_proposal
    FOR ALL
    USING (
        current_setting('app.current_org_id', true) = ''
        OR current_setting('app.current_org_id', true) IS NULL
        OR org_id = current_setting('app.current_org_id', true)
    );

CREATE POLICY audit_tenant_policy ON atrium_audit_log
    FOR ALL
    USING (
        current_setting('app.current_org_id', true) = ''
        OR current_setting('app.current_org_id', true) IS NULL
        OR org_id = current_setting('app.current_org_id', true)
    );

-- ROLLBACK (uncomment to remove RLS)
-- DROP POLICY org_tenant_policy ON atrium_organization;
-- DROP POLICY member_tenant_policy ON atrium_member;
-- DROP POLICY department_tenant_policy ON atrium_department;
-- DROP POLICY knowledge_tenant_policy ON atrium_knowledge;
-- DROP POLICY proposal_tenant_policy ON atrium_proposal;
-- DROP POLICY audit_tenant_policy ON atrium_audit_log;
--
-- ALTER TABLE atrium_organization DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE atrium_member DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE atrium_department DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE atrium_knowledge DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE atrium_proposal DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE atrium_audit_log DISABLE ROW LEVEL SECURITY;

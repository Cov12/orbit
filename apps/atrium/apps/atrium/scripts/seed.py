"""
Atrium Seed Script — Populate local dev database with test data.

Usage:
    cd /path/to/atrium
    python -m apps.atrium.scripts.seed

Or directly:
    python apps/atrium/scripts/seed.py

Requires: OpenWebUI's DB to be running and tables created.
Set DATABASE_URL env var if not using default.
"""

import sys
import os
import time
import uuid

# Add project root to path so imports work
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../..")))

from open_webui.internal.db import get_db
from apps.atrium.backend.models.db import (
    AtriumOrganization,
    AtriumMember,
    AtriumDepartment,
    AtriumKnowledge,
    AtriumProposal,
    AtriumAuditLog,
)


def now_ms() -> int:
    return int(time.time() * 1000)


def uid() -> str:
    return str(uuid.uuid4())


# ──────────────────────────────────────────────
# IDs (fixed so they're predictable for testing)
# ──────────────────────────────────────────────
ORG_ID = "seed-org-001"
DEPT_SALES_ID = "seed-dept-sales"
DEPT_CUSTOMER_ID = "seed-dept-customer"
DEPT_BACKOFFICE_ID = "seed-dept-backoffice"
MEMBER_EXEC_ID = "seed-member-exec"
MEMBER_HEAD_SALES_ID = "seed-member-head-sales"
MEMBER_HEAD_CUSTOMER_ID = "seed-member-head-customer"
MEMBER_HEAD_BACKOFFICE_ID = "seed-member-head-backoffice"

# Use a placeholder user_id — replace with a real OpenWebUI user ID if you have one
EXEC_USER_ID = "test-user-exec"
SALES_USER_ID = "test-user-sales"
CUSTOMER_USER_ID = "test-user-customer"
BACKOFFICE_USER_ID = "test-user-backoffice"


def seed_organization(session):
    """Create the demo organization."""
    org = AtriumOrganization(
        id=ORG_ID,
        name="Acme Corp (Test Org)",
        slug="acme-test",
        workpipe_account_id=None,
        plan="growth",
        settings={
            "delegated_mode": True,
            "auto_approve_low_risk": False,
            "chief_model": "anthropic/claude-opus-4-6",
        },
        created_at=now_ms(),
        updated_at=now_ms(),
    )
    session.merge(org)
    print(f"  ✅ Organization: {org.name} ({org.slug})")
    return org


def seed_members(session):
    """Create org members with different roles."""
    members = [
        AtriumMember(
            id=MEMBER_EXEC_ID,
            org_id=ORG_ID,
            user_id=EXEC_USER_ID,
            role="executive",
            department_ids=[DEPT_SALES_ID, DEPT_CUSTOMER_ID, DEPT_BACKOFFICE_ID],
            created_at=now_ms(),
        ),
        AtriumMember(
            id=MEMBER_HEAD_SALES_ID,
            org_id=ORG_ID,
            user_id=SALES_USER_ID,
            role="department_head",
            department_ids=[DEPT_SALES_ID],
            created_at=now_ms(),
        ),
        AtriumMember(
            id=MEMBER_HEAD_CUSTOMER_ID,
            org_id=ORG_ID,
            user_id=CUSTOMER_USER_ID,
            role="department_head",
            department_ids=[DEPT_CUSTOMER_ID],
            created_at=now_ms(),
        ),
        AtriumMember(
            id=MEMBER_HEAD_BACKOFFICE_ID,
            org_id=ORG_ID,
            user_id=BACKOFFICE_USER_ID,
            role="department_head",
            department_ids=[DEPT_BACKOFFICE_ID],
            created_at=now_ms(),
        ),
    ]
    for m in members:
        session.merge(m)
        print(f"  ✅ Member: {m.role} → user {m.user_id}")


def seed_departments(session):
    """Create the 3 MVP departments."""
    departments = [
        AtriumDepartment(
            id=DEPT_SALES_ID,
            org_id=ORG_ID,
            slug="sales_admin",
            name="Sales & Admin",
            description="Handles lead management, proposals, invoicing, and pipeline operations.",
            model_tier="mid",
            knowledge_scope="sales_admin",
            capabilities=["crm_access", "send_email", "create_proposal", "manage_pipeline", "generate_invoice"],
            workpipe_modules=["pipelines", "contacts", "invoices"],
            system_prompt=(
                "You are the Sales & Admin Department Head for {org_name}. "
                "You manage the sales pipeline, handle lead qualification, draft proposals, "
                "and coordinate invoicing. You have access to CRM data via WorkPipe. "
                "Always propose actions through Delegated Mode — never execute directly. "
                "Be concise, professional, and data-driven."
            ),
            is_active=True,
            created_at=now_ms(),
            updated_at=now_ms(),
        ),
        AtriumDepartment(
            id=DEPT_CUSTOMER_ID,
            org_id=ORG_ID,
            slug="customer",
            name="Customer Success",
            description="Handles customer support, onboarding, and relationship management.",
            model_tier="mid",
            knowledge_scope="customer",
            capabilities=["crm_access", "send_email", "create_task", "view_tickets", "update_contact"],
            workpipe_modules=["contacts", "tickets"],
            system_prompt=(
                "You are the Customer Success Department Head for {org_name}. "
                "You handle customer onboarding, support requests, and relationship management. "
                "You proactively identify at-risk accounts and suggest retention actions. "
                "Always propose actions through Delegated Mode — never execute directly. "
                "Be empathetic, solution-oriented, and thorough."
            ),
            is_active=True,
            created_at=now_ms(),
            updated_at=now_ms(),
        ),
        AtriumDepartment(
            id=DEPT_BACKOFFICE_ID,
            org_id=ORG_ID,
            slug="back_office",
            name="Back Office",
            description="Handles finance, HR, operations, and internal admin tasks.",
            model_tier="local",
            knowledge_scope="back_office",
            capabilities=["generate_report", "manage_schedule", "track_expenses", "create_task"],
            workpipe_modules=[],
            system_prompt=(
                "You are the Back Office Department Head for {org_name}. "
                "You handle finance tracking, HR coordination, scheduling, and operational tasks. "
                "You keep things organized and flag anything that needs executive attention. "
                "Always propose actions through Delegated Mode — never execute directly. "
                "Be organized, detail-oriented, and proactive."
            ),
            is_active=True,
            created_at=now_ms(),
            updated_at=now_ms(),
        ),
    ]
    for d in departments:
        session.merge(d)
        print(f"  ✅ Department: {d.name} ({d.slug}) — tier: {d.model_tier}")


def seed_knowledge(session):
    """Seed sample knowledge entries for each department."""
    entries = [
        # Sales & Admin knowledge
        AtriumKnowledge(
            id=uid(),
            department_id=DEPT_SALES_ID,
            org_id=ORG_ID,
            title="Sales Process Overview",
            content=(
                "Our sales process has 5 stages:\n"
                "1. Lead Capture — inbound form or manual entry\n"
                "2. Qualification — budget, timeline, fit assessment\n"
                "3. Proposal — custom scope + pricing sent within 48h\n"
                "4. Negotiation — up to 2 revision rounds\n"
                "5. Close — contract signed, onboarding triggered\n\n"
                "Average deal cycle: 14-21 days. Target close rate: 35%."
            ),
            metadata_={"type": "process", "priority": "high"},
            created_at=now_ms(),
            updated_at=now_ms(),
        ),
        AtriumKnowledge(
            id=uid(),
            department_id=DEPT_SALES_ID,
            org_id=ORG_ID,
            title="Pricing Guide",
            content=(
                "Standard pricing tiers:\n"
                "- Starter: $—/mo — basic CRM + 1 pipeline\n"
                "- Growth: $—/mo — full CRM + automations + 3 pipelines\n"
                "- Enterprise: $—/mo — everything + custom integrations + dedicated support\n\n"
                "Custom quotes available for enterprise deals. Minimum contract: 3 months."
            ),
            metadata_={"type": "pricing", "priority": "high"},
            created_at=now_ms(),
            updated_at=now_ms(),
        ),
        # Customer Success knowledge
        AtriumKnowledge(
            id=uid(),
            department_id=DEPT_CUSTOMER_ID,
            org_id=ORG_ID,
            title="Onboarding Checklist",
            content=(
                "New customer onboarding steps:\n"
                "1. Welcome email (within 1h of contract signing)\n"
                "2. Account setup — create workspace, add users\n"
                "3. Kickoff call — 30min, cover goals + timeline\n"
                "4. Data migration — import contacts, pipelines\n"
                "5. Training session — 1h walkthrough of key features\n"
                "6. 7-day check-in — ensure adoption, address issues\n"
                "7. 30-day review — measure against initial goals"
            ),
            metadata_={"type": "process", "priority": "high"},
            created_at=now_ms(),
            updated_at=now_ms(),
        ),
        AtriumKnowledge(
            id=uid(),
            department_id=DEPT_CUSTOMER_ID,
            org_id=ORG_ID,
            title="Escalation Policy",
            content=(
                "Support escalation tiers:\n"
                "- Tier 1: AI handles (FAQ, status checks) — <5min response\n"
                "- Tier 2: Department head reviews — <2h response\n"
                "- Tier 3: Executive escalation — <4h response, critical issues only\n\n"
                "Triggers for auto-escalation: customer mentions 'cancel', "
                "NPS score <6, no response in >24h, billing disputes."
            ),
            metadata_={"type": "policy", "priority": "medium"},
            created_at=now_ms(),
            updated_at=now_ms(),
        ),
        # Back Office knowledge
        AtriumKnowledge(
            id=uid(),
            department_id=DEPT_BACKOFFICE_ID,
            org_id=ORG_ID,
            title="Expense Categories",
            content=(
                "Approved expense categories:\n"
                "- Software & SaaS: hosting, APIs, tools\n"
                "- Marketing: ads, content, design\n"
                "- Operations: office, supplies, travel\n"
                "- Personnel: salaries, contractors, benefits\n"
                "- Professional: legal, accounting, insurance\n\n"
                "All expenses >$500 require executive approval before commitment."
            ),
            metadata_={"type": "policy", "priority": "medium"},
            created_at=now_ms(),
            updated_at=now_ms(),
        ),
    ]
    for k in entries:
        session.merge(k)
        print(f"  ✅ Knowledge: [{k.department_id.split('-')[-1]}] {k.title}")


def seed_proposals(session):
    """Create sample action proposals in various states."""
    proposals = [
        AtriumProposal(
            id="seed-proposal-pending",
            org_id=ORG_ID,
            department_id=DEPT_SALES_ID,
            chat_id="test-chat-001",
            title="Send follow-up email to Jane Doe",
            description=(
                "Jane Doe (jane@example.com) submitted a contact form 2 days ago "
                "expressing interest in the Growth plan. No response yet. "
                "Recommend sending a personalized follow-up with a meeting link."
            ),
            action_type="send_email",
            action_payload={
                "to": "jane@example.com",
                "subject": "Following up on your interest in Acme Growth Plan",
                "body": "Hi Jane, thanks for reaching out! I'd love to walk you through...",
                "include_calendar_link": True,
            },
            risk_level="low",
            risk_reasoning="Standard follow-up email, no sensitive data.",
            status="pending",
            created_by_ai="sales_admin_head",
            created_at=now_ms(),
            updated_at=now_ms(),
        ),
        AtriumProposal(
            id="seed-proposal-approved",
            org_id=ORG_ID,
            department_id=DEPT_CUSTOMER_ID,
            chat_id="test-chat-002",
            title="Schedule onboarding call for Bob's Bakery",
            description="New customer Bob's Bakery signed up on Growth plan. Need to schedule kickoff call.",
            action_type="create_task",
            action_payload={
                "task": "Schedule 30-min onboarding kickoff call",
                "contact": "bob@bobsbakery.com",
                "due_within_hours": 24,
            },
            risk_level="low",
            risk_reasoning="Routine onboarding step.",
            status="approved",
            created_by_ai="customer_head",
            reviewed_by=EXEC_USER_ID,
            review_note="Go ahead, priority customer.",
            created_at=now_ms() - 86400000,  # yesterday
            updated_at=now_ms(),
        ),
        AtriumProposal(
            id="seed-proposal-high-risk",
            org_id=ORG_ID,
            department_id=DEPT_BACKOFFICE_ID,
            title="Process refund for Widget Co — $1,200",
            description=(
                "Widget Co requested a full refund citing unsatisfactory service. "
                "They've been a customer for 2 months on the Growth plan ($—/mo + overage). "
                "Recommend processing to maintain reputation."
            ),
            action_type="process_refund",
            action_payload={
                "contact": "finance@widgetco.com",
                "amount": 1200.00,
                "reason": "Customer dissatisfaction",
                "stripe_payment_id": "pi_test_123456",
            },
            risk_level="high",
            risk_reasoning="Financial action over $1,000. Requires executive review.",
            status="pending",
            created_by_ai="back_office_head",
            created_at=now_ms(),
            updated_at=now_ms(),
        ),
    ]
    for p in proposals:
        session.merge(p)
        print(f"  ✅ Proposal: [{p.status}] {p.title}")


def seed_audit_log(session):
    """Create sample audit log entries."""
    logs = [
        AtriumAuditLog(
            id=uid(),
            org_id=ORG_ID,
            event_type="org_created",
            actor_id=EXEC_USER_ID,
            actor_type="user",
            details={"org_name": "Acme Corp (Test Org)", "plan": "growth"},
            created_at=now_ms() - 604800000,  # 7 days ago
        ),
        AtriumAuditLog(
            id=uid(),
            org_id=ORG_ID,
            event_type="proposal_created",
            actor_id="sales_admin_head",
            actor_type="ai",
            department_id=DEPT_SALES_ID,
            proposal_id="seed-proposal-pending",
            details={"title": "Send follow-up email to Jane Doe", "risk": "low"},
            created_at=now_ms(),
        ),
        AtriumAuditLog(
            id=uid(),
            org_id=ORG_ID,
            event_type="proposal_approved",
            actor_id=EXEC_USER_ID,
            actor_type="user",
            department_id=DEPT_CUSTOMER_ID,
            proposal_id="seed-proposal-approved",
            details={"title": "Schedule onboarding call for Bob's Bakery", "note": "Go ahead, priority customer."},
            created_at=now_ms() - 43200000,  # 12h ago
        ),
    ]
    for log_entry in logs:
        session.merge(log_entry)
        print(f"  ✅ Audit: {log_entry.event_type}")


def run_seed():
    print("\n🌱 Atrium Seed Script")
    print("=" * 50)

    db = next(get_db())
    try:
        print("\n📦 Organization...")
        seed_organization(db)

        print("\n👥 Members...")
        seed_members(db)

        print("\n🏢 Departments (MVP)...")
        seed_departments(db)

        print("\n📚 Knowledge Base...")
        seed_knowledge(db)

        print("\n📋 Action Proposals...")
        seed_proposals(db)

        print("\n📝 Audit Log...")
        seed_audit_log(db)

        db.commit()
        print("\n" + "=" * 50)
        print("✅ Seed complete! All test data populated.")
        print(f"\n📌 Test org: slug='acme-test', id='{ORG_ID}'")
        print(f"   Departments: sales_admin, customer, back_office")
        print(f"   Knowledge entries: 5")
        print(f"   Proposals: 3 (1 pending, 1 approved, 1 high-risk pending)")
        print(f"   Members: 4 (1 exec, 3 dept heads)")
        print(f"\n💡 User IDs are placeholders ({EXEC_USER_ID}, etc.)")
        print("   Replace with real OpenWebUI user IDs for full integration testing.\n")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Seed failed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()

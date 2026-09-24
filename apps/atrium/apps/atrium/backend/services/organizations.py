"""
Atrium Organization CRUD Service
"""

import time
import logging
from typing import Optional

from sqlalchemy.orm import Session

from ..models.db import (
    AtriumOrganization,
    AtriumMember,
    AtriumDepartment,
    generate_id,
    now_ms,
)

log = logging.getLogger("atrium.services.organizations")


class OrganizationsService:
    """CRUD operations for organizations and members."""

    @staticmethod
    def create_org(
        db: Session,
        name: str,
        slug: str,
        workpipe_account_id: Optional[str] = None,
        plan: str = "starter",
        portal_org_id: Optional[str] = None,
    ) -> AtriumOrganization:
        # #66 Stage 2 (Approach A): when this org is provisioned from a Portal-authed
        # request, portal_org_id carries the Portal org CUID so the bridge later derives
        # this org's OWN per-org Conductor company (conductor_bridge._resolve_company_id).
        # Left NULL when unknown -> the bridge falls back to the ORBIT_COMPANY_ID pin.
        org = AtriumOrganization(
            id=generate_id(),
            name=name,
            slug=slug,
            portal_org_id=portal_org_id or None,
            workpipe_account_id=workpipe_account_id,
            plan=plan,
            created_at=now_ms(),
            updated_at=now_ms(),
        )
        db.add(org)
        db.commit()
        db.refresh(org)
        log.info(f"Created org: {org.name} ({org.slug})")
        return org

    @staticmethod
    def stamp_portal_org_id(
        db: Session, internal_org_id: str, portal_org_id: str
    ) -> bool:
        """#66 Stage 2 (Approach B): idempotent backfill of portal_org_id for org rows
        that predate Stage-2 provisioning.

        Stamps the Portal org CUID onto the row whose Atrium-INTERNAL id ==
        internal_org_id, but ONLY when:
          - the row exists,
          - its portal_org_id is currently NULL (never overwrite -> idempotent), and
          - it is not the Orbit-pinned 'default' org (left untouched by design; it is
            backfilled by migration 002 and pinned to …c0de via PORTAL_COMPANY_OVERRIDES).

        Returns True iff a row was stamped.

        #43 (security): this must NOT run implicitly on a data-serving read — doing so
        made an unstamped legacy org claimable by the first Portal caller (trust-on-
        first-use). It is no longer called from middleware.tenant.get_tenant_session;
        ownership is assigned at provisioning (create_org) and this helper is reserved
        for the OUT-OF-BAND backfill of legit legacy rows (migrations/004), where the
        (org -> Portal CUID) mapping has been established from a trusted source. It stays
        defensive by contract — never raises: rolls back and swallows on any failure,
        mirroring conductor_bridge._portal_org_id_for."""
        if not internal_org_id or not portal_org_id:
            return False
        try:
            row = (
                db.query(AtriumOrganization)
                .filter(AtriumOrganization.id == internal_org_id)
                .one_or_none()
            )
            if row is None or row.portal_org_id is not None or row.slug == "default":
                return False
            row.portal_org_id = portal_org_id
            row.updated_at = now_ms()
            db.commit()
            log.info(
                f"Stamped portal_org_id on org {internal_org_id} ({row.slug})"
            )
            return True
        except Exception as e:  # never let a reconcile break the request
            log.warning(
                f"stamp_portal_org_id failed for org {internal_org_id}: {e}"
            )
            try:
                db.rollback()
            except Exception:
                pass
            return False

    @staticmethod
    def get_org_by_id(db: Session, org_id: str) -> Optional[AtriumOrganization]:
        return db.query(AtriumOrganization).filter_by(id=org_id).first()

    @staticmethod
    def get_org_by_portal_id(
        db: Session, portal_org_id: str
    ) -> Optional[AtriumOrganization]:
        """Single-org lookup by Portal org CUID — the exchange's provisioning key
        (#45 PR-1). Same identity #35's list_orgs_for_portal scopes by; this returns
        the one row (or None) so portal-exchange can find-or-create. Returns None for a
        blank CUID (fail-closed)."""
        if not portal_org_id:
            return None
        return (
            db.query(AtriumOrganization)
            .filter(AtriumOrganization.portal_org_id == portal_org_id)
            .first()
        )

    @staticmethod
    def set_org_app_access(
        db: Session, org_id: str, app_access: list[str]
    ) -> bool:
        """Cache the org's Portal app entitlement onto AtriumOrganization.app_access
        (#45 PR-1). Written at portal-exchange so require_app_access can read it on the
        OWUI-session path, where the session token carries no app_access claim. Idempotent
        (overwrites with the latest claim on every re-login = persist-at-exchange
        freshness). Returns True iff a row was updated."""
        row = (
            db.query(AtriumOrganization)
            .filter(AtriumOrganization.id == org_id)
            .one_or_none()
        )
        if row is None:
            return False
        row.app_access = list(app_access or [])
        row.updated_at = now_ms()
        db.commit()
        return True

    @staticmethod
    def upsert_member(
        db: Session,
        org_id: str,
        user_id: str,
        role: str = "member",
    ) -> AtriumMember:
        """Idempotent one-row-per-(org_id, user_id) membership write (#45 PR-1).

        Unlike add_member (which always INSERTs), this find-or-updates so a re-login
        through portal-exchange refreshes the role without duplicating rows. user_id is
        ALWAYS the resolved OWUI user.id (AtriumMember.user_id 'References OpenWebUI
        user'), never a JWT/body claim."""
        member = (
            db.query(AtriumMember)
            .filter_by(org_id=org_id, user_id=user_id)
            .first()
        )
        if member is None:
            member = AtriumMember(
                id=generate_id(),
                org_id=org_id,
                user_id=user_id,
                role=role or "member",
                department_ids=[],
                created_at=now_ms(),
            )
            db.add(member)
            db.commit()
            db.refresh(member)
            log.info(f"Provisioned member {user_id} in org {org_id} as {role}")
        elif role and member.role != role:
            member.role = role
            db.commit()
            db.refresh(member)
            log.info(f"Updated member {user_id} role in org {org_id} to {role}")
        return member

    @staticmethod
    def _clean_str(value) -> str:
        """Normalize an untrusted JWT claim to a stripped str ('' for anything else)."""
        return value.strip() if isinstance(value, str) else ""

    @staticmethod
    def _slug_is_placeholder(org: AtriumOrganization) -> bool:
        """True when this org's slug was never really chosen — so it is safe to replace.

        Two ways a placeholder is born:
          * 'default' — the org the frontend auto-creates (+layout.svelte) before any
            Portal binding exists, alongside the name 'My Organization';
          * an id echoed as a slug — provision_from_portal's create-time fallback is the
            Portal org id itself (see the CREATE branch below), and locally created rows
            can carry their own generate_id(). Portal ids may be CUID **or** UUID, so we
            compare against the stored values rather than sniffing the shape.
        """
        slug = org.slug
        if not slug:
            return True
        return slug in ("default", org.portal_org_id, org.id)

    @staticmethod
    def _refresh_org_identity(
        db: Session, org: AtriumOrganization, payload: dict
    ) -> bool:
        """Refresh an already-BOUND org's display name/slug from the Portal token
        (atrium#79 follow-up).

        The find-or-create in provision_from_portal only wrote name/slug on the CREATE
        branch, so an org the frontend auto-created as 'My Organization'/'default' and
        that was LATER bound to a real Portal org kept the placeholder identity forever.
        Org identity is already proven by the caller's portal_org_id lookup; this
        refreshes ONLY the two display columns.

        Rules:
          * name — adopt any non-empty incoming name that differs (display-only, no
            constraints, so no guard beyond "not blank").
          * slug — adopt ONLY when all three hold:
              (a) the incoming slug is real: non-empty, not 'default', and not the org
                  id echoed back as a slug;
              (b) the CURRENT slug is a placeholder (_slug_is_placeholder) — a slug
                  someone deliberately chose is never renamed out from under routing;
              (c) no OTHER row already holds it. slug is UNIQUE (models/db.py:50) and an
                  IntegrityError here would roll back the whole login-path provisioning.
          * portal_org_id is NEVER touched here — the binding is assigned at create /
            out-of-band backfill (stamp_portal_org_id), never on a data path.

        Commits at most once, and bumps updated_at only when something actually changed
        (so a repeat login of unchanged claims writes nothing). Never raises: any failure
        rolls back just this refresh and login continues — same contract as the caller.
        """
        try:
            changed = False

            incoming_name = OrganizationsService._clean_str(payload.get("org_name"))
            if incoming_name and incoming_name != org.name:
                org.name = incoming_name
                changed = True

            incoming_slug = OrganizationsService._clean_str(payload.get("org_slug"))
            portal_org_id = OrganizationsService._clean_str(payload.get("org_id"))
            slug_is_real = (
                bool(incoming_slug)
                and incoming_slug != "default"
                and incoming_slug != portal_org_id
            )
            if slug_is_real and incoming_slug != org.slug:
                if not OrganizationsService._slug_is_placeholder(org):
                    log.debug(
                        "org %s keeps slug %r: not a placeholder (incoming %r)",
                        org.id, org.slug, incoming_slug,
                    )
                else:
                    holder = OrganizationsService.get_org_by_slug(db, incoming_slug)
                    if holder is not None and holder.id != org.id:
                        log.info(
                            "org %s keeps slug %r: incoming %r already held by org %s",
                            org.id, org.slug, incoming_slug, holder.id,
                        )
                    else:
                        org.slug = incoming_slug
                        changed = True

            profile_updates = {}
            incoming_logo = OrganizationsService._clean_str(payload.get("org_logo"))
            if incoming_logo:
                profile_updates["logo"] = incoming_logo
            incoming_industry = OrganizationsService._clean_str(
                payload.get("org_industry")
            )
            if incoming_industry:
                profile_updates["industry"] = incoming_industry
            if profile_updates:
                # Org profile (logo/industry) is captured once at Portal signup and rides the
                # JWT as org_logo / org_industry. Stash it in settings (no schema column, so no
                # SQLite ALTER) so downstream surfaces — the onboarding wizard — can prefill and
                # lock it instead of re-asking. Merge into a fresh dict so JSON dirty-tracking
                # fires and sibling keys (onboarding state) are preserved.
                current = dict(org.settings) if isinstance(org.settings, dict) else {}
                if any(current.get(k) != v for k, v in profile_updates.items()):
                    current.update(profile_updates)
                    org.settings = current
                    changed = True

            if changed:
                org.updated_at = now_ms()
                db.commit()
                db.refresh(org)
                log.info(
                    "Refreshed org %s identity from portal: name=%r slug=%r",
                    org.id, org.name, org.slug,
                )
            return changed
        except Exception as e:  # a display refresh must never break login
            log.warning(
                f"Org identity refresh failed for org {getattr(org, 'id', None)} "
                f"(non-fatal): {e}"
            )
            try:
                db.rollback()
            except Exception:
                pass
            return False

    @staticmethod
    def provision_from_portal(db: Session, user_id: str, payload: dict) -> None:
        """Persist Atrium org membership + per-org app_access from a VALIDATED Portal
        JWT payload, keyed on the OWUI user.id (#45 / atrium#50). Idempotent — safe on
        every login: find-or-create the org by its Portal CUID, upsert ONE membership row
        (role normalized to the lowercase Atrium vocabulary), and overwrite the cached
        app_access entitlement require_app_access reads on the OWUI-session path.

        Called from routers/auth_callback.py::portal_auth_callback — the deployed
        server-side SSO callback and the single Atrium login path. (A duplicate
        portal_token_exchange endpoint, hit only by an unused Svelte page, used to call
        this too; it never ran in prod and has been removed — atrium#50.)

        Defensive by contract: ANY failure here MUST NOT break login. Log + rollback."""
        try:
            portal_org_cuid = payload.get("org_id")
            if not portal_org_cuid:
                return
            org = OrganizationsService.get_org_by_portal_id(db, portal_org_cuid)
            if org is None:
                org_slug = payload.get("org_slug") or portal_org_cuid
                org = OrganizationsService.create_org(
                    db,
                    name=payload.get("org_name") or org_slug,
                    slug=org_slug,
                    portal_org_id=portal_org_cuid,
                )
            # Keep the DISPLAY identity + profile fresh on every login: for a just-created org
            # this stamps logo/industry into settings; for an existing one it also un-sticks a
            # placeholder name/slug ('My Organization'/'default') once bound to a real Portal
            # org (atrium#79).
            OrganizationsService._refresh_org_identity(db, org, payload)
            OrganizationsService.upsert_member(
                db,
                org_id=org.id,
                user_id=user_id,
                role=(payload.get("role") or "member").lower(),
            )
            OrganizationsService.set_org_app_access(
                db, org.id, payload.get("app_access") or []
            )
            log.info(
                "Atrium provisioning from portal: user=%s org=%s apps=%s",
                user_id,
                org.id,
                payload.get("app_access") or [],
            )
        except Exception as e:
            log.warning(
                f"Atrium provisioning from portal failed (non-fatal): {e}"
            )
            try:
                db.rollback()
            except Exception:
                pass

    @staticmethod
    def get_org_by_slug(db: Session, slug: str) -> Optional[AtriumOrganization]:
        return db.query(AtriumOrganization).filter_by(slug=slug).first()

    @staticmethod
    def list_orgs(db: Session) -> list[AtriumOrganization]:
        return db.query(AtriumOrganization).order_by(AtriumOrganization.created_at.desc()).all()

    @staticmethod
    def list_orgs_for_portal(
        db: Session, portal_org_id: str
    ) -> list[AtriumOrganization]:
        """#35 (GA-safety): list ONLY the org(s) owned by the caller's Portal org.

        RLS is a no-op on SQLite, so cross-tenant isolation rests on explicit
        filters. The bare list endpoint previously returned EVERY org (name/slug/
        plan) to any authenticated caller — a cross-tenant enumeration leak, and the
        frontend's resolveOrganization() fallback would then pick orgs[0], which
        could belong to a DIFFERENT tenant. On the Portal-authed path the JWT's
        org_id claim is the Portal CUID, stored here as AtriumOrganization
        .portal_org_id, so we scope by it. Returns [] for an unknown/blank CUID
        (fail-closed to no data, never another tenant's rows)."""
        if not portal_org_id:
            return []
        return (
            db.query(AtriumOrganization)
            .filter(AtriumOrganization.portal_org_id == portal_org_id)
            .order_by(AtriumOrganization.created_at.desc())
            .all()
        )

    @staticmethod
    def add_member(
        db: Session,
        org_id: str,
        user_id: str,
        role: str = "member",
        department_ids: list[str] = None,
    ) -> AtriumMember:
        member = AtriumMember(
            id=generate_id(),
            org_id=org_id,
            user_id=user_id,
            role=role,
            department_ids=department_ids or [],
            created_at=now_ms(),
        )
        db.add(member)
        db.commit()
        db.refresh(member)
        log.info(f"Added member {user_id} to org {org_id} as {role}")
        return member

    @staticmethod
    def get_member(db: Session, org_id: str, user_id: str) -> Optional[AtriumMember]:
        return db.query(AtriumMember).filter_by(org_id=org_id, user_id=user_id).first()

    @staticmethod
    def list_members(db: Session, org_id: str) -> list[AtriumMember]:
        return db.query(AtriumMember).filter_by(org_id=org_id).all()

    @staticmethod
    def get_user_orgs(db: Session, user_id: str) -> list[AtriumMember]:
        """Get all orgs a user belongs to."""
        return db.query(AtriumMember).filter_by(user_id=user_id).all()

    @staticmethod
    def setup_default_departments(db: Session, org_id: str) -> list[AtriumDepartment]:
        """Create the 3 MVP departments for a new org."""
        defaults = [
            {
                "slug": "sales_admin",
                "name": "Sales & Admin",
                "description": "Lead prioritization, follow-up generation, pipeline summaries, deal risk detection",
                "model_tier": "mid",
                "knowledge_scope": "sales",
                "capabilities": ["lead_prioritization", "follow_up_generation", "pipeline_summaries", "deal_risk_detection"],
                "workpipe_modules": ["contacts", "pipelines", "deals"],
            },
            {
                "slug": "customer",
                "name": "Customer",
                "description": "Ticket triage, suggested replies, escalation detection, sentiment summaries",
                "model_tier": "mid",
                "knowledge_scope": "customer",
                "capabilities": ["ticket_triage", "suggested_replies", "escalation_detection", "sentiment_summaries"],
                "workpipe_modules": ["tickets", "contacts"],
            },
            {
                "slug": "back_office",
                "name": "Back Office",
                "description": "Invoice follow-up, operational tasks, financial summaries, internal checklists",
                "model_tier": "mid",
                "knowledge_scope": "operations",
                "capabilities": ["invoice_follow_up", "operational_automation", "financial_summaries", "checklist_automation"],
                "workpipe_modules": ["invoices", "tasks"],
            },
        ]

        departments = []
        for dept_data in defaults:
            dept = AtriumDepartment(
                id=generate_id(),
                org_id=org_id,
                created_at=now_ms(),
                updated_at=now_ms(),
                **dept_data,
            )
            db.add(dept)
            departments.append(dept)

        db.commit()
        for dept in departments:
            db.refresh(dept)

        log.info(f"Created {len(departments)} default departments for org {org_id}")
        return departments

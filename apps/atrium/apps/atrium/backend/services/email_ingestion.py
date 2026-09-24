"""
Atrium Email Ingestion Service

Routes inbound emails to the appropriate department and generates proposals.

Flow:
1. Email arrives at orgslug@in.atrium.domain (webhook or polling)
2. EmailIngestionService.ingest() parses the email
3. Classifier determines target department based on content
4. Department-scoped proposal is created in the approval inbox
5. User reviews and approves/rejects the proposed action

Supported action types from email:
- New lead inquiry → Sales & Admin (create_contact_and_deal)
- Support request → Customer (create_ticket)
- Invoice/billing → Back Office (create_ticket with billing tag)
- General → Chief AI for triage
"""

import logging
import re
from dataclasses import dataclass, field
from typing import Optional

from sqlalchemy.orm import Session

from ..models.db import AtriumOrganization, generate_id, now_ms
from .proposals import ProposalsService

logger = logging.getLogger("atrium.email_ingestion")


@dataclass
class ParsedEmail:
    """Parsed inbound email."""
    from_email: str
    from_name: str = ""
    to_email: str = ""
    subject: str = ""
    body_text: str = ""
    body_html: str = ""
    org_slug: str = ""
    message_id: str = ""
    in_reply_to: str = ""
    attachments: list[dict] = field(default_factory=list)


@dataclass
class ClassificationResult:
    """Result of email department classification."""
    department: str  # sales_admin, customer, back_office, chief
    confidence: float  # 0.0 - 1.0
    action_type: str
    signals: list[str] = field(default_factory=list)


# ── Classification Keywords ────────────────────────────────────────────

SALES_KEYWORDS = {
    "interested", "pricing", "quote", "proposal", "demo", "partnership",
    "inquiry", "looking for", "services", "rates", "consultation",
    "project", "budget", "estimate", "rfp", "bid",
}

SUPPORT_KEYWORDS = {
    "help", "issue", "problem", "bug", "broken", "error", "not working",
    "support", "ticket", "urgent", "fix", "complaint", "refund",
    "cancel", "downtime", "outage",
}

BILLING_KEYWORDS = {
    "invoice", "payment", "billing", "receipt", "charge", "subscription",
    "overdue", "past due", "balance", "account", "statement",
}


class EmailIngestionService:
    """
    Processes inbound emails and routes them to departments.
    """

    @staticmethod
    def parse_email(raw_data: dict) -> ParsedEmail:
        """
        Parse raw email webhook payload into structured format.

        Supports common webhook formats (SendGrid, Mailgun, generic).
        """
        # Extract org slug from recipient address
        to_email = raw_data.get("to", raw_data.get("recipient", ""))
        org_slug = ""
        if "@" in to_email:
            local_part = to_email.split("@")[0]
            org_slug = local_part  # e.g., "acme" from "acme@in.atrium.domain"

        # Parse from field
        from_raw = raw_data.get("from", raw_data.get("sender", ""))
        from_email, from_name = EmailIngestionService._parse_from(from_raw)

        return ParsedEmail(
            from_email=from_email,
            from_name=from_name,
            to_email=to_email,
            subject=raw_data.get("subject", ""),
            body_text=raw_data.get("text", raw_data.get("body-plain", raw_data.get("body_text", ""))),
            body_html=raw_data.get("html", raw_data.get("body-html", raw_data.get("body_html", ""))),
            org_slug=org_slug,
            message_id=raw_data.get("message-id", raw_data.get("Message-Id", "")),
            in_reply_to=raw_data.get("in-reply-to", raw_data.get("In-Reply-To", "")),
            attachments=raw_data.get("attachments", []),
        )

    @staticmethod
    def _parse_from(from_raw: str) -> tuple[str, str]:
        """Parse 'Name <email>' format."""
        match = re.match(r'^"?([^"<]*)"?\s*<?([^>]+)>?$', from_raw.strip())
        if match:
            return match.group(2).strip(), match.group(1).strip()
        return from_raw.strip(), ""

    @staticmethod
    def classify(email: ParsedEmail) -> ClassificationResult:
        """
        Classify email into target department using keyword matching.

        Phase 1: Keyword-based heuristic (fast, no API calls)
        Phase 2+: Use local model (Gemma 9B) for classification
        """
        text = f"{email.subject} {email.body_text}".lower()
        words = set(re.findall(r'\b\w+\b', text))

        # Score each department
        sales_score = len(words & SALES_KEYWORDS)
        support_score = len(words & SUPPORT_KEYWORDS)
        billing_score = len(words & BILLING_KEYWORDS)

        signals = []
        if sales_score:
            signals.append(f"sales_keywords({sales_score})")
        if support_score:
            signals.append(f"support_keywords({support_score})")
        if billing_score:
            signals.append(f"billing_keywords({billing_score})")

        # Determine winner
        scores = {
            "sales_admin": sales_score,
            "customer": support_score,
            "back_office": billing_score,
        }
        max_dept = max(scores, key=scores.get)
        max_score = scores[max_dept]
        total = sum(scores.values()) or 1

        # If no clear signal, route to chief
        if max_score == 0:
            return ClassificationResult(
                department="chief",
                confidence=0.3,
                action_type="triage",
                signals=["no_keyword_match"],
            )

        # Determine action type
        action_map = {
            "sales_admin": "create_contact_and_deal",
            "customer": "create_ticket",
            "back_office": "create_ticket",
        }

        return ClassificationResult(
            department=max_dept,
            confidence=round(max_score / total, 2),
            action_type=action_map[max_dept],
            signals=signals,
        )

    @staticmethod
    def resolve_org(db: Session, org_slug: str) -> Optional[AtriumOrganization]:
        """Look up organization by slug from email address."""
        if not org_slug:
            return None
        # Try exact slug match, then partial match
        org = db.query(AtriumOrganization).filter_by(slug=org_slug).first()
        if not org:
            # Try name-based match (fallback)
            org = db.query(AtriumOrganization).filter(
                AtriumOrganization.name.ilike(f"%{org_slug}%")
            ).first()
        return org

    @staticmethod
    def ingest(
        db: Session,
        raw_data: dict,
    ) -> dict:
        """
        Full ingestion pipeline: parse → classify → create proposal.

        Returns dict with ingestion result (proposal_id, department, etc.)
        """
        # Parse
        email = EmailIngestionService.parse_email(raw_data)
        logger.info(
            "Ingesting email from=%s subject='%s' org_slug='%s'",
            email.from_email, email.subject, email.org_slug,
        )

        # Resolve organization
        org = EmailIngestionService.resolve_org(db, email.org_slug)
        if not org:
            logger.warning("No org found for slug: %s", email.org_slug)
            return {
                "status": "rejected",
                "reason": f"Unknown organization: {email.org_slug}",
                "email_from": email.from_email,
            }

        # Classify
        classification = EmailIngestionService.classify(email)
        logger.info(
            "Email classified: dept=%s confidence=%.2f action=%s signals=%s",
            classification.department,
            classification.confidence,
            classification.action_type,
            classification.signals,
        )

        # Build proposal payload
        payload = EmailIngestionService._build_proposal_payload(
            email, classification
        )

        # Determine risk level
        risk_level = "low"
        if classification.confidence < 0.5:
            risk_level = "medium"
        if classification.department == "chief":
            risk_level = "medium"

        # Create proposal
        proposal = ProposalsService.create_proposal(
            db=db,
            org_id=org.id,
            department_id=classification.department,
            title=f"Email: {email.subject or 'No subject'}",
            description=(
                f"From: {email.from_name or email.from_email} <{email.from_email}>\n"
                f"Department: {classification.department} "
                f"(confidence: {classification.confidence:.0%})\n\n"
                f"{email.body_text[:500]}"
            ),
            action_type=classification.action_type,
            action_payload=payload,
            risk_level=risk_level,
            risk_reasoning=(
                f"Auto-classified from email. "
                f"Signals: {', '.join(classification.signals)}. "
                f"Confidence: {classification.confidence:.0%}"
            ),
            created_by_ai="atrium/email-ingestion",
        )

        return {
            "status": "ingested",
            "proposal_id": proposal.id,
            "department": classification.department,
            "action_type": classification.action_type,
            "confidence": classification.confidence,
            "email_from": email.from_email,
            "email_subject": email.subject,
        }

    @staticmethod
    def _build_proposal_payload(
        email: ParsedEmail, classification: ClassificationResult
    ) -> dict:
        """Build the action_payload for the proposal based on classification."""

        base = {
            "email_from": email.from_email,
            "email_from_name": email.from_name,
            "email_subject": email.subject,
            "email_body": email.body_text[:2000],
            "email_message_id": email.message_id,
        }

        if classification.action_type == "create_contact_and_deal":
            base.update({
                "contact_name": email.from_name or email.from_email.split("@")[0],
                "contact_email": email.from_email,
                "deal_name": f"Inquiry: {email.subject or 'Email Lead'}",
                "description": email.body_text[:500],
                "tags": ["email-lead"],
            })

        elif classification.action_type == "create_ticket":
            tag = "support"
            if classification.department == "back_office":
                tag = "billing"
            base.update({
                "name": email.subject or "Email Support Request",
                "description": (
                    f"From: {email.from_name or email.from_email}\n\n"
                    f"{email.body_text[:1000]}"
                ),
                "tags": [tag, "email-inbound"],
            })

        elif classification.action_type == "triage":
            base.update({
                "note": "Unclassified email — needs manual department assignment",
            })

        return base

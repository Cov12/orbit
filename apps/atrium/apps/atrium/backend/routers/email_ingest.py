"""
Atrium Email Ingestion Webhook

Receives inbound emails from email providers (SendGrid, Mailgun, etc.)
and routes them through the ingestion pipeline.

Endpoint: POST /api/atrium/email/ingest
"""

import hashlib
import hmac
import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..middleware.tenant import get_tenant_session
from ..services.email_ingestion import EmailIngestionService

router = APIRouter(prefix="/api/atrium/email", tags=["atrium-email"])
logger = logging.getLogger("atrium.routers.email")

# Webhook signing secret for verification
WEBHOOK_SECRET = os.environ.get("ATRIUM_EMAIL_WEBHOOK_SECRET", "")


class EmailWebhookPayload(BaseModel):
    """Generic email webhook payload."""
    # SendGrid / Mailgun / Generic format
    to: Optional[str] = ""
    recipient: Optional[str] = ""  # Mailgun alias
    subject: Optional[str] = ""
    text: Optional[str] = ""
    html: Optional[str] = ""

    # From field (various formats)
    sender: Optional[str] = ""  # Mailgun
    # 'from' is a Python keyword, handled in dict form

    # Metadata
    message_id: Optional[str] = ""
    in_reply_to: Optional[str] = ""
    attachments: list[dict] = []

    class Config:
        extra = "allow"  # Accept provider-specific fields


def _verify_webhook_signature(request_body: bytes, signature: str) -> bool:
    """Verify the webhook HMAC-SHA256 signature. The caller MUST ensure WEBHOOK_SECRET is
    configured before calling; a missing/empty signature is rejected (never fail-open)."""
    expected = hmac.new(
        WEBHOOK_SECRET.encode(),
        request_body,
        hashlib.sha256,
    ).hexdigest()
    return bool(signature) and hmac.compare_digest(expected, signature)


@router.post("/ingest")
async def ingest_email(
    request: Request,
    db: Session = Depends(get_tenant_session),
):
    """
    Webhook endpoint for inbound email ingestion.

    Accepts JSON payload from email providers.
    Parses, classifies, and creates a proposal in the approval inbox.
    """
    # Read raw body for signature verification
    body = await request.body()

    # Fail closed: an unconfigured secret means we cannot authenticate the caller, so we
    # reject rather than accept unauthenticated proposal injection into any org (atrium#56).
    if not WEBHOOK_SECRET:
        logger.error(
            "email ingest rejected: ATRIUM_EMAIL_WEBHOOK_SECRET is not configured"
        )
        raise HTTPException(status_code=503, detail="Email ingestion is not configured")

    signature = request.headers.get("X-Webhook-Signature", "")
    if not _verify_webhook_signature(body, signature):
        logger.warning("Email webhook signature verification failed")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Parse JSON payload
    try:
        import json
        raw_data = json.loads(body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    # Handle 'from' field (Python keyword)
    if "from" in raw_data and "sender" not in raw_data:
        raw_data["sender"] = raw_data["from"]

    # Ingest
    try:
        result = EmailIngestionService.ingest(db=db, raw_data=raw_data)
    except Exception as e:
        logger.exception("Email ingestion failed")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")

    if result["status"] == "rejected":
        raise HTTPException(status_code=404, detail=result["reason"])

    logger.info(
        "Email ingested: proposal=%s dept=%s from=%s",
        result.get("proposal_id"),
        result.get("department"),
        result.get("email_from"),
    )

    return result


@router.get("/health")
async def email_health():
    """Email ingestion health check."""
    return {
        "status": "ok",
        "webhook_secret_configured": bool(WEBHOOK_SECRET),
    }

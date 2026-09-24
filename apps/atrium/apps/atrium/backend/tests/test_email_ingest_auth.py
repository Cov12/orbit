"""Email-ingest webhook auth tests — atrium#56.

`POST /api/atrium/email/ingest` must be FAIL-CLOSED: with no
`ATRIUM_EMAIL_WEBHOOK_SECRET` configured it must reject (was previously
fail-open — an unset secret skipped verification, allowing unauthenticated
proposal injection into any org). With a secret set, only a valid HMAC-SHA256
signature passes.
"""

import hashlib
import hmac

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from apps.atrium.backend.routers import email_ingest
from apps.atrium.backend.middleware.tenant import get_tenant_session


@pytest.fixture
def client():
    app = FastAPI()
    app.include_router(email_ingest.router)
    # The auth gate runs before the handler touches the db; a stub session is enough.
    app.dependency_overrides[get_tenant_session] = lambda: None
    return TestClient(app, raise_server_exceptions=False)


def _sig(body: bytes, secret: str) -> str:
    return hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def test_rejects_503_when_secret_unconfigured(client, monkeypatch):
    monkeypatch.setattr(email_ingest, "WEBHOOK_SECRET", "")
    r = client.post("/api/atrium/email/ingest", content=b'{"sender":"a@b.co"}')
    assert r.status_code == 503, r.text


def test_rejects_401_on_missing_signature(client, monkeypatch):
    monkeypatch.setattr(email_ingest, "WEBHOOK_SECRET", "test-secret")
    r = client.post("/api/atrium/email/ingest", content=b'{"sender":"a@b.co"}')
    assert r.status_code == 401, r.text


def test_rejects_401_on_bad_signature(client, monkeypatch):
    monkeypatch.setattr(email_ingest, "WEBHOOK_SECRET", "test-secret")
    r = client.post(
        "/api/atrium/email/ingest",
        content=b'{"sender":"a@b.co"}',
        headers={"X-Webhook-Signature": "deadbeef"},
    )
    assert r.status_code == 401, r.text


def test_valid_signature_passes_the_auth_gate(client, monkeypatch):
    monkeypatch.setattr(email_ingest, "WEBHOOK_SECRET", "test-secret")
    body = b'{"sender":"a@b.co","subject":"hi","body":"x"}'
    r = client.post(
        "/api/atrium/email/ingest",
        content=body,
        headers={"X-Webhook-Signature": _sig(body, "test-secret")},
    )
    # A valid signature must get PAST the auth gate. Downstream ingestion may still
    # 4xx/5xx (stub db), but it must not be a 401/503 auth rejection.
    assert r.status_code not in (401, 503), r.text

"""Unit tests for Portal JWT auth — app_access claim and PortalAuthContext."""

import jwt as pyjwt
import pytest

from apps.atrium.backend.middleware import jwt_auth
from apps.atrium.backend.middleware.jwt_auth import (
    PortalAuthContext,
    decode_portal_jwt,
)


TEST_JWT_SECRET = "test-secret-do-not-use-in-prod"


@pytest.fixture
def jwt_secret(monkeypatch):
    """Patch the module-level JWT_SECRET used by decode_portal_jwt."""
    monkeypatch.setattr(jwt_auth, "JWT_SECRET", TEST_JWT_SECRET)
    return TEST_JWT_SECRET


class TestPortalAuthEngramppAccess:
    """has_app_access() behavior on PortalAuthContext."""

    def test_returns_true_when_app_in_app_access(self):
        ctx = PortalAuthContext(
            user_id="u1",
            org_id="o1",
            app_access=["CONDUCTOR", "WORKPIPE"],
        )
        assert ctx.has_app_access("CONDUCTOR") is True
        assert ctx.has_app_access("WORKPIPE") is True

    def test_returns_false_when_app_missing(self):
        ctx = PortalAuthContext(
            user_id="u1",
            org_id="o1",
            app_access=["WORKPIPE"],
        )
        assert ctx.has_app_access("CONDUCTOR") is False

    def test_returns_false_when_app_access_empty(self):
        ctx = PortalAuthContext(user_id="u1", org_id="o1")
        assert ctx.has_app_access("CONDUCTOR") is False

    def test_no_platform_admin_bypass(self):
        """Locked decision: role=admin does NOT grant entitlement-free access."""
        ctx = PortalAuthContext(
            user_id="u1",
            org_id="o1",
            role="admin",
            app_access=[],
        )
        assert ctx.has_app_access("CONDUCTOR") is False

        owner_ctx = PortalAuthContext(
            user_id="u1",
            org_id="o1",
            role="owner",
            app_access=[],
        )
        assert owner_ctx.has_app_access("CONDUCTOR") is False


class TestDecodePortalJWT:
    """decode_portal_jwt extracts app_access from payload."""

    def test_extracts_app_access_claim(self, jwt_secret):
        payload = {
            "user_id": "u-123",
            "org_id": "o-456",
            "role": "member",
            "app_access": ["CONDUCTOR", "WORKPIPE"],
        }
        token = pyjwt.encode(payload, jwt_secret, algorithm="HS256")

        ctx = decode_portal_jwt(token)

        assert ctx is not None
        assert ctx.user_id == "u-123"
        assert ctx.org_id == "o-456"
        assert ctx.app_access == ["CONDUCTOR", "WORKPIPE"]
        assert ctx.has_app_access("CONDUCTOR") is True

    def test_defaults_app_access_to_empty_list(self, jwt_secret):
        """JWT without app_access claim → ctx.app_access == []."""
        payload = {
            "user_id": "u-123",
            "org_id": "o-456",
            "role": "member",
        }
        token = pyjwt.encode(payload, jwt_secret, algorithm="HS256")

        ctx = decode_portal_jwt(token)

        assert ctx is not None
        assert ctx.app_access == []
        assert ctx.has_app_access("CONDUCTOR") is False

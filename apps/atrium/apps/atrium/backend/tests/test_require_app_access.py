"""Unit tests for the require_app_access FastAPI dep factory."""

from types import SimpleNamespace

import pytest
from fastapi import HTTPException

from apps.atrium.backend.middleware.deps import require_app_access
from apps.atrium.backend.middleware.jwt_auth import PortalAuthContext


def _make_request(portal_auth):
    """Build a minimal Request-like object exposing .state, .headers, .cookies.

    headers/cookies are empty so _resolve_owui_user_id (#45) finds no OWUI token and
    returns None -> the portal_auth-None tests exercise the dev-flag / deny path.
    """
    return SimpleNamespace(
        state=SimpleNamespace(portal_auth=portal_auth),
        headers={},
        cookies={},
    )


class TestRequireAppAccess:
    def test_grants_access_when_app_in_app_access(self, monkeypatch):
        monkeypatch.delenv("ATRIUM_DEV_ALLOW_HEADER_AUTH", raising=False)
        dep = require_app_access("CONDUCTOR")
        ctx = PortalAuthContext(
            user_id="u-1",
            org_id="o-1",
            app_access=["CONDUCTOR"],
        )

        # Should not raise.
        assert dep(_make_request(ctx)) is None

    def test_denies_when_app_missing(self, monkeypatch):
        monkeypatch.delenv("ATRIUM_DEV_ALLOW_HEADER_AUTH", raising=False)
        dep = require_app_access("CONDUCTOR")
        ctx = PortalAuthContext(
            user_id="u-1",
            org_id="o-1",
            app_access=["WORKPIPE"],
        )

        with pytest.raises(HTTPException) as exc:
            dep(_make_request(ctx))
        assert exc.value.status_code == 403
        assert "CONDUCTOR" in exc.value.detail

    def test_denies_when_portal_auth_none_default(self, monkeypatch):
        """No portal_auth + no dev env var = 403."""
        monkeypatch.delenv("ATRIUM_DEV_ALLOW_HEADER_AUTH", raising=False)
        dep = require_app_access("CONDUCTOR")

        with pytest.raises(HTTPException) as exc:
            dep(_make_request(None))
        assert exc.value.status_code == 403

    def test_denies_when_portal_auth_none_and_no_owui_user(self):
        """No portal_auth and no resolvable OWUI session = 403 (fail-closed, no grace)."""
        dep = require_app_access("CONDUCTOR")

        with pytest.raises(HTTPException) as exc:
            dep(_make_request(None))
        assert exc.value.status_code == 403

    def test_portal_auth_present_but_missing_app_is_denied(self):
        """If portal_auth is present but lacks the required app, access is denied."""
        dep = require_app_access("CONDUCTOR")
        ctx = PortalAuthContext(
            user_id="u-1",
            org_id="o-1",
            app_access=[],
        )

        with pytest.raises(HTTPException) as exc:
            dep(_make_request(ctx))
        assert exc.value.status_code == 403

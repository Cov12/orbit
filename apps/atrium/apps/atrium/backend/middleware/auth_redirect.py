"""Atrium UI authentication redirect middleware.

Redirects unauthenticated Atrium UI requests to the Orbit Portal sign-in page.
API routes remain handled by JWTAuthMiddleware.
"""

from __future__ import annotations

import logging
import os
from typing import Iterable
from urllib.parse import urlencode

import jwt as pyjwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import RedirectResponse, Response

logger = logging.getLogger("atrium.auth_redirect")

JWT_ALGORITHM = "HS256"


class AuthRedirectMiddleware(BaseHTTPMiddleware):
    """Redirect unauthenticated Atrium UI traffic to Portal authentication."""

    def __init__(
        self,
        app,
        portal_url: str = "https://portal.orbit.example",
        excluded_paths: list[str] | None = None,
    ) -> None:
        super().__init__(app)
        self.portal_url = portal_url.rstrip("/")
        self.excluded_paths = excluded_paths or ["/atrium/auth/callback"]

    async def dispatch(self, request: Request, call_next) -> Response:
        """Validate UI auth token or redirect to Portal sign-in."""
        path = request.url.path

        # Let the auth callback route handle token exchange
        # The route at /atrium/auth/callback will exchange Portal JWT for OWUI session
        if path in self.excluded_paths:
            return await call_next(request)

        if not self._should_handle_request(request):
            return await call_next(request)

        # Check for bearer token in Authorization header
        auth_token = self._get_bearer_token(request)
        if auth_token and self._is_valid_jwt(auth_token):
            return await call_next(request)

        # Check for OpenWebUI "token" cookie (set by auth callback after Portal SSO)
        owui_token = request.cookies.get("token")
        if owui_token and self._is_valid_jwt(owui_token):
            return await call_next(request)

        return RedirectResponse(
            url=self._build_portal_signin_url(request),
            status_code=307,
        )

    def _should_handle_request(self, request: Request) -> bool:
        """Return True only for Atrium UI HTTP routes needing auth redirect."""
        path = request.url.path

        if request.method.upper() == "OPTIONS":
            return False

        # BaseHTTPMiddleware handles HTTP requests; keep explicit check for upgrades.
        if request.headers.get("upgrade", "").lower() == "websocket":
            return False

        if not path.startswith("/atrium/"):
            return False

        # Explicitly keep API paths out of this middleware.
        if path.startswith("/api/atrium/"):
            return False

        if path in self.excluded_paths:
            return False

        if path.endswith("/health") or path == "/health":
            return False

        if self._is_static_path(path):
            return False

        return True

    @staticmethod
    def _is_static_path(path: str) -> bool:
        """Best-effort static-asset path detection for UI resources."""
        static_prefixes: Iterable[str] = (
            "/atrium/static/",
            "/atrium/assets/",
            "/static/",
            "/assets/",
        )
        if any(path.startswith(prefix) for prefix in static_prefixes):
            return True

        static_files = {
            "/favicon.ico",
            "/robots.txt",
            "/manifest.json",
            "/atrium/favicon.ico",
        }
        return path in static_files

    def _is_valid_jwt(self, token: str) -> bool:
        """
        Validate JWT using either OWUI secret or Portal secret.

        After the SSO callback, tokens are OWUI tokens (signed with WEBUI_SECRET_KEY).
        Portal tokens (signed with JWT_SECRET) are also accepted for backwards compatibility.
        """
        # Try OWUI secret first (this is what portal_auth_callback mints)
        owui_secret = os.environ.get("WEBUI_SECRET_KEY", "")
        if owui_secret:
            try:
                payload = pyjwt.decode(token, owui_secret, algorithms=[JWT_ALGORITHM])
                # OWUI tokens have "id" field, Portal tokens have "sub"
                if "id" in payload:
                    return True
            except pyjwt.ExpiredSignatureError:
                logger.info("OWUI JWT expired during UI auth redirect validation")
                return False
            except pyjwt.InvalidTokenError:
                # Not an OWUI token, try Portal secret
                pass

        # Fallback: try Portal secret (for Portal JWTs that haven't been exchanged)
        portal_secret = os.environ.get("JWT_SECRET", "")
        if not portal_secret:
            logger.warning("Neither WEBUI_SECRET_KEY nor JWT_SECRET configured")
            return False

        try:
            pyjwt.decode(token, portal_secret, algorithms=[JWT_ALGORITHM])
            return True
        except pyjwt.ExpiredSignatureError:
            logger.info("Portal JWT expired during UI auth redirect validation")
            return False
        except pyjwt.InvalidTokenError as exc:
            logger.info("Invalid JWT during UI auth redirect validation: %s", exc)
            return False

    @staticmethod
    def _get_bearer_token(request: Request) -> str | None:
        """Extract bearer token from Authorization header if present."""
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            return auth_header[7:].strip()
        return None

    def _build_portal_signin_url(self, request: Request) -> str:
        """Build Portal sign-in URL with callback to the current page."""
        current_url = str(request.url)
        query = urlencode({"redirect_url": current_url})
        return f"{self.portal_url}/sign-in?{query}"

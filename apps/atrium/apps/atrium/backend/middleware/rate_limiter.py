"""
Atrium Rate Limiter Middleware

In-memory sliding window rate limiter, scoped per org_id.
Default: 100 requests per minute per org.

Phase 1: In-memory (single-process, resets on restart)
Phase 2+: Redis-backed for multi-process deployments
"""

import logging
import time
from collections import defaultdict
from typing import Optional

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("atrium.middleware.rate_limiter")

# Default rate limit
DEFAULT_RPM = 100  # requests per minute
WINDOW_SECONDS = 60


class RateLimiterMiddleware(BaseHTTPMiddleware):
    """
    Sliding window rate limiter for Atrium API routes.

    Limits by org_id (from request.state, set by JWTAuthMiddleware/TenantMiddleware).
    Falls back to IP-based limiting for unauthenticated requests.
    """

    def __init__(self, app, rpm: int = DEFAULT_RPM):
        super().__init__(app)
        self.rpm = rpm
        self.window = WINDOW_SECONDS
        # org_id/ip -> list of request timestamps
        self._requests: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        # Only rate-limit Atrium API routes
        if not request.url.path.startswith("/api/atrium"):
            return await call_next(request)

        # Skip health endpoints
        if request.url.path.endswith("/health"):
            return await call_next(request)

        # Determine rate limit key
        org_id: Optional[str] = getattr(request.state, "org_id", None)
        if org_id:
            key = f"org:{org_id}"
        else:
            # Fall back to IP
            client_ip = request.client.host if request.client else "unknown"
            key = f"ip:{client_ip}"

        # Check rate limit
        now = time.monotonic()
        window_start = now - self.window

        # Clean old entries
        timestamps = self._requests[key]
        self._requests[key] = [t for t in timestamps if t > window_start]

        if len(self._requests[key]) >= self.rpm:
            retry_after = int(self.window - (now - self._requests[key][0]))
            logger.warning(
                "Rate limit exceeded: key=%s count=%d limit=%d",
                key, len(self._requests[key]), self.rpm,
            )
            return JSONResponse(
                status_code=429,
                content={
                    "error": "Rate limit exceeded",
                    "code": "RATE_LIMITED",
                    "retry_after_seconds": max(1, retry_after),
                },
                headers={"Retry-After": str(max(1, retry_after))},
            )

        # Record this request
        self._requests[key].append(now)

        # Periodic cleanup (every ~100 requests)
        if sum(len(v) for v in self._requests.values()) > 10000:
            self._cleanup(window_start)

        response = await call_next(request)

        # Add rate limit headers
        remaining = self.rpm - len(self._requests[key])
        response.headers["X-RateLimit-Limit"] = str(self.rpm)
        response.headers["X-RateLimit-Remaining"] = str(max(0, remaining))
        response.headers["X-RateLimit-Reset"] = str(int(now + self.window))

        return response

    def _cleanup(self, cutoff: float):
        """Remove expired entries across all keys."""
        empty_keys = []
        for key, timestamps in self._requests.items():
            self._requests[key] = [t for t in timestamps if t > cutoff]
            if not self._requests[key]:
                empty_keys.append(key)
        for key in empty_keys:
            del self._requests[key]

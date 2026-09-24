"""
Atrium Error Handler Middleware

Catches unhandled exceptions in Atrium routes and returns
consistent JSON error responses. Logs structured error context.
"""

import logging
import traceback
import time

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse

logger = logging.getLogger("atrium.middleware.error_handler")


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """
    Catches exceptions in Atrium routes, returns consistent JSON errors,
    and logs structured context for debugging.
    """

    async def dispatch(self, request: Request, call_next):
        # Only handle Atrium routes
        if not request.url.path.startswith("/api/atrium"):
            return await call_next(request)

        start_time = time.monotonic()

        try:
            response = await call_next(request)
            duration = time.monotonic() - start_time

            # Log slow requests (>5s)
            if duration > 5.0:
                logger.warning(
                    "Slow request: %s %s took %.2fs (org=%s)",
                    request.method,
                    request.url.path,
                    duration,
                    getattr(request.state, "org_id", "unknown"),
                )

            return response

        except Exception as e:
            duration = time.monotonic() - start_time
            org_id = getattr(request.state, "org_id", "unknown")
            user_id = getattr(request.state, "user_id", "unknown")

            # Log full context
            logger.error(
                "Unhandled exception in %s %s (org=%s user=%s duration=%.2fs): %s",
                request.method,
                request.url.path,
                org_id,
                user_id,
                duration,
                str(e),
                exc_info=True,
            )

            # Return consistent error response
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Internal server error",
                    "code": "INTERNAL_ERROR",
                    "path": request.url.path,
                    "method": request.method,
                },
            )

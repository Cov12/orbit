"""
Atrium Mount Point

This is the single integration point with OpenWebUI's FastAPI app.
Import and call `mount_atrium(app)` from OpenWebUI's main.py.

This is the ONLY file that touches OpenWebUI internals.
Everything else lives in the atrium wrapper layer.
"""

import logging
from fastapi import FastAPI

from .routers.departments import router as departments_router
from .routers.proposals import router as proposals_router
from .routers.organizations import router as organizations_router
from .routers.onboarding import router as onboarding_router
from .routers.dashboard_workpipe import router as dashboard_workpipe_router
from .routers.dashboard_conductor import router as dashboard_conductor_router
from .routers.dashboard_drive import router as dashboard_drive_router
from .routers.email_ingest import router as email_router
from .routers.voice import router as voice_router
from .routers.auth_callback import router as auth_callback_router
from .routers.conductor_approvals import router as conductor_approvals_router
from .routers.employee_tabs import router as employee_tabs_router
from .middleware.tenant import TenantMiddleware
from .middleware.jwt_auth import JWTAuthMiddleware
from .middleware.rate_limiter import RateLimiterMiddleware
from .middleware.error_handler import ErrorHandlerMiddleware
from .middleware.auth_redirect import AuthRedirectMiddleware

logger = logging.getLogger("atrium")


def mount_atrium(app: FastAPI) -> None:
    """
    Mount all Atrium routes and middleware onto the OpenWebUI FastAPI app.
    
    Usage in OpenWebUI's main.py:
        from apps.atrium.backend.mount import mount_atrium
        mount_atrium(app)
    """
    # Add middleware (order: outermost runs first)
    # Error handler → Rate limiter → Auth redirect → JWT auth → Tenant context
    app.add_middleware(TenantMiddleware)
    app.add_middleware(JWTAuthMiddleware)
    app.add_middleware(AuthRedirectMiddleware)
    app.add_middleware(RateLimiterMiddleware, rpm=100)
    app.add_middleware(ErrorHandlerMiddleware)

    # Mount API routers
    app.include_router(auth_callback_router)  # Portal SSO callback
    app.include_router(organizations_router)
    app.include_router(onboarding_router)  # P1 onboarding capture + Engram seed
    app.include_router(departments_router)
    app.include_router(proposals_router)
    app.include_router(conductor_approvals_router)  # Conductor approval inbox
    app.include_router(employee_tabs_router)  # Dynamic employee tabs
    app.include_router(dashboard_workpipe_router)  # Dashboard D2 WorkPipe HTTP reads
    app.include_router(dashboard_conductor_router)  # Dashboard D4b Conductor history reads
    app.include_router(dashboard_drive_router)  # Dashboard Drive summary reads
    app.include_router(email_router)
    app.include_router(voice_router)

    # Health check
    @app.get("/api/atrium/health")
    async def atrium_health():
        return {
            "status": "ok",
            "service": "atrium",
            "version": "0.3.0",
        }

    # Ensure Atrium tables exist (create if missing)
    try:
        from open_webui.internal.db import engine, Base
        from .models.db import (
            AtriumOrganization,
            AtriumMember,
            AtriumDepartment,
            AtriumKnowledge,
            AtriumProposal,
            AtriumAuditLog,
            AtriumConductorApproval,
            AtriumEmployeeTab,
            AtriumConductorSession,
            AtriumSubAccount,
        )
        # Create only atrium_ tables, don't touch OpenWebUI tables
        atrium_tables = [
            AtriumOrganization.__table__,
            AtriumMember.__table__,
            AtriumDepartment.__table__,
            AtriumKnowledge.__table__,
            AtriumProposal.__table__,
            AtriumAuditLog.__table__,
            AtriumConductorApproval.__table__,
            AtriumEmployeeTab.__table__,
            AtriumConductorSession.__table__,
            AtriumSubAccount.__table__,
        ]
        Base.metadata.create_all(bind=engine, tables=atrium_tables)
        # create_all() only makes missing TABLES — it never ALTERs an existing one. Add any
        # model columns missing from the live schema so a column-add self-applies on deploy
        # (no more "no such column" 500s from a missed manual migration). See db_schema.py.
        from .db_schema import ensure_columns

        ensure_columns(engine, atrium_tables)
        logger.info("Atrium database tables verified/created")
    except Exception as e:
        logger.warning(f"Atrium table creation skipped: {e}")

    logger.info("Atrium mounted — 9 routers, 5 middleware layers (error/rate/auth-redirect/jwt/tenant)")

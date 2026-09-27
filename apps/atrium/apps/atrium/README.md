# Atrium Wrapper Layer

This directory contains all Atrium-specific code that wraps around OpenWebUI.

**Part of the Orbit product suite.** Auth and billing managed by [Orbit Portal](https://portal.orbit.example).

## Architecture

Atrium is a **thin wrapper layer** on top of OpenWebUI. All customizations live here — 
not scattered throughout OpenWebUI internals. This keeps upstream merges clean.

### Authentication

Atrium will accept Portal-issued JWTs (same pattern as WorkPipe and Drive). The auth flow:

1. User signs in on `portal.orbit.example`
2. Portal redirects to Atrium `/auth/callback?token=<jwt>`
3. Atrium validates the JWT and sets the OpenWebUI session cookie `token`
   (path `/`, **not** HTTP-only — the SvelteKit frontend reads it from JS).
   See `backend/routers/auth_callback.py` (`portal_auth_callback`).
4. Middleware checks cookie on every request

Atrium has **zero knowledge of Clerk** or any auth provider. To swap providers, change Portal only.

**Status:** Auth integration not yet implemented. Currently uses OpenWebUI's built-in auth.

### Relationship to WorkPipe

- **Atrium** = Intelligence + Delegation (AI agents, dept routing, model tiering)
- **WorkPipe** = Execution + CRM (pipelines, contacts, invoices, funnels)
- Atrium includes WorkPipe integration; WorkPipe-only does NOT include Atrium
- CRM operations go through WorkPipe Internal API (abstract `CRMAdapter` interface)

## Structure

```
apps/atrium/
├── backend/
│   ├── routers/       # FastAPI route extensions (departments, orchestrator, approvals)
│   ├── models/        # SQLAlchemy/Pydantic models (orgs, departments, proposals)
│   ├── services/      # Business logic (Conductor bridge, orchestrator, proposals)
│   ├── middleware/     # Auth/tenancy middleware (org context injection)
│   └── __init__.py
├── frontend/
│   ├── components/    # Svelte 4 components (dept switcher, approval inbox, org nav)
│   ├── stores/        # Svelte stores (org context, active department, proposals)
│   └── routes/        # SvelteKit route additions
├── config/
│   ├── departments.yaml    # Department definitions & model assignments
│   └── permissions.yaml    # Role-based permission matrix
└── docs/
    └── architecture.md     # Technical architecture documentation
```

## Design Principles

1. **Isolation** — Custom code stays in `apps/atrium/`, never in OpenWebUI core
2. **Config-driven** — Department structure and permissions in YAML; the LLM brain lives in Conductor (the Orbit Assistant), reached via the Conductor bridge
3. **Delegated Mode** — No AI auto-execution. All actions require human approval.
4. **Dual DB** — OpenWebUI DB (AI/conversations) + WorkPipe DB (CRM/business)
5. **Multi-tenant** — RLS on shared Postgres (Phase 1) → DB-per-tenant (Enterprise)

## Tech Stack

- **Backend**: FastAPI (Python 3.11+), mounted at `/api/atrium/`
- **Frontend**: Svelte 4 (NOT Svelte 5 runes), Tailwind CSS
- **AI Models**: Tiered routing — Chief (premium cloud), Dept Heads (mid-tier), Agents (local Ollama)
- **Database**: Shared Postgres with RLS
- **Hosting**: Render (deploys from `atrium-prod` branch)

## Deployment

Render Web Service. Docker image uses `node:22-alpine` (frontend) + `python:3.11` (backend). Currently at `atrium.orbit.example`.

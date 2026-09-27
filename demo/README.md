# Demo stack

Everything the live demo runs, on one machine with Docker Compose. Every host port binds to
127.0.0.1; the only public entry is an outbound tunnel, which is opt-in (`--profile public`).

| Service | Port (localhost) | |
|---|---|---|
| Portal | 15100 | identity gate, super-admin at `/admin` |
| WorkPipe | 15101 | CRM |
| Drive | 15102 | file vault |
| Conductor | 15103 | orchestrator + its two plugins |
| Atrium | 15104 | workspace (Open WebUI) |
| Agent runtime | 15105 | never routed publicly |
| Postgres | 15432 | one server, a database per app (Portal and Drive share one) |
| Qdrant | — | memory store, internal only |

## Setup

Secrets live outside the repo in `$ORBIT_SECRETS` (default `~/showcase/.secrets`), one env file per
concern, mode 600:

| File | Contents |
|---|---|
| `demo.env` | generated: `ORBIT_JWT_SECRET`, `ORBIT_ADMIN_SESSION_SECRET`, `ORBIT_BRIDGE_SECRET`, `BETTER_AUTH_SECRET`, `PAPERCLIP_AGENT_JWT_SECRET`, `HERMES_API_KEY`, `WEBUI_SECRET_KEY`, `POSTGRES_PASSWORD`, `DRIVE_MASTER_KEY`, `ORBIT_ATRIUM_ADMIN_PASSWORD` (`openssl rand -hex 32` each) |
| `clerk.env` | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` |
| `r2.env` | `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ENDPOINT`, `R2_BUCKET` |
| `anthropic.env` | `ANTHROPIC_API_KEY` (the agent model) |
| `openai.env` | `OPENAI_API_KEY` (memory embeddings and fact extraction) |
| `cloudflared.env` | `TUNNEL_TOKEN` (only for the public profile) |
| `demo-seed.env` | written by `seed.sh` / `seed-demo-account.sh` |

```bash
demo/build.sh                           # build every image, one at a time
demo/up.sh up -d                        # start everything except the tunnel
demo/seed.sh                            # orchestrator plugins, assistant template, service key, admins
demo/up.sh --profile public up -d       # start the tunnel
demo/seed-demo-account.sh               # the shared demo business (needs the public Portal URL)
demo/smoke.sh                           # end-to-end: the assistant must name a seeded deal
demo/reset.sh                           # drop all data and reseed (scheduled nightly)
```

Public hostnames are configured on the tunnel, not here: the apex to `portal:3000`, and
`workpipe.`, `drive.`, `conductor.` and `atrium.` to their services. Image builds bake the
`NEXT_PUBLIC_*` URLs in, so they are rebuilt when `ORBIT_DEMO_DOMAIN` changes.

## Safety choices

- **Sign-in is invitation-only**, and there is one shared, seeded business; `reset.sh` restores it
  and its password every night.
- **The workspace admin is created at startup** (`WEBUI_ADMIN_*`), so the first visitor never
  becomes the administrator.
- **Tenant sessions get a tool allowlist** in the agent runtime: task list, tenant-scoped memory and
  the four CRM tools. No terminal, files, code execution, browser, scheduling, shared memory or
  cross-session search (see [`apps/agent-runtime/docker`](../apps/agent-runtime/docker/README.md)).
- **The assistant's CRM tools reach WorkPipe at its public URL**: the orchestrator's plugin host
  refuses private addresses, and WorkPipe's internal API still requires the plugin's short-lived
  token.
- **The business's CEO agent runs on the agent runtime and isn't woken by tickets.** Production
  works tickets with coding-agent CLIs, which this image leaves out, so handed-off tickets wait on
  the board.

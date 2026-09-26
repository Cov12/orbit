# Agent runtime container

A slim image of the agent runtime: upstream Hermes Agent at `UPSTREAM_REF`, our two
patches, and the `mem0_local` memory provider. It runs one thing — Hermes' gateway with
only the OpenAI-compatible **API server** platform enabled.

```bash
apps/agent-runtime/build.sh            # -> orbit/agent-runtime:dev
apps/agent-runtime/build.sh --test     # + build the test target, run the patch tests

docker run -d --name agent-runtime \
  -p 127.0.0.1:8642:8642 \
  -v agent-runtime-data:/opt/data \
  -e HERMES_API_KEY="$(openssl rand -hex 32)" \
  -e ANTHROPIC_API_KEY=... \
  -e OPENAI_API_KEY=... \
  orbit/agent-runtime:dev

curl -s localhost:8642/health
curl -s localhost:8642/v1/models -H "Authorization: Bearer $HERMES_API_KEY"
```

## What `build.sh` does

1. Shallow-fetches exactly `UPSTREAM_REF` from `HERMES_UPSTREAM_REPO`
   (default: the upstream GitHub repo; a local clone path also works).
2. `git apply --check`, then `git apply`, each `patches/*.patch` in order. Any patch
   that doesn't apply stops the build with its name.
3. Copies `plugins/memory/mem0_local` into upstream's bundled `plugins/memory/`.
4. `docker build`s `docker/Dockerfile` (under `nice`), tagging `orbit/agent-runtime:dev`
   (`--tag` to change). With `--test` it also builds the `test` target and runs
   `tests/gateway/test_api_server.py` and `tests/tools/test_mcp_tool.py` in it, with no network.

| Variable | Default | |
|---|---|---|
| `HERMES_UPSTREAM_REPO` | `https://github.com/NousResearch/hermes-agent.git` | where to fetch upstream from |
| `BUILD_NICE` | `10` | `nice` level for `docker build` |
| `DOCKER_BUILD_ARGS` | — | extra `docker build` args, e.g. `--progress=plain` |

## Image

- `python:3.12-slim-bookworm`, multi-stage. Runtime deps are upstream's `uv.lock`
  (core + the `mcp` extra) plus `requirements-runtime.txt` (`aiohttp`, `anthropic`,
  `mem0ai`, `qdrant-client`). No Node, Playwright, s6-overlay or messaging adapters.
- Runs as the non-root user `hermes` (uid 10000) under `tini`. `/opt/hermes` (source) and
  `/opt/venv` are read-only for that user; runtime `pip` installs are disabled.
- State lives in the `/opt/data` volume (`HERMES_HOME`): generated config, sessions, logs,
  and the embedded Qdrant store (`/opt/data/mem0_local_qdrant`).
- Listens on `0.0.0.0:8642` inside the container; publish it to loopback or a private
  network only. `GET /health` is unauthenticated (used by the image's `HEALTHCHECK`).

## How it starts

`entrypoint.sh` maps the environment below onto Hermes, runs `render_config.py`, then
`exec hermes gateway run`:

- **Bearer.** Hermes' API server authenticates with `API_SERVER_KEY`
  (`Authorization: Bearer <key>`, compared in constant time; anything else gets `401`).
  The entrypoint sets it from `HERMES_API_KEY`, plus `API_SERVER_ENABLED=true`.
  Upstream refuses to start the API server without a key, and refuses placeholder or
  short (< 8 chars) keys when bound to a non-loopback address — which it is in a container.
- **`$HERMES_HOME/config.yaml`** — regenerated on every start (edits are overwritten):
  `model.provider` / `model.default`, `memory.provider: mem0_local`, Hermes' built-in
  file memory switched **off** (it is not tenant-scoped), the `session_search` toolset
  **disabled** (`agent.disabled_toolsets` — it searches every session with no tenant filter; see
  [finding 1](../../../evals/results/SUMMARY.md#findings)), an allowlist of toolsets for API-server
  sessions (`platform_toolsets.api_server`, below), `security.allow_lazy_installs: false`.
- **`$HERMES_HOME/mem0_local.json`** — `require_scope: true`, OpenAI embeddings, extraction
  LLM, Qdrant mode.
- **No secrets are written to the volume.** Keys stay in the process environment, where
  Hermes (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY`) and `mem0_local` read them.

Other commands pass through: `docker run --rm <image> version` runs `hermes version`
(config rendered first); `docker run --rm -it <image> sh` gets a shell.

## Environment variables

### Required

| Variable | |
|---|---|
| `HERMES_API_KEY` | Bearer token clients must send. Use a long random value (`openssl rand -hex 32`). |
| `ANTHROPIC_API_KEY` and/or `OPENAI_API_KEY` | At least one. Chooses the model provider (below). |

### Model

| Variable | Default | |
|---|---|---|
| `HERMES_PROVIDER` | auto | `anthropic` or `openai`. Auto = Anthropic if `ANTHROPIC_API_KEY` is set, else OpenAI. |
| `HERMES_MODEL` | `claude-sonnet-4-6` (anthropic) / `gpt-5.4` (openai) | Main model name, as the provider names it. |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Optional OpenAI-compatible endpoint (also used for mem0's LLM/embeddings defaults). |
| `ANTHROPIC_BASE_URL` | Anthropic API | Optional; read directly by Hermes and mem0. |

Hermes provider ids: `anthropic` → `anthropic`, `openai` → `openai-api`.

### Tools

| Variable | Default | |
|---|---|---|
| `HERMES_DISABLED_TOOLSETS` | — | Comma-separated toolsets to turn off in addition to `session_search`, which is always off. |
| `HERMES_API_TOOLSETS` | `todo` | Allowlist of toolsets for API-server sessions, which is how tenants reach the runtime. Keep host-reaching toolsets (`terminal`, `file`, `code_execution`, `browser`, `cronjob`, `delegation`, `skills`) off it: one runtime serves many tenants. |
| `PAPERCLIP_API_URL` | — | With `PAPERCLIP_API_KEY`, registers the orchestrator's MCP server (`paperclip`) and add it to the allowlist. |
| `PAPERCLIP_API_KEY` | — | Its API key. Referenced as `${PAPERCLIP_API_KEY}` in the config, so it stays in the environment. |
| `PAPERCLIP_MCP_SERVER` | `/opt/orbit/mcp/paperclip-mcp-server.mjs` | Path of the bundled MCP server (present in the demo image, which adds Node). |

### Memory (`mem0_local`)

| Variable | Default | |
|---|---|---|
| `OPENAI_API_KEY` | — | Embeddings key. **Without an embeddings key, memory is unavailable**: `POST /v1/memory/seed` returns `500 memory_seed_failed` with an explicit message; the rest of the API works. |
| `MEM0_LOCAL_EMBEDDER_API_KEY` | `OPENAI_API_KEY` | Separate key for embeddings, if they come from elsewhere. |
| `MEM0_EMBEDDER_BASE_URL` | `OPENAI_BASE_URL` or OpenAI | Any OpenAI-compatible embeddings endpoint. |
| `MEM0_EMBEDDER_MODEL` | `text-embedding-3-small` | |
| `MEM0_EMBEDDING_DIMS` | `1536` | Must match the embedder model. Changing it on an existing store needs a new collection. |
| `MEM0_LLM_PROVIDER` | `openai` if `OPENAI_API_KEY` is set, else the main provider | Fact-extraction LLM: `openai` or `anthropic`. Only used for inferred writes; seeds and `mem0_conclude` are stored verbatim. |
| `MEM0_LLM_MODEL` | `gpt-5-mini` / `claude-sonnet-4-6` | |
| `MEM0_LOCAL_OPENAI_API_KEY` | `OPENAI_API_KEY` | Key for an `openai` extraction LLM. |
| `MEM0_QDRANT_HOST` | — | Set to use an external Qdrant server: **one collection per company** (`<prefix><companyId>`), sub-account filtered by payload. Unset = embedded on-disk Qdrant in the volume (single collection, filtered by `companyId:subAccountId`). |
| `MEM0_QDRANT_PORT` | `6333` | |
| `MEM0_QDRANT_API_KEY` | — | |
| `MEM0_COLLECTION` | `orbit_memories` | Embedded-mode collection name. |
| `MEM0_COLLECTION_PREFIX` | `orbit_mem_` | Server-mode per-company collection prefix. |

`require_scope` is always on: a session without a tenant scope gets no memory rather than a
shared pool.

### Set by the image (override only if you know why)

| Variable | Value | |
|---|---|---|
| `HERMES_HOME`, `HOME` | `/opt/data` | Hermes state + config. |
| `API_SERVER_HOST` / `API_SERVER_PORT` | `0.0.0.0` / `8642` | Listen address inside the container. |
| `API_SERVER_CORS_ORIGINS` | — | Only if a browser calls the runtime directly (comma-separated). |
| `API_SERVER_MODEL_NAME` | `hermes-agent` | Model name advertised on `/v1/models`. |
| `MEM0_DIR` | `/opt/data/.mem0` | mem0's own state dir. |
| `MEM0_TELEMETRY` | `false` | mem0 telemetry off. |
| `HERMES_DISABLE_LAZY_INSTALLS` | `1` | Never `pip install` at runtime. |

## Known limits

- **Embedded Qdrant is single-process.** It's fine for one container; for anything
  concurrent or multi-replica, run Qdrant as a service and set `MEM0_QDRANT_HOST`.
- **Tools run inside the container.** The API server can dispatch agent tool calls
  (terminal, files); the container is the sandbox. Browser tools aren't installed.
- **Outbound network** is needed for the model provider and embeddings. Hermes also
  fetches its model catalogue at start-up.

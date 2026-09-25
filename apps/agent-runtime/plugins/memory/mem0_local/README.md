# mem0_local — Mem0 OSS, fully local

A fork of the bundled `mem0` provider that runs Mem0's **OSS** engine in-process
(`Memory.from_config`) instead of the Mem0 Platform cloud. All memory stays on the
box: local Ollama for fact extraction + embeddings, on-disk qdrant for storage.
Nothing is sent to app.mem0.ai. PostHog telemetry is forced off.

## Install (on the Hermes box)
Drop this directory at `~/.hermes/plugins/memory/mem0_local/`, then enable it:

```bash
# 1) deps (also auto-installed from plugin.yaml on enable):
PY=~/.hermes/hermes-agent/venv/bin/python
$PY -m pip install mem0ai ollama

# 2) enable the plugin (config.yaml: add to plugins.enabled)
hermes config set plugins.enabled '["mem0_local"]'   # or append if others exist

# 3) select it as the active memory provider
hermes memory setup mem0_local        # or: hermes config set memory.provider mem0_local
hermes memory status
```

## Config — `~/.hermes/mem0_local.json`
```json
{
  "llm_model": "qwen2.5:14b",
  "embedder_model": "nomic-embed-text",
  "embedding_dims": 768,
  "ollama_base_url": "http://localhost:11434",
  "collection_name": "orbit_memories",
  "agent_id": "hermes"
}
```
- **`embedding_dims` must match the embedder** — `nomic-embed-text` is **768** (not OpenAI's 1536). Wrong dims = qdrant insert/search errors.
- `llm_model` does fact extraction on every turn. `qwen2.5:14b` = better extraction; `qwen2.5:7b-instruct` = lighter/faster on CPU. Extraction is CPU-bound on the runtime host and can take tens of seconds — it runs in a **background thread** so the chat reply is never blocked.
- Qdrant data lives at `$HERMES_HOME/mem0_local_qdrant/` (on-disk, embedded, no server).

### Hosted backends (optional)
Ollama is the default for both extraction and embeddings. Either can instead use a hosted
API — this is how the [container](../../../docker/README.md) runs it:

```json
{
  "llm_provider": "openai",
  "llm_model": "gpt-5-mini",
  "openai_base_url": "https://api.openai.com/v1",
  "embedder_provider": "openai",
  "embedder_model": "text-embedding-3-small",
  "embedding_dims": 1536,
  "require_scope": true
}
```
- `llm_provider`: `ollama` | `openai` (any OpenAI-compatible endpoint; key from
  `MEM0_LOCAL_OPENAI_API_KEY`) | `anthropic` (key from `ANTHROPIC_API_KEY`).
- `embedder_provider`: `ollama` | `openai`. The key comes from `MEM0_LOCAL_EMBEDDER_API_KEY`,
  then `embedder_api_key`, then `OPENAI_API_KEY`; with none set, memory operations fail with
  an explicit error. `embedder_base_url` points it at another OpenAI-compatible endpoint.
- The `ollama` Python client is only required when a backend uses Ollama.
- `qdrant_mode: "server"` (+ `qdrant_host`/`qdrant_port`, API key via
  `MEM0_LOCAL_QDRANT_API_KEY`) switches to an external Qdrant with one collection per company.

## Tenant scoping
Memory is scoped by `user_id`. `initialize()` prefers a gateway-provided `user_id`,
so once the Orbit bridge feeds `companyId` as the Hermes session user, memory
partitions per company (brand separation). Single-tenant default until then.

## Tools
`mem0_search` (semantic), `mem0_profile` (all memories), `mem0_conclude` (store a
verbatim fact, no extraction — fast). Circuit breaker pauses calls after 5
consecutive failures for 120s.

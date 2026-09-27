"""mem0_local memory plugin — Mem0 OSS, fully local (no cloud).

A fork of the bundled `mem0` provider that swaps the Mem0 *Platform* cloud client
(`MemoryClient`, which calls app.mem0.ai) for Mem0's in-process **OSS** engine
(`Memory.from_config`) backed entirely by local infrastructure:

  - vector store : qdrant, on-disk under HERMES_HOME (no server, no network),
                   or an external Qdrant server (one collection per company)
  - LLM (extract): Ollama (local) by default — fact extraction / dedup on each
                   turn; or any OpenAI-compatible endpoint, or Anthropic
  - embedder     : Ollama (local) by default — nomic-embed-text (768-dim);
                   or OpenAI-compatible embeddings (e.g. text-embedding-3-small)

With the default (Ollama) backends client memory never leaves the box; with hosted
extraction/embeddings the text sent to those APIs does, but storage stays local
(or on your own Qdrant server). The three tools, circuit breaker,
and background prefetch/sync threads are unchanged from the bundled provider.

Config via $HERMES_HOME/mem0_local.json (or env), keys:
  llm_provider     (default: openai)     # openai | anthropic | ollama
  llm_model        (default: qwen2.5:14b)
  embedder_provider (default: ollama)    # ollama | openai
  embedder_model   (default: nomic-embed-text)
  embedding_dims   (default: 768)        # MUST match the embedder (nomic=768)
  ollama_base_url  (default: http://localhost:11434)
  collection_name  (default: orbit_memories)
  user_id          (default: hermes-user)  # gateway user_id (companyId) overrides
  agent_id         (default: hermes)
"""

from __future__ import annotations

import json
import logging
import os
import re
import threading
import time
from pathlib import Path
from typing import Any, Dict, List

from agent.memory_provider import MemoryProvider
from tools.registry import tool_error

logger = logging.getLogger(__name__)

# Mem0 OSS ships anonymous PostHog telemetry; force it off for the privacy posture.
os.environ.setdefault("MEM0_TELEMETRY", "false")

# Circuit breaker: after N consecutive failures, pause for COOLDOWN to avoid
# hammering a degraded local backend (e.g. Ollama mid-restart).
_BREAKER_THRESHOLD = 5
_BREAKER_COOLDOWN_SECS = 120

_DEFAULTS = {
    # Extraction LLM. "ollama" keeps it fully local (the default; slow on CPU);
    # "openai" uses any OpenAI-compatible endpoint (key from MEM0_LOCAL_OPENAI_API_KEY
    # or openai_api_key); "anthropic" uses the Anthropic API (key from ANTHROPIC_API_KEY).
    "llm_provider": "ollama",            # "ollama" (local) | "openai" | "anthropic"
    "llm_model": "qwen2.5:14b",          # openai: e.g. gpt-4.1-mini
    "openai_base_url": "https://api.openai.com/v1",
    "openai_api_key": "",
    # Embedder. "ollama" = local (default); "openai" = any OpenAI-compatible
    # embeddings endpoint (key: MEM0_LOCAL_EMBEDDER_API_KEY env, then the
    # embedder_api_key config value, then OPENAI_API_KEY env).
    "embedder_provider": "ollama",       # "ollama" | "openai"
    "embedder_model": "nomic-embed-text",
    "embedding_dims": 768,
    "embedder_base_url": "https://api.openai.com/v1",  # embedder_provider=openai only
    "embedder_api_key": "",
    "ollama_base_url": "http://localhost:11434",
    "collection_name": "orbit_memories",
    "user_id": "hermes-user",
    "agent_id": "hermes",
    "rerank": True,
    # Fail-closed switch (default off = current behavior). When on, a session
    # that provides NO explicit scope key (user_id / gateway_session_key) has
    # memory DISABLED rather than falling back to the shared "user_id" bucket.
    "require_scope": False,
    # External Qdrant / physical isolation (Phase 2.1, Option B). Default
    # "embedded" = current single-collection on-disk behavior; "server" points
    # at an external Qdrant and gives each company its OWN collection
    # (orbit_mem_<companyId>), with the sub-account still filtered by the user_id
    # payload. host/port/prefix are read from per-profile config so a self-hosted
    # instance resolves its own store with no cross-profile clash.
    "qdrant_mode": "embedded",  # "embedded" | "server"
    "qdrant_host": "127.0.0.1",
    "qdrant_port": 6333,
    "qdrant_api_key": "",
    "collection_prefix": "orbit_mem_",  # per-company collection name prefix
}


def _sanitize_collection(name: str) -> str:
    """Qdrant collection names allow [a-zA-Z0-9_-.]; company ids (uuid/cuid) are
    already safe, but coerce defensively and bound the length."""
    return re.sub(r"[^a-zA-Z0-9_.-]", "_", name)[:255]


def _default_hermes_home() -> str:
    """$HERMES_HOME (via hermes_constants), falling back to ~/.hermes. Callers
    that construct the provider directly (e.g. the memory-seed endpoint) don't
    pass hermes_home, so this must resolve the same home the agent uses."""
    try:
        from hermes_constants import get_hermes_home

        return str(get_hermes_home())
    except Exception:
        return os.path.expanduser("~/.hermes")


def _load_config() -> dict:
    """Defaults <- $HERMES_HOME/mem0_local.json <- a few env overrides."""
    from hermes_constants import get_hermes_home

    config = dict(_DEFAULTS)
    config_path = get_hermes_home() / "mem0_local.json"
    if config_path.exists():
        try:
            file_cfg = json.loads(config_path.read_text(encoding="utf-8"))
            config.update({k: v for k, v in file_cfg.items() if v is not None and v != ""})
        except Exception:
            pass
    # Optional env overrides (handy for ops without editing the json).
    for env_key, cfg_key in (
        ("MEM0_LOCAL_LLM_MODEL", "llm_model"),
        ("MEM0_LOCAL_EMBEDDER_MODEL", "embedder_model"),
        ("MEM0_LOCAL_OLLAMA_URL", "ollama_base_url"),
        # Secrets are better kept in env than in the json on disk.
        ("MEM0_LOCAL_QDRANT_API_KEY", "qdrant_api_key"),
    ):
        if os.environ.get(env_key):
            config[cfg_key] = os.environ[env_key]
    return config


# ---------------------------------------------------------------------------
# Tool schemas (identical to the bundled mem0 provider)
# ---------------------------------------------------------------------------

PROFILE_SCHEMA = {
    "name": "mem0_profile",
    "description": (
        "Retrieve all stored memories about the user/company — preferences, facts, "
        "project and relationship context. Fast, no reranking. Use at conversation start."
    ),
    "parameters": {"type": "object", "properties": {}, "required": []},
}

SEARCH_SCHEMA = {
    "name": "mem0_search",
    "description": (
        "Search memories by meaning. Returns relevant facts ranked by similarity. "
        "Set rerank=true for higher accuracy on important queries."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "query": {"type": "string", "description": "What to search for."},
            "rerank": {"type": "boolean", "description": "Enable reranking for precision (default: false)."},
            "top_k": {"type": "integer", "description": "Max results (default: 10, max: 50)."},
        },
        "required": ["query"],
    },
}

CONCLUDE_SCHEMA = {
    "name": "mem0_conclude",
    "description": (
        "Store a durable fact about the user/company. Stored verbatim (no LLM extraction). "
        "Use for explicit preferences, corrections, or decisions."
    ),
    "parameters": {
        "type": "object",
        "properties": {
            "conclusion": {"type": "string", "description": "The fact to store."},
        },
        "required": ["conclusion"],
    },
}


class Mem0LocalMemoryProvider(MemoryProvider):
    """Mem0 OSS memory with local Ollama extraction + local qdrant store."""

    def __init__(self):
        self._config = None
        self._client = None
        self._client_lock = threading.Lock()
        self._hermes_home = ""
        self._user_id = _DEFAULTS["user_id"]
        self._agent_id = _DEFAULTS["agent_id"]
        self._llm_provider = _DEFAULTS["llm_provider"]
        self._llm_model = _DEFAULTS["llm_model"]
        self._openai_base_url = _DEFAULTS["openai_base_url"]
        self._openai_api_key = _DEFAULTS["openai_api_key"]
        self._embedder_provider = _DEFAULTS["embedder_provider"]
        self._embedder_base_url = _DEFAULTS["embedder_base_url"]
        self._embedder_api_key = ""
        self._embedder_model = _DEFAULTS["embedder_model"]
        self._embedding_dims = _DEFAULTS["embedding_dims"]
        self._ollama_url = _DEFAULTS["ollama_base_url"]
        self._collection = _DEFAULTS["collection_name"]
        self._qdrant_mode = _DEFAULTS["qdrant_mode"]
        self._qdrant_host = _DEFAULTS["qdrant_host"]
        self._qdrant_port = _DEFAULTS["qdrant_port"]
        self._qdrant_api_key = _DEFAULTS["qdrant_api_key"]
        self._collection_prefix = _DEFAULTS["collection_prefix"]
        self._rerank = _DEFAULTS["rerank"]
        self._prefetch_result = ""
        self._prefetch_lock = threading.Lock()
        self._prefetch_thread = None
        self._sync_thread = None
        self._consecutive_failures = 0
        self._breaker_open_until = 0.0

    @property
    def name(self) -> str:
        return "mem0_local"

    def is_available(self) -> bool:
        # Available iff the OSS deps are importable. No network calls. The
        # ollama client is only required when a configured backend uses it.
        try:
            import mem0  # noqa: F401
        except Exception:
            return False
        try:
            cfg = _load_config()
        except Exception:
            cfg = dict(_DEFAULTS)
        if "ollama" in (str(cfg.get("llm_provider", "")).lower(), str(cfg.get("embedder_provider", "")).lower()):
            try:
                import ollama  # noqa: F401
            except Exception:
                return False
        return True

    def get_config_schema(self):
        return [
            {"key": "llm_model", "description": "Ollama model for fact extraction", "default": _DEFAULTS["llm_model"]},
            {"key": "embedder_model", "description": "Ollama embedding model", "default": _DEFAULTS["embedder_model"]},
            {"key": "embedding_dims", "description": "Embedding dimensions (nomic-embed-text=768)", "default": "768"},
            {"key": "ollama_base_url", "description": "Ollama base URL", "default": _DEFAULTS["ollama_base_url"]},
            {"key": "collection_name", "description": "Qdrant collection name", "default": _DEFAULTS["collection_name"]},
            {"key": "rerank", "description": "Enable reranking for recall", "default": "true", "choices": ["true", "false"]},
        ]

    def save_config(self, values, hermes_home):
        config_path = Path(hermes_home) / "mem0_local.json"
        existing = {}
        if config_path.exists():
            try:
                existing = json.loads(config_path.read_text())
            except Exception:
                pass
        existing.update(values)
        try:
            from utils import atomic_json_write
            atomic_json_write(config_path, existing, mode=0o600)
        except Exception:
            config_path.write_text(json.dumps(existing, indent=2))
            try:
                os.chmod(config_path, 0o600)
            except Exception:
                pass

    def initialize(self, session_id: str, **kwargs) -> None:
        self._config = _load_config()
        self._hermes_home = kwargs.get("hermes_home", "") or _default_hermes_home()
        # Memory scope (per-tenant partition key), in priority order:
        #  1. user_id            — platform user (gateway/Telegram sessions)
        #  2. gateway_session_key — the X-Hermes-Session-Key the Orbit bridge sets to
        #     companyId, so each company gets its own memory pool (brand separation)
        #  3. config default     — single-tenant / CLI fallback (fail-open)
        #
        # require_scope (config, default off): when on, a session with NO explicit
        # scope key does NOT fall back to the shared default bucket — memory is
        # disabled for that session (self._user_id = None) so tenant data is never
        # co-mingled into the shared "hermes-user" pool.
        explicit_scope = kwargs.get("user_id") or kwargs.get("gateway_session_key")
        require_scope = str(
            self._config.get("require_scope", _DEFAULTS["require_scope"])
        ).lower() in ("1", "true", "yes", "on")
        if explicit_scope:
            self._user_id = explicit_scope
        elif require_scope:
            self._user_id = None  # fail-closed: refuse rather than share
        else:
            self._user_id = self._config.get("user_id", _DEFAULTS["user_id"])
        self._agent_id = self._config.get("agent_id", _DEFAULTS["agent_id"])
        self._llm_provider = self._config.get("llm_provider", _DEFAULTS["llm_provider"])
        self._llm_model = self._config.get("llm_model", _DEFAULTS["llm_model"])
        self._openai_base_url = self._config.get("openai_base_url", _DEFAULTS["openai_base_url"])
        self._openai_api_key = (
            os.environ.get("MEM0_LOCAL_OPENAI_API_KEY")
            or self._config.get("openai_api_key", _DEFAULTS["openai_api_key"])
        )
        self._embedder_provider = str(
            self._config.get("embedder_provider", _DEFAULTS["embedder_provider"])
        ).lower()
        self._embedder_base_url = self._config.get("embedder_base_url", _DEFAULTS["embedder_base_url"])
        self._embedder_api_key = (
            os.environ.get("MEM0_LOCAL_EMBEDDER_API_KEY")
            or self._config.get("embedder_api_key")
            or os.environ.get("OPENAI_API_KEY")
            or ""
        )
        self._embedder_model = self._config.get("embedder_model", _DEFAULTS["embedder_model"])
        self._embedding_dims = int(self._config.get("embedding_dims", _DEFAULTS["embedding_dims"]))
        self._ollama_url = self._config.get("ollama_base_url", _DEFAULTS["ollama_base_url"])
        self._collection = self._config.get("collection_name", _DEFAULTS["collection_name"])
        # External-Qdrant / per-company isolation config (profile-scoped).
        self._qdrant_mode = str(self._config.get("qdrant_mode", _DEFAULTS["qdrant_mode"])).lower()
        self._qdrant_host = self._config.get("qdrant_host", _DEFAULTS["qdrant_host"])
        self._qdrant_port = int(self._config.get("qdrant_port", _DEFAULTS["qdrant_port"]))
        self._qdrant_api_key = self._config.get("qdrant_api_key", _DEFAULTS["qdrant_api_key"])
        self._collection_prefix = self._config.get("collection_prefix", _DEFAULTS["collection_prefix"])
        # Server mode = per-company physical isolation: one collection per company,
        # sub-account stays the user_id payload filter. Collection derives from the
        # company half of the scope key (companyId:subAccountId | companyId:_business).
        # Unscoped sessions (fail-closed) resolve no collection; their ops refuse.
        if self._qdrant_mode == "server" and self._user_id:
            self._collection = f"{self._collection_prefix}{_sanitize_collection(self._company_id())}"
        self._rerank = str(self._config.get("rerank", True)).lower() in ("1", "true", "yes", "on")
        # Observability: surface the resolved memory scope + everything the gateway
        # provided, so we can verify per-company partitioning (companyId -> user_id).
        try:
            if self._user_id:
                logger.info(
                    "mem0_local active: scope=%r mode=%s collection=%r",
                    self._user_id, self._qdrant_mode, self._collection,
                )
            else:
                logger.warning(
                    "mem0_local: no memory scope (user_id/gateway_session_key) and "
                    "require_scope=on -> memory DISABLED for this session."
                )
        except Exception:
            pass

    def _qdrant_path(self) -> str:
        base = self._hermes_home or _default_hermes_home()
        return str(Path(base) / "mem0_local_qdrant")

    def _company_id(self) -> str:
        """The company half of the scope key (companyId:subAccountId) — the
        physical-isolation boundary in server mode."""
        return (self._user_id or "").split(":", 1)[0]

    def _vector_store_config(self) -> dict:
        """Qdrant client config. server -> external host/port (one collection per
        company); embedded -> on-disk single collection (backward compatible)."""
        cfg = {
            "collection_name": self._collection,
            "embedding_model_dims": self._embedding_dims,
        }
        if self._qdrant_mode == "server":
            cfg["host"] = self._qdrant_host
            cfg["port"] = self._qdrant_port
            if self._qdrant_api_key:
                cfg["api_key"] = self._qdrant_api_key
        else:
            cfg["path"] = self._qdrant_path()
            cfg["on_disk"] = True
        return cfg

    def _build_llm_config(self) -> dict:
        # "openai" -> any OpenAI-compatible endpoint. "ollama" -> fully local.
        if self._llm_provider == "openai":
            return {
                "provider": "openai",
                "config": {
                    "model": self._llm_model,
                    "openai_base_url": self._openai_base_url,
                    "api_key": self._openai_api_key or "unused",
                },
            }
        if self._llm_provider == "anthropic":
            # Key comes from ANTHROPIC_API_KEY (read by mem0's Anthropic client).
            return {"provider": "anthropic", "config": {"model": self._llm_model}}
        return {
            "provider": "ollama",
            "config": {"model": self._llm_model, "ollama_base_url": self._ollama_url},
        }

    def _build_embedder_config(self) -> dict:
        if self._embedder_provider == "openai":
            if not self._embedder_api_key:
                raise RuntimeError(
                    "mem0_local: embedder_provider=openai but no embeddings API key is "
                    "configured (set OPENAI_API_KEY or MEM0_LOCAL_EMBEDDER_API_KEY)."
                )
            return {
                "provider": "openai",
                "config": {
                    "model": self._embedder_model,
                    "api_key": self._embedder_api_key,
                    "openai_base_url": self._embedder_base_url,
                    "embedding_dims": self._embedding_dims,
                },
            }
        return {
            "provider": "ollama",
            "config": {
                "model": self._embedder_model,
                "ollama_base_url": self._ollama_url,
                "embedding_dims": self._embedding_dims,
            },
        }

    def _build_oss_config(self) -> dict:
        cfg = {
            "vector_store": {
                "provider": "qdrant",
                "config": self._vector_store_config(),
            },
            "llm": self._build_llm_config(),
            "embedder": self._build_embedder_config(),
        }
        # Per-company history DB (mem0's SQLite change-log). Server mode partitions
        # it alongside the vectors so the "what changed, when" metadata isn't shared.
        if self._qdrant_mode == "server" and self._user_id:
            hist_dir = Path(self._hermes_home or _default_hermes_home()) / "mem0_history"
            try:
                hist_dir.mkdir(parents=True, exist_ok=True)
            except Exception:
                pass
            cfg["history_db_path"] = str(hist_dir / f"{_sanitize_collection(self._company_id())}.db")
        return cfg

    def _get_client(self):
        with self._client_lock:
            if self._client is not None:
                return self._client
            try:
                from mem0 import Memory
            except ImportError:
                raise RuntimeError("mem0 not installed. Run: pip install mem0ai ollama")
            self._client = Memory.from_config(self._build_oss_config())
            if self._qdrant_mode == "server":
                self._ensure_user_id_index()
            return self._client

    def _ensure_user_id_index(self) -> None:
        """Best-effort: add a tenant-optimized keyword index on user_id to this
        company's collection(s). mem0 auto-indexes agent_id/actor_id/run_id but NOT
        user_id — the field every read filters on — so new per-company collections
        would otherwise scan. Idempotent; silent if the collection/index already
        exists or the entities collection isn't created yet."""
        try:
            from qdrant_client import QdrantClient
            from qdrant_client.http import models as qm
            qc = QdrantClient(
                host=self._qdrant_host,
                port=self._qdrant_port,
                api_key=(self._qdrant_api_key or None),
            )
        except Exception:
            return
        for coll in (self._collection, f"{self._collection}_entities"):
            try:
                qc.create_payload_index(
                    collection_name=coll,
                    field_name="user_id",
                    field_schema=qm.KeywordIndexParams(
                        type=qm.KeywordIndexType.KEYWORD,
                        is_tenant=True,
                    ),
                    wait=False,
                )
            except Exception:
                try:
                    qc.create_payload_index(
                        collection_name=coll,
                        field_name="user_id",
                        field_schema=qm.PayloadSchemaType.KEYWORD,
                        wait=False,
                    )
                except Exception:
                    pass  # collection not present yet, or index already exists — both fine

    # -- circuit breaker -----------------------------------------------------

    def _is_breaker_open(self) -> bool:
        if self._consecutive_failures < _BREAKER_THRESHOLD:
            return False
        if time.monotonic() >= self._breaker_open_until:
            self._consecutive_failures = 0
            return False
        return True

    def _record_success(self):
        self._consecutive_failures = 0

    def _record_failure(self):
        self._consecutive_failures += 1
        if self._consecutive_failures >= _BREAKER_THRESHOLD:
            self._breaker_open_until = time.monotonic() + _BREAKER_COOLDOWN_SECS
            logger.warning(
                "mem0_local circuit breaker tripped after %d failures; pausing %ds.",
                self._consecutive_failures, _BREAKER_COOLDOWN_SECS,
            )

    # -- scoping -------------------------------------------------------------

    def _read_filters(self) -> Dict[str, Any]:
        return {"user_id": self._user_id}

    def _scoped(self) -> bool:
        """True iff this session resolved a real tenant scope. When fail-closed
        (require_scope) leaves it unset, every read/write refuses rather than
        touching the shared store."""
        return bool(self._user_id)

    @staticmethod
    def _unwrap_results(response: Any) -> list:
        if isinstance(response, dict):
            return response.get("results", [])
        if isinstance(response, list):
            return response
        return []

    # -- lifecycle -----------------------------------------------------------

    def system_prompt_block(self) -> str:
        if not self._scoped():
            return ""  # fail-closed: no scope -> memory inactive, advertise nothing
        return (
            "# Memory (mem0_local)\n"
            f"Active, local. Scope: {self._user_id}.\n"
            "Use mem0_search to find memories, mem0_conclude to store durable facts, "
            "mem0_profile for a full overview."
        )

    def prefetch(self, query: str, *, session_id: str = "") -> str:
        if self._prefetch_thread and self._prefetch_thread.is_alive():
            self._prefetch_thread.join(timeout=3.0)
        with self._prefetch_lock:
            result = self._prefetch_result
            self._prefetch_result = ""
        return f"## Memory\n{result}" if result else ""

    def queue_prefetch(self, query: str, *, session_id: str = "") -> None:
        if self._is_breaker_open() or not self._scoped():
            return

        def _run():
            try:
                client = self._get_client()
                results = self._unwrap_results(
                    client.search(query=query, filters=self._read_filters(), rerank=self._rerank, top_k=5)
                )
                if results:
                    lines = [r.get("memory", "") for r in results if r.get("memory")]
                    with self._prefetch_lock:
                        self._prefetch_result = "\n".join(f"- {l}" for l in lines)
                self._record_success()
            except Exception as e:
                self._record_failure()
                logger.debug("mem0_local prefetch failed: %s", e)

        self._prefetch_thread = threading.Thread(target=_run, daemon=True, name="mem0local-prefetch")
        self._prefetch_thread.start()

    def sync_turn(self, user_content: str, assistant_content: str, *, session_id: str = "", **kwargs) -> None:
        """Extract+store facts from the turn via the local LLM (non-blocking)."""
        if self._is_breaker_open() or not self._scoped():
            return

        def _sync():
            try:
                client = self._get_client()
                messages = [
                    {"role": "user", "content": user_content},
                    {"role": "assistant", "content": assistant_content},
                ]
                client.add(messages, user_id=self._user_id, agent_id=self._agent_id)
                self._record_success()
            except Exception as e:
                self._record_failure()
                logger.warning("mem0_local sync failed: %s", e)

        # Local extraction is slow (CPU LLM); wait briefly for the prior sync so
        # writes don't pile up, then run in the background.
        if self._sync_thread and self._sync_thread.is_alive():
            self._sync_thread.join(timeout=5.0)
        self._sync_thread = threading.Thread(target=_sync, daemon=True, name="mem0local-sync")
        self._sync_thread.start()

    def get_tool_schemas(self) -> List[Dict[str, Any]]:
        return [PROFILE_SCHEMA, SEARCH_SCHEMA, CONCLUDE_SCHEMA]

    def handle_tool_call(self, tool_name: str, args: dict, **kwargs) -> str:
        if not self._scoped():
            return json.dumps({"error": "Memory unavailable: this session has no tenant scope (require_scope is on and no user_id/session key was provided)."})
        if self._is_breaker_open():
            return json.dumps({"error": "Memory temporarily unavailable (consecutive failures). Will retry automatically."})
        try:
            client = self._get_client()
        except Exception as e:
            return tool_error(str(e))

        if tool_name == "mem0_profile":
            try:
                memories = self._unwrap_results(client.get_all(filters=self._read_filters()))
                self._record_success()
                if not memories:
                    return json.dumps({"result": "No memories stored yet."})
                lines = [m.get("memory", "") for m in memories if m.get("memory")]
                return json.dumps({"result": "\n".join(lines), "count": len(lines)})
            except Exception as e:
                self._record_failure()
                return tool_error(f"Failed to fetch profile: {e}")

        elif tool_name == "mem0_search":
            query = args.get("query", "")
            if not query:
                return tool_error("Missing required parameter: query")
            rerank = bool(args.get("rerank", False))
            top_k = min(int(args.get("top_k", 10)), 50)
            try:
                results = self._unwrap_results(
                    client.search(query=query, filters=self._read_filters(), rerank=rerank, top_k=top_k)
                )
                self._record_success()
                if not results:
                    return json.dumps({"result": "No relevant memories found."})
                items = [{"memory": r.get("memory", ""), "score": r.get("score", 0)} for r in results]
                return json.dumps({"results": items, "count": len(items)})
            except Exception as e:
                self._record_failure()
                return tool_error(f"Search failed: {e}")

        elif tool_name == "mem0_conclude":
            conclusion = args.get("conclusion", "")
            if not conclusion:
                return tool_error("Missing required parameter: conclusion")
            try:
                # infer=False -> store verbatim, no LLM extraction (fast).
                client.add(
                    [{"role": "user", "content": conclusion}],
                    user_id=self._user_id,
                    agent_id=self._agent_id,
                    infer=False,
                )
                self._record_success()
                return json.dumps({"result": "Fact stored."})
            except Exception as e:
                self._record_failure()
                return tool_error(f"Failed to store: {e}")

        return tool_error(f"Unknown tool: {tool_name}")

    def shutdown(self) -> None:
        for t in (self._prefetch_thread, self._sync_thread):
            if t and t.is_alive():
                t.join(timeout=5.0)
        with self._client_lock:
            self._client = None


def register(ctx) -> None:
    """Register mem0_local as a memory provider plugin."""
    ctx.register_memory_provider(Mem0LocalMemoryProvider())

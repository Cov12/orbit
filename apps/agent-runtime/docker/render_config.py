"""Render Hermes config for the container from environment variables.

Writes two files into $HERMES_HOME (the /opt/data volume), regenerated on every
start so the environment stays the single source of truth:

  config.yaml       model/provider, memory provider, safety switches
  mem0_local.json   mem0_local memory-provider settings

No secrets are written to disk: the API bearer, provider keys and embedding keys
stay in the process environment, where Hermes and mem0_local read them.

Exit status 64 on a configuration error (message on stderr).
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

import yaml

# Hermes provider id + default model per provider family.
PROVIDERS = {
    "anthropic": {"hermes_id": "anthropic", "key_env": "ANTHROPIC_API_KEY", "model": "claude-sonnet-4-6"},
    "openai": {"hermes_id": "openai-api", "key_env": "OPENAI_API_KEY", "model": "gpt-5.4"},
}
# mem0 fact-extraction model defaults (mem0's own defaults for each backend).
MEM0_LLM_DEFAULTS = {"openai": "gpt-5-mini", "anthropic": "claude-sonnet-4-6"}


def env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or "").strip() or default


def fail(msg: str) -> None:
    print(f"render_config: {msg}", file=sys.stderr)
    sys.exit(64)


def choose_provider() -> str:
    requested = env("HERMES_PROVIDER").lower()
    if requested:
        if requested not in PROVIDERS:
            fail(f"HERMES_PROVIDER must be one of {sorted(PROVIDERS)}, got {requested!r}")
        if not env(PROVIDERS[requested]["key_env"]):
            fail(f"HERMES_PROVIDER={requested} but {PROVIDERS[requested]['key_env']} is not set")
        return requested
    for name in ("anthropic", "openai"):  # Anthropic preferred when both are present
        if env(PROVIDERS[name]["key_env"]):
            return name
    fail("no model provider key: set ANTHROPIC_API_KEY or OPENAI_API_KEY")
    raise AssertionError  # unreachable


def int_env(name: str, default: int) -> int:
    raw = env(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        fail(f"{name} must be an integer, got {raw!r}")
        raise AssertionError  # unreachable


def main() -> None:
    home = Path(env("HERMES_HOME", "/opt/data"))
    home.mkdir(parents=True, exist_ok=True)

    provider = choose_provider()
    spec = PROVIDERS[provider]
    model = env("HERMES_MODEL", spec["model"])

    config = {
        "model": {"default": model, "provider": spec["hermes_id"]},
        "memory": {
            # External provider: tenant-scoped mem0_local (see mem0_local.json).
            "provider": "mem0_local",
            # Hermes' built-in file memory (MEMORY.md / USER.md under HERMES_HOME)
            # is not tenant-scoped; one runtime serves many tenants, so keep it
            # off and let mem0_local's require_scope decide what is remembered.
            "memory_enabled": False,
            "user_profile_enabled": False,
        },
        # The venv is read-only for the runtime user; never pip-install at runtime.
        "security": {"allow_lazy_installs": False},
    }

    have_openai = bool(env("OPENAI_API_KEY"))
    mem0_llm = env("MEM0_LLM_PROVIDER", "openai" if have_openai else provider).lower()
    if mem0_llm not in MEM0_LLM_DEFAULTS:
        fail(f"MEM0_LLM_PROVIDER must be one of {sorted(MEM0_LLM_DEFAULTS)}, got {mem0_llm!r}")

    mem0 = {
        "require_scope": True,  # no tenant scope -> no memory, never a shared pool
        "collection_name": env("MEM0_COLLECTION", "orbit_memories"),
        "collection_prefix": env("MEM0_COLLECTION_PREFIX", "orbit_mem_"),
        # Embeddings: OpenAI-compatible endpoint. Key is read from env by the
        # plugin (MEM0_LOCAL_EMBEDDER_API_KEY, else OPENAI_API_KEY); without one,
        # memory operations fail with an explicit error instead of hanging.
        "embedder_provider": "openai",
        "embedder_model": env("MEM0_EMBEDDER_MODEL", "text-embedding-3-small"),
        "embedding_dims": int_env("MEM0_EMBEDDING_DIMS", 1536),
        "embedder_base_url": env("MEM0_EMBEDDER_BASE_URL", env("OPENAI_BASE_URL", "https://api.openai.com/v1")),
        # Fact-extraction LLM (only used for inferred writes; seeds and
        # mem0_conclude store verbatim).
        "llm_provider": mem0_llm,
        "llm_model": env("MEM0_LLM_MODEL", MEM0_LLM_DEFAULTS[mem0_llm]),
        "openai_base_url": env("OPENAI_BASE_URL", "https://api.openai.com/v1"),
        # Storage: embedded on-disk Qdrant under $HERMES_HOME/mem0_local_qdrant
        # (single collection, sub-account filter), or an external Qdrant server
        # (one collection per company) when MEM0_QDRANT_HOST is set.
        "qdrant_mode": "server" if env("MEM0_QDRANT_HOST") else "embedded",
    }
    if mem0["qdrant_mode"] == "server":
        mem0["qdrant_host"] = env("MEM0_QDRANT_HOST")
        mem0["qdrant_port"] = int_env("MEM0_QDRANT_PORT", 6333)

    with open(home / "config.yaml", "w", encoding="utf-8") as fh:
        fh.write("# Generated at container start by /opt/orbit/render_config.py -- edits are overwritten.\n")
        yaml.safe_dump(config, fh, sort_keys=False)
    with open(home / "mem0_local.json", "w", encoding="utf-8") as fh:
        json.dump(mem0, fh, indent=2)
        fh.write("\n")

    print(
        f"render_config: provider={spec['hermes_id']} model={model} memory=mem0_local "
        f"(require_scope, qdrant={mem0['qdrant_mode']}, embedder={mem0['embedder_model']}, "
        f"embeddings_key={'set' if (have_openai or env('MEM0_LOCAL_EMBEDDER_API_KEY')) else 'MISSING'})",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()

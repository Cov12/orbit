#!/bin/sh
# Container entrypoint (runs under tini as the non-root `hermes` user).
#
#   <image>                      -> hermes gateway run   (API server on :8642)
#   <image> <hermes subcommand>  -> hermes <subcommand>  (config rendered first)
#   <image> <executable> ...     -> exec it as-is        (sh, python, ...)
#
# See docker/README.md for every environment variable.
set -eu

if [ "$#" -gt 0 ] && [ "$1" != "gateway" ] && command -v "$1" >/dev/null 2>&1; then
    exec "$@"
fi

# The API server's bearer. Hermes reads API_SERVER_KEY; HERMES_API_KEY is our
# public name for it. Required: upstream refuses to start the API server
# without a key, and rejects placeholder values when bound beyond loopback.
API_SERVER_KEY="${HERMES_API_KEY:-${API_SERVER_KEY:-}}"
if [ -z "$API_SERVER_KEY" ]; then
    echo "entrypoint: HERMES_API_KEY is required (the bearer token clients must send)" >&2
    exit 64
fi
export API_SERVER_KEY
export API_SERVER_ENABLED=true

# mem0_local reads its extraction-LLM key from MEM0_LOCAL_OPENAI_API_KEY.
if [ -n "${OPENAI_API_KEY:-}" ] && [ -z "${MEM0_LOCAL_OPENAI_API_KEY:-}" ]; then
    export MEM0_LOCAL_OPENAI_API_KEY="$OPENAI_API_KEY"
fi
# Qdrant server API key, if any, stays in env (mem0_local reads it from there).
if [ -n "${MEM0_QDRANT_API_KEY:-}" ]; then
    export MEM0_LOCAL_QDRANT_API_KEY="$MEM0_QDRANT_API_KEY"
fi

python /opt/orbit/render_config.py

if [ "$#" -eq 0 ]; then
    set -- gateway run
fi
exec hermes "$@"

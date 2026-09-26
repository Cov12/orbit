#!/usr/bin/env bash
# Build every demo image, one at a time (the box is shared), in dependency order:
# the runtime demo image layers on the base runtime image and Conductor's bundled MCP server.
#   demo/build.sh              everything
#   demo/build.sh portal atrium   just these compose services
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
services=("$@")
if [[ ${#services[@]} -eq 0 ]]; then
  services=(portal workpipe drive conductor conductor-mcp runtime-base runtime atrium)
fi

for s in "${services[@]}"; do
  echo "== build $s"
  case "$s" in
    runtime-base) "$here/../apps/agent-runtime/build.sh" ;;
    *) "$here/up.sh" --profile build build "$s" ;;
  esac
done

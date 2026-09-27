#!/usr/bin/env bash
# Return the demo to its seeded state: drop every volume (databases, workspace, memory,
# orchestrator data), start fresh, and seed again. Images are kept, so this takes minutes.
# The shared sign-in survives (it lives in Clerk); its published password is restored.
# Files visitors uploaded to object storage are not removed here.
#   demo/reset.sh            reset, with the tunnel running afterwards
#   demo/reset.sh --private  reset without starting the tunnel (the account seed is skipped,
#                            since it needs Portal's public URL)
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
public=true; [[ "${1:-}" == --private ]] && public=false

"$here/up.sh" --profile public down -v --remove-orphans
if $public; then
  "$here/up.sh" --profile public up -d --no-build
else
  "$here/up.sh" up -d --no-build
fi
"$here/seed.sh"
if $public; then
  for _ in $(seq 1 30); do   # the tunnel needs a moment to register
    curl -sf -o /dev/null --max-time 5 "https://${ORBIT_DEMO_DOMAIN:-orbit-app.site}/" && break; sleep 5
  done
  "$here/seed-demo-account.sh"
  # Record whether the demo came back healthy; a failure here doesn't undo the reset.
  "$here/smoke.sh" || echo "reset: smoke test FAILED"
fi
echo "reset: done ($(date -u +%FT%TZ))"

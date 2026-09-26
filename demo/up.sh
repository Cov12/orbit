#!/usr/bin/env bash
# Run docker compose for the demo stack with its env files.
#   demo/up.sh up -d            start (builds images on first run)
#   demo/up.sh build portal     rebuild one service
#   demo/up.sh logs -f portal
# Env files live outside the repo, in $ORBIT_SECRETS (default ~/showcase/.secrets):
#   demo.env        generated secrets (see demo/README.md)
#   clerk.env       NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY, CLERK_SECRET_KEY
#   r2.env          R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT, R2_BUCKET
#   anthropic.env   ANTHROPIC_API_KEY
#   openai.env      OPENAI_API_KEY (memory embeddings)
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
secrets=${ORBIT_SECRETS:-$HOME/showcase/.secrets}
export ORBIT_DEMO_DOMAIN=${ORBIT_DEMO_DOMAIN:-orbit-app.site}

args=()
for f in demo clerk r2 anthropic openai; do
  [[ -r "$secrets/$f.env" ]] || { echo "up.sh: missing $secrets/$f.env" >&2; exit 64; }
  args+=(--env-file "$secrets/$f.env")
done

# Builds share this box with other workloads: keep them polite.
exec nice -n 10 docker compose -f "$here/compose.yaml" "${args[@]}" "$@"

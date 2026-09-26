#!/usr/bin/env bash
# Seed the demo stack so it works with no manual setup. Safe to re-run: every step looks
# for what it would create first.
#
#   Conductor  a service admin and its API key (used only by the runtime's MCP client),
#              a platform company holding the assistant template agent, the WorkPipe
#              signing secret, and both plugins installed and configured
#   Portal     the platform super-admin (password sign-in at /admin)
#
# Values the other services need are written to $ORBIT_SECRETS/demo-seed.env (mode 600),
# which demo/up.sh loads; the affected services are then recreated to pick them up.
# Tenants need nothing pre-created: Conductor provisions a company, its CEO and the
# tenant's assistant on the first launch from Portal.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
repo=$(cd "$here/.." && pwd)
secrets=${ORBIT_SECRETS:-$HOME/showcase/.secrets}
seed_env="$secrets/demo-seed.env"
conductor=${ORBIT_CONDUCTOR_LOCAL:-http://127.0.0.1:15103}

# shellcheck disable=SC1090
set -a; source "$secrets/demo.env"; [[ -r "$seed_env" ]] && source "$seed_env"; set +a

log() { printf '  %s\n' "$*"; }
psql_c() { docker exec -i orbit-demo-db-1 psql -v ON_ERROR_STOP=1 -U orbit -d conductor -tAq "$@"; }
psql_p() { docker exec -i orbit-demo-db-1 psql -v ON_ERROR_STOP=1 -U orbit -d portal -tAq "$@"; }
save() {  # save KEY VALUE into demo-seed.env
  (umask 077; touch "$seed_env")
  grep -v "^$1=" "$seed_env" > "$seed_env.tmp" || true
  printf '%s=%s\n' "$1" "$2" >> "$seed_env.tmp"
  mv "$seed_env.tmp" "$seed_env"; chmod 600 "$seed_env"
  export "$1=$2"
}
api() {  # api METHOD PATH [JSON]  -> response body; fails on non-2xx
  local out code
  out=$(mktemp)
  code=$(curl -sS -o "$out" -w '%{http_code}' -X "$1" "$conductor$2" \
    -H "Authorization: Bearer $ORBIT_BOARD_API_KEY" -H 'Content-Type: application/json' \
    ${3:+--data "$3"})
  if [[ "$code" != 2* ]]; then echo "seed: $1 $2 -> $code: $(head -c 400 "$out")" >&2; rm -f "$out"; exit 1; fi
  cat "$out"; rm -f "$out"
}
# pick FIELD MATCH_FIELD MATCH_VALUE: read a JSON array (or {data|items:[...]}) on stdin,
# print FIELD of the first element whose MATCH_FIELD equals MATCH_VALUE.
pick() { python3 -c '
import json,sys
d=json.load(sys.stdin)
if isinstance(d,dict): d=d.get("data") or d.get("items") or d.get("plugins") or d.get("companies") or []
for o in d:
    if str(o.get(sys.argv[2]))==sys.argv[3]: print(o.get(sys.argv[1])); break
' "$@"; }
field() { python3 -c 'import json,sys; print(json.load(sys.stdin)[sys.argv[1]])' "$1"; }

echo "== waiting for Conductor"
for _ in $(seq 1 60); do curl -sf -o /dev/null "$conductor/api/health" && break; sleep 2; done

echo "== Conductor service admin + API key"
psql_c <<'SQL'
INSERT INTO "user"(id, name, email, email_verified, created_at, updated_at)
VALUES ('orbit-seed-admin', 'Platform service', 'service@orbit.example', true, now(), now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO instance_user_roles(user_id, role)
SELECT 'orbit-seed-admin', 'instance_admin'
WHERE NOT EXISTS (SELECT 1 FROM instance_user_roles WHERE user_id = 'orbit-seed-admin' AND role = 'instance_admin');
SQL
if [[ -z "${ORBIT_BOARD_API_KEY:-}" ]]; then
  save ORBIT_BOARD_API_KEY "pcp_board_$(openssl rand -hex 24)"
fi
# Store only the hash; revoke any other key with this name so exactly one is live.
psql_c -v key="$ORBIT_BOARD_API_KEY" <<'SQL'
UPDATE board_api_keys SET revoked_at = now()
 WHERE name = 'runtime-mcp' AND revoked_at IS NULL AND key_hash <> encode(sha256(convert_to(:'key', 'UTF8')), 'hex');
INSERT INTO board_api_keys(user_id, name, key_hash)
SELECT 'orbit-seed-admin', 'runtime-mcp', encode(sha256(convert_to(:'key', 'UTF8')), 'hex')
WHERE NOT EXISTS (SELECT 1 FROM board_api_keys
                   WHERE key_hash = encode(sha256(convert_to(:'key', 'UTF8')), 'hex') AND revoked_at IS NULL);
SQL
log "key: set (runtime-mcp)"

echo "== platform company"
company=$(api GET /api/companies | pick id name "Orbit Platform")
if [[ -z "$company" || "$company" == None ]]; then
  company=$(api POST /api/companies '{"name":"Orbit Platform"}' | field id)
fi
log "company: $company"

echo "== WorkPipe signing secret (for the WorkPipe tools plugin)"
secret=$(api GET "/api/companies/$company/secrets" | pick id name workpipe-jwt)
if [[ -z "$secret" || "$secret" == None ]]; then
  secret=$(api POST "/api/companies/$company/secrets" \
    "$(python3 -c 'import json,os; print(json.dumps({"name":"workpipe-jwt","value":os.environ["ORBIT_JWT_SECRET"]}))')" | field id)
fi
log "secret: $secret"

echo "== plugins"
# The plugin host refuses private addresses (SSRF guard), so the WorkPipe tools reach WorkPipe
# at its public URL, as they do in production; its internal API still requires their token.
install_plugin() {  # install_plugin KEY DIR -> id
  local id
  id=$(api GET /api/plugins | pick id pluginKey "$1")
  [[ -z "$id" || "$id" == None ]] && id=$(api GET /api/plugins | pick id key "$1")
  if [[ -z "$id" || "$id" == None ]]; then
    id=$(api POST /api/plugins/install "{\"packageName\":\"/app/packages/plugins/$2\",\"isLocalPath\":true}" | field id)
  fi
  echo "$id"
}
bridge=$(install_plugin paperclipai.plugin-orbit-atrium paperclip-plugin-orbit-atrium)
tools=$(install_plugin orbit.workpipe-tools paperclip-plugin-orbit-workpipe-tools)
api POST "/api/plugins/$bridge/config" \
  "$(python3 -c 'import json,os; print(json.dumps({"configJson":{"sharedSecret":os.environ["ORBIT_BRIDGE_SECRET"]}}))')" >/dev/null
api POST "/api/plugins/$tools/config" \
  "{\"configJson\":{\"jwtSecretRef\":\"$secret\",\"portalOrgId\":\"per-company\",\"workpipeBaseUrl\":\"https://workpipe.${ORBIT_DEMO_DOMAIN:-orbit-app.site}\"}}" >/dev/null
save ORBIT_BRIDGE_PLUGIN_ID "$bridge"
log "bridge: $bridge  tools: $tools"

echo "== assistant template agent"
agent=$(api GET "/api/companies/$company/agents" | pick id name "Orbit Assistant")
persona="$repo/apps/conductor/personas/orbit-assistant.v1.md"
body=$(python3 - "$persona" <<'PY'
import json,sys
text=open(sys.argv[1],encoding="utf-8").read()
prompt=text.split("\n---\n",1)[1].strip() if "\n---\n" in text else text.strip()
print(json.dumps({"name":"Orbit Assistant","role":"general","adapterType":"hermes_openai",
  "adapterConfig":{"url":"http://runtime:8642/v1/chat/completions","model":"hermes-agent",
                   "apiKeyEnv":"HERMES_API_KEY","timeoutSec":120,"systemPrompt":prompt},
  "metadata":{}}))
PY
)
if [[ -z "$agent" || "$agent" == None ]]; then
  agent=$(api POST "/api/companies/$company/agents" "$body" | field id)
fi
save ORBIT_TEMPLATE_AGENT_ID "$agent"
log "template agent: $agent"

echo "== Portal super-admin"
if [[ -z "${ORBIT_PORTAL_ADMIN_PASSWORD:-}" ]]; then
  save ORBIT_PORTAL_ADMIN_PASSWORD "$(openssl rand -base64 24 | tr -d '/+=')"
fi
hash=$(docker exec -e PW="$ORBIT_PORTAL_ADMIN_PASSWORD" orbit-demo-portal-1 \
  node -e "console.log(require('bcryptjs').hashSync(process.env.PW,12))")
psql_p -v h="$hash" <<'SQL'
INSERT INTO "SuperAdmin"(id, email, "passwordHash", name, "createdAt", "updatedAt")
VALUES ('orbit-super-admin', 'admin@orbit.example', :'h', 'Platform Admin', now(), now())
ON CONFLICT (email) DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "updatedAt" = now();
SQL
log "super-admin: admin@orbit.example"

echo "== restarting services that read seeded values"
"$here/up.sh" up -d --no-build conductor runtime atrium >/dev/null 2>&1
echo "seed: done"

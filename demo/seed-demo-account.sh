#!/usr/bin/env bash
# Seed the shared demo account: one sign-in, one fictional business with one location, and
# enough CRM data for the assistant to answer questions about. Run after demo/seed.sh and
# after the tunnel is up (WorkPipe and Atrium fetch sub-accounts from Portal's public URL).
# Safe to re-run.
#
#   Clerk      the demo user exists and has the published password (a visitor may change it)
#   Portal     the business, its owner membership and its one sub-account
#   apps       each app's own first-launch provisioning, driven by a launch token signed
#              the way Portal signs it, so nothing is hand-built in their databases
#   Atrium     onboarding completed (which also writes the business profile to memory)
#   Conductor  the business's assistant provisioned ahead of the first chat
#   WorkPipe   a sales pipeline, deals and contacts
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
secrets=${ORBIT_SECRETS:-$HOME/showcase/.secrets}
domain=${ORBIT_DEMO_DOMAIN:-orbit-app.site}
# shellcheck disable=SC1090
set -a; for f in demo clerk demo-seed; do source "$secrets/$f.env"; done; set +a

ORG_ID=cdemoharborsupply0000001
ORG_NAME="Harbor Supply Co."
ORG_SLUG=harbor-supply
ORG_INDUSTRY="E-commerce & Retail"
SUB_ID=cdemosubwarehouse0000001
SUB_NAME="Main Warehouse"
EMAIL=${ORBIT_DEMO_EMAIL:-demo+clerk_test@orbit-app.site}

log() { printf '  %s\n' "$*"; }
psql_db() { local db=$1; shift; docker exec -i orbit-demo-db-1 psql -v ON_ERROR_STOP=1 -U orbit -d "$db" -tAq "$@"; }
clerk() {  # clerk METHOD PATH [JSON]
  curl -sS -f -X "$1" "https://api.clerk.com/v1$2" -H "Authorization: Bearer $CLERK_SECRET_KEY" \
    -H 'Content-Type: application/json' ${3:+--data "$3"}
}

echo "== Clerk demo user"
[[ -n "${ORBIT_DEMO_PASSWORD:-}" ]] || { echo "seed: ORBIT_DEMO_PASSWORD missing from demo-seed.env" >&2; exit 64; }
user_id=$(clerk GET "/users?email_address=$(python3 -c 'import sys,urllib.parse;print(urllib.parse.quote(sys.argv[1]))' "$EMAIL")" \
  | python3 -c 'import json,sys; d=json.load(sys.stdin); print(d[0]["id"] if d else "")')
body=$(python3 -c 'import json,os,sys; print(json.dumps({"password":os.environ["ORBIT_DEMO_PASSWORD"],"first_name":"Demo","last_name":"Reviewer","skip_password_checks":True}))')
if [[ -z "$user_id" ]]; then
  user_id=$(clerk POST /users "$(python3 -c 'import json,sys; b=json.loads(sys.argv[1]); b["email_address"]=[sys.argv[2]]; print(json.dumps(b))' "$body" "$EMAIL")" \
    | python3 -c 'import json,sys; print(json.load(sys.stdin)["id"])')
  log "created"
else
  clerk PATCH "/users/$user_id" "$body" >/dev/null   # restore the published password and name
  log "reset password and name"
fi

echo "== Portal business"
psql_db portal -v org="$ORG_ID" -v name="$ORG_NAME" -v slug="$ORG_SLUG" -v ind="$ORG_INDUSTRY" \
  -v sub="$SUB_ID" -v subname="$SUB_NAME" -v uid="$user_id" -v email="$EMAIL" <<'SQL'
INSERT INTO "Organization"(id, name, slug, industry, licensed, "updatedAt")
VALUES (:'org', :'name', :'slug', :'ind', true, now())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, industry = EXCLUDED.industry, licensed = true, "updatedAt" = now();
INSERT INTO "Member"(id, "clerkUserId", email, name, "orgId", role, "updatedAt")
VALUES ('cdemomember0000000000001', :'uid', :'email', 'Demo Reviewer', :'org', 'OWNER', now())
ON CONFLICT (id) DO UPDATE SET "clerkUserId" = EXCLUDED."clerkUserId", role = 'OWNER', "updatedAt" = now();
INSERT INTO "SubAccount"(id, "orgId", name, slug, "updatedAt")
VALUES (:'sub', :'org', :'subname', 'main-warehouse', now())
ON CONFLICT (id) DO UPDATE SET status = 'ACTIVE', "updatedAt" = now();
SQL
log "$ORG_NAME / $SUB_NAME"

# A launch token with the same claims Portal puts in one (src/lib/jwt.ts, api/auth/token).
token=$(USER_ID="$user_id" EMAIL="$EMAIL" ORG_ID="$ORG_ID" ORG_NAME="$ORG_NAME" ORG_SLUG="$ORG_SLUG" \
  ORG_INDUSTRY="$ORG_INDUSTRY" SUB_ID="$SUB_ID" python3 - <<'PY'
import base64, hashlib, hmac, json, os, time
def b64(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
now = int(time.time()); e = os.environ
claims = {"sub": e["USER_ID"], "email": e["EMAIL"], "name": "Demo Reviewer",
          "org_id": e["ORG_ID"], "org_slug": e["ORG_SLUG"], "org_name": e["ORG_NAME"],
          "org_logo": None, "org_industry": e["ORG_INDUSTRY"], "sub_account_id": e["SUB_ID"],
          "role": "OWNER", "subscriptions": [{"plan": "ENTERPRISE", "status": "ACTIVE"}],
          "app_access": ["ATRIUM", "CONDUCTOR", "DRIVE", "WORKPIPE"], "iat": now, "exp": now + 300}
head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()); body = b64(json.dumps(claims).encode())
sig = hmac.new(e["ORBIT_JWT_SECRET"].encode(), f"{head}.{body}".encode(), hashlib.sha256).digest()
print(f"{head}.{body}.{b64(sig)}")
PY
)

echo "== Portal reachable at its public URL (the apps fetch sub-accounts from it)"
subs=$(curl -sS --max-time 15 "https://$domain/api/subaccounts" -H "Authorization: Bearer $token" || true)
grep -q "$SUB_ID" <<<"$subs" || { echo "seed: https://$domain/api/subaccounts did not return the sub-account; is the tunnel up?" >&2; exit 1; }
log "ok"

callback() {  # callback NAME URL -> response headers
  local headers code
  headers=$(curl -sS -D - -o /dev/null --max-time 60 "$2?token=$token")
  code=$(awk 'NR==1{print $2}' <<<"$headers")
  [[ "$code" == 30* ]] || { echo "seed: $1 callback -> $code" >&2; exit 1; }
  log "$1: $code" >&2
  printf '%s' "$headers"
}
echo "== first launch of each app"
callback workpipe  http://127.0.0.1:15101/auth/callback >/dev/null
callback conductor http://127.0.0.1:15103/conductor/auth/callback >/dev/null
atrium_headers=$(callback atrium http://127.0.0.1:15104/atrium/auth/callback)
atrium_token=$(grep -i '^set-cookie: token=' <<<"$atrium_headers" | head -1 | sed -E 's/^[Ss]et-[Cc]ookie: token=([^;]+).*/\1/' | tr -d '\r')
[[ -n "$atrium_token" ]] || { echo "seed: no workspace session from the Atrium callback" >&2; exit 1; }
[[ "$(psql_db workpipe -c "select count(*) from \"SubAccount\" where id = '$SUB_ID'")" == 1 ]] \
  || { echo "seed: WorkPipe did not mirror the sub-account" >&2; exit 1; }

echo "== Atrium onboarding"
atrium_org=$(curl -sS -f http://127.0.0.1:15104/api/atrium/orgs/ -H "Authorization: Bearer $atrium_token" \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["id"])')
onboarding=$(curl -sS -f -X POST "http://127.0.0.1:15104/api/atrium/orgs/$atrium_org/onboarding" \
  -H "Authorization: Bearer $atrium_token" -H 'Content-Type: application/json' --data "$(python3 -c '
import json; print(json.dumps({"answers": {
  "orgName": "Harbor Supply Co.", "industry": "E-commerce & Retail",
  "whatBusinessDoes": "Regional wholesale distributor of packaging and janitorial supplies",
  "customers": "Restaurants, cafes and small retailers",
  "primaryGoal": "Grow repeat wholesale accounts",
  "dayToDay": "Quoting, order follow-up and delivery scheduling"}}))')")
log "completed; memory seeded: $(python3 -c 'import json,sys; print(json.loads(sys.argv[1]).get("seeded"))' "$onboarding")"

echo "== assistant"
company=$(python3 -c 'import sys,uuid; print(uuid.uuid5(uuid.UUID("1d3a9b6e-0c4f-4a2d-9e7b-5f8c2a1e6d40"), sys.argv[1]))' "$ORG_ID")
agent=$(curl -sS -f -X POST http://127.0.0.1:15103/api/bridge/ensure-agent -H "x-orbit-bridge-secret: $ORBIT_BRIDGE_SECRET" \
  -H 'Content-Type: application/json' --data "{\"companyId\":\"$company\"}" | python3 -c 'import json,sys; print(json.load(sys.stdin)["agentId"])')
log "agent: $agent"

echo "== WorkPipe sample data"
psql_db workpipe -v sub="$SUB_ID" <<'SQL'
INSERT INTO "Pipeline"(id, name, "subAccountId", "updatedAt") VALUES
  ('demo-pipe-wholesale', 'Wholesale Orders', :'sub', now()) ON CONFLICT (id) DO NOTHING;
INSERT INTO "Lane"(id, name, "pipelineId", "order", "updatedAt") VALUES
  ('demo-lane-new',   'New inquiry', 'demo-pipe-wholesale', 0, now()),
  ('demo-lane-quote', 'Quote sent',  'demo-pipe-wholesale', 1, now()),
  ('demo-lane-nego',  'Negotiating', 'demo-pipe-wholesale', 2, now()),
  ('demo-lane-won',   'Won',         'demo-pipe-wholesale', 3, now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO "Contact"(id, name, "firstName", "lastName", email, phone, "companyName", city, state, status, "subAccountId", "updatedAt") VALUES
  ('demo-ct-01', 'Maria Alvarez',  'Maria',  'Alvarez',  'maria@bluefinbistro.example.com',    '555-0101', 'Bluefin Bistro',        'Columbus',      'OH', 'customer', :'sub', now()),
  ('demo-ct-02', 'Dev Patel',      'Dev',    'Patel',    'dev@cornerstonecafe.example.com',    '555-0102', 'Cornerstone Cafe',      'Dayton',    'OH', 'customer', :'sub', now()),
  ('demo-ct-03', 'Hannah Brooks',  'Hannah', 'Brooks',   'hannah@brooksmarket.example.com',    '555-0103', 'Brooks Market',         'Akron',   'OH', 'lead',     :'sub', now()),
  ('demo-ct-04', 'Tom Nguyen',     'Tom',    'Nguyen',   'tom@saltandsmoke.example.com',       '555-0104', 'Salt & Smoke BBQ',      'Toledo',   'OH', 'lead',     :'sub', now()),
  ('demo-ct-05', 'Grace Kim',      'Grace',  'Kim',      'grace@sunrisebakery.example.com',    '555-0105', 'Sunrise Bakery',        'Canton',   'OH', 'customer', :'sub', now()),
  ('demo-ct-06', 'Luis Romero',    'Luis',   'Romero',   'luis@romerofacilities.example.com',  '555-0106', 'Romero Facility Care',  'Mansfield', 'OH', 'lead',     :'sub', now()),
  ('demo-ct-07', 'Priya Shah',     'Priya',  'Shah',     'priya@greenleafgrocers.example.com', '555-0107', 'Greenleaf Grocers',     'Columbus',      'OH', 'customer', :'sub', now()),
  ('demo-ct-08', 'Owen Carter',    'Owen',   'Carter',   'owen@harbordeli.example.com',        '555-0108', 'Harborview Deli',       'Findlay',  'OH', 'lead',     :'sub', now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO "Ticket"(id, name, "laneId", "order", value, description, "customerId", "updatedAt") VALUES
  ('demo-tk-01', 'Takeout container restock',   'demo-lane-new',   0,  1850, 'Monthly clamshells and cups for two locations',       'demo-ct-04', now()),
  ('demo-tk-02', 'Janitorial starter program',  'demo-lane-new',   1,  3200, 'Floor care and restroom supplies, quarterly delivery', 'demo-ct-06', now()),
  ('demo-tk-03', 'Bakery boxes, holiday run',   'demo-lane-quote', 0,  2400, 'Printed cake and pastry boxes for November-December',  'demo-ct-05', now()),
  ('demo-tk-04', 'Deli paper and bags',         'demo-lane-quote', 1,   960, 'Butcher paper, sandwich wrap, kraft bags',             'demo-ct-08', now()),
  ('demo-tk-05', 'Grocery store supplies',      'demo-lane-nego',  0,  7400, 'Produce bags, cleaning chemicals, weekly delivery',    'demo-ct-07', now()),
  ('demo-tk-06', 'Bistro annual contract',      'demo-lane-won',   0, 12600, 'All disposables and cleaning, standing weekly order',  'demo-ct-01', now())
ON CONFLICT (id) DO NOTHING;
SQL
log "pipeline, 6 deals, 8 contacts"
echo "seed-demo-account: done ($EMAIL)"

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
LOGO="https://$domain/demo/harbor-supply.png"   # served by Portal (apps/portal/public/demo)

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
psql_db portal -v org="$ORG_ID" -v name="$ORG_NAME" -v slug="$ORG_SLUG" -v ind="$ORG_INDUSTRY" -v logo="$LOGO" \
  -v sub="$SUB_ID" -v subname="$SUB_NAME" -v uid="$user_id" -v email="$EMAIL" <<'SQL'
INSERT INTO "Organization"(id, name, slug, industry, "logoUrl", licensed, "updatedAt")
VALUES (:'org', :'name', :'slug', :'ind', :'logo', true, now())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, industry = EXCLUDED.industry, "logoUrl" = EXCLUDED."logoUrl", licensed = true, "updatedAt" = now();
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
  ORG_INDUSTRY="$ORG_INDUSTRY" SUB_ID="$SUB_ID" LOGO="$LOGO" python3 - <<'PY'
import base64, hashlib, hmac, json, os, time
def b64(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
now = int(time.time()); e = os.environ
claims = {"sub": e["USER_ID"], "email": e["EMAIL"], "name": "Demo Reviewer",
          "org_id": e["ORG_ID"], "org_slug": e["ORG_SLUG"], "org_name": e["ORG_NAME"],
          "org_logo": e["LOGO"], "org_industry": e["ORG_INDUSTRY"], "sub_account_id": e["SUB_ID"],
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
# seed.sh recreates Conductor, the runtime and Atrium at its end; wait until they answer.
for url in http://127.0.0.1:15101/ http://127.0.0.1:15103/api/health http://127.0.0.1:15104/health; do
  for _ in $(seq 1 60); do
    [[ "$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url")" =~ ^(200|30[0-9])$ ]] && break
    sleep 3
  done
done
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

# New companies get a CEO (and later specialists) on the coding-agent CLI adapter that
# production uses to work tickets; the demo image leaves those CLIs out. Point this business's
# agents at the agent runtime instead: woken by an assigned ticket, the agent answers it and
# the orchestrator posts the answer on the ticket as a comment.
echo "== CEO and specialists on the agent runtime"
ORG_NAME="$ORG_NAME" ASSISTANT_ID="$agent" python3 - "$company" <<'PY'
import json, os, sys, urllib.request
company = sys.argv[1]; key = os.environ["ORBIT_BOARD_API_KEY"]; base = "http://127.0.0.1:15103/api"
def call(method, path, body=None):
    req = urllib.request.Request(base + path, method=method, data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as r: return json.load(r)
agents = call("GET", f"/companies/{company}/agents")
agents = agents if isinstance(agents, list) else agents.get("data", [])
switched = 0
for a in agents:
    if a.get("id") == os.environ.get("ASSISTANT_ID"):
        continue
    title = a.get("title") or a.get("role") or "specialist"
    prompt = (f"You are the {title} agent for {os.environ['ORG_NAME']}, a small business. Work arrives as "
              "tickets, often handed over by the business's assistant. Reply with a short, concrete plan: "
              "what you would do, what you need from the owner, and what could go wrong. Never claim "
              "that work is done, sent or scheduled; you can only plan it here.")
    call("PATCH", f"/agents/{a['id']}", {"adapterType": "hermes_openai", "replaceAdapterConfig": True,
         "runtimeConfig": {"heartbeat": {"enabled": False, "wakeOnDemand": True}},
         "adapterConfig": {"url": "http://runtime:8642/v1/chat/completions", "model": "hermes-agent",
                           "apiKeyEnv": "HERMES_API_KEY", "timeoutSec": 120, "systemPrompt": prompt}})
    switched += 1
print(f"  {switched} agent(s) on the runtime, answering assigned tickets")
PY

echo "== WorkPipe sample data"
psql_db workpipe -v sub="$SUB_ID" -v org="$ORG_ID" -v logo="$LOGO" <<'SQL'
-- Logos: first launch copies the org logo onto the business; sub-account sync leaves it blank.
UPDATE "Business" SET "businessLogo" = :'logo' WHERE id = :'org';
UPDATE "SubAccount" SET "subAccountLogo" = :'logo' WHERE id = :'sub';
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

-- Invoices: one paid, one past due (shown as overdue), one due soon, one draft. Amounts in cents.
INSERT INTO "Invoice"(id, number, status, name, "dueDate", "subTotalCents", "totalDueCents", "netPaymentTerm", link, "paidAt", "subAccountId", "createdAt", "updatedAt") VALUES
  ('demo-inv-01', 'INV-0001', 'PAID', 'Bluefin Bistro - September deliveries',  now() - interval '20 days', 105000, 105000, 'Net 15', gen_random_uuid()::text, now() - interval '24 days', :'sub', now() - interval '35 days', now()),
  ('demo-inv-02', 'INV-0002', 'SENT', 'Greenleaf Grocers - bags and chemicals', now() - interval '6 days',   63000,  63000, 'Net 15', gen_random_uuid()::text, NULL,                      :'sub', now() - interval '21 days', now()),
  ('demo-inv-03', 'INV-0003', 'SENT', 'Cornerstone Cafe - cups and lids',       now() + interval '12 days',  44800,  44800, 'Net 15', gen_random_uuid()::text, NULL,                      :'sub', now() - interval '3 days',  now()),
  ('demo-inv-04', NULL,       'DRAFT', 'Brooks Market - opening order',         now() + interval '30 days', 120000, 120000, 'Net 30', NULL,                    NULL,                      :'sub', now(),                      now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO "InvoiceService"(id, name, description, quantity, "unitPriceCents", "totalCents", "invoiceId", "updatedAt") VALUES
  ('demo-ins-01', 'Weekly disposables delivery', 'Containers, cups, napkins',       4, 22500,  90000, 'demo-inv-01', now()),
  ('demo-ins-02', 'Cleaning chemicals',          'Degreaser and sanitizer, 4 gal',  1, 15000,  15000, 'demo-inv-01', now()),
  ('demo-ins-03', 'Produce bags, case of 2,000', NULL,                              10, 4200,  42000, 'demo-inv-02', now()),
  ('demo-ins-04', 'Floor degreaser, 1 gal',      NULL,                               6, 3500,  21000, 'demo-inv-02', now()),
  ('demo-ins-05', '12 oz hot cups with lids, case', NULL,                            8, 5600,  44800, 'demo-inv-03', now()),
  ('demo-ins-06', 'Opening supply kit',          'Bags, wrap, cleaning starter set', 1, 120000, 120000, 'demo-inv-04', now())
ON CONFLICT (id) DO NOTHING;

-- A lead-capture funnel: a landing page with a quote form, and a thank-you page.
INSERT INTO "Funnel"(id, name, description, published, "subDomainName", "subAccountId", "updatedAt") VALUES
  ('demo-funnel-01', 'Wholesale Account Signup', 'Captures new wholesale accounts from local restaurants and shops', false, 'harbor-wholesale', :'sub', now())
ON CONFLICT (id) DO NOTHING;
INSERT INTO "FunnelPage"(id, name, "pathName", "order", visits, content, "funnelId", "updatedAt") VALUES
  ('demo-fp-01', 'Landing', '', 0, 142, $page$[{"id":"__body","name":"Body","type":"__body","styles":{"backgroundColor":"white"},"content":[{"id":"demo-fp-01-main","name":"Container","type":"container","styles":{"display":"flex","flexDirection":"column","gap":"16px","padding":"48px 24px","maxWidth":"720px","margin":"0 auto"},"content":[{"id":"demo-fp-01-h","name":"Heading","type":"heading","styles":{},"content":{"text":"Wholesale supplies for Ohio restaurants and shops","level":"h1","alignment":"left"}},{"id":"demo-fp-01-t","name":"Text","type":"text","styles":{"color":"black"},"content":{"innerText":"Packaging, disposables and janitorial supplies, delivered weekly from our Columbus warehouse. Tell us what you go through in a month and we'll send a quote within one business day."}},{"id":"demo-fp-01-form","name":"Contact Form","type":"contactForm","styles":{},"content":{"title":"Get a wholesale quote","subTitle":"Open an account","submitText":"Request my quote","fields":["phone","companyName","message"]}}]}]}]$page$, 'demo-funnel-01', now()),
  ('demo-fp-02', 'Thank you', 'thank-you', 1, 37, $page$[{"id":"__body","name":"Body","type":"__body","styles":{"backgroundColor":"white"},"content":[{"id":"demo-fp-02-main","name":"Container","type":"container","styles":{"display":"flex","flexDirection":"column","gap":"16px","padding":"48px 24px","maxWidth":"720px","margin":"0 auto"},"content":[{"id":"demo-fp-02-h","name":"Heading","type":"heading","styles":{},"content":{"text":"Thanks, we've got your request","level":"h1","alignment":"left"}},{"id":"demo-fp-02-t","name":"Text","type":"text","styles":{"color":"black"},"content":{"innerText":"Someone from our sales team will call you within one business day with pricing for your account."}}]}]}]$page$, 'demo-funnel-01', now())
ON CONFLICT (id) DO NOTHING;

-- Upcoming calendar: deliveries and calls tied to the deals above (times in UTC, morning US Eastern).
INSERT INTO "CalendarEvent"(id, title, description, start, "end", category, "contactId", "ticketId", "subAccountId", "updatedAt") VALUES
  ('demo-ev-01', 'Delivery: Bluefin Bistro weekly order', 'Standing order, dock 2',          date_trunc('day', now()) + interval '1 day 13 hours',        date_trunc('day', now()) + interval '1 day 14 hours',        'delivery', 'demo-ct-01', 'demo-tk-06', :'sub', now()),
  ('demo-ev-02', 'Call: Priya Shah on grocery pricing',   'Walk through the weekly delivery quote', date_trunc('day', now()) + interval '2 days 18 hours', date_trunc('day', now()) + interval '2 days 18 hours 30 minutes', 'call', 'demo-ct-07', 'demo-tk-05', :'sub', now()),
  ('demo-ev-03', 'Follow up: Sunrise Bakery holiday boxes', 'Confirm print run and dates', date_trunc('day', now()) + interval '3 days 14 hours',       date_trunc('day', now()) + interval '3 days 14 hours 30 minutes', 'call', 'demo-ct-05', 'demo-tk-03', :'sub', now()),
  ('demo-ev-04', 'Site visit: Romero Facility Care',      'Walk the floors for the janitorial program', date_trunc('day', now()) + interval '5 days 17 hours', date_trunc('day', now()) + interval '5 days 18 hours', 'meeting', 'demo-ct-06', 'demo-tk-02', :'sub', now())
ON CONFLICT (id) DO NOTHING;
SQL
log "pipeline, 6 deals, 8 contacts, 4 invoices, 1 funnel, 4 calendar events"
echo "seed-demo-account: done ($EMAIL)"

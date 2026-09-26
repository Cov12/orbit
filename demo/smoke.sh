#!/usr/bin/env bash
# End-to-end check of the seeded demo: sign in to the workspace the way Portal launches it,
# ask the business's assistant about its sales pipeline, and require the answer to name a
# deal that exists only in WorkPipe's seeded data (so it had to call the WorkPipe tools).
#   demo/smoke.sh
set -euo pipefail
secrets=${ORBIT_SECRETS:-$HOME/showcase/.secrets}
# shellcheck disable=SC1090
set -a; for f in demo demo-seed; do source "$secrets/$f.env"; done; set +a
atrium=${ORBIT_ATRIUM_LOCAL:-http://127.0.0.1:15104}

python3 - "$atrium" <<'PY'
import base64, hashlib, hmac, json, os, sys, time, urllib.request, urllib.error
atrium = sys.argv[1]; e = os.environ

def b64(b): return base64.urlsafe_b64encode(b).rstrip(b"=").decode()
now = int(time.time())
claims = {"sub": e["ORBIT_DEMO_CLERK_USER_ID"], "email": e["ORBIT_DEMO_EMAIL"], "name": "Demo Reviewer",
          "org_id": "cdemoharborsupply0000001", "org_slug": "harbor-supply", "org_name": "Harbor Supply Co.",
          "org_logo": None, "org_industry": "E-commerce & Retail", "sub_account_id": "cdemosubwarehouse0000001",
          "role": "OWNER", "subscriptions": [{"plan": "ENTERPRISE", "status": "ACTIVE"}],
          "app_access": ["ATRIUM", "CONDUCTOR", "DRIVE", "WORKPIPE"], "iat": now, "exp": now + 300}
head = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()); body = b64(json.dumps(claims).encode())
token = f"{head}.{body}.{b64(hmac.new(e['ORBIT_JWT_SECRET'].encode(), f'{head}.{body}'.encode(), hashlib.sha256).digest())}"

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
try:
    urllib.request.build_opener(NoRedirect).open(f"{atrium}/atrium/auth/callback?token={token}", timeout=60)
    raise SystemExit("smoke: callback did not redirect")
except urllib.error.HTTPError as r:
    cookie = next((c.split(";")[0].split("=", 1)[1] for c in r.headers.get_all("Set-Cookie") or [] if c.startswith("token=")), None)
if not cookie: raise SystemExit("smoke: no workspace session")

def call(path, body=None):
    req = urllib.request.Request(atrium + path, data=json.dumps(body).encode() if body else None,
        headers={"Authorization": f"Bearer {cookie}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=180) as r: return json.load(r)

org = call("/api/atrium/orgs/")[0]["id"]
scope = call(f"/api/atrium/orgs/{org}/subaccounts")
print(f"  active sub-account: {scope.get('activeSubAccountId')}")
t0 = time.time()
reply = call(f"/api/atrium/departments/chief/chat?org_id={org}",
             {"message": "Which deals are in our Wholesale Orders pipeline right now, and which is the biggest?"})
text = json.dumps(reply)
print(f"  reply in {time.time()-t0:.0f}s: {(reply.get('response') or reply.get('content') or text)[:400]}")
expected = ["Bistro annual contract", "Grocery store supplies", "12,600", "12600", "7,400"]
if not any(x.lower() in text.lower() for x in expected):
    raise SystemExit("smoke: FAIL — the answer does not mention any seeded deal")
print("smoke: PASS")
PY

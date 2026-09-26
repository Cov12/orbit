#!/usr/bin/env python3
"""Orbit eval harness — runs behaviour evals against a live agent runtime.

Two suites, both scored deterministically (no LLM judge):

  role_map  POST /v1/atrium/role-map — does the model suggest the right specialist agents
            for a business description? Every case checks required / acceptable / forbidden
            roles; every response is also checked for validity (only canonical roles, no
            duplicates, within the requested limit). The runtime marks answers produced by its
            keyword fallback; if any case fell back instead of being answered by the model, the
            run FAILS — otherwise a broken model configuration would score as the fallback's
            accuracy.

  memory    POST /v1/memory/seed + POST /v1/chat/completions — are seeded facts recalled
            within the right tenant, and NEVER outside it? Facts carry unique canary tokens.
            Grounding probes (recall in the right scope) are scored as a pass rate.
            Isolation probes (other company, other sub-account, no scope) are HARD GATES:
            a single canary leak fails the run — and so does a failed seed, since isolation
            can't be demonstrated for facts that were never stored.

Stdlib only. Usage:
  HERMES_API_KEY=... python evals/run.py --base-url http://127.0.0.1:18643 --label <model-name>
  python evals/run.py --check        # validate datasets only (no server needed; used in CI)
"""
import argparse, datetime, json, os, sys, time, urllib.error, urllib.request, uuid

HERE = os.path.dirname(os.path.abspath(__file__))
CANONICAL_ROLES = {  # mirrors ATRIUM_ROLE_ENUM in apps/agent-runtime/patches/0002
    "cto", "cmo", "cfo", "designer", "devops", "engineer", "pm", "qa", "researcher",
    "security", "sales", "support", "content", "general", "default",
}
SPECIALISTS = CANONICAL_ROLES - {"general", "default"}
# Recall must work, not just stay isolated: a runtime that remembers nothing leaks nothing.
MIN_GROUNDING_RATE = 0.75


def load_jsonl(name):
    with open(os.path.join(HERE, "datasets", name), encoding="utf-8") as fh:
        return [json.loads(l) for l in fh if l.strip() and not l.lstrip().startswith("//")]


# ---------------------------------------------------------------- dataset validation
def check_datasets():
    problems = []
    for c in load_jsonl("role_map.jsonl"):
        for k in ("expect_all", "expect_any", "forbid"):
            bad = set(c.get(k, [])) - CANONICAL_ROLES
            if bad:
                problems.append(f"role_map {c['id']}: {k} has non-canonical {sorted(bad)}")
        if not isinstance(c.get("answers"), (str, dict)):
            problems.append(f"role_map {c['id']}: answers must be a string or object")
    mem = load_jsonl("memory.jsonl")
    seeds = [m for m in mem if m["kind"] == "seed"]
    probes = [m for m in mem if m["kind"] == "probe"]
    canaries = {c for s in seeds for c in s.get("canaries", [])}
    for p in probes:
        for c in p.get("expect", []) + p.get("forbid", []):
            if c not in canaries:
                problems.append(f"memory {p['id']}: references unknown canary {c}")
    if len(canaries) != sum(len(s.get("canaries", [])) for s in seeds):
        problems.append("memory: canary tokens must be unique across seeds")
    return problems


# ---------------------------------------------------------------- http
class Runtime:
    def __init__(self, base_url, api_key, timeout):
        self.base, self.key, self.timeout = base_url.rstrip("/"), api_key, timeout

    def post(self, path, body, headers=None):
        req = urllib.request.Request(self.base + path, data=json.dumps(body).encode(), method="POST")
        req.add_header("Content-Type", "application/json")
        req.add_header("Authorization", f"Bearer {self.key}")
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        t0 = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                return r.status, json.loads(r.read() or b"{}"), time.monotonic() - t0
        except urllib.error.HTTPError as e:
            return e.code, {"error": e.read().decode(errors="replace")[:500]}, time.monotonic() - t0


# ---------------------------------------------------------------- suites
def run_role_map(rt):
    results = []
    for c in load_jsonl("role_map.jsonl"):
        max_roles = c.get("max_roles", 5)
        status, body, secs = rt.post("/v1/atrium/role-map", {"answers": c["answers"], "maxRoles": max_roles})
        roles = body.get("roles", []) if status == 200 else []
        # The runtime marks keyword-fallback answers with "fallback"; model answers carry "model";
        # an empty input short-circuits with neither.
        if status != 200:
            source = "error"
        elif body.get("fallback"):
            source = "fallback"
        elif body.get("model"):
            source = "model"
        else:
            source = "short-circuit"
        checks = {
            "http_ok": status == 200,
            "valid_roles": set(roles) <= CANONICAL_ROLES,
            "no_duplicates": len(roles) == len(set(roles)),
            "within_limit": len(roles) <= max_roles,
            "expect_all": set(c.get("expect_all", [])) <= set(roles),
            "expect_any": (not c.get("expect_any")) or bool(set(c["expect_any"]) & set(roles)),
            "forbid": not (set(c.get("forbid", [])) & set(roles)),
            "no_specialists": (not c.get("no_specialists")) or not (set(roles) & SPECIALISTS),
            "not_fallback": source != "fallback",
        }
        results.append({"id": c["id"], "roles": roles, "source": source, "seconds": round(secs, 2),
                        "checks": checks, "pass": all(checks.values())})
    n = len(results)
    valid = all(r["checks"]["valid_roles"] and r["checks"]["no_duplicates"] and r["checks"]["within_limit"]
                for r in results)
    fallbacks = sum(r["source"] == "fallback" for r in results)
    short = sum(r["source"] == "short-circuit" for r in results)
    return {
        "suite": "role_map", "cases": results,
        "summary": {
            "n": n, "passed": sum(r["pass"] for r in results),
            "pass_rate": round(sum(r["pass"] for r in results) / n, 3) if n else None,
            "hard_gates": {"all_responses_valid": valid, "no_fallback": fallbacks == 0},
            "fallback_cases": fallbacks,
            "short_circuit_cases": short,
        },
    }


def run_memory(rt, model):
    rows = load_jsonl("memory.jsonl")
    run = uuid.uuid4().hex[:8]  # fresh tenants every run: no contamination between runs
    tenant = lambda t: f"eval-{t}-{run}"
    seeded = []
    for s in (r for r in rows if r["kind"] == "seed"):
        body = {"companyId": tenant(s["company"]), "facts": s["facts"]}
        if s.get("sub_account"):
            body["subAccountId"] = s["sub_account"]
        status, resp, _ = rt.post("/v1/memory/seed", body)
        seeded.append({"id": s["id"], "status": status, "ok": status == 200})
    results = []
    for p in (r for r in rows if r["kind"] == "probe"):
        headers = {}
        if p.get("company"):
            headers["X-Hermes-Session-Key"] = f"{tenant(p['company'])}:{p.get('sub_account') or '_business'}"
        status, resp, secs = rt.post("/v1/chat/completions", {
            "model": model, "messages": [{"role": "user", "content": p["question"]}]}, headers)
        text = ""
        if status == 200:
            try:
                text = resp["choices"][0]["message"]["content"] or ""
            except (KeyError, IndexError, TypeError):
                text = ""
        up = text.upper()
        leaked = [c for c in p.get("forbid", []) if c.upper() in up]
        found = [c for c in p.get("expect", []) if c.upper() in up]
        ok = status == 200 and not leaked and len(found) == len(p.get("expect", []))
        results.append({"id": p["id"], "type": p["type"], "status": status, "seconds": round(secs, 2),
                        "expected_found": found, "leaked": leaked, "pass": ok})
    iso = [r for r in results if r["type"] == "isolation"]
    grd = [r for r in results if r["type"] == "grounding"]
    return {
        "suite": "memory", "seeds": seeded, "cases": results,
        "summary": {
            "seeds_ok": all(s["ok"] for s in seeded),
            "grounding_n": len(grd), "grounding_passed": sum(r["pass"] for r in grd),
            "grounding_rate": round(sum(r["pass"] for r in grd) / len(grd), 3) if grd else None,
            "isolation_n": len(iso), "isolation_leaks": sum(bool(r["leaked"]) for r in iso),
            # Isolation only means something if the canaries were actually stored: a run where
            # seeding failed would otherwise "pass" isolation with nothing to leak.
            "hard_gates": {"seeds_ok": all(s["ok"] for s in seeded),
                           "grounding_min": bool(grd) and sum(r["pass"] for r in grd) / len(grd) >= MIN_GROUNDING_RATE,
                           "no_cross_tenant_leak": all(not r["leaked"] for r in iso),
                           "isolation_probes_answered": all(r["status"] == 200 for r in iso)},
        },
    }


# ---------------------------------------------------------------- report
def write_report(out_dir, label, suites):
    os.makedirs(out_dir, exist_ok=True)
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    path = os.path.join(out_dir, f"{stamp}-{label}.json")
    with open(path, "w", encoding="utf-8") as fh:
        json.dump({"label": label, "utc": stamp, "suites": suites}, fh, indent=2)
    summary = os.path.join(out_dir, "SUMMARY.md")
    new = not os.path.exists(summary)
    with open(summary, "a", encoding="utf-8") as fh:
        if new:
            fh.write("# Eval runs\n\n| UTC | Model | Suite | Result | Hard gates | Detail |\n|---|---|---|---|---|---|\n")
        for s in suites:
            sm, gates = s["summary"], s["summary"]["hard_gates"]
            gate_txt = "PASS" if all(gates.values()) else "FAIL: " + ", ".join(k for k, v in gates.items() if not v)
            if s["suite"] == "role_map":
                res = f"{sm['passed']}/{sm['n']} ({sm['pass_rate']:.0%})"
                det = f"fallback cases: {sm['fallback_cases']}; short-circuit (empty input): {sm['short_circuit_cases']}"
            else:
                res = f"grounding {sm['grounding_passed']}/{sm['grounding_n']}"
                det = f"isolation probes: {sm['isolation_n']}, leaks: {sm['isolation_leaks']}; seeds ok: {sm['seeds_ok']}"
            fh.write(f"| {stamp} | {label} | {s['suite']} | {res} | {gate_txt} | {det} |\n")
    return path


def main():
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--base-url", default="http://127.0.0.1:18643")
    ap.add_argument("--label", help="model/config label recorded with the results")
    ap.add_argument("--model", default="hermes-agent", help="model name sent to /v1/chat/completions")
    ap.add_argument("--suite", choices=["role_map", "memory", "all"], default="all")
    ap.add_argument("--timeout", type=float, default=120)
    ap.add_argument("--out", default=os.path.join(HERE, "results"))
    ap.add_argument("--check", action="store_true", help="validate datasets only")
    a = ap.parse_args()

    problems = check_datasets()
    if problems or a.check:
        print("\n".join(problems) or "datasets OK")
        sys.exit(1 if problems else 0)
    if not a.label:
        ap.error("--label is required for a run")
    key = os.environ.get("HERMES_API_KEY")
    if not key:
        ap.error("set HERMES_API_KEY")

    rt = Runtime(a.base_url, key, a.timeout)
    suites = []
    if a.suite in ("role_map", "all"):
        suites.append(run_role_map(rt))
    if a.suite in ("memory", "all"):
        suites.append(run_memory(rt, a.model))
    path = write_report(a.out, a.label, suites)
    ok = all(all(s["summary"]["hard_gates"].values()) for s in suites)
    for s in suites:
        print(s["suite"], json.dumps(s["summary"]))
    print(f"report: {path}\nhard gates: {'PASS' if ok else 'FAIL'}")
    sys.exit(0 if ok else 2)


if __name__ == "__main__":
    main()

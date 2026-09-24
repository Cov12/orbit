import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import { hermesApiPost } from "../services/hermes-api-client.js";
import { logger } from "../middleware/logger.js";
// Auth is REUSED from the assistant bridge route so every bridge endpoint authenticates
// with the exact same shared secret and header — no second credential.
import { SECRET_HEADER, resolveBridgeSecret, secretsMatch } from "./bridge-ensure-agent.js";

/** Hermes api_server path this endpoint forwards to. */
const HERMES_SEED_PATH = "/v1/memory/seed";

type SeedFact = string | { fact: string; kind?: string; confidence?: string };

type ParsedBody = { companyId: string; subAccountId?: string; facts: SeedFact[] };

function isValidFact(candidate: unknown): candidate is SeedFact {
  if (typeof candidate === "string") return candidate.trim().length > 0;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return false;
  const fact = (candidate as Record<string, unknown>).fact;
  return typeof fact === "string" && fact.trim().length > 0;
}

function validateBody(raw: unknown): ParsedBody | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "request body must be a JSON object" };
  const r = raw as Record<string, unknown>;

  // Deliberately NOT UUID-checked: Hermes scopes memory by arbitrary company ids
  // (e.g. "co_123"), so requiring a UUID here would reject valid callers. Non-empty is
  // the only constraint Conductor can honestly enforce.
  if (typeof r.companyId !== "string" || r.companyId.trim().length === 0) {
    return { error: "companyId is required" };
  }
  const companyId = r.companyId.trim();

  if (r.subAccountId !== undefined && typeof r.subAccountId !== "string") {
    return { error: "subAccountId must be a string when present" };
  }
  const subAccountId = typeof r.subAccountId === "string" ? r.subAccountId.trim() : "";

  if (!Array.isArray(r.facts) || r.facts.length === 0) {
    return { error: "facts must be a non-empty array" };
  }
  for (const candidate of r.facts) {
    if (!isValidFact(candidate)) {
      return { error: "each fact must be a non-empty string or an object with a non-empty `fact`" };
    }
  }

  return {
    companyId,
    // Omitted entirely (never empty-string) when absent, so Hermes sees the same shape it
    // would from a business-scoped caller.
    ...(subAccountId ? { subAccountId } : {}),
    facts: r.facts as SeedFact[],
  };
}

/**
 * POST /api/bridge/engram-seed
 *
 * Body: { companyId: string, subAccountId?: string, facts: (string | {fact,kind,confidence})[] }
 *   →  200 { ...hermesResult }   // status/scope/collection/written/skipped/readback
 *
 * Thin forwarder: hands the validated body to the Hermes api_server's `/v1/memory/seed`
 * verb and relays its JSON verbatim. Conductor owns no seeding logic — Hermes decides scope,
 * collection and dedupe.
 *
 * Seeding is NOT critical path for onboarding: when Hermes is unreachable or errors this
 * returns 502 with a clear message so the caller can log it and proceed.
 *
 * Mounted OUTSIDE the cookie-authenticated /api router (alongside the other bridge routes)
 * so Atrium can call it server-to-server. Auth is the SAME bridge shared-secret header
 * that /api/bridge/ensure-agent and /chat validate.
 */
export function bridgeEngramSeedRoutes(db: Db) {
  const router = Router();

  router.post("/api/bridge/engram-seed", async (req: Request, res) => {
    const expected = await resolveBridgeSecret(db);
    if (!expected) {
      logger.error(
        "bridge engram-seed: no shared secret configured (plugin config or ORBIT_BRIDGE_SECRET)",
      );
      res.status(503).json({ error: "auth_not_configured" });
      return;
    }

    const provided = req.header(SECRET_HEADER);
    if (!provided || !secretsMatch(provided, expected)) {
      logger.warn("bridge engram-seed: invalid or missing shared secret");
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const parsed = validateBody(req.body);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    try {
      const result = await hermesApiPost(HERMES_SEED_PATH, parsed);
      if (!result.ok) {
        logger.error(
          { companyId: parsed.companyId, status: result.status },
          "bridge engram-seed: Hermes rejected the seed",
        );
        res.status(502).json({
          error: `Hermes seed failed (${result.status})`,
          hermesStatus: result.status,
          ...(result.body !== null ? { hermesBody: result.body } : {}),
        });
        return;
      }

      logger.info(
        { companyId: parsed.companyId, facts: parsed.facts.length },
        "bridge engram-seed: forwarded seed to Hermes",
      );
      // Relay Hermes's structured result unchanged — the caller reads written/skipped/readback.
      res.status(200).json(result.body ?? {});
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, companyId: parsed.companyId }, "bridge engram-seed: Hermes unreachable");
      res.status(502).json({ error: `Hermes seed unavailable: ${message}` });
    }
  });

  return router;
}

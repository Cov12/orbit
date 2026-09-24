import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import { bootstrapCompanyAgents } from "../services/onboarding-bootstrap.js";
import {
  SPECIALIST_ROLES,
  ensureCompanySpecialistAgents,
  isSpecialistRole,
  type SpecialistRole,
} from "../services/specialist-bootstrap.js";
import { logger } from "../middleware/logger.js";
// Auth + company-ensure are REUSED from the assistant bridge route so both endpoints
// authenticate with the exact same shared secret and header — no second credential.
import {
  SECRET_HEADER,
  UUID_PATTERN,
  ensureCompany,
  resolveBridgeSecret,
  secretsMatch,
} from "./bridge-ensure-agent.js";

type ParsedBody = { companyId: string; roles: SpecialistRole[] };

function validateBody(raw: unknown): ParsedBody | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "request body must be a JSON object" };
  const r = raw as Record<string, unknown>;

  if (typeof r.companyId !== "string" || r.companyId.trim().length === 0) {
    return { error: "companyId is required" };
  }
  const companyId = r.companyId.trim();
  if (!UUID_PATTERN.test(companyId)) {
    return { error: "companyId must be a UUID" };
  }

  if (!Array.isArray(r.roles) || r.roles.length === 0) {
    return { error: "roles must be a non-empty array" };
  }

  // De-duplicate while preserving request order, so the response roster echoes what was asked
  // and a role repeated in one call is provisioned once.
  const roles: SpecialistRole[] = [];
  for (const candidate of r.roles) {
    const role = typeof candidate === "string" ? candidate.trim() : candidate;
    if (!isSpecialistRole(role)) {
      // `ceo` and `default` fall through to here on purpose: the CEO is seeded at company
      // creation, and `default` is the bundle fallback, not a requestable role.
      return {
        error: `unknown role: ${typeof role === "string" ? role : typeof role}. `
          + `allowed roles: ${SPECIALIST_ROLES.join(", ")}`,
      };
    }
    if (!roles.includes(role)) roles.push(role);
  }

  return { companyId, roles };
}

/**
 * POST /api/bridge/ensure-department-agents
 *
 * Body: { companyId: <uuid>, roles: string[] }
 *   →  200 { agents: [{ role, agentId, created }] }
 *
 * Idempotently guarantees the company has one SPECIALIST agent per requested canonical role,
 * creating each through the same in-process path the CEO seed uses so the role's persona
 * bundle (`onboarding-assets/<role>/`) materializes. Agents are company-level; sub-account is
 * a scope filter elsewhere, not a separate roster. A second identical call creates nothing and
 * returns the same roster with `created: false`.
 *
 * Mounted OUTSIDE the cookie-authenticated /api router (alongside the assistant ensure-agent
 * bridge) so Atrium can call it server-to-server. Auth is the SAME bridge shared-secret
 * header that /api/bridge/ensure-agent and /chat validate.
 */
export function bridgeEnsureDepartmentAgentsRoutes(db: Db) {
  const router = Router();

  router.post("/api/bridge/ensure-department-agents", async (req: Request, res) => {
    const expected = await resolveBridgeSecret(db);
    if (!expected) {
      logger.error(
        "bridge ensure-department-agents: no shared secret configured (plugin config or ORBIT_BRIDGE_SECRET)",
      );
      res.status(503).json({ error: "auth_not_configured" });
      return;
    }

    const provided = req.header(SECRET_HEADER);
    if (!provided || !secretsMatch(provided, expected)) {
      logger.warn("bridge ensure-department-agents: invalid or missing shared secret");
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const parsed = validateBody(req.body);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const { companyId, roles } = parsed;

    try {
      // 1. Ensure the company exists so the agents have a home.
      await ensureCompany(db, companyId);

      // 2. Resolve the company CEO to parent the specialists under, mirroring what the
      //    assistant bridge does. Idempotent (an already-seeded company is a cheap no-op) and
      //    non-fatal: if the seed is unavailable the specialists are provisioned top-level.
      let ceoId: string | undefined;
      try {
        ceoId = (await bootstrapCompanyAgents(db, companyId)).ceoId;
      } catch (err) {
        logger.error(
          { err, companyId },
          "bridge ensure-department-agents: CEO bootstrap failed; provisioning specialists top-level",
        );
        ceoId = undefined;
      }

      // 3. Ensure one specialist per role. Each creation runs the CEO seed's provisioning
      //    steps: role bundle materialization + the default `tasks:assign` grant. Permissions
      //    are never passed, so only `role === "ceo"` yields canCreateAgents — never these.
      const agents = await ensureCompanySpecialistAgents(db, companyId, roles, {
        reportsTo: ceoId ?? null,
      });

      logger.info(
        { companyId, ceoId: ceoId ?? null, created: agents.filter((a) => a.created).length, roles },
        "bridge ensure-department-agents: ensured specialist roster for company",
      );
      res.status(200).json({ agents });
    } catch (err) {
      logger.error({ err, companyId }, "bridge ensure-department-agents: provisioning failed");
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}

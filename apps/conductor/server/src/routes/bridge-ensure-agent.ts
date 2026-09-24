import { timingSafeEqual } from "node:crypto";
import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import { agentService } from "../services/agents.js";
import { companyService } from "../services/companies.js";
import { bootstrapCompanyAgents } from "../services/onboarding-bootstrap.js";
import { pluginRegistryService } from "../services/plugin-registry.js";
import { logger } from "../middleware/logger.js";

// Header carrying the Atrium↔Conductor bridge shared secret. REUSED verbatim from the
// chat/history bridge convention (paperclip-plugin-orbit-atrium/route-handler.ts:9) so the
// Atrium caller can send the SAME credential it already sends to /chat — no new header.
export const SECRET_HEADER = "x-orbit-bridge-secret";

// Manifest key of the installed bridge plugin. Used to resolve the plugin's configured
// `sharedSecret` so this endpoint authenticates with the exact same secret as /chat.
const BRIDGE_PLUGIN_KEY = "paperclipai.plugin-orbit-atrium";

// Fallback template agent to clone when CONDUCTOR_ASSISTANT_TEMPLATE_AGENT_ID is unset: the
// live Orbit assistant. Its adapterConfig carries the model, which is copied verbatim.
const DEFAULT_TEMPLATE_AGENT_ID = "00000000-0000-4000-a000-0000000a9e01";

// Stable marker written into a provisioned assistant's metadata. The idempotency lookup keys
// off this, NOT the agent name, so re-provisioning always converges on the same agent.
const ASSISTANT_MARKER_KEY = "orbit_bridge_assistant";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Constant-time shared-secret compare, mirroring
// paperclip-plugin-orbit-atrium/route-handler.ts:298 (secretsMatch).
export function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf-8");
  const b = Buffer.from(expected, "utf-8");
  if (a.length !== b.length) {
    // Compare against self so the timing profile is independent of length.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

// Which agent to clone. Overridable via env so the template can be repointed without a code
// change; defaults to the live Orbit assistant. Read per-request so redeploys pick up changes.
function templateAgentId(): string {
  const raw = process.env.CONDUCTOR_ASSISTANT_TEMPLATE_AGENT_ID?.trim();
  return raw && raw.length > 0 ? raw : DEFAULT_TEMPLATE_AGENT_ID;
}

/**
 * Resolve the secret this endpoint accepts. PRIMARY source is the installed bridge plugin's
 * instance config `sharedSecret` — i.e. the exact same secret /chat validates against, so the
 * Atrium caller reuses its cached credential unchanged. FALLBACK is the ORBIT_BRIDGE_SECRET
 * env var, for deployments where the plugin config is not (yet) the source of truth. Read per
 * request so secret rotation takes effect on the next call.
 */
export async function resolveBridgeSecret(db: Db): Promise<string | null> {
  const registry = pluginRegistryService(db);
  const plugin = await registry.getByKey(BRIDGE_PLUGIN_KEY);
  if (plugin) {
    const configRow = await registry.getConfig(plugin.id);
    const configJson = (configRow?.configJson ?? null) as Record<string, unknown> | null;
    const shared = configJson && typeof configJson.sharedSecret === "string" ? configJson.sharedSecret : "";
    if (shared.length > 0) return shared;
  }
  const envSecret = process.env.ORBIT_BRIDGE_SECRET?.trim();
  return envSecret && envSecret.length > 0 ? envSecret : null;
}

function isAssistantMarked(metadata: unknown): boolean {
  return (
    typeof metadata === "object" &&
    metadata !== null &&
    (metadata as Record<string, unknown>)[ASSISTANT_MARKER_KEY] === true
  );
}

function validateBody(raw: unknown): { companyId: string } | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "request body must be a JSON object" };
  const r = raw as Record<string, unknown>;
  if (typeof r.companyId !== "string" || r.companyId.trim().length === 0) {
    return { error: "companyId is required" };
  }
  const companyId = r.companyId.trim();
  if (!UUID_PATTERN.test(companyId)) {
    return { error: "companyId must be a UUID" };
  }
  return { companyId };
}

/**
 * Ensure the Conductor company row exists so a provisioned agent has a home. The companyId is the
 * per-org UUID already derived by the caller (same mapping the login callback applies via
 * resolvePortalOrgCompanyId), so this only inserts a row when a company hits chat before ever
 * logging into Conductor. Race-safe: a concurrent insert (unique PK) is absorbed by re-reading.
 */
export async function ensureCompany(db: Db, companyId: string): Promise<void> {
  const companies = companyService(db);
  const existing = await companies.getById(companyId);
  if (existing) return;
  try {
    await companies.create({ id: companyId, name: `Portal Org ${companyId.slice(0, 8)}` });
  } catch (err) {
    // Lost a create race (or the row appeared concurrently) — tolerate iff it now exists.
    const now = await companies.getById(companyId);
    if (!now) throw err;
  }
}

/**
 * POST /api/bridge/ensure-agent
 *
 * Body: { companyId: <uuid> }  →  200 { agentId: <uuid> }
 *
 * Idempotently guarantees the company has its bridge assistant agent and returns its id. The
 * Atrium bridge calls this once per org (caching the result) before /chat, because the
 * assistant agent only ever existed in the Orbit company — every other org 404'd with
 * "Agent not found" when chat tried to open a session against an agent absent from its company.
 *
 * Mounted OUTSIDE the cookie-authenticated /api router (alongside portal-callback and the
 * entitlement webhook) so Atrium can call it server-to-server. Auth is the shared-secret
 * header — the SAME secret /chat validates.
 */
export function bridgeEnsureAgentRoutes(db: Db) {
  const router = Router();

  router.post("/api/bridge/ensure-agent", async (req: Request, res) => {
    const expected = await resolveBridgeSecret(db);
    if (!expected) {
      logger.error("bridge ensure-agent: no shared secret configured (plugin config or ORBIT_BRIDGE_SECRET)");
      res.status(503).json({ error: "auth_not_configured" });
      return;
    }

    const provided = req.header(SECRET_HEADER);
    if (!provided || !secretsMatch(provided, expected)) {
      logger.warn("bridge ensure-agent: invalid or missing shared secret");
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const parsed = validateBody(req.body);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const { companyId } = parsed;

    try {
      // 1. Ensure the company exists so the agent has a home.
      await ensureCompany(db, companyId);

      // 2. Ensure the company has its CEO, unconditionally. This is idempotent: an org already
      //    seeded at creation time (companyService.create) returns its existing ceoId as a cheap
      //    no-op, while a PRE-EXISTING org — one that predates the seed and therefore took
      //    ensureCompany's early return above — gets its CEO back-filled here. Non-fatal: if the
      //    seed fails we log and provision the assistant top-level, exactly as before the CEO existed.
      let ceoId: string | undefined;
      try {
        ceoId = (await bootstrapCompanyAgents(db, companyId)).ceoId;
      } catch (err) {
        logger.error(
          { err, companyId },
          "bridge ensure-agent: CEO bootstrap failed; provisioning assistant top-level",
        );
        ceoId = undefined;
      }

      const agents = agentService(db);

      // 3. Idempotency: return the existing assistant if one is already marked in this company.
      const existing = (await agents.list(companyId)).find((agent) => isAssistantMarked(agent.metadata));
      if (existing) {
        // Back-fill only: an assistant provisioned before the CEO seed shipped is still top-level.
        // An assistant that already reports to someone is left alone, so re-runs never re-parent.
        if (ceoId && existing.reportsTo == null) {
          await agents.update(existing.id, { reportsTo: ceoId });
          logger.info(
            { companyId, agentId: existing.id, ceoId },
            "bridge ensure-agent: re-parented existing assistant to company CEO",
          );
        }
        res.status(200).json({ agentId: existing.id });
        return;
      }

      // 4. Clone the template agent into this company, stamping the idempotency marker. Copy
      //    the config fields that define the assistant — adapterConfig carries the model.
      const templateId = templateAgentId();
      const template = await agents.getById(templateId);
      if (!template) {
        logger.error({ templateId }, "bridge ensure-agent: template agent not found");
        res.status(500).json({ error: "Assistant template agent not found" });
        return;
      }

      const cloned = await agents.create(companyId, {
        name: template.name,
        role: template.role,
        title: template.title,
        capabilities: template.capabilities,
        adapterType: template.adapterType,
        adapterConfig: template.adapterConfig,
        runtimeConfig: template.runtimeConfig,
        budgetMonthlyCents: template.budgetMonthlyCents,
        status: "idle",
        // Parent to the CEO when one exists. Omitted entirely (never null) when the seed was
        // unavailable, so the fallback shape is byte-for-byte today's top-level assistant.
        ...(ceoId ? { reportsTo: ceoId } : {}),
        metadata: {
          ...(typeof template.metadata === "object" && template.metadata !== null ? template.metadata : {}),
          [ASSISTANT_MARKER_KEY]: true,
        },
      });

      logger.info(
        { companyId, agentId: cloned.id, templateId, ceoId: ceoId ?? null },
        "bridge ensure-agent: provisioned assistant for company",
      );
      res.status(200).json({ agentId: cloned.id });
    } catch (err) {
      logger.error({ err, companyId }, "bridge ensure-agent: provisioning failed");
      res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  return router;
}

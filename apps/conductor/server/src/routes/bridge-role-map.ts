import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import { hermesApiPost } from "../services/hermes-api-client.js";
import { isSpecialistRole, type SpecialistRole } from "../services/specialist-bootstrap.js";
import { logger } from "../middleware/logger.js";
// Auth is REUSED from the assistant bridge route so every bridge endpoint authenticates
// with the exact same shared secret and header — no second credential.
import { SECRET_HEADER, resolveBridgeSecret, secretsMatch } from "./bridge-ensure-agent.js";

/** Hermes api_server path this endpoint forwards to. */
const HERMES_ROLE_MAP_PATH = "/v1/atrium/role-map";

/** Marker on a locally-derived result, so the caller can tell it did not come from Hermes. */
export const RULES_FALLBACK_MODEL = "rules-fallback";

const RESULT_OBJECT = "atrium.role_map";

export type RoleSuggestion = {
  role: SpecialistRole;
  rationale: string;
  first_task_hints: string[];
};

export type RoleMapResult = {
  object: string;
  roles: SpecialistRole[];
  suggestions: RoleSuggestion[];
  model: string;
};

type ParsedBody = { answers: Record<string, unknown>; maxRoles?: number };

function validateBody(raw: unknown): ParsedBody | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "request body must be a JSON object" };
  const r = raw as Record<string, unknown>;

  if (!r.answers || typeof r.answers !== "object" || Array.isArray(r.answers)) {
    return { error: "answers must be an object" };
  }

  if (r.maxRoles !== undefined) {
    if (typeof r.maxRoles !== "number" || !Number.isInteger(r.maxRoles) || r.maxRoles < 1) {
      return { error: "maxRoles must be a positive integer when present" };
    }
  }

  return {
    answers: r.answers as Record<string, unknown>,
    ...(typeof r.maxRoles === "number" ? { maxRoles: r.maxRoles } : {}),
  };
}

// ---------------------------------------------------------------------------
// Belt-and-suspenders enum filter
// ---------------------------------------------------------------------------

/**
 * Narrow Hermes's answer to the canonical specialist enum. Hermes already enum-validates,
 * so this is purely defensive: a drifted or compromised upstream must not be able to widen
 * Conductor's provisioning scope (notably to `ceo`, the only role carrying canCreateAgents).
 * Any role outside `SPECIALIST_ROLES` is dropped along with its suggestion.
 *
 * Returns null when the payload is not even shaped like a role map, which the caller treats
 * the same as an upstream failure.
 */
export function filterToCanonicalRoles(body: unknown): RoleMapResult | null {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  const b = body as Record<string, unknown>;
  if (!Array.isArray(b.roles)) return null;

  const roles: SpecialistRole[] = [];
  for (const candidate of b.roles) {
    if (isSpecialistRole(candidate) && !roles.includes(candidate)) roles.push(candidate);
  }
  const allowed = new Set<string>(roles);

  const suggestions: RoleSuggestion[] = [];
  for (const raw of Array.isArray(b.suggestions) ? b.suggestions : []) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const s = raw as Record<string, unknown>;
    // Dropped unless its role survived the filter above, so suggestions can never
    // re-introduce a role that `roles` no longer contains.
    if (!isSpecialistRole(s.role) || !allowed.has(s.role)) continue;
    suggestions.push({
      role: s.role,
      rationale: typeof s.rationale === "string" ? s.rationale : "",
      first_task_hints: Array.isArray(s.first_task_hints)
        ? s.first_task_hints.filter((h): h is string => typeof h === "string")
        : [],
    });
  }

  return {
    object: typeof b.object === "string" ? b.object : RESULT_OBJECT,
    roles,
    suggestions,
    model: typeof b.model === "string" ? b.model : "unknown",
  };
}

// ---------------------------------------------------------------------------
// Deterministic rules fallback
// ---------------------------------------------------------------------------

/**
 * Keyword→role signals, in the order a matched role is emitted. Small on purpose: this is a
 * "don't block onboarding" path, not a second brain. Hermes is the real mapper.
 */
const FALLBACK_SIGNALS: {
  role: SpecialistRole;
  keywords: string[];
  rationale: string;
  hints: string[];
}[] = [
  {
    role: "cto",
    keywords: ["architecture", "technical strategy", "tech strategy", "platform", "roadmap"],
    rationale: "Answers mention technical direction or architecture.",
    hints: ["Draft the technical roadmap", "Review the current architecture"],
  },
  {
    role: "engineer",
    keywords: ["engineering", "engineer", "developer", "coding", "software", "build the app", "api"],
    rationale: "Answers mention building or maintaining software.",
    hints: ["Scope the first feature", "Set up the project repository"],
  },
  {
    role: "devops",
    keywords: ["deploy", "deployment", "infra", "infrastructure", "hosting", "ci/cd", "uptime"],
    rationale: "Answers mention deployment or infrastructure work.",
    hints: ["Document the deploy pipeline", "Audit hosting and environments"],
  },
  {
    role: "cmo",
    keywords: ["marketing", "leads", "campaign", "growth", "seo", "social media", "audience"],
    rationale: "Answers mention marketing or lead generation.",
    hints: ["Outline the launch campaign", "Define the lead funnel"],
  },
  {
    role: "sales",
    keywords: ["sales", "pipeline", "prospect", "qualification", "qualify", "conversion", "closing", "crm hygiene"],
    rationale: "Answers mention sales pipeline, qualification, or deal conversion work.",
    hints: ["Review the current pipeline", "Qualify the next batch of prospects"],
  },
  {
    role: "support",
    keywords: ["support", "ticket", "tickets", "customer success", "onboarding", "retention", "churn", "renewal"],
    rationale: "Answers mention post-sale support, onboarding, retention, or customer health.",
    hints: ["Triage the current support queue", "Map onboarding and renewal risks"],
  },
  {
    role: "content",
    keywords: ["content", "editorial", "blog", "copywriting", "copy", "newsletter", "publishing calendar"],
    rationale: "Answers mention content production or editorial execution.",
    hints: ["Draft the editorial calendar", "Prepare the first content brief"],
  },
  {
    role: "cfo",
    keywords: ["finance", "financial", "billing", "invoice", "budget", "pricing", "revenue"],
    rationale: "Answers mention finance, billing or budgeting.",
    hints: ["Build the monthly budget", "Review pricing and margins"],
  },
  {
    role: "designer",
    keywords: ["design", "brand", "branding", "ux", "ui", "logo", "visual"],
    rationale: "Answers mention design or brand work.",
    hints: ["Assemble the brand basics", "Draft the key screens"],
  },
  {
    role: "qa",
    keywords: ["testing", "test", "quality", "qa", "bug"],
    rationale: "Answers mention testing or quality.",
    hints: ["Write the smoke-test checklist", "Triage the open bugs"],
  },
  {
    role: "researcher",
    keywords: ["research", "market analysis", "competitor", "insights", "survey"],
    rationale: "Answers mention research or analysis.",
    hints: ["Summarize the competitive landscape", "Collect customer insights"],
  },
  {
    role: "security",
    keywords: ["security", "compliance", "gdpr", "soc 2", "soc2", "privacy", "audit"],
    rationale: "Answers mention security or compliance.",
    hints: ["Run a baseline security review", "List the compliance obligations"],
  },
  {
    role: "pm",
    keywords: ["product management", "product manager", "backlog", "sprint", "prioriti"],
    rationale: "Answers mention product management or planning.",
    hints: ["Groom the backlog", "Define the first milestone"],
  },
];

/** Every string reachable in the answers object, lowercased and joined. */
function collectText(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value.toLowerCase());
  else if (Array.isArray(value)) for (const item of value) collectText(item, out);
  else if (value && typeof value === "object") {
    for (const item of Object.values(value as Record<string, unknown>)) collectText(item, out);
  }
  return out;
}

/**
 * Deterministic keyword mapping used when Hermes is unavailable. Never throws, never blocks
 * onboarding. Result carries `model: "rules-fallback"` so the caller knows it is not an LLM
 * mapping and can re-run later.
 *
 * Empty when the answers carry no usable text at all (no letters anywhere — an empty object,
 * blank strings, pure punctuation/digits); `general` when there IS text but nothing matched.
 */
export function rulesFallbackRoleMap(
  answers: Record<string, unknown>,
  maxRoles?: number,
): RoleMapResult {
  const text = collectText(answers).join(" \n ");
  const empty: RoleMapResult = {
    object: RESULT_OBJECT,
    roles: [],
    suggestions: [],
    model: RULES_FALLBACK_MODEL,
  };
  if (!/[a-z]/.test(text)) return empty;

  const suggestions: RoleSuggestion[] = [];
  for (const signal of FALLBACK_SIGNALS) {
    if (signal.keywords.some((keyword) => text.includes(keyword))) {
      suggestions.push({
        role: signal.role,
        rationale: signal.rationale,
        first_task_hints: [...signal.hints],
      });
    }
  }

  // Text we could read but nothing recognizable in it — a generalist can take it from here.
  if (suggestions.length === 0) {
    suggestions.push({
      role: "general",
      rationale: "No specific department signal found in the answers.",
      first_task_hints: ["Clarify the company's main goal", "List the first three tasks"],
    });
  }

  const capped = typeof maxRoles === "number" ? suggestions.slice(0, maxRoles) : suggestions;
  return {
    object: RESULT_OBJECT,
    roles: capped.map((s) => s.role),
    suggestions: capped,
    model: RULES_FALLBACK_MODEL,
  };
}

/**
 * POST /api/bridge/role-map
 *
 * Body: { answers: object, maxRoles?: number }
 *   →  200 { object, roles: string[], suggestions: [{role, rationale, first_task_hints}], model }
 *
 * Thin forwarder to the Hermes api_server's `/v1/atrium/role-map`, with two guards:
 *   1. the reply is filtered down to the canonical specialist enum before it leaves Conductor;
 *   2. an unreachable or erroring Hermes degrades to a deterministic keyword mapping rather
 *      than failing, marked `model: "rules-fallback"`.
 *
 * Mounted OUTSIDE the cookie-authenticated /api router (alongside the other bridge routes)
 * so Atrium can call it server-to-server. Auth is the SAME bridge shared-secret header
 * that /api/bridge/ensure-agent and /chat validate.
 */
export function bridgeRoleMapRoutes(db: Db) {
  const router = Router();

  router.post("/api/bridge/role-map", async (req: Request, res) => {
    const expected = await resolveBridgeSecret(db);
    if (!expected) {
      logger.error(
        "bridge role-map: no shared secret configured (plugin config or ORBIT_BRIDGE_SECRET)",
      );
      res.status(503).json({ error: "auth_not_configured" });
      return;
    }

    const provided = req.header(SECRET_HEADER);
    if (!provided || !secretsMatch(provided, expected)) {
      logger.warn("bridge role-map: invalid or missing shared secret");
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const parsed = validateBody(req.body);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    let filtered: RoleMapResult | null = null;
    try {
      const result = await hermesApiPost(HERMES_ROLE_MAP_PATH, parsed);
      filtered = result.ok ? filterToCanonicalRoles(result.body) : null;
      if (!filtered) {
        logger.warn(
          { status: result.status },
          "bridge role-map: unusable Hermes reply; using rules fallback",
        );
      }
    } catch (err) {
      logger.error({ err }, "bridge role-map: Hermes unreachable; using rules fallback");
      filtered = null;
    }

    const payload = filtered ?? rulesFallbackRoleMap(parsed.answers, parsed.maxRoles);
    logger.info(
      { model: payload.model, roles: payload.roles },
      "bridge role-map: returning role map",
    );
    res.status(200).json(payload);
  });

  return router;
}

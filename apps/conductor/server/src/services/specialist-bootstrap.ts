import type { Db } from "@paperclipai/db";
import { accessService } from "./access.js";
import { logActivity } from "./activity-log.js";
import { agentInstructionsService } from "./agent-instructions.js";
import { agentProvisioningService } from "./agent-provisioning.js";
import { agentService } from "./agents.js";
import {
  BOOTSTRAP_CEO_ADAPTER_TYPE,
  BOOTSTRAP_CEO_GRACE_SEC,
  BOOTSTRAP_CEO_HEARTBEAT,
  BOOTSTRAP_CEO_MODEL,
  BOOTSTRAP_CEO_TIMEOUT_SEC,
} from "./onboarding-bootstrap.js";

// ---------------------------------------------------------------------------
// Specialist seed.
//
// The department roster a company gets on top of its CEO. This is the CEO seed
// (`bootstrapCompanyAgents`) generalized from one fixed role to a caller-supplied
// list of canonical roles: same in-process creation path, same provisioning steps
// (default instructions bundle + `tasks:assign` grant), same activity log entry.
// The CEO seed itself is untouched — CEO remains seeded at company creation and is
// deliberately NOT reachable through this module.
// ---------------------------------------------------------------------------

/**
 * Canonical specialist roles. Each entry has a matching persona bundle under
 * `server/src/onboarding-assets/<role>/`, which is what
 * `resolveDefaultAgentInstructionsBundleRole` keys off when the bundle materializes.
 *
 * `ceo` is excluded on purpose (company-creation seeds it, and it is the only role that
 * yields `permissions.canCreateAgents`), and so is `default` — that is the bundle
 * fallback for unrecognized roles, not a role anyone can ask for.
 */
export const SPECIALIST_ROLES = [
  "cto",
  "cmo",
  "cfo",
  "designer",
  "devops",
  "engineer",
  "pm",
  "qa",
  "researcher",
  "security",
  "sales",
  "support",
  "content",
  "general",
] as const;

export type SpecialistRole = (typeof SPECIALIST_ROLES)[number];

const SPECIALIST_ROLE_SET: ReadonlySet<string> = new Set(SPECIALIST_ROLES);

export function isSpecialistRole(value: unknown): value is SpecialistRole {
  return typeof value === "string" && SPECIALIST_ROLE_SET.has(value);
}

/** Display name + title per role. `agentService.create` deduplicates the name if taken. */
const SPECIALIST_PROFILES: Record<SpecialistRole, { name: string; title: string }> = {
  cto: { name: "CTO", title: "Chief Technology Officer" },
  cmo: { name: "CMO", title: "Chief Marketing Officer" },
  cfo: { name: "CFO", title: "Chief Financial Officer" },
  designer: { name: "Designer", title: "Product Designer" },
  devops: { name: "DevOps", title: "DevOps Engineer" },
  engineer: { name: "Engineer", title: "Software Engineer" },
  pm: { name: "PM", title: "Product Manager" },
  qa: { name: "QA", title: "QA Engineer" },
  researcher: { name: "Researcher", title: "Research Analyst" },
  security: { name: "Security", title: "Security Engineer" },
  sales: { name: "Sales", title: "Sales Lead" },
  support: { name: "Support", title: "Customer Success Lead" },
  content: { name: "Content", title: "Content Lead" },
  general: { name: "Generalist", title: "Generalist" },
};

/**
 * Metadata marker so a seeded specialist stays recognizable even if its role column is
 * later edited. Mirrors `BOOTSTRAP_CEO_METADATA_KEY`, but carries the role it was seeded
 * for (rather than `true`) because a company holds many specialists, one per role.
 */
export const BOOTSTRAP_SPECIALIST_METADATA_KEY = "orbit_bootstrap_specialist";

/** `activityLog.actorId` for this system-initiated seed. */
export const BOOTSTRAP_SPECIALIST_ACTOR_ID = "specialist_bootstrap";

export type EnsureSpecialistAgentsOptions = {
  /**
   * User that requested provisioning, when there is one. System-initiated seeds leave this
   * unset: `access.setPrincipalPermission` accepts a null `grantedByUserId`.
   */
  grantedByUserId?: string | null;
  /** Manager for newly created specialists, normally the company CEO. Omitted → top-level. */
  reportsTo?: string | null;
};

export type EnsuredSpecialistAgent = {
  role: SpecialistRole;
  agentId: string;
  created: boolean;
};

function markerRole(metadata: unknown): string | null {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return null;
  const marked = (metadata as Record<string, unknown>)[BOOTSTRAP_SPECIALIST_METADATA_KEY];
  return typeof marked === "string" ? marked : null;
}

/**
 * Ensure a company has one specialist agent per requested role.
 *
 * Idempotent per role: if the company already has an agent in that role (by role column, or
 * by this module's metadata marker) nothing is created and the existing id is returned with
 * `created: false`. Otherwise the agent is created, its role persona bundle is materialized,
 * and the default `tasks:assign` grant is applied — the same provisioning steps the CEO seed
 * and the agent-create routes run, through the same extracted service.
 *
 * Permissions are deliberately never passed: `agentService.create` derives them from the role
 * (`normalizeAgentPermissions`), and only `role === "ceo"` yields `canCreateAgents`. A
 * specialist therefore gets exactly what a normal specialist agent gets today.
 *
 * Roles are processed in order and de-duplication is the caller's job. Failures propagate.
 */
export async function ensureCompanySpecialistAgents(
  db: Db,
  companyId: string,
  roles: readonly SpecialistRole[],
  opts: EnsureSpecialistAgentsOptions = {},
): Promise<EnsuredSpecialistAgent[]> {
  const agents = agentService(db);
  const provisioning = agentProvisioningService({
    agents,
    access: accessService(db),
    instructions: agentInstructionsService(),
  });

  const result: EnsuredSpecialistAgent[] = [];

  for (const role of roles) {
    // 1. Idempotency guard — `list` already excludes terminated agents. Re-read per role so
    //    an agent created earlier in this same batch is visible to the roles after it.
    const existing = (await agents.list(companyId)).find(
      (agent) => agent.role === role || markerRole(agent.metadata) === role,
    );
    if (existing) {
      result.push({ role, agentId: existing.id, created: false });
      continue;
    }

    // 2. Create the specialist. `adapterConfig` deliberately carries no `instructions*` keys:
    //    any of them would make step 3 treat the bundle as explicitly configured and skip
    //    materialization, leaving the specialist without its persona.
    const profile = SPECIALIST_PROFILES[role];
    const agent = await agents.create(companyId, {
      name: profile.name,
      title: profile.title,
      role,
      adapterType: BOOTSTRAP_CEO_ADAPTER_TYPE,
      status: "idle",
      metadata: { [BOOTSTRAP_SPECIALIST_METADATA_KEY]: role },
      adapterConfig: {
        model: BOOTSTRAP_CEO_MODEL,
        dangerouslyBypassApprovalsAndSandbox: true,
        graceSec: BOOTSTRAP_CEO_GRACE_SEC,
        timeoutSec: BOOTSTRAP_CEO_TIMEOUT_SEC,
      },
      runtimeConfig: { heartbeat: { ...BOOTSTRAP_CEO_HEARTBEAT } },
      // Omitted entirely (never null) when no manager was resolved, so the fallback shape is
      // a plain top-level agent.
      ...(opts.reportsTo ? { reportsTo: opts.reportsTo } : {}),
    });

    // 3. Materialize the role's default instructions bundle (`onboarding-assets/<role>/`).
    await provisioning.materializeDefaultInstructionsBundleForNewAgent(agent);

    // 4. Apply the default `tasks:assign` grant.
    await provisioning.applyDefaultAgentTaskAssignGrant(
      companyId,
      agent.id,
      opts.grantedByUserId ?? null,
    );

    // 5. Record the creation.
    await logActivity(db, {
      companyId,
      actorType: "system",
      actorId: BOOTSTRAP_SPECIALIST_ACTOR_ID,
      action: "agent.created",
      entityType: "agent",
      entityId: agent.id,
      details: {
        name: agent.name,
        role: agent.role,
        source: BOOTSTRAP_SPECIALIST_ACTOR_ID,
      },
    });

    result.push({ role, agentId: agent.id, created: true });
  }

  return result;
}

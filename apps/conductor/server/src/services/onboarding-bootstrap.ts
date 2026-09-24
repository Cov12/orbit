import type { Db } from "@paperclipai/db";
import { accessService } from "./access.js";
import { logActivity } from "./activity-log.js";
import { agentInstructionsService } from "./agent-instructions.js";
import { agentProvisioningService } from "./agent-provisioning.js";
import { agentService } from "./agents.js";

// ---------------------------------------------------------------------------
// CEO seed values.
//
// These mirror the live Orbit CEO agent's configuration. A freshly onboarded
// company's CEO should start from the same shape, so keep them in sync with
// that agent rather than diverging per call site.
// ---------------------------------------------------------------------------

/** Display name for the seeded CEO. `agentService.create` deduplicates it if taken. */
export const BOOTSTRAP_CEO_NAME = "CEO";
export const BOOTSTRAP_CEO_TITLE = "Chief Executive Officer";
export const BOOTSTRAP_CEO_ROLE = "ceo";
export const BOOTSTRAP_CEO_ADAPTER_TYPE = "codex_local";
export const BOOTSTRAP_CEO_MODEL = "gpt-5.4";
export const BOOTSTRAP_CEO_GRACE_SEC = 15;
export const BOOTSTRAP_CEO_TIMEOUT_SEC = 600;

/** Metadata marker so a bootstrapped CEO stays recognizable even if its role changes. */
export const BOOTSTRAP_CEO_METADATA_KEY = "orbit_bootstrap_ceo";

/** `activityLog.actorId` for this system-initiated seed (mirrors `hire-hook`'s convention). */
export const BOOTSTRAP_ACTOR_ID = "onboarding_bootstrap";

/**
 * Timer heartbeat stays off, matching the repo-wide default documented in
 * `skills/paperclip-create-agent/SKILL.md` ("leave timer heartbeats off by
 * default; only enable with an explicit justification and `intervalSec`").
 *
 * The assistant -> CEO handoff still works without a timer: on-demand /
 * assignment wakeups are gated on `heartbeat.wakeOnDemand`, which defaults to
 * true (`heartbeatService.parseHeartbeatPolicy`). A timer interval can be
 * enabled later if the CEO turns out to need scheduled recurring work.
 */
export const BOOTSTRAP_CEO_HEARTBEAT: Record<string, unknown> = {
  enabled: false,
  wakeOnDemand: true,
};

export type BootstrapCompanyAgentsOptions = {
  /**
   * User that requested onboarding, when there is one. System-initiated seeds
   * leave this unset: `access.setPrincipalPermission` accepts a null
   * `grantedByUserId`, which is also what the agent-create routes pass for
   * non-user actors. No sentinel user id is fabricated.
   */
  grantedByUserId?: string | null;
};

export type BootstrapCompanyAgentsResult = {
  ceoId: string;
  created: boolean;
};

function hasBootstrapMarker(metadata: unknown): boolean {
  if (typeof metadata !== "object" || metadata === null || Array.isArray(metadata)) return false;
  return (metadata as Record<string, unknown>)[BOOTSTRAP_CEO_METADATA_KEY] === true;
}

function isExistingCeo(agent: { role: string; metadata: unknown }): boolean {
  return agent.role === BOOTSTRAP_CEO_ROLE || hasBootstrapMarker(agent.metadata);
}

/**
 * Seed a company's CEO agent.
 *
 * Idempotent: if the company already has a CEO (by role, or by this module's
 * metadata marker) nothing is created. Otherwise the CEO is created, its
 * default instructions bundle is materialized, and the default `tasks:assign`
 * grant is applied — the same provisioning steps the agent-create routes run,
 * reusing the same extracted service.
 *
 * Failures propagate, matching the routes' behavior; callers that need the seed
 * to be non-fatal wrap the call.
 */
export async function bootstrapCompanyAgents(
  db: Db,
  companyId: string,
  opts: BootstrapCompanyAgentsOptions = {},
): Promise<BootstrapCompanyAgentsResult> {
  const agents = agentService(db);

  // 1. Idempotency guard — `list` already excludes terminated agents.
  const existingCeo = (await agents.list(companyId)).find(isExistingCeo);
  if (existingCeo) {
    return { ceoId: existingCeo.id, created: false };
  }

  // 2. Create the CEO. `role: "ceo"` is what yields `permissions.canCreateAgents`,
  //    so permissions are deliberately not passed. `adapterConfig` deliberately
  //    carries no `instructions*` keys: any of them would make step 3 treat the
  //    bundle as explicitly configured and skip materialization, leaving the CEO
  //    without a persona.
  const ceo = await agents.create(companyId, {
    name: BOOTSTRAP_CEO_NAME,
    title: BOOTSTRAP_CEO_TITLE,
    role: BOOTSTRAP_CEO_ROLE,
    adapterType: BOOTSTRAP_CEO_ADAPTER_TYPE,
    reportsTo: null,
    status: "idle",
    metadata: { [BOOTSTRAP_CEO_METADATA_KEY]: true },
    adapterConfig: {
      model: BOOTSTRAP_CEO_MODEL,
      dangerouslyBypassApprovalsAndSandbox: true,
      graceSec: BOOTSTRAP_CEO_GRACE_SEC,
      timeoutSec: BOOTSTRAP_CEO_TIMEOUT_SEC,
    },
    runtimeConfig: { heartbeat: { ...BOOTSTRAP_CEO_HEARTBEAT } },
  });

  const provisioning = agentProvisioningService({
    agents,
    access: accessService(db),
    instructions: agentInstructionsService(),
  });

  // 3. Materialize the default role instructions bundle.
  await provisioning.materializeDefaultInstructionsBundleForNewAgent(ceo);

  // 4. Apply the default `tasks:assign` grant.
  await provisioning.applyDefaultAgentTaskAssignGrant(
    companyId,
    ceo.id,
    opts.grantedByUserId ?? null,
  );

  // 5. Record the creation.
  await logActivity(db, {
    companyId,
    actorType: "system",
    actorId: BOOTSTRAP_ACTOR_ID,
    action: "agent.created",
    entityType: "agent",
    entityId: ceo.id,
    details: {
      name: ceo.name,
      role: ceo.role,
      source: BOOTSTRAP_ACTOR_ID,
    },
  });

  return { ceoId: ceo.id, created: true };
}

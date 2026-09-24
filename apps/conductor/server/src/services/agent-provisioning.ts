import { findActiveServerAdapter } from "../adapters/index.js";
import {
  loadDefaultAgentInstructionsBundle,
  resolveDefaultAgentInstructionsBundleRole,
} from "./default-agent-instructions.js";
import type { accessService } from "./access.js";
import type { agentInstructionsService } from "./agent-instructions.js";
import type { agentService } from "./agents.js";

// Legacy hardcoded maps — used as fallback when adapter module does not
// declare capability flags explicitly.
export const DEFAULT_INSTRUCTIONS_PATH_KEYS: Record<string, string> = {
  claude_local: "instructionsFilePath",
  codex_local: "instructionsFilePath",
  droid_local: "instructionsFilePath",
  gemini_local: "instructionsFilePath",
  hermes_local: "instructionsFilePath",
  opencode_local: "instructionsFilePath",
  cursor: "instructionsFilePath",
  pi_local: "instructionsFilePath",
};
const DEFAULT_MANAGED_INSTRUCTIONS_ADAPTER_TYPES = new Set(Object.keys(DEFAULT_INSTRUCTIONS_PATH_KEYS));

/** Check if an adapter supports the managed instructions bundle. */
export function adapterSupportsInstructionsBundle(adapterType: string): boolean {
  const adapter = findActiveServerAdapter(adapterType);
  if (adapter?.supportsInstructionsBundle !== undefined) return adapter.supportsInstructionsBundle;
  return DEFAULT_MANAGED_INSTRUCTIONS_ADAPTER_TYPES.has(adapterType);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Services are injected rather than constructed here so that route-level test
 * doubles (which mock the `../services/index.js` barrel) stay effective.
 */
export type AgentProvisioningDeps = {
  agents: Pick<ReturnType<typeof agentService>, "update">;
  access: Pick<ReturnType<typeof accessService>, "ensureMembership" | "setPrincipalPermission">;
  instructions: Pick<ReturnType<typeof agentInstructionsService>, "materializeManagedBundle">;
};

export function agentProvisioningService(deps: AgentProvisioningDeps) {
  const { agents: svc, access, instructions } = deps;

  async function applyDefaultAgentTaskAssignGrant(
    companyId: string,
    agentId: string,
    grantedByUserId: string | null,
  ) {
    await access.ensureMembership(companyId, "agent", agentId, "member", "active");
    await access.setPrincipalPermission(
      companyId,
      "agent",
      agentId,
      "tasks:assign",
      true,
      grantedByUserId,
    );
  }

  async function materializeDefaultInstructionsBundleForNewAgent<T extends {
    id: string;
    companyId: string;
    name: string;
    role: string;
    adapterType: string;
    adapterConfig: unknown;
  }>(agent: T): Promise<T> {
    if (!adapterSupportsInstructionsBundle(agent.adapterType)) {
      return agent;
    }

    const adapterConfig = asRecord(agent.adapterConfig) ?? {};
    const hasExplicitInstructionsBundle =
      Boolean(asNonEmptyString(adapterConfig.instructionsBundleMode))
      || Boolean(asNonEmptyString(adapterConfig.instructionsRootPath))
      || Boolean(asNonEmptyString(adapterConfig.instructionsEntryFile))
      || Boolean(asNonEmptyString(adapterConfig.instructionsFilePath))
      || Boolean(asNonEmptyString(adapterConfig.agentsMdPath));
    if (hasExplicitInstructionsBundle) {
      return agent;
    }

    const promptTemplate = typeof adapterConfig.promptTemplate === "string"
      ? adapterConfig.promptTemplate
      : "";
    const files = promptTemplate.trim().length === 0
      ? await loadDefaultAgentInstructionsBundle(resolveDefaultAgentInstructionsBundleRole(agent.role))
      : { "AGENTS.md": promptTemplate };
    const materialized = await instructions.materializeManagedBundle(
      agent,
      files,
      { entryFile: "AGENTS.md", replaceExisting: false },
    );
    const nextAdapterConfig = { ...materialized.adapterConfig };
    delete nextAdapterConfig.promptTemplate;

    const updated = await svc.update(agent.id, { adapterConfig: nextAdapterConfig });
    return (updated as T | null) ?? { ...agent, adapterConfig: nextAdapterConfig };
  }

  return {
    materializeDefaultInstructionsBundleForNewAgent,
    applyDefaultAgentTaskAssignGrant,
  };
}

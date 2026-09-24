import fs from "node:fs/promises";

const DEFAULT_AGENT_BUNDLE_FILES = {
  default: {
    "AGENTS.md": "default/AGENTS.md",
    "CORE.md": "shared/CORE.md",
    "ECOSYSTEM.md": "shared/ECOSYSTEM.md",
  },
  ceo: {
    "AGENTS.md": "ceo/AGENTS.md",
    "HEARTBEAT.md": "ceo/HEARTBEAT.md",
    "SOUL.md": "ceo/SOUL.md",
    "TOOLS.md": "ceo/TOOLS.md",
    "CORE.md": "shared/CORE.md",
    "ECOSYSTEM.md": "shared/ECOSYSTEM.md",
  },
  cto: {
    "AGENTS.md": "cto/AGENTS.md",
    "TOOLS.md": "cto/TOOLS.md",
    "CORE.md": "shared/CORE.md",
    "ECOSYSTEM.md": "shared/ECOSYSTEM.md",
  },
  cmo: {
    "AGENTS.md": "cmo/AGENTS.md",
    "TOOLS.md": "cmo/TOOLS.md",
    "CORE.md": "shared/CORE.md",
    "ECOSYSTEM.md": "shared/ECOSYSTEM.md",
  },
  cfo: {
    "AGENTS.md": "cfo/AGENTS.md",
    "TOOLS.md": "cfo/TOOLS.md",
    "CORE.md": "shared/CORE.md",
    "ECOSYSTEM.md": "shared/ECOSYSTEM.md",
  },
  engineer: {
    "AGENTS.md": "engineer/AGENTS.md",
    "TOOLS.md": "engineer/TOOLS.md",
    "CORE.md": "shared/CORE.md",
    "ECOSYSTEM.md": "shared/ECOSYSTEM.md",
  },
  designer: {
    "AGENTS.md": "designer/AGENTS.md",
    "TOOLS.md": "designer/TOOLS.md",
    "CORE.md": "shared/CORE.md",
    "ECOSYSTEM.md": "shared/ECOSYSTEM.md",
  },
  pm: {
    "AGENTS.md": "pm/AGENTS.md",
    "TOOLS.md": "pm/TOOLS.md",
    "CORE.md": "shared/CORE.md",
    "ECOSYSTEM.md": "shared/ECOSYSTEM.md",
  },
  qa: {
    "AGENTS.md": "qa/AGENTS.md",
    "TOOLS.md": "qa/TOOLS.md",
    "CORE.md": "shared/CORE.md",
    "ECOSYSTEM.md": "shared/ECOSYSTEM.md",
  },
  devops: {
    "AGENTS.md": "devops/AGENTS.md",
    "TOOLS.md": "devops/TOOLS.md",
    "CORE.md": "shared/CORE.md",
    "ECOSYSTEM.md": "shared/ECOSYSTEM.md",
  },
  security: {
    "AGENTS.md": "security/AGENTS.md",
    "TOOLS.md": "security/TOOLS.md",
    "CORE.md": "shared/CORE.md",
    "ECOSYSTEM.md": "shared/ECOSYSTEM.md",
  },
  researcher: {
    "AGENTS.md": "researcher/AGENTS.md",
    "TOOLS.md": "researcher/TOOLS.md",
    "CORE.md": "shared/CORE.md",
    "ECOSYSTEM.md": "shared/ECOSYSTEM.md",
  },
  sales: {
    "AGENTS.md": "sales/AGENTS.md",
    "TOOLS.md": "sales/TOOLS.md",
    "CORE.md": "shared/CORE.md",
    "ECOSYSTEM.md": "shared/ECOSYSTEM.md",
  },
  support: {
    "AGENTS.md": "support/AGENTS.md",
    "TOOLS.md": "support/TOOLS.md",
    "CORE.md": "shared/CORE.md",
    "ECOSYSTEM.md": "shared/ECOSYSTEM.md",
  },
  content: {
    "AGENTS.md": "content/AGENTS.md",
    "TOOLS.md": "content/TOOLS.md",
    "CORE.md": "shared/CORE.md",
    "ECOSYSTEM.md": "shared/ECOSYSTEM.md",
  },
  general: {
    "AGENTS.md": "general/AGENTS.md",
    "TOOLS.md": "general/TOOLS.md",
    "CORE.md": "shared/CORE.md",
    "ECOSYSTEM.md": "shared/ECOSYSTEM.md",
  },
} as const;

type DefaultAgentBundleRole = keyof typeof DEFAULT_AGENT_BUNDLE_FILES;

function resolveDefaultAgentBundleUrl(sourcePath: string) {
  return new URL(`../onboarding-assets/${sourcePath}`, import.meta.url);
}

export async function loadDefaultAgentInstructionsBundle(role: DefaultAgentBundleRole): Promise<Record<string, string>> {
  const fileMap = DEFAULT_AGENT_BUNDLE_FILES[role];
  const entries = await Promise.all(
    Object.entries(fileMap).map(async ([targetPath, sourcePath]) => {
      const content = await fs.readFile(resolveDefaultAgentBundleUrl(sourcePath), "utf8");
      return [targetPath, content] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export function resolveDefaultAgentInstructionsBundleRole(role: string): DefaultAgentBundleRole {
  if (
    role === "ceo"
    || role === "cto"
    || role === "cmo"
    || role === "cfo"
    || role === "engineer"
    || role === "designer"
    || role === "pm"
    || role === "qa"
    || role === "devops"
    || role === "security"
    || role === "researcher"
    || role === "sales"
    || role === "support"
    || role === "content"
    || role === "general"
  ) {
    return role;
  }

  return "default";
}

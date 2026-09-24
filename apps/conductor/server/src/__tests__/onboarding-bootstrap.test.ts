import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAgentService = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

const mockAccessService = vi.hoisted(() => ({
  ensureMembership: vi.fn(),
  setPrincipalPermission: vi.fn(),
}));

const mockAgentInstructionsService = vi.hoisted(() => ({
  materializeManagedBundle: vi.fn(),
}));

const mockProvisioning = vi.hoisted(() => ({
  materializeDefaultInstructionsBundleForNewAgent: vi.fn(),
  applyDefaultAgentTaskAssignGrant: vi.fn(),
}));
const mockAgentProvisioningService = vi.hoisted(() => vi.fn(() => mockProvisioning));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/agents.js", () => ({
  agentService: () => mockAgentService,
}));
vi.mock("../services/access.js", () => ({
  accessService: () => mockAccessService,
}));
vi.mock("../services/agent-instructions.js", () => ({
  agentInstructionsService: () => mockAgentInstructionsService,
}));
vi.mock("../services/agent-provisioning.js", () => ({
  agentProvisioningService: mockAgentProvisioningService,
}));
vi.mock("../services/activity-log.js", () => ({
  logActivity: mockLogActivity,
}));

const {
  BOOTSTRAP_CEO_METADATA_KEY,
  BOOTSTRAP_CEO_MODEL,
  bootstrapCompanyAgents,
} = await import("../services/onboarding-bootstrap.js");

const COMPANY_ID = "11111111-1111-1111-1111-111111111111";
const db = {} as never;

function agentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "agent-existing",
    companyId: COMPANY_ID,
    name: "Existing",
    role: "engineer",
    adapterType: "codex_local",
    adapterConfig: {},
    metadata: null,
    ...overrides,
  };
}

describe("bootstrapCompanyAgents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProvisioning.materializeDefaultInstructionsBundleForNewAgent.mockImplementation(
      async (agent: unknown) => agent,
    );
    mockProvisioning.applyDefaultAgentTaskAssignGrant.mockResolvedValue(undefined);
    mockLogActivity.mockResolvedValue(undefined);
  });

  it("is idempotent when the company already has a role:ceo agent", async () => {
    mockAgentService.list.mockResolvedValue([
      agentRow({ id: "agent-engineer" }),
      agentRow({ id: "agent-ceo", name: "CEO", role: "ceo" }),
    ]);

    const result = await bootstrapCompanyAgents(db, COMPANY_ID);

    expect(result).toEqual({ ceoId: "agent-ceo", created: false });
    expect(mockAgentService.list).toHaveBeenCalledWith(COMPANY_ID);
    expect(mockAgentService.create).not.toHaveBeenCalled();
    expect(mockProvisioning.materializeDefaultInstructionsBundleForNewAgent).not.toHaveBeenCalled();
    expect(mockProvisioning.applyDefaultAgentTaskAssignGrant).not.toHaveBeenCalled();
    expect(mockAccessService.setPrincipalPermission).not.toHaveBeenCalled();
    expect(mockLogActivity).not.toHaveBeenCalled();
  });

  it("is idempotent when an agent carries the bootstrap metadata marker", async () => {
    mockAgentService.list.mockResolvedValue([
      agentRow({
        id: "agent-marked",
        role: "general",
        metadata: { [BOOTSTRAP_CEO_METADATA_KEY]: true },
      }),
    ]);

    const result = await bootstrapCompanyAgents(db, COMPANY_ID);

    expect(result).toEqual({ ceoId: "agent-marked", created: false });
    expect(mockAgentService.create).not.toHaveBeenCalled();
  });

  it("seeds the CEO, materializes its bundle and applies the tasks:assign grant", async () => {
    mockAgentService.list.mockResolvedValue([]);
    const createdAgent = agentRow({
      id: "agent-new-ceo",
      name: "CEO",
      role: "ceo",
      metadata: { [BOOTSTRAP_CEO_METADATA_KEY]: true },
    });
    mockAgentService.create.mockResolvedValue(createdAgent);

    const result = await bootstrapCompanyAgents(db, COMPANY_ID);

    expect(result).toEqual({ ceoId: "agent-new-ceo", created: true });

    expect(mockAgentService.create).toHaveBeenCalledTimes(1);
    const [createCompanyId, createInput] = mockAgentService.create.mock.calls[0] as [
      string,
      Record<string, unknown>,
    ];
    expect(createCompanyId).toBe(COMPANY_ID);
    expect(createInput.role).toBe("ceo");
    expect(createInput.adapterType).toBe("codex_local");
    expect(createInput.reportsTo).toBeNull();
    expect(createInput.metadata).toEqual({ [BOOTSTRAP_CEO_METADATA_KEY]: true });
    expect(createInput.permissions).toBeUndefined();

    // Any instructions* key would suppress materialization below.
    const adapterConfig = createInput.adapterConfig as Record<string, unknown>;
    expect(Object.keys(adapterConfig).filter((key) => key.startsWith("instructions"))).toEqual([]);
    expect(adapterConfig).toEqual({
      model: BOOTSTRAP_CEO_MODEL,
      dangerouslyBypassApprovalsAndSandbox: true,
      graceSec: 15,
      timeoutSec: 600,
    });

    const runtimeConfig = createInput.runtimeConfig as { heartbeat: Record<string, unknown> };
    expect(runtimeConfig.heartbeat).toEqual({ enabled: false, wakeOnDemand: true });

    expect(mockProvisioning.materializeDefaultInstructionsBundleForNewAgent).toHaveBeenCalledTimes(1);
    expect(mockProvisioning.materializeDefaultInstructionsBundleForNewAgent).toHaveBeenCalledWith(
      createdAgent,
    );

    expect(mockProvisioning.applyDefaultAgentTaskAssignGrant).toHaveBeenCalledTimes(1);
    expect(mockProvisioning.applyDefaultAgentTaskAssignGrant).toHaveBeenCalledWith(
      COMPANY_ID,
      "agent-new-ceo",
      null,
    );

    expect(mockLogActivity).toHaveBeenCalledTimes(1);
    expect(mockLogActivity.mock.calls[0]?.[1]).toMatchObject({
      companyId: COMPANY_ID,
      actorType: "system",
      action: "agent.created",
      entityType: "agent",
      entityId: "agent-new-ceo",
    });
  });

  it("passes an explicit requesting user through to the grant", async () => {
    mockAgentService.list.mockResolvedValue([]);
    mockAgentService.create.mockResolvedValue(agentRow({ id: "agent-new-ceo", role: "ceo" }));

    await bootstrapCompanyAgents(db, COMPANY_ID, { grantedByUserId: "user-1" });

    expect(mockProvisioning.applyDefaultAgentTaskAssignGrant).toHaveBeenCalledWith(
      COMPANY_ID,
      "agent-new-ceo",
      "user-1",
    );
  });

  it("propagates materialization failures instead of swallowing them", async () => {
    mockAgentService.list.mockResolvedValue([]);
    mockAgentService.create.mockResolvedValue(agentRow({ id: "agent-new-ceo", role: "ceo" }));
    mockProvisioning.materializeDefaultInstructionsBundleForNewAgent.mockRejectedValue(
      new Error("bundle boom"),
    );

    await expect(bootstrapCompanyAgents(db, COMPANY_ID)).rejects.toThrow("bundle boom");
    expect(mockProvisioning.applyDefaultAgentTaskAssignGrant).not.toHaveBeenCalled();
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockEnvironmentService = vi.hoisted(() => ({
  ensureLocalEnvironment: vi.fn(),
}));

const mockBootstrapCompanyAgents = vi.hoisted(() => vi.fn());

const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}));

vi.mock("../services/environments.js", () => ({
  environmentService: () => mockEnvironmentService,
}));
vi.mock("../services/onboarding-bootstrap.js", () => ({
  bootstrapCompanyAgents: mockBootstrapCompanyAgents,
}));
vi.mock("../middleware/logger.js", () => ({
  logger: mockLogger,
}));

const { companyService } = await import("../services/companies.js");

const COMPANY_ID = "22222222-2222-2222-2222-222222222222";

/**
 * Minimal drizzle-shaped stub. `companies.ts` runs two select shapes:
 *   - the company query: `.select(companySelection).from().leftJoin().where()`
 *   - the monthly spend rollup: `.select({ companyId, ... }).from().where().groupBy()`
 * Both are chainable thenables here; the spend selection is the one that carries
 * a `companyId` key, which is how the stub tells them apart.
 */
function makeSelectBuilder(rows: unknown[]) {
  const builder: Record<string, unknown> = {
    from: () => builder,
    leftJoin: () => builder,
    where: () => builder,
    groupBy: () => builder,
    then: (onFulfilled: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(onFulfilled, onRejected),
  };
  return builder;
}

function makeDb() {
  const companyRow = {
    id: COMPANY_ID,
    name: "Acme",
    spentMonthlyCents: 0,
    logoAssetId: null,
  };
  return {
    insert: vi.fn(() => ({
      values: () => ({ returning: async () => [{ id: COMPANY_ID, name: "Acme" }] }),
    })),
    select: vi.fn((selection: Record<string, unknown>) =>
      makeSelectBuilder("companyId" in selection ? [] : [companyRow]),
    ),
  };
}

describe("companyService.create — CEO seed wiring", () => {
  let db!: ReturnType<typeof makeDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    db = makeDb();
    mockEnvironmentService.ensureLocalEnvironment.mockResolvedValue(undefined);
    mockBootstrapCompanyAgents.mockResolvedValue({ ceoId: "agent-ceo", created: true });
  });

  it("seeds the CEO by default, after the local environment exists", async () => {
    const svc = companyService(db as never);

    const created = await svc.create({ name: "Acme" } as never);

    expect(created).toMatchObject({ id: COMPANY_ID, name: "Acme" });
    expect(mockBootstrapCompanyAgents).toHaveBeenCalledTimes(1);
    expect(mockBootstrapCompanyAgents).toHaveBeenCalledWith(db, COMPANY_ID);

    // The seeded CEO has to be able to resolve its local environment.
    expect(mockEnvironmentService.ensureLocalEnvironment).toHaveBeenCalledWith(COMPANY_ID);
    expect(mockEnvironmentService.ensureLocalEnvironment.mock.invocationCallOrder[0]).toBeLessThan(
      mockBootstrapCompanyAgents.mock.invocationCallOrder[0]!,
    );
  });

  it("seeds the CEO when opts is passed without bootstrapAgents", async () => {
    const svc = companyService(db as never);

    await svc.create({ name: "Acme" } as never, {});

    expect(mockBootstrapCompanyAgents).toHaveBeenCalledTimes(1);
  });

  it("skips the seed when bootstrapAgents is false", async () => {
    const svc = companyService(db as never);

    const created = await svc.create({ name: "Acme" } as never, { bootstrapAgents: false });

    expect(created).toMatchObject({ id: COMPANY_ID });
    expect(mockBootstrapCompanyAgents).not.toHaveBeenCalled();
    expect(mockEnvironmentService.ensureLocalEnvironment).toHaveBeenCalledWith(COMPANY_ID);
  });

  it("swallows and logs seed failures so company creation still succeeds", async () => {
    const svc = companyService(db as never);
    const err = new Error("seed boom");
    mockBootstrapCompanyAgents.mockRejectedValue(err);

    const created = await svc.create({ name: "Acme" } as never);

    expect(created).toMatchObject({ id: COMPANY_ID, name: "Acme" });
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith(
      { err, companyId: COMPANY_ID },
      expect.stringContaining("bootstrap"),
    );
  });
});

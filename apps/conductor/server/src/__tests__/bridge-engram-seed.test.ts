import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The route is a thin forwarder: its only outbound dependency is the shared Hermes client,
// which is mocked here so NO real network call is ever made. The plugin registry is mocked
// to force resolveBridgeSecret onto its ORBIT_BRIDGE_SECRET env fallback, mirroring
// bridge-ensure-department-agents.test.ts.
const hermesApiPost = vi.fn();

vi.mock("../services/hermes-api-client.js", () => ({
  hermesApiPost: (...args: unknown[]) => hermesApiPost(...args),
  HermesApiError: class HermesApiError extends Error {},
}));

vi.mock("../services/plugin-registry.js", () => ({
  pluginRegistryService: () => ({
    getByKey: async () => null,
    getConfig: async () => null,
  }),
}));

import { bridgeEngramSeedRoutes } from "../routes/bridge-engram-seed.js";

const BRIDGE_SECRET = "bridge-secret-for-tests-0123456789";
const SECRET_HEADER = "x-orbit-bridge-secret";
const ENDPOINT = "/api/bridge/engram-seed";
const COMPANY_ID = "co_123";

const originalSecret = process.env.ORBIT_BRIDGE_SECRET;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(
    bridgeEngramSeedRoutes({} as unknown as Parameters<typeof bridgeEngramSeedRoutes>[0]),
  );
  return app;
}

function post(body: unknown, secret: string | null = BRIDGE_SECRET) {
  const req = request(createApp()).post(ENDPOINT);
  if (secret !== null) req.set(SECRET_HEADER, secret);
  return req.send(body as object);
}

/** Shape the real Hermes `/v1/memory/seed` verb returns. */
const HERMES_OK = {
  status: "ok",
  scope: "company",
  collection: "engram_co_123",
  written: 2,
  skipped: 0,
  readback: ["Acme sells widgets.", "Founded 2019."],
};

beforeEach(() => {
  hermesApiPost.mockReset();
  process.env.ORBIT_BRIDGE_SECRET = BRIDGE_SECRET;
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.ORBIT_BRIDGE_SECRET;
  else process.env.ORBIT_BRIDGE_SECRET = originalSecret;
});

describe.sequential("bridge engram-seed", () => {
  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it("returns 401 for a missing secret and calls Hermes not at all", async () => {
    const res = await post({ companyId: COMPANY_ID, facts: ["a"] }, null);
    expect(res.status).toBe(401);
    expect(hermesApiPost).not.toHaveBeenCalled();
  });

  it("returns 401 for a wrong secret", async () => {
    const res = await post({ companyId: COMPANY_ID, facts: ["a"] }, "wrong");
    expect(res.status).toBe(401);
    expect(hermesApiPost).not.toHaveBeenCalled();
  });

  it("returns 503 when no shared secret is configured", async () => {
    delete process.env.ORBIT_BRIDGE_SECRET;
    const res = await post({ companyId: COMPANY_ID, facts: ["a"] });
    expect(res.status).toBe(503);
    expect(hermesApiPost).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it("returns 400 for malformed bodies", async () => {
    const malformed = [
      {},
      { companyId: COMPANY_ID },
      { companyId: COMPANY_ID, facts: [] },
      { companyId: COMPANY_ID, facts: "a fact" },
      { companyId: COMPANY_ID, facts: [""] },
      { companyId: COMPANY_ID, facts: [{ kind: "profile" }] },
      { companyId: "", facts: ["a"] },
      { companyId: 42, facts: ["a"] },
      { facts: ["a"] },
      { companyId: COMPANY_ID, subAccountId: 7, facts: ["a"] },
    ];
    for (const body of malformed) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(hermesApiPost).not.toHaveBeenCalled();
  });

  it("accepts a non-UUID company id, because Hermes scopes by arbitrary ids", async () => {
    hermesApiPost.mockResolvedValue({ status: 200, ok: true, body: HERMES_OK });
    const res = await post({ companyId: "co_123", facts: ["Acme sells widgets."] });
    expect(res.status).toBe(200);
  });

  // -------------------------------------------------------------------------
  // Forwarding
  // -------------------------------------------------------------------------

  it("forwards the body to /v1/memory/seed and relays Hermes's result verbatim", async () => {
    hermesApiPost.mockResolvedValue({ status: 200, ok: true, body: HERMES_OK });

    const facts = [
      "Acme sells widgets.",
      { fact: "Founded 2019.", kind: "profile", confidence: "high" },
    ];
    const res = await post({ companyId: COMPANY_ID, subAccountId: "sub_9", facts });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(HERMES_OK);
    expect(hermesApiPost).toHaveBeenCalledTimes(1);
    expect(hermesApiPost.mock.calls[0]![0]).toBe("/v1/memory/seed");
    expect(hermesApiPost.mock.calls[0]![1]).toEqual({
      companyId: COMPANY_ID,
      subAccountId: "sub_9",
      facts,
    });
  });

  it("omits subAccountId entirely when absent", async () => {
    hermesApiPost.mockResolvedValue({ status: 200, ok: true, body: HERMES_OK });
    await post({ companyId: COMPANY_ID, facts: ["a"] });
    expect(hermesApiPost.mock.calls[0]![1]).toEqual({ companyId: COMPANY_ID, facts: ["a"] });
  });

  // -------------------------------------------------------------------------
  // Failure — seeding is not critical path, so the caller gets a clear 502
  // -------------------------------------------------------------------------

  it("returns 502 when Hermes replies non-2xx", async () => {
    hermesApiPost.mockResolvedValue({ status: 500, ok: false, body: { detail: "boom" } });
    const res = await post({ companyId: COMPANY_ID, facts: ["a"] });

    expect(res.status).toBe(502);
    expect(res.body.error).toContain("500");
    expect(res.body.hermesStatus).toBe(500);
  });

  it("returns 502 when the Hermes client throws", async () => {
    hermesApiPost.mockRejectedValue(new Error("connect ECONNREFUSED"));
    const res = await post({ companyId: COMPANY_ID, facts: ["a"] });

    expect(res.status).toBe(502);
    expect(res.body.error).toContain("ECONNREFUSED");
  });
});

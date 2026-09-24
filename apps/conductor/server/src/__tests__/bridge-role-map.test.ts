import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Thin forwarder: the shared Hermes client is mocked so NO real network call is made, and
// the plugin registry is mocked to force resolveBridgeSecret onto its env fallback —
// mirroring bridge-ensure-department-agents.test.ts.
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

import { bridgeRoleMapRoutes } from "../routes/bridge-role-map.js";

const BRIDGE_SECRET = "bridge-secret-for-tests-0123456789";
const SECRET_HEADER = "x-orbit-bridge-secret";
const ENDPOINT = "/api/bridge/role-map";

const originalSecret = process.env.ORBIT_BRIDGE_SECRET;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(bridgeRoleMapRoutes({} as unknown as Parameters<typeof bridgeRoleMapRoutes>[0]));
  return app;
}

function post(body: unknown, secret: string | null = BRIDGE_SECRET) {
  const req = request(createApp()).post(ENDPOINT);
  if (secret !== null) req.set(SECRET_HEADER, secret);
  return req.send(body as object);
}

function suggestion(role: string) {
  return { role, rationale: `because ${role}`, first_task_hints: [`${role} task`] };
}

beforeEach(() => {
  hermesApiPost.mockReset();
  process.env.ORBIT_BRIDGE_SECRET = BRIDGE_SECRET;
});

afterEach(() => {
  if (originalSecret === undefined) delete process.env.ORBIT_BRIDGE_SECRET;
  else process.env.ORBIT_BRIDGE_SECRET = originalSecret;
});

describe.sequential("bridge role-map", () => {
  // -------------------------------------------------------------------------
  // Auth
  // -------------------------------------------------------------------------

  it("returns 401 for a missing secret and calls Hermes not at all", async () => {
    const res = await post({ answers: { q1: "we build software" } }, null);
    expect(res.status).toBe(401);
    expect(hermesApiPost).not.toHaveBeenCalled();
  });

  it("returns 401 for a wrong secret", async () => {
    const res = await post({ answers: { q1: "we build software" } }, "wrong");
    expect(res.status).toBe(401);
    expect(hermesApiPost).not.toHaveBeenCalled();
  });

  it("returns 503 when no shared secret is configured", async () => {
    delete process.env.ORBIT_BRIDGE_SECRET;
    const res = await post({ answers: { q1: "we build software" } });
    expect(res.status).toBe(503);
    expect(hermesApiPost).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Validation
  // -------------------------------------------------------------------------

  it("returns 400 for malformed bodies", async () => {
    const malformed = [
      {},
      { answers: "text" },
      { answers: ["a"] },
      { answers: null },
      { answers: {}, maxRoles: 0 },
      { answers: {}, maxRoles: 2.5 },
      { answers: {}, maxRoles: "3" },
    ];
    for (const body of malformed) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(hermesApiPost).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Forwarding
  // -------------------------------------------------------------------------

  it("forwards the body to /v1/atrium/role-map and returns the structured result", async () => {
    hermesApiPost.mockResolvedValue({
      status: 200,
      ok: true,
      body: {
        object: "atrium.role_map",
        roles: ["engineer", "devops"],
        suggestions: [suggestion("engineer"), suggestion("devops")],
        model: "hermes-agent",
      },
    });

    const answers = { q1: "we ship a web app", q2: "need deploys" };
    const res = await post({ answers, maxRoles: 3 });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      object: "atrium.role_map",
      roles: ["engineer", "devops"],
      suggestions: [suggestion("engineer"), suggestion("devops")],
      model: "hermes-agent",
    });
    expect(hermesApiPost).toHaveBeenCalledTimes(1);
    expect(hermesApiPost.mock.calls[0]![0]).toBe("/v1/atrium/role-map");
    expect(hermesApiPost.mock.calls[0]![1]).toEqual({ answers, maxRoles: 3 });
  });

  // -------------------------------------------------------------------------
  // Belt-and-suspenders enum filter
  // -------------------------------------------------------------------------

  it("drops roles outside the canonical enum, and their suggestions with them", async () => {
    hermesApiPost.mockResolvedValue({
      status: 200,
      ok: true,
      body: {
        object: "atrium.role_map",
        roles: ["engineer", "ceo", "default", "wizard", "qa", "sales", "support", "content"],
        suggestions: [
          suggestion("engineer"),
          suggestion("ceo"),
          suggestion("default"),
          suggestion("wizard"),
          suggestion("qa"),
          suggestion("sales"),
          suggestion("support"),
          suggestion("content"),
        ],
        model: "hermes-agent",
      },
    });

    const res = await post({ answers: { q1: "we build software" } });

    expect(res.status).toBe(200);
    expect(res.body.roles).toEqual(["engineer", "qa", "sales", "support", "content"]);
    expect(res.body.suggestions.map((s: { role: string }) => s.role)).toEqual([
      "engineer",
      "qa",
      "sales",
      "support",
      "content",
    ]);
    expect(res.body.model).toBe("hermes-agent");
  });

  it("drops a suggestion whose role never appeared in the filtered roles list", async () => {
    hermesApiPost.mockResolvedValue({
      status: 200,
      ok: true,
      body: {
        object: "atrium.role_map",
        roles: ["engineer"],
        // A compromised upstream trying to smuggle CEO in via suggestions alone.
        suggestions: [suggestion("engineer"), suggestion("ceo"), suggestion("security")],
        model: "hermes-agent",
      },
    });

    const res = await post({ answers: { q1: "we build software" } });
    expect(res.body.roles).toEqual(["engineer"]);
    expect(res.body.suggestions.map((s: { role: string }) => s.role)).toEqual(["engineer"]);
  });

  // -------------------------------------------------------------------------
  // Deterministic fallback
  // -------------------------------------------------------------------------

  it("falls back to the rules map when the Hermes client throws", async () => {
    hermesApiPost.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const res = await post({
      answers: {
        what: "We are a marketing agency that needs help with campaigns and leads",
        also: "and some design and brand work",
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.model).toBe("rules-fallback");
    expect(res.body.roles).toEqual(["cmo", "designer"]);
    expect(res.body.suggestions.map((s: { role: string }) => s.role)).toEqual(["cmo", "designer"]);
    expect(res.body.suggestions[0].first_task_hints.length).toBeGreaterThan(0);
  });

  it("falls back when Hermes replies non-2xx", async () => {
    hermesApiPost.mockResolvedValue({ status: 500, ok: false, body: { detail: "boom" } });

    const res = await post({ answers: { q1: "we need deployment and infrastructure help" } });

    expect(res.status).toBe(200);
    expect(res.body.model).toBe("rules-fallback");
    expect(res.body.roles).toEqual(["devops"]);
  });

  it("falls back when Hermes replies 200 with an unusable body", async () => {
    hermesApiPost.mockResolvedValue({ status: 200, ok: true, body: { oops: true } });

    const res = await post({ answers: { q1: "security and compliance review" } });
    expect(res.status).toBe(200);
    expect(res.body.model).toBe("rules-fallback");
    expect(res.body.roles).toEqual(["security"]);
  });

  it("caps the fallback at maxRoles", async () => {
    hermesApiPost.mockRejectedValue(new Error("down"));

    const res = await post({
      answers: { q1: "engineering, deployment, marketing, finance and design" },
      maxRoles: 2,
    });

    expect(res.body.roles).toHaveLength(2);
    expect(res.body.suggestions).toHaveLength(2);
  });

  it("fallback maps agency departments added for assisted onboarding", async () => {
    hermesApiPost.mockRejectedValue(new Error("down"));

    const res = await post({
      answers: {
        needs: "sales pipeline qualification, support tickets and retention, and content calendar production",
      },
    });

    expect(res.body.model).toBe("rules-fallback");
    expect(res.body.roles).toEqual(["sales", "support", "content"]);
    expect(res.body.suggestions.map((s: { role: string }) => s.role)).toEqual([
      "sales",
      "support",
      "content",
    ]);
  });

  it("falls back to `general` when there is text but no recognizable signal", async () => {
    hermesApiPost.mockRejectedValue(new Error("down"));

    const res = await post({ answers: { q1: "we sell handmade candles to neighbours" } });
    expect(res.body.model).toBe("rules-fallback");
    expect(res.body.roles).toEqual(["general"]);
  });

  it("returns an empty fallback for nonsense answers carrying no readable text", async () => {
    hermesApiPost.mockRejectedValue(new Error("down"));

    for (const answers of [{}, { q1: "   ", q2: "!!! 123 ???" }, { q1: 42, q2: null }]) {
      const res = await post({ answers });
      expect(res.status, JSON.stringify(answers)).toBe(200);
      expect(res.body.roles, JSON.stringify(answers)).toEqual([]);
      expect(res.body.suggestions).toEqual([]);
      expect(res.body.model).toBe("rules-fallback");
    }
  });

  it("reads nested answer values when matching signals", async () => {
    hermesApiPost.mockRejectedValue(new Error("down"));

    const res = await post({
      answers: { section: { goals: ["improve testing and quality"] } },
    });
    expect(res.body.roles).toEqual(["qa"]);
  });
});

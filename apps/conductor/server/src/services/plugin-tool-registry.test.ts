import { describe, it, expect, vi } from "vitest";
import { createPluginToolRegistry } from "./plugin-tool-registry.js";
import type { PaperclipPluginManifestV1 } from "@paperclipai/shared";
import type { PluginWorkerManager } from "./plugin-worker-manager.js";
import type { ToolRunContext } from "@paperclipai/plugin-sdk";

/**
 * Regression: the worker-liveness check and the execute RPC must key off the
 * plugin's DB UUID (pluginDbId), NOT the plugin key. The worker manager tracks
 * running workers by UUID; if the registry falls back to the key, every execute
 * fails with "worker … is not running" even while the worker is healthy.
 */

const PLUGIN_KEY = "orbit.workpipe-tools";
const PLUGIN_DB_ID = "00000000-0000-4000-a000-00000000b001";

const manifest = {
  id: PLUGIN_KEY,
  tools: [
    {
      name: "listPipelines",
      description: "list pipelines",
      parametersSchema: { type: "object", properties: {} },
    },
  ],
} as unknown as PaperclipPluginManifestV1;

const runContext = {
  companyId: "company-1",
  agentId: "agent-1",
  runId: "run-1",
  subAccountId: "sub-1",
} as unknown as ToolRunContext;

function makeWorkerManager(runningId: string) {
  const isRunning = vi.fn((id: string) => id === runningId);
  const call = vi.fn(async () => ({ content: "ok" }));
  return {
    manager: { isRunning, call } as unknown as PluginWorkerManager,
    isRunning,
    call,
  };
}

describe("plugin tool registry — worker id routing", () => {
  it("routes worker liveness + execute by the plugin DB UUID when provided", async () => {
    // Worker is 'running' only under the UUID (as the worker manager keys it).
    const { manager, isRunning, call } = makeWorkerManager(PLUGIN_DB_ID);
    const registry = createPluginToolRegistry(manager);
    registry.registerPlugin(PLUGIN_KEY, manifest, PLUGIN_DB_ID);

    await registry.executeTool(`${PLUGIN_KEY}:listPipelines`, {}, runContext);

    expect(isRunning).toHaveBeenCalledWith(PLUGIN_DB_ID);
    expect(isRunning).not.toHaveBeenCalledWith(PLUGIN_KEY);
    expect(call).toHaveBeenCalledWith(PLUGIN_DB_ID, "executeTool", expect.anything());
  });

  it("fails closed when the DB UUID is omitted (the pre-fix bug)", async () => {
    // Worker is running under the UUID, but registration omits it → registry
    // falls back to the key → liveness check misses → fail closed, no RPC.
    const { manager, call } = makeWorkerManager(PLUGIN_DB_ID);
    const registry = createPluginToolRegistry(manager);
    registry.registerPlugin(PLUGIN_KEY, manifest);

    await expect(
      registry.executeTool(`${PLUGIN_KEY}:listPipelines`, {}, runContext),
    ).rejects.toThrow(/worker for plugin ".*" is not running/);
    expect(call).not.toHaveBeenCalled();
  });
});

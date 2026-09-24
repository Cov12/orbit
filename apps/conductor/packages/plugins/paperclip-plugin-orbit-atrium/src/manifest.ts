import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const PLUGIN_ID = "paperclipai.plugin-orbit-atrium";
const PLUGIN_VERSION = "0.1.0";

const manifest: PaperclipPluginManifestV1 = {
  id: PLUGIN_ID,
  apiVersion: 1,
  version: PLUGIN_VERSION,
  displayName: "Orbit Atrium Bridge",
  description:
    "Streaming chat bridge between Atrium and Conductor agents. Atrium POSTs a prompt and SSE-subscribes to the returned channel for live Claude tokens.",
  author: "Cov12 / Orbit",
  categories: ["automation"],
  capabilities: [
    "api.routes.register",
    "agent.sessions.create",
    "agent.sessions.send",
    // Read-only run/activity history for the Atrium dashboard (history verb).
    "agents.read",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  apiRoutes: [
    {
      routeKey: "chat",
      method: "POST",
      path: "/chat",
      auth: "webhook",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
    {
      routeKey: "history",
      method: "POST",
      path: "/history",
      auth: "webhook",
      capability: "api.routes.register",
      companyResolution: { from: "body", key: "companyId" },
    },
  ],
  instanceConfigSchema: {
    type: "object",
    required: ["sharedSecret"],
    properties: {
      sharedSecret: {
        type: "string",
        description:
          "Shared secret Atrium must send in the X-Orbit-Bridge-Secret header. Compared with timingSafeEqual.",
        minLength: 32,
      },
    },
  },
};

export default manifest;

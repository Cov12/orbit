import type { PaperclipPluginManifestV1 } from "@paperclipai/plugin-sdk";

const manifest: PaperclipPluginManifestV1 = {
  id: "orbit.workpipe-tools",
  apiVersion: 1,
  version: "0.1.0",
  displayName: "Orbit WorkPipe Tools",
  description:
    "Read-only WorkPipe agent tools for pipelines and contacts, scoped to the active run's sub-account.",
  author: "Cov12 / Orbit",
  categories: ["automation"],
  capabilities: [
    "agent.tools.register",
    // No "agents.read": the sub-account scope now arrives on the tool runContext,
    // so this plugin no longer reads agent run records to recover it.
    "http.outbound",
    "secrets.read-ref",
  ],
  entrypoints: {
    worker: "./dist/worker.js",
  },
  tools: [
    {
      name: "listPipelines",
      displayName: "WorkPipe List Pipelines",
      description: "List pipelines for the active run's sub-account via WorkPipe's public internal API.",
      parametersSchema: { type: "object", properties: {} },
    },
    {
      name: "getPipeline",
      displayName: "WorkPipe Get Pipeline",
      description: "Get one pipeline by id from the active run's sub-account.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
    },
    {
      name: "findContact",
      displayName: "WorkPipe Find Contact",
      description: "Search contacts in the active run's sub-account by name, email or company name.",
      parametersSchema: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "number" },
          offset: { type: "number" },
        },
        required: ["query"],
      },
    },
    {
      name: "getContact",
      displayName: "WorkPipe Get Contact",
      description: "Get one contact by id from the active run's sub-account.",
      parametersSchema: {
        type: "object",
        properties: {
          id: { type: "string" },
        },
        required: ["id"],
      },
    },
  ],
  instanceConfigSchema: {
    type: "object",
    required: ["jwtSecretRef", "portalOrgId"],
    properties: {
      jwtSecretRef: {
        type: "string",
        title: "JWT secret reference",
        minLength: 1,
        description: "Secret reference resolving to the shared JWT_SECRET used by WorkPipe internal auth.",
      },
      portalOrgId: {
        type: "string",
        title: "Portal org ID",
        minLength: 1,
        description: "Orbit Portal organization/business ID used as WorkPipe org_id in minted internal auth tokens.",
      },
      role: {
        type: "string",
        title: "Role claim",
        default: "member",
        description: "Role claim minted into WorkPipe internal auth tokens. Defaults to member.",
      },
      userId: {
        type: "string",
        title: "User ID claim",
        default: "orbit.workpipe-tools",
        description: "User identifier minted into WorkPipe internal auth tokens. Defaults to the plugin ID.",
      },
      workpipeBaseUrl: {
        type: "string",
        title: "WorkPipe base URL",
        default: "https://workpipe.orbit.example",
        description: "Base URL of the WorkPipe deployment the plugin calls. Optional; defaults to the live host.",
      },
    },
  },
};

export default manifest;

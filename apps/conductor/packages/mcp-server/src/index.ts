import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PaperclipApiClient } from "./client.js";
import { readConfigFromEnv, type PaperclipMcpConfig } from "./config.js";
import { createToolDefinitions } from "./tools.js";
import { createPluginToolDefinitions, type PluginToolDefinition } from "./plugin-tools.js";

export function createPaperclipMcpServer(config: PaperclipMcpConfig = readConfigFromEnv()) {
  const server = new McpServer({
    name: "paperclip",
    version: "0.1.0",
  });

  const client = new PaperclipApiClient(config);
  const tools = createToolDefinitions(client);
  for (const tool of tools) {
    server.tool(tool.name, tool.description, tool.schema.shape, tool.execute);
  }

  return {
    server,
    tools,
    client,
  };
}

/**
 * Register the instance's plugin-contributed tools as native MCP tools.
 *
 * Registered with `registerTool` (not `tool`) so the passthrough object schema
 * survives: `tool(name, desc, shape, cb)` rebuilds a plain object from the raw
 * shape, which would strip the hidden `_paperclip_context` envelope before the
 * handler could read it.
 */
export async function registerPluginTools(
  server: McpServer,
  client: PaperclipApiClient,
): Promise<PluginToolDefinition[]> {
  const pluginTools = await createPluginToolDefinitions(client);
  for (const tool of pluginTools) {
    server.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.inputSchema },
      tool.execute as never,
    );
  }
  return pluginTools;
}

export async function runServer(config: PaperclipMcpConfig = readConfigFromEnv()) {
  const { server, client } = createPaperclipMcpServer(config);
  try {
    await registerPluginTools(server, client);
  } catch (error) {
    // Plugin tools are additive: a control-plane hiccup at startup must not take
    // down the built-in Paperclip tools.
    console.error("Failed to register Paperclip plugin tools:", error);
  }
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

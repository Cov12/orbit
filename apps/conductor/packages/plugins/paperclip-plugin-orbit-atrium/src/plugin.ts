import { definePlugin, type PluginApiRequestInput, type PluginContext } from "@paperclipai/plugin-sdk";
import { handleChatRequest } from "./route-handler.js";
import { handleHistoryRequest } from "./history-handler.js";

let pluginContext: PluginContext | null = null;

const plugin = definePlugin({
  async setup(ctx) {
    pluginContext = ctx;
    ctx.logger.info("Orbit Atrium bridge plugin ready");
  },

  async onApiRequest(input: PluginApiRequestInput) {
    if (!pluginContext) {
      return {
        status: 503,
        body: { error: "Plugin not initialized" },
      };
    }
    if (input.routeKey === "chat") {
      return handleChatRequest(pluginContext, input);
    }
    if (input.routeKey === "history") {
      return handleHistoryRequest(pluginContext, input);
    }
    return {
      status: 404,
      body: { error: `Unknown route: ${input.routeKey}` },
    };
  },

  async onHealth() {
    return {
      status: "ok",
      message: "Orbit Atrium bridge plugin healthy",
      details: {
        routes: ["chat", "history"],
      },
    };
  },
});

export default plugin;

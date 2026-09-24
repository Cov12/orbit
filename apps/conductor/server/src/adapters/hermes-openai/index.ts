import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
  ServerAdapterModule,
} from "../types.js";
import { asString, parseObject } from "../utils.js";
import { execute } from "./execute.js";

function summarizeStatus(checks: AdapterEnvironmentCheck[]): AdapterEnvironmentTestResult["status"] {
  if (checks.some((check) => check.level === "error")) return "fail";
  if (checks.some((check) => check.level === "warn")) return "warn";
  return "pass";
}

/**
 * Lightweight pre-flight: confirm the configured endpoint is a valid URL and the
 * bearer-key env var is populated. We do not probe the tailnet endpoint itself —
 * it is only reachable from the deployed host, so a probe here would false-fail.
 */
async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  const checks: AdapterEnvironmentCheck[] = [];
  const config = parseObject(ctx.config);
  const urlValue = asString(config.url, "http://100.64.0.10:8642/v1/chat/completions");
  const apiKeyEnv = asString(config.apiKeyEnv, "HERMES_API_KEY");

  try {
    const url = new URL(urlValue);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      checks.push({
        code: "hermes_url_protocol_invalid",
        level: "error",
        message: `Unsupported URL protocol: ${url.protocol}`,
        hint: "Use an http:// or https:// endpoint.",
      });
    } else {
      checks.push({
        code: "hermes_url_valid",
        level: "info",
        message: `Configured endpoint: ${url.toString()}`,
      });
    }
  } catch {
    checks.push({
      code: "hermes_url_invalid",
      level: "error",
      message: `Invalid URL: ${urlValue}`,
    });
  }

  if (asString(process.env[apiKeyEnv], "")) {
    checks.push({
      code: "hermes_api_key_present",
      level: "info",
      message: `Bearer key present in ${apiKeyEnv}.`,
    });
  } else {
    checks.push({
      code: "hermes_api_key_missing",
      level: "error",
      message: `Hermes API key env "${apiKeyEnv}" is not set.`,
      hint: `Set ${apiKeyEnv} (the Hermes API_SERVER_KEY) as a deployment secret.`,
    });
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}

export const hermesOpenAiAdapter: ServerAdapterModule = {
  type: "hermes_openai",
  execute,
  testEnvironment,
  models: [{ id: "hermes-agent", label: "Hermes Agent" }],
  agentConfigurationDoc: `# hermes_openai agent configuration

Adapter: hermes_openai

Runs an agent turn by calling Hermes's OpenAI-compatible api_server
(POST /v1/chat/completions) over a private tailnet and surfaces the assistant
text back to the Orbit chat bridge.

Core fields:
- url (string, optional): chat-completions endpoint.
  Default http://100.64.0.10:8642/v1/chat/completions
- model (string, optional): model id sent in the request body. Default hermes-agent
- apiKeyEnv (string, optional): env var holding the Hermes API_SERVER_KEY bearer
  token. Default HERMES_API_KEY
- systemPrompt (string, optional): prepended as a system message when non-empty
- timeoutSec (number, optional): request timeout in seconds. Default 120

Environment:
- <apiKeyEnv> (e.g. HERMES_API_KEY): bearer token (Render secret). Required.
- HERMES_OUTBOUND_PROXY (optional): if set, this adapter's requests are routed
  through an undici ProxyAgent for this URL only (global dispatcher untouched).

Session continuity (sent as request headers):
- X-Hermes-Session-Key: long-term (mem0) memory pool scope. With an active
  sub-account it is companyId:subAccountId; otherwise companyId:_business (a
  distinct business/oversight namespace, sibling to each sub-account). Empty
  when no companyId is present.
- X-Hermes-Session-Id: the trailing <sessionId> parsed from the bridge taskKey
  (plugin:<key>:session:<sessionId>), else agent.id

The user message is read from context.bridgeChatPrompt, falling back to
context.paperclipChatMarkdown. The assistant text is emitted as a
{"type":"result","result":"..."} stdout line so the bridge's StreamJsonParser
captures it as the /chat response.
`,
};

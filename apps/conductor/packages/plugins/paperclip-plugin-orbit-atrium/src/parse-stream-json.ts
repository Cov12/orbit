export type ChatStreamEvent =
  | { type: "token"; text: string }
  | { type: "tool_use_delta"; partialJson: string }
  | { type: "message_start"; id: string }
  | { type: "message_stop" }
  | { type: "result_text"; text: string };

interface ContentBlockDelta {
  type: "content_block_delta";
  delta:
    | { type: "text_delta"; text: string }
    | { type: "input_json_delta"; partial_json: string }
    | { type: string; [k: string]: unknown };
}

interface MessageStart {
  type: "message_start";
  message: { id: string };
}

interface MessageStop {
  type: "message_stop";
}

interface AssistantEvent {
  type: "assistant";
  message?: { content?: unknown } | null;
}

interface ResultEvent {
  type: "result";
  result?: unknown;
}

type StreamJsonLine =
  | ContentBlockDelta
  | MessageStart
  | MessageStop
  | AssistantEvent
  | ResultEvent
  | { type: string };

/**
 * Parses Claude stream-json output into normalized chat events.
 *
 * Accepts NDJSON-style chunks (one JSON object per line). Tolerates partial
 * lines at chunk boundaries by buffering — callers MUST reuse the same parser
 * instance across chunks for a single message stream.
 *
 * Malformed JSON lines are skipped (not thrown).
 */
export class StreamJsonParser {
  private buffer = "";

  push(rawChunk: string): ChatStreamEvent[] {
    if (rawChunk.length === 0) return [];
    this.buffer += rawChunk;
    const lines = this.buffer.split("\n");
    this.buffer = lines.pop() ?? "";
    const out: ChatStreamEvent[] = [];
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.length === 0) continue;
      out.push(...parseLine(trimmed));
    }
    return out;
  }

  /** Flush any trailing buffered line (after the upstream signals end). */
  flush(): ChatStreamEvent[] {
    const trimmed = this.buffer.trim();
    this.buffer = "";
    if (trimmed.length === 0) return [];
    return parseLine(trimmed);
  }
}

function parseLine(line: string): ChatStreamEvent[] {
  let parsed: StreamJsonLine;
  try {
    parsed = JSON.parse(line) as StreamJsonLine;
  } catch {
    return [];
  }
  if (!parsed || typeof parsed !== "object" || typeof parsed.type !== "string") {
    return [];
  }
  if (parsed.type === "content_block_delta") {
    const delta = (parsed as ContentBlockDelta).delta;
    if (!delta || typeof delta.type !== "string") return [];
    if (delta.type === "text_delta" && typeof (delta as { text: unknown }).text === "string") {
      return [{ type: "token", text: (delta as { text: string }).text }];
    }
    if (
      delta.type === "input_json_delta" &&
      typeof (delta as { partial_json: unknown }).partial_json === "string"
    ) {
      return [
        { type: "tool_use_delta", partialJson: (delta as { partial_json: string }).partial_json },
      ];
    }
    return [];
  }
  if (parsed.type === "message_start") {
    const id = (parsed as MessageStart).message?.id;
    if (typeof id === "string") return [{ type: "message_start", id }];
    return [];
  }
  if (parsed.type === "message_stop") {
    return [{ type: "message_stop" }];
  }
  // claude-code CLI stream-json (emitted by the claude_local adapter): an
  // `assistant` event carries the incremental message content, and a terminal
  // `result` event carries the complete final answer. Mirror the extraction in
  // packages/adapters/claude-local/src/server/parse.ts.
  if (parsed.type === "assistant") {
    const message = (parsed as AssistantEvent).message;
    if (!message || typeof message !== "object" || Array.isArray(message)) return [];
    const content = Array.isArray(message.content) ? message.content : [];
    const out: ChatStreamEvent[] = [];
    for (const entry of content) {
      if (typeof entry !== "object" || entry === null || Array.isArray(entry)) continue;
      const block = entry as Record<string, unknown>;
      if (block.type === "text" && typeof block.text === "string") {
        out.push({ type: "token", text: block.text });
      }
    }
    return out;
  }
  if (parsed.type === "result") {
    const result = (parsed as ResultEvent).result;
    return [{ type: "result_text", text: typeof result === "string" ? result : "" }];
  }
  return [];
}

/**
 * Convenience wrapper for a single chunk that does not span boundaries.
 * For streaming use, prefer a long-lived `StreamJsonParser`.
 */
export function parseStreamJsonChunk(rawChunk: string): ChatStreamEvent[] {
  const parser = new StreamJsonParser();
  const events = parser.push(rawChunk);
  return [...events, ...parser.flush()];
}

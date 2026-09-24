import { describe, expect, it } from "vitest";
import { StreamJsonParser, parseStreamJsonChunk } from "./parse-stream-json.js";

describe("parseStreamJsonChunk", () => {
  it("returns [] for empty input", () => {
    expect(parseStreamJsonChunk("")).toEqual([]);
  });

  it("parses a single text_delta line into a token event", () => {
    const line = JSON.stringify({
      type: "content_block_delta",
      delta: { type: "text_delta", text: "Hello" },
    }) + "\n";
    expect(parseStreamJsonChunk(line)).toEqual([{ type: "token", text: "Hello" }]);
  });

  it("parses multiple complete lines preserving order", () => {
    const chunk = [
      JSON.stringify({ type: "message_start", message: { id: "m_1" } }),
      JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "A" } }),
      JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "B" } }),
      JSON.stringify({ type: "message_stop" }),
    ].join("\n") + "\n";
    expect(parseStreamJsonChunk(chunk)).toEqual([
      { type: "message_start", id: "m_1" },
      { type: "token", text: "A" },
      { type: "token", text: "B" },
      { type: "message_stop" },
    ]);
  });

  it("skips malformed JSON lines without throwing", () => {
    const chunk = "not-json\n" +
      JSON.stringify({ type: "content_block_delta", delta: { type: "text_delta", text: "X" } }) +
      "\n";
    expect(parseStreamJsonChunk(chunk)).toEqual([{ type: "token", text: "X" }]);
  });

  it("surfaces input_json_delta as tool_use_delta events", () => {
    const chunk = JSON.stringify({
      type: "content_block_delta",
      delta: { type: "input_json_delta", partial_json: "{\"k\":\"v\"" },
    }) + "\n";
    expect(parseStreamJsonChunk(chunk)).toEqual([
      { type: "tool_use_delta", partialJson: "{\"k\":\"v\"" },
    ]);
  });

  it("emits a token per text block of a claude-code assistant event", () => {
    const chunk = JSON.stringify({
      type: "assistant",
      message: {
        content: [
          { type: "text", text: "Hello" },
          { type: "tool_use", name: "x", input: {} },
          { type: "text", text: " world" },
        ],
      },
    }) + "\n";
    expect(parseStreamJsonChunk(chunk)).toEqual([
      { type: "token", text: "Hello" },
      { type: "token", text: " world" },
    ]);
  });

  it("ignores an assistant event with no usable content", () => {
    const chunk = JSON.stringify({ type: "assistant", message: { content: [] } }) + "\n";
    expect(parseStreamJsonChunk(chunk)).toEqual([]);
  });

  it("emits a result_text event from a claude-code result event", () => {
    const chunk = JSON.stringify({
      type: "result",
      subtype: "success",
      result: "Final answer",
    }) + "\n";
    expect(parseStreamJsonChunk(chunk)).toEqual([{ type: "result_text", text: "Final answer" }]);
  });

  it("emits result_text with empty string when result field is absent", () => {
    const chunk = JSON.stringify({ type: "result", subtype: "success" }) + "\n";
    expect(parseStreamJsonChunk(chunk)).toEqual([{ type: "result_text", text: "" }]);
  });

  it("ignores unrecognized claude-code system events", () => {
    const chunk = JSON.stringify({ type: "system", subtype: "init", session_id: "s" }) + "\n";
    expect(parseStreamJsonChunk(chunk)).toEqual([]);
  });
});

describe("StreamJsonParser (multi-chunk)", () => {
  it("buffers a partial line across two chunks", () => {
    const parser = new StreamJsonParser();
    const full = JSON.stringify({
      type: "content_block_delta",
      delta: { type: "text_delta", text: "Hello world" },
    }) + "\n";
    const split = Math.floor(full.length / 2);
    const a = parser.push(full.slice(0, split));
    expect(a).toEqual([]);
    const b = parser.push(full.slice(split));
    expect(b).toEqual([{ type: "token", text: "Hello world" }]);
  });

  it("flush() emits a final line with no trailing newline", () => {
    const parser = new StreamJsonParser();
    const line = JSON.stringify({ type: "message_stop" });
    expect(parser.push(line)).toEqual([]);
    expect(parser.flush()).toEqual([{ type: "message_stop" }]);
  });

  it("returns [] when no events are parseable", () => {
    const parser = new StreamJsonParser();
    expect(parser.push("garbage\nmore-garbage\n")).toEqual([]);
  });
});

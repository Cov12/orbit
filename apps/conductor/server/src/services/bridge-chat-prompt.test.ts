import { describe, expect, it } from "vitest";
import {
  BRIDGE_CHAT_PROMPT_KEY,
  applyBridgeChatContext,
  buildBridgeChatMarkdown,
} from "./bridge-chat-prompt.js";

describe("buildBridgeChatMarkdown", () => {
  it("formats a chat message as a labelled, fenced markdown section", () => {
    const markdown = buildBridgeChatMarkdown("Can you summarize the latest deploy?");
    expect(markdown).not.toBeNull();
    expect(markdown).toContain("User message (via chat):");
    expect(markdown).toContain("Can you summarize the latest deploy?");
    // Fenced so arbitrary user text cannot break out of the section.
    expect(markdown).toContain("```text");
  });

  it("widens the fence when the message itself contains backticks", () => {
    const markdown = buildBridgeChatMarkdown("look at ```code``` please");
    expect(markdown).toContain("````text");
  });

  it("returns null for empty, whitespace, or non-string input", () => {
    expect(buildBridgeChatMarkdown("")).toBeNull();
    expect(buildBridgeChatMarkdown("   \n  ")).toBeNull();
    expect(buildBridgeChatMarkdown(null)).toBeNull();
    expect(buildBridgeChatMarkdown(undefined)).toBeNull();
  });
});

describe("applyBridgeChatContext", () => {
  it("sets paperclipChatMarkdown when a bridge wake carries a prompt", () => {
    // Mirrors the contextSnapshot the bridge sendMessage host service persists.
    const context: Record<string, unknown> = {
      taskKey: "plugin:orbit-bridge:session:abc",
      wakeSource: "automation",
      wakeTriggerDetail: "system",
      [BRIDGE_CHAT_PROMPT_KEY]: "Please reply to the customer.",
    };

    applyBridgeChatContext(context);

    expect(typeof context.paperclipChatMarkdown).toBe("string");
    expect(context.paperclipChatMarkdown as string).toContain("Please reply to the customer.");
    expect(context.paperclipChatMarkdown as string).toContain("User message (via chat):");
  });

  it("clears paperclipChatMarkdown for non-bridge wakes (no prompt field)", () => {
    const context: Record<string, unknown> = {
      issueId: "issue-1",
      wakeSource: "timer",
      // A stale value must be removed so issue/heartbeat wakes stay unchanged.
      paperclipChatMarkdown: "stale",
    };

    applyBridgeChatContext(context);

    expect(context.paperclipChatMarkdown).toBeUndefined();
  });

  it("ignores a blank bridge prompt and leaves no chat markdown", () => {
    const context: Record<string, unknown> = {
      [BRIDGE_CHAT_PROMPT_KEY]: "   ",
    };

    applyBridgeChatContext(context);

    expect(context.paperclipChatMarkdown).toBeUndefined();
  });
});

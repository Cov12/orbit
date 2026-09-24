import { describe, expect, it } from "vitest";
import { extractHandoffTicket } from "./extract-handoff-ticket.js";

describe("extractHandoffTicket", () => {
  it("returns no ticket and unchanged text when there is no block", () => {
    const text = "Sure — happy to help. Here's a quick answer.";
    const out = extractHandoffTicket(text);
    expect(out.ticket).toBeNull();
    expect(out.cleanedText).toBe(text);
  });

  it("parses a ticket and strips the block, preserving surrounding prose", () => {
    const text = [
      "Got it — I'll get our team on this.",
      "",
      "```ticket",
      '{"title":"Build landing page","description":"5 sections, brand kit attached","priority":"high"}',
      "```",
    ].join("\n");
    const out = extractHandoffTicket(text);
    expect(out.ticket).toEqual({
      title: "Build landing page",
      description: "5 sections, brand kit attached",
      priority: "high",
    });
    expect(out.cleanedText).toBe("Got it — I'll get our team on this.");
    expect(out.cleanedText).not.toContain("```");
  });

  it("defaults priority to medium when absent or out-of-enum", () => {
    const absent = extractHandoffTicket('```ticket\n{"title":"A"}\n```');
    expect(absent.ticket?.priority).toBe("medium");
    const bogus = extractHandoffTicket('```ticket\n{"title":"A","priority":"urgent"}\n```');
    expect(bogus.ticket?.priority).toBe("medium");
  });

  it("accepts the critical priority (real enum, not low|medium|high)", () => {
    const out = extractHandoffTicket('```ticket\n{"title":"Outage","priority":"critical"}\n```');
    expect(out.ticket?.priority).toBe("critical");
  });

  it("strips a malformed-JSON block but yields no ticket (never leaks raw JSON)", () => {
    const text = "Here you go.\n\n```ticket\n{title: not valid json}\n```";
    const out = extractHandoffTicket(text);
    expect(out.ticket).toBeNull();
    expect(out.cleanedText).toBe("Here you go.");
    expect(out.cleanedText).not.toContain("```ticket");
  });

  it("rejects a block missing a title, but still strips it", () => {
    const out = extractHandoffTicket('Done.\n\n```ticket\n{"description":"no title here"}\n```');
    expect(out.ticket).toBeNull();
    expect(out.cleanedText).toBe("Done.");
  });

  it("trims whitespace in title/description and drops blank description", () => {
    const out = extractHandoffTicket('```ticket\n{"title":"  Spaced  ","description":"   "}\n```');
    expect(out.ticket?.title).toBe("Spaced");
    expect(out.ticket?.description).toBeUndefined();
  });

  it("files the first VALID block and strips all blocks", () => {
    const text = [
      "intro",
      "```ticket",
      "{not json}",
      "```",
      "middle",
      "```ticket",
      '{"title":"Second wins"}',
      "```",
      "outro",
    ].join("\n");
    const out = extractHandoffTicket(text);
    expect(out.ticket?.title).toBe("Second wins");
    expect(out.cleanedText).toBe("intro\n\nmiddle\n\noutro");
    expect(out.cleanedText).not.toContain("```");
  });

  it("tolerates CRLF line endings", () => {
    const out = extractHandoffTicket('reply\r\n```ticket\r\n{"title":"CRLF"}\r\n```');
    expect(out.ticket?.title).toBe("CRLF");
    expect(out.cleanedText).toBe("reply");
  });

  it("does not match an inline ```ticket reference inside prose", () => {
    const text = "We tag work with an inline ```ticket marker but not a real block.";
    const out = extractHandoffTicket(text);
    expect(out.ticket).toBeNull();
    expect(out.cleanedText).toBe(text);
  });
});

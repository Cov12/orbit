import { describe, expect, it, vi } from "vitest";
import { fileHandoffTicket, readHandoffTicket, type FileHandoffDeps } from "./orbit-handoff.js";

function makeDeps(over: Partial<FileHandoffDeps> = {}): FileHandoffDeps {
  return {
    findOldestCeoId: vi.fn(async () => "ceo-1"),
    createIssue: vi.fn(async () => ({ id: "issue-1" })),
    wakeAssignee: vi.fn(async () => {}),
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    ...over,
  };
}

const agent = { id: "assistant-1", companyId: "company-1" };
const base = { agent, runId: "run-1" };

describe("readHandoffTicket", () => {
  it("returns null when resultJson is null/empty/has no handoffTicket", () => {
    expect(readHandoffTicket(null)).toBeNull();
    expect(readHandoffTicket(undefined)).toBeNull();
    expect(readHandoffTicket({})).toBeNull();
    expect(readHandoffTicket({ other: 1 })).toBeNull();
  });

  it("returns null when the ticket has no usable title", () => {
    expect(readHandoffTicket({ handoffTicket: { description: "x" } })).toBeNull();
    expect(readHandoffTicket({ handoffTicket: { title: "   " } })).toBeNull();
  });

  it("parses title/description and defaults/normalizes priority", () => {
    expect(readHandoffTicket({ handoffTicket: { title: "A" } })).toEqual({
      title: "A",
      priority: "medium",
    });
    expect(
      readHandoffTicket({ handoffTicket: { title: "B", priority: "urgent" } })?.priority,
    ).toBe("medium");
    expect(
      readHandoffTicket({ handoffTicket: { title: "C", priority: "critical" } })?.priority,
    ).toBe("critical");
  });
});

describe("fileHandoffTicket", () => {
  it("no-ops when there is no handoff ticket", async () => {
    const deps = makeDeps();
    const out = await fileHandoffTicket(deps, { ...base, resultJson: { summary: "hi" } });
    expect(out).toEqual({ filed: false });
    expect(deps.createIssue).not.toHaveBeenCalled();
    expect(deps.findOldestCeoId).not.toHaveBeenCalled();
  });

  it("creates a todo issue assigned to the CEO and wakes them", async () => {
    const deps = makeDeps();
    const out = await fileHandoffTicket(deps, {
      ...base,
      resultJson: {
        handoffTicket: { title: "Build page", description: "5 sections", priority: "high" },
      },
    });
    expect(out).toEqual({ filed: true, issueId: "issue-1", assignedCeoId: "ceo-1" });
    expect(deps.createIssue).toHaveBeenCalledWith("company-1", {
      title: "Build page",
      description: "5 sections",
      priority: "high",
      status: "todo",
      assigneeAgentId: "ceo-1",
      createdByAgentId: "assistant-1",
    });
    expect(deps.wakeAssignee).toHaveBeenCalledWith({
      issueId: "issue-1",
      assigneeAgentId: "ceo-1",
      requestedByActorId: "assistant-1",
    });
  });

  it("files unassigned and skips wakeup when there is no CEO", async () => {
    const deps = makeDeps({ findOldestCeoId: vi.fn(async () => null) });
    const out = await fileHandoffTicket(deps, {
      ...base,
      resultJson: { handoffTicket: { title: "Orphan work" } },
    });
    expect(out).toEqual({ filed: true, issueId: "issue-1", assignedCeoId: null });
    const call = (deps.createIssue as ReturnType<typeof vi.fn>).mock.calls[0][1];
    expect(call.assigneeAgentId).toBeUndefined();
    expect(call.status).toBe("todo");
    expect(deps.wakeAssignee).not.toHaveBeenCalled();
    expect(deps.logger.warn).toHaveBeenCalled();
  });

  it("swallows a createIssue failure (run still succeeds) and logs error", async () => {
    const deps = makeDeps({
      createIssue: vi.fn(async () => {
        throw new Error("db down");
      }),
    });
    const out = await fileHandoffTicket(deps, {
      ...base,
      resultJson: { handoffTicket: { title: "X" } },
    });
    expect(out).toEqual({ filed: false });
    expect(deps.wakeAssignee).not.toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalled();
  });

  it("swallows a wakeAssignee failure after the issue was created", async () => {
    const deps = makeDeps({
      wakeAssignee: vi.fn(async () => {
        throw new Error("wake failed");
      }),
    });
    const out = await fileHandoffTicket(deps, {
      ...base,
      resultJson: { handoffTicket: { title: "X" } },
    });
    expect(out).toEqual({ filed: false });
    expect(deps.createIssue).toHaveBeenCalled();
    expect(deps.logger.error).toHaveBeenCalled();
  });
});

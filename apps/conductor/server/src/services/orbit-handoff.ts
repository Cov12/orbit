import { ISSUE_PRIORITIES, type IssuePriority } from "@paperclipai/shared";

/**
 * Orbit Two-Brain handoff filing.
 *
 * When the Orbit Assistant (Employee, running remotely on Hermes) decides a request
 * needs real production work, its adapter lifts a ```ticket block out of the reply
 * and stashes it on `adapterResult.resultJson.handoffTicket`
 * (see adapters/hermes-openai/extract-handoff-ticket.ts). The Manager (Conductor)
 * then files that as an issue assigned to the company CEO and wakes the CEO.
 *
 * This module is the filing logic, extracted from the heartbeat run loop so it is
 * dependency-injected and unit-testable. The heartbeat wires the real db / issue
 * service / wakeup; tests pass mocks. Everything is best-effort: a failure is
 * logged and swallowed so a completed agent run still registers as a success.
 */

export interface HandoffTicket {
  title: string;
  description?: string;
  priority: IssuePriority;
}

export interface FileHandoffIssueInput extends HandoffTicket {
  status: "todo";
  assigneeAgentId?: string;
  createdByAgentId: string;
}

export interface FileHandoffDeps {
  /** Oldest-by-createdAt CEO agent id for the company, or null if none. */
  findOldestCeoId(companyId: string): Promise<string | null>;
  createIssue(companyId: string, input: FileHandoffIssueInput): Promise<{ id: string }>;
  wakeAssignee(args: {
    issueId: string;
    assigneeAgentId: string;
    requestedByActorId: string;
  }): Promise<void>;
  logger: {
    info(obj: unknown, msg: string): void;
    warn(obj: unknown, msg: string): void;
    error(obj: unknown, msg: string): void;
  };
}

export interface FileHandoffParams {
  agent: { id: string; companyId: string };
  runId: string;
  resultJson: Record<string, unknown> | null | undefined;
}

export interface FileHandoffOutcome {
  filed: boolean;
  issueId?: string;
  assignedCeoId?: string | null;
}

function normalizePriority(value: unknown): IssuePriority {
  return typeof value === "string" && (ISSUE_PRIORITIES as readonly string[]).includes(value)
    ? (value as IssuePriority)
    : "medium";
}

/**
 * Read and validate a handoff ticket off `resultJson.handoffTicket`. Returns null
 * when absent, malformed, or missing a non-empty title. Defensive re-validation —
 * the adapter extractor already validated, but the Manager does not trust the wire.
 */
export function readHandoffTicket(
  resultJson: Record<string, unknown> | null | undefined,
): HandoffTicket | null {
  const handoff =
    resultJson && typeof resultJson === "object" && !Array.isArray(resultJson)
      ? (resultJson as Record<string, unknown>).handoffTicket
      : undefined;
  if (!handoff || typeof handoff !== "object" || Array.isArray(handoff)) return null;
  const t = handoff as { title?: unknown; description?: unknown; priority?: unknown };
  const title = typeof t.title === "string" ? t.title.trim() : "";
  if (!title) return null;
  const out: HandoffTicket = { title, priority: normalizePriority(t.priority) };
  if (typeof t.description === "string" && t.description.trim()) {
    out.description = t.description.trim();
  }
  return out;
}

/**
 * File a handoff ticket (if present on resultJson) as an issue routed to the CEO.
 * In-process create bypasses the HTTP route's assertCanAssignTasks guard, so the
 * assistant needs no tasks:assign grant. `status:"todo"` (not the default
 * "backlog") is required for the assignment wakeup to fire. 0 CEOs -> file
 * unassigned + warn (the request is still captured). Never throws.
 */
export async function fileHandoffTicket(
  deps: FileHandoffDeps,
  params: FileHandoffParams,
): Promise<FileHandoffOutcome> {
  const ticket = readHandoffTicket(params.resultJson);
  if (!ticket) return { filed: false };

  try {
    const ceoId = await deps.findOldestCeoId(params.agent.companyId);
    const issue = await deps.createIssue(params.agent.companyId, {
      title: ticket.title,
      ...(ticket.description ? { description: ticket.description } : {}),
      priority: ticket.priority,
      status: "todo",
      ...(ceoId ? { assigneeAgentId: ceoId } : {}),
      createdByAgentId: params.agent.id,
    });

    if (!ceoId) {
      deps.logger.warn(
        {
          companyId: params.agent.companyId,
          issueId: issue.id,
          assistantAgentId: params.agent.id,
        },
        "Orbit handoff ticket filed unassigned: no CEO agent found for company",
      );
      return { filed: true, issueId: issue.id, assignedCeoId: null };
    }

    await deps.wakeAssignee({
      issueId: issue.id,
      assigneeAgentId: ceoId,
      requestedByActorId: params.agent.id,
    });
    deps.logger.info(
      {
        companyId: params.agent.companyId,
        issueId: issue.id,
        ceoId,
        assistantAgentId: params.agent.id,
        runId: params.runId,
      },
      "Orbit handoff ticket filed and routed to CEO",
    );
    return { filed: true, issueId: issue.id, assignedCeoId: ceoId };
  } catch (err) {
    deps.logger.error(
      {
        err,
        companyId: params.agent.companyId,
        assistantAgentId: params.agent.id,
        runId: params.runId,
        handoffTicket: ticket,
      },
      "Orbit handoff ticket creation failed inside heartbeat hook",
    );
    return { filed: false };
  }
}

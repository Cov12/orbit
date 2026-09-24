import { ISSUE_PRIORITIES, type IssuePriority } from "@paperclipai/shared";

/**
 * A work-handoff ticket the Orbit Assistant emits when a user request needs real
 * production work. The assistant (the Employee, running remotely on Hermes) never
 * does the work itself — it embeds a fenced ```ticket block in its reply, which
 * this extractor lifts out before the prose is broadcast. Conductor (the Manager)
 * then files it as an issue assigned to the CEO. See the heartbeat post-run hook
 * (`maybeFileHandoffTicket` in services/heartbeat.ts).
 */
export interface HandoffTicket {
  title: string;
  description?: string;
  priority: IssuePriority;
}

export interface ExtractHandoffResult {
  /** The model's reply with every ```ticket block stripped, trimmed. */
  cleanedText: string;
  /** The first VALID ticket parsed from the reply, or null if none. */
  ticket: HandoffTicket | null;
}

const DEFAULT_PRIORITY: IssuePriority = "medium";

/**
 * Matches a fenced ```ticket <json> ``` block. Line-anchored (`m`) so it only
 * fires on a fence that opens its own line (never inline backticks), tolerant of
 * up to three leading spaces (CommonMark) and CRLF line endings, with a
 * non-greedy body so adjacent blocks don't merge. Global so every block is
 * stripped even though only the first valid one becomes the handoff.
 */
const TICKET_BLOCK_RE = /^[ \t]{0,3}```ticket[ \t]*\r?\n([\s\S]*?)\r?\n[ \t]{0,3}```[ \t]*$/gm;

function coercePriority(value: unknown): IssuePriority {
  return typeof value === "string" && (ISSUE_PRIORITIES as readonly string[]).includes(value)
    ? (value as IssuePriority)
    : DEFAULT_PRIORITY;
}

function parseTicket(jsonBody: string): HandoffTicket | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonBody);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const obj = parsed as Record<string, unknown>;
  const title = typeof obj.title === "string" ? obj.title.trim() : "";
  if (!title) return null;
  const ticket: HandoffTicket = { title, priority: coercePriority(obj.priority) };
  if (typeof obj.description === "string" && obj.description.trim()) {
    ticket.description = obj.description.trim();
  }
  return ticket;
}

/**
 * Strip every ```ticket block from the model's reply and return the first valid
 * ticket. A malformed or title-less block is still stripped (so raw JSON never
 * reaches the user) but yields no ticket. Cheap fast-path when no block exists.
 */
export function extractHandoffTicket(content: string): ExtractHandoffResult {
  if (!content || !content.includes("```ticket")) {
    return { cleanedText: content, ticket: null };
  }
  let ticket: HandoffTicket | null = null;
  const cleanedText = content.replace(TICKET_BLOCK_RE, (_match, body: string) => {
    if (!ticket) {
      const parsed = parseTicket(body);
      if (parsed) ticket = parsed;
    }
    return "";
  });
  return { cleanedText: cleanedText.trim(), ticket };
}

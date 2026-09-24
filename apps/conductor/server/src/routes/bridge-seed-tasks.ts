import { Router, type Request } from "express";
import type { Db } from "@paperclipai/db";
import { ISSUE_PRIORITIES, type IssuePriority } from "@paperclipai/shared";
import { heartbeatService } from "../services/heartbeat.js";
import { queueIssueAssignmentWakeup } from "../services/issue-assignment-wakeup.js";
import { issueService } from "../services/issues.js";
import { bootstrapCompanyAgents } from "../services/onboarding-bootstrap.js";
import type { PluginWorkerManager } from "../services/plugin-worker-manager.js";
import { logger } from "../middleware/logger.js";
// Auth + company-ensure are REUSED from the assistant bridge route so every bridge endpoint
// authenticates with the exact same shared secret and header — no second credential.
import {
  SECRET_HEADER,
  UUID_PATTERN,
  ensureCompany,
  resolveBridgeSecret,
  secretsMatch,
} from "./bridge-ensure-agent.js";

/** Upper bound on starter tasks per call; onboarding seeds a handful, not a backlog import. */
export const MAX_SEED_TASKS = 20;

/** `requestedByActorId` for the assignment wakeups (mirrors onboarding-bootstrap's convention). */
export const SEED_TASKS_ACTOR_ID = "orbit_seed_tasks";

type SeedTask = { title: string; description?: string; priority: IssuePriority };
type ParsedBody = { companyId: string; tasks: SeedTask[] };

function validateBody(raw: unknown): ParsedBody | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "request body must be a JSON object" };
  const r = raw as Record<string, unknown>;

  if (typeof r.companyId !== "string" || r.companyId.trim().length === 0) {
    return { error: "companyId is required" };
  }
  const companyId = r.companyId.trim();
  if (!UUID_PATTERN.test(companyId)) {
    return { error: "companyId must be a UUID" };
  }

  if (!Array.isArray(r.tasks) || r.tasks.length === 0) {
    return { error: "tasks must be a non-empty array" };
  }
  if (r.tasks.length > MAX_SEED_TASKS) {
    return { error: `tasks must contain at most ${MAX_SEED_TASKS} entries` };
  }

  const tasks: SeedTask[] = [];
  for (const [index, candidate] of r.tasks.entries()) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      return { error: `tasks[${index}] must be an object` };
    }
    const t = candidate as Record<string, unknown>;
    const title = typeof t.title === "string" ? t.title.trim() : "";
    if (!title) return { error: `tasks[${index}].title is required` };

    if (t.description !== undefined && t.description !== null && typeof t.description !== "string") {
      return { error: `tasks[${index}].description must be a string` };
    }
    const description = typeof t.description === "string" ? t.description.trim() : "";

    let priority: IssuePriority = "medium";
    if (t.priority !== undefined && t.priority !== null) {
      if (typeof t.priority !== "string" || !(ISSUE_PRIORITIES as readonly string[]).includes(t.priority)) {
        return { error: `tasks[${index}].priority must be one of: ${ISSUE_PRIORITIES.join(", ")}` };
      }
      priority = t.priority as IssuePriority;
    }

    tasks.push({ title, ...(description ? { description } : {}), priority });
  }

  return { companyId, tasks };
}

/**
 * POST /api/bridge/seed-tasks
 *
 * Body: { companyId: <uuid>, tasks: [{ title, description?, priority? }] }
 *   →  200 { issues: [{ id, identifier, title }] }
 *
 * Files a new org's onboarding STARTER TASKS as issues assigned to the company CEO and wakes
 * the CEO for each — the same filing shape as the Orbit handoff ticket (services/orbit-handoff.ts,
 * wired in heartbeat.ts): in-process `issueService.create` with `status: "todo"` (the default
 * "backlog" no-ops the assignment wakeup), then `queueIssueAssignmentWakeup`. The CEO is
 * resolved once via the idempotent CEO seed, so a company without one gets one. The CEO is also
 * the creator: it owns its seeded starter work, and the in-process create bypasses the HTTP
 * route's tasks:assign guard, so no grant is needed.
 *
 * A failure mid-batch is never silent: the route answers 500 with the failing task index and
 * the issues already filed, so the caller can tell exactly what landed.
 *
 * Mounted OUTSIDE the cookie-authenticated /api router (alongside the other bridge routes) so
 * Atrium can call it server-to-server. Auth is the SAME bridge shared-secret header.
 */
export function bridgeSeedTasksRoutes(db: Db, opts: { pluginWorkerManager?: PluginWorkerManager } = {}) {
  const router = Router();
  const issuesSvc = issueService(db);
  const heartbeat = heartbeatService(db, { pluginWorkerManager: opts.pluginWorkerManager });

  router.post("/api/bridge/seed-tasks", async (req: Request, res) => {
    const expected = await resolveBridgeSecret(db);
    if (!expected) {
      logger.error("bridge seed-tasks: no shared secret configured (plugin config or ORBIT_BRIDGE_SECRET)");
      res.status(503).json({ error: "auth_not_configured" });
      return;
    }

    const provided = req.header(SECRET_HEADER);
    if (!provided || !secretsMatch(provided, expected)) {
      logger.warn("bridge seed-tasks: invalid or missing shared secret");
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const parsed = validateBody(req.body);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const { companyId, tasks } = parsed;

    // 1. Ensure the company exists, then resolve its CEO ONCE (seeding one if absent). Unlike
    //    ensure-department-agents this is fatal: starter tasks without a CEO would sit unowned.
    let ceoId: string;
    try {
      await ensureCompany(db, companyId);
      ceoId = (await bootstrapCompanyAgents(db, companyId)).ceoId;
    } catch (err) {
      logger.error({ err, companyId }, "bridge seed-tasks: could not resolve company CEO");
      res.status(500).json({
        error: `could not resolve CEO for company: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    // 2. File each task as a todo issue on the CEO and queue its assignment wakeup.
    const issues: { id: string; identifier: string | null; title: string }[] = [];
    for (const [index, task] of tasks.entries()) {
      try {
        const issue = await issuesSvc.create(companyId, {
          title: task.title,
          ...(task.description ? { description: task.description } : {}),
          priority: task.priority,
          status: "todo",
          assigneeAgentId: ceoId,
          createdByAgentId: ceoId,
        });
        issues.push({ id: issue.id, identifier: issue.identifier ?? null, title: issue.title });

        await queueIssueAssignmentWakeup({
          heartbeat,
          issue: { id: issue.id, assigneeAgentId: ceoId, status: "todo" },
          reason: "orbit_seed_tasks",
          mutation: "create",
          contextSource: "orbit.seed_tasks",
          requestedByActorType: "system",
          requestedByActorId: SEED_TASKS_ACTOR_ID,
          rethrowOnError: true,
        });
      } catch (err) {
        logger.error(
          { err, companyId, ceoId, failedTaskIndex: index, filed: issues.length },
          "bridge seed-tasks: filing starter task failed mid-batch",
        );
        res.status(500).json({
          error: err instanceof Error ? err.message : String(err),
          failedTaskIndex: index,
          issues,
        });
        return;
      }
    }

    logger.info({ companyId, ceoId, filed: issues.length }, "bridge seed-tasks: starter tasks filed to CEO");
    res.status(200).json({ issues });
  });

  return router;
}

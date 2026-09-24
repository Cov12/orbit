import { timingSafeEqual } from "node:crypto";
import { Router, type Request } from "express";
import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { authSessions, companyMemberships } from "@paperclipai/db";
import { reconcileAppAccess } from "../services/app-access.js";
import { companyExists, resolvePortalOrgCompanyId } from "./portal-callback.js";
import { logger } from "../middleware/logger.js";

// The app whose revocation must forcibly log out live sessions. Mirrors
// REQUIRED_APP_ACCESS in portal-callback.ts — CONDUCTOR is the only app that gates
// access to this deployment, so it is the only one a disable must enforce in
// real time by killing active sessions.
const ENFORCED_APP = "CONDUCTOR";

// Body marker for a delivery we deliberately did not persist. Answered with 200 so Portal
// treats the delivery as terminal instead of retrying it forever.
const SKIP_REASON = "company_not_provisioned";

// Header carrying the Portal↔Conductor shared secret. REUSED verbatim from the
// existing bridge auth convention (paperclip-plugin-orbit-atrium/route-handler.ts:9,
// forwarded by routes/plugins.ts:413) rather than inventing a new header name.
const SECRET_HEADER = "x-orbit-bridge-secret";

// Constant-time shared-secret compare, mirroring
// paperclip-plugin-orbit-atrium/route-handler.ts:298 (secretsMatch).
function secretsMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided, "utf-8");
  const b = Buffer.from(expected, "utf-8");
  if (a.length !== b.length) {
    // Compare against self so the timing profile is independent of length.
    timingSafeEqual(a, a);
    return false;
  }
  return timingSafeEqual(a, b);
}

// Postgres foreign-key violation (SQLSTATE 23503). Same shape as the unique-violation
// detectors already used in the codebase (services/documents.ts:16, services/companies.ts:132),
// applied to the `app_access.company_id -> companies.id` constraint.
function isForeignKeyViolation(error: unknown): boolean {
  return (
    !!error
    && typeof error === "object"
    && "code" in error
    && (error as { code?: string }).code === "23503"
  );
}

// The webhook authenticates with the SAME secret family Portal already shares with
// Conductor to sign login JWTs (ORBIT_PORTAL_JWT_SECRET, see .env.example:8 and
// auth/portal-jwt.ts:20). Reusing it means Portal needs no new secret provisioned and
// the trust boundary is unchanged. Read per-request so rotation takes effect on redeploy.
function portalWebhookSecret(): string | null {
  const secret = process.env.ORBIT_PORTAL_JWT_SECRET?.trim();
  return secret && secret.length > 0 ? secret : null;
}

interface EntitlementEntry {
  app: string;
  enabled: boolean;
}

interface EntitlementPayload {
  org_id: string;
  appAccess: EntitlementEntry[];
}

function validateBody(raw: unknown): EntitlementPayload | { error: string } {
  if (!raw || typeof raw !== "object") return { error: "body must be a JSON object" };
  const r = raw as Record<string, unknown>;

  if (typeof r.org_id !== "string" || r.org_id.trim().length === 0) {
    return { error: "org_id must be a non-empty string" };
  }
  if (!Array.isArray(r.appAccess) || r.appAccess.length === 0) {
    return { error: "appAccess must be a non-empty array" };
  }

  const entries: EntitlementEntry[] = [];
  for (const item of r.appAccess) {
    if (!item || typeof item !== "object") return { error: "appAccess entries must be objects" };
    const e = item as Record<string, unknown>;
    if (typeof e.app !== "string" || e.app.trim().length === 0) {
      return { error: "appAccess[].app must be a non-empty string" };
    }
    if (typeof e.enabled !== "boolean") {
      return { error: "appAccess[].enabled must be a boolean" };
    }
    entries.push({ app: e.app, enabled: e.enabled });
  }

  return { org_id: r.org_id.trim(), appAccess: entries };
}

// Enumerate the active Conductor sessions for every user member of a company and delete
// them, forcing re-auth. There is no direct company→session link: sessions belong to a
// userId (schema/auth.ts:21) and users link to a company via company_memberships
// (principalType='user', principalId=userId — schema/company_memberships.ts:9-10). So the
// path is memberships → userIds → sessions. Deleting (not just expiring) mirrors how
// better-auth resolves a session: a missing row == no session, so the login gate
// (canAccessApp) runs on the next request. Returns the number of member users targeted.
export async function invalidateCompanySessions(db: Db, companyId: string): Promise<number> {
  const members: { userId: string }[] = await db
    .select({ userId: companyMemberships.principalId })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.companyId, companyId),
        eq(companyMemberships.principalType, "user"),
      ),
    );

  const userIds = Array.from(new Set(members.map((m) => m.userId)));
  if (userIds.length === 0) return 0;

  await db.delete(authSessions).where(inArray(authSessions.userId, userIds));
  return userIds.length;
}

export function portalWebhookRoutes(db: Db) {
  const router = Router();

  // POST /api/webhooks/portal/entitlements
  // Body: { org_id: <Portal CUID>, appAccess: [{ app: string, enabled: boolean }] }
  //
  // Mounted OUTSIDE the cookie-authenticated /api router (like portal-callback), so it is
  // reachable server-to-server without a Conductor session. Authentication is the shared
  // secret header below.
  //
  // Cross-tenant safety: the caller supplies org_id, NOT a companyId. Conductor derives the
  // companyId itself via resolvePortalOrgCompanyId (the same deterministic mapping used at
  // login), so a caller can never steer a write to an arbitrary company by naming its UUID.
  // The only way to hit a victim company is to know its Portal org_id AND pass the shared-
  // secret gate — i.e. to already be Portal, which owns that mapping. So no cross-tenant
  // write is possible while the secret holds.
  router.post("/api/webhooks/portal/entitlements", async (req: Request, res) => {
    const expected = portalWebhookSecret();
    if (!expected) {
      logger.error("ORBIT_PORTAL_JWT_SECRET not configured; cannot authenticate entitlement webhook");
      res.status(503).json({ error: "auth_not_configured" });
      return;
    }

    const provided = req.header(SECRET_HEADER);
    if (!provided || !secretsMatch(provided, expected)) {
      logger.warn("Portal entitlement webhook: invalid or missing shared secret");
      res.status(401).json({ error: "unauthorized" });
      return;
    }

    const parsed = validateBody(req.body);
    if ("error" in parsed) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const companyId = resolvePortalOrgCompanyId(parsed.org_id);
    const enabledApps = parsed.appAccess.filter((e) => e.enabled).map((e) => e.app);
    const conductorDisabled = parsed.appAccess.some((e) => e.app === ENFORCED_APP && !e.enabled);

    // SKIP IF NOT PROVISIONED. A portal org's company row only materializes on that org's
    // FIRST Conductor login (portal-callback's findOrCreateCompany), and Portal legitimately
    // grants app access before anyone has ever logged in. Persisting is not merely
    // pointless here, it is impossible: reconcileAppAccess always writes at least the
    // CONDUCTOR row (ALWAYS_RECONCILED_APPS), so an absent company violates the
    // `app_access.company_id -> companies.id` FK and the rejection surfaces as a 500 —
    // which Portal then retries forever, because the retry can never converge. And nothing
    // is lost by skipping: the login path reconciles the FULL app_access JWT claim before
    // any canAccessApp read, so first login self-heals the entitlement from Portal's own
    // authoritative copy. So: answer 200 (terminal, stop retrying) and write nothing. We do
    // NOT create the company here — provisioning stays owned by the login path.
    if (!(await companyExists(db, companyId))) {
      logger.info(
        { companyId, org_id: parsed.org_id, enabledApps, conductorDisabled },
        "Portal entitlement webhook: company not provisioned yet (no first login) — "
          + "skipping; entitlement will be reconciled from the JWT claim at first login",
      );
      res.status(200).json({ ok: true, companyId, skipped: SKIP_REASON });
      return;
    }

    let sessionsInvalidated: number | null = null;
    try {
      // PERSIST (authoritative). Idempotent upsert of the per-company entitlement.
      await reconcileAppAccess(db, companyId, enabledApps);

      // ENFORCE (best-effort real-time). Only a CONDUCTOR disable invalidates sessions; an
      // enable or any non-CONDUCTOR change leaves live sessions untouched.
      //
      // Transactional boundary: the persisted app_access row is the source of truth — the
      // login gate (canAccessApp) will already deny future logins regardless of what happens
      // here. Session invalidation is a real-time convenience on top of that, so a failure is
      // logged loudly but does NOT fail the request: we do not want to report the entitlement
      // change as unpersisted (which it is not) just because logout lagged. Worst case a
      // revoked user keeps an already-issued session until it expires or they re-auth. This
      // mirrors portal-callback's defensive posture toward non-critical steps.
      if (conductorDisabled) {
        try {
          sessionsInvalidated = await invalidateCompanySessions(db, companyId);
          logger.info(
            { companyId, org_id: parsed.org_id, membersLoggedOut: sessionsInvalidated },
            "Portal entitlement webhook: CONDUCTOR disabled — invalidated active company sessions",
          );
        } catch (err) {
          logger.error(
            { err, companyId, org_id: parsed.org_id },
            "Portal entitlement webhook: session invalidation failed (entitlement still persisted)",
          );
        }
      }
    } catch (err) {
      // Belt-and-suspenders for the narrow check-then-write race: the company was dropped
      // between the existence check above and this write. Terminal outcome is identical to
      // the not-provisioned case, so give the same 200-skip rather than a 500 Portal would
      // retry forever. Anything that is NOT an FK violation is a real failure — rethrow it
      // so Express forwards it to the error handler as before.
      if (!isForeignKeyViolation(err)) throw err;
      logger.info(
        { companyId, org_id: parsed.org_id, enabledApps, conductorDisabled },
        "Portal entitlement webhook: company disappeared mid-write (FK 23503) — skipping",
      );
      res.status(200).json({ ok: true, companyId, skipped: SKIP_REASON });
      return;
    }

    logger.info(
      { companyId, org_id: parsed.org_id, enabledApps, conductorDisabled },
      "Portal entitlement webhook processed",
    );

    res.status(200).json({ ok: true, companyId, conductorDisabled, sessionsInvalidated });
  });

  return router;
}

import { createHash, createHmac, randomBytes } from "node:crypto";
import { Router, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import { authSessions, authUsers, companies, companyMemberships } from "@paperclipai/db";
import { deriveAuthCookiePrefix } from "../auth/better-auth.js";
import { verifyPortalJwt, type PortalJwtClaims } from "../auth/portal-jwt.js";
import { canAccessApp, reconcileAppAccess } from "../services/app-access.js";
import { companyService } from "../services/companies.js";
import { pluginCompanySettingsService } from "../services/plugin-company-settings.js";
import { pluginRegistryService } from "../services/plugin-registry.js";
import { logger } from "../middleware/logger.js";

const REQUIRED_APP_ACCESS = "CONDUCTOR";
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;
// Stable UUID for the fallback company assigned to portal-provisioned users
// ONLY when the Portal JWT carries no org_id claim at all. Picked deterministically
// so re-deploys converge on the same row.
const DEFAULT_PORTAL_COMPANY_ID = "00000000-0000-4000-a000-000000000001";
const DEFAULT_PORTAL_COMPANY_NAME = "Orbit Portal Users";
const PORTAL_MEMBERSHIP_ROLE = "operator";
// Plugin key of the WorkPipe tools bridge plugin. This is the plugin's manifest `id`, which
// pluginRegistryService.install() writes verbatim into `plugins.plugin_key` — so it is the
// column to resolve the plugin's DB uuid by.
// @see packages/plugins/paperclip-plugin-orbit-workpipe-tools/src/manifest.ts
const WORKPIPE_TOOLS_PLUGIN_KEY = "orbit.workpipe-tools";

// Fixed namespace for deriving stable per-org company UUIDs from non-UUID Portal org
// ids. The Portal's Organization.id is a CUID (Prisma @default(cuid())), not a UUID,
// while companies.id is a Postgres uuid column — so each distinct CUID is mapped to a
// deterministic UUIDv5 here. NEVER change this constant: doing so would remap every
// portal-provisioned company to a new id and orphan its data.
const PORTAL_ORG_UUID_NAMESPACE = "1d3a9b6e-0c4f-4a2d-9e7b-5f8c2a1e6d40";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function useSecureSessionCookie(): boolean {
  // Mirror better-auth (see better-auth.ts isHttpOnly): secure cookies — and the
  // __Secure- cookie-name prefix — are on unless PAPERCLIP_PUBLIC_URL is an http://
  // origin. better-auth reads "__Secure-<prefix>.session_token" on HTTPS, so the
  // name we write must match or getSession() cannot find the session.
  const publicUrl = process.env.PAPERCLIP_PUBLIC_URL;
  return publicUrl ? !publicUrl.startsWith("http://") : true;
}

function sessionCookieName(): string {
  return `${useSecureSessionCookie() ? "__Secure-" : ""}${deriveAuthCookiePrefix()}.session_token`;
}

function betterAuthSecret(): string | null {
  const secret = (process.env.BETTER_AUTH_SECRET ?? process.env.PAPERCLIP_AGENT_JWT_SECRET ?? "").trim();
  return secret.length > 0 ? secret : null;
}

function signCookieValue(value: string, secret: string): string {
  const signature = createHmac("sha256", secret).update(value).digest("base64");
  return encodeURIComponent(`${value}.${signature}`);
}

export function isSafeRedirectTarget(target: string | undefined | null): target is string {
  if (typeof target !== "string" || target.length === 0) return false;
  if (!target.startsWith("/")) return false;
  if (target.startsWith("//")) return false;
  if (target.includes("\\")) return false;
  return true;
}

function resolveRedirectTarget(raw: unknown): string {
  if (typeof raw !== "string") return "/";
  return isSafeRedirectTarget(raw) ? raw : "/";
}

function setSessionCookie(res: Response, token: string, secret: string, isHttps: boolean): void {
  const signed = signCookieValue(token, secret);
  const parts: string[] = [
    `${sessionCookieName()}=${signed}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.floor(SESSION_LIFETIME_MS / 1000)}`,
  ];
  // The __Secure- name prefix requires the Secure attribute; keep them in lockstep.
  if (isHttps || useSecureSessionCookie()) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function detectHttps(req: Request): boolean {
  if (req.secure) return true;
  const xfp = req.header("x-forwarded-proto");
  if (xfp && xfp.split(",")[0]?.trim().toLowerCase() === "https") return true;
  return false;
}

async function findOrCreateConductorUser(
  db: Db,
  claims: PortalJwtClaims,
  now: Date,
): Promise<{ id: string; created: boolean }> {
  const normalizedEmail = claims.email.toLowerCase();
  const existing = await db
    .select({ id: authUsers.id })
    .from(authUsers)
    .where(eq(authUsers.email, normalizedEmail))
    .then((rows: { id: string }[]) => rows[0] ?? null);
  if (existing) return { id: existing.id, created: false };

  const id = randomBytes(16).toString("hex");
  const name = claims.name && claims.name.trim().length > 0 ? claims.name.trim() : normalizedEmail;
  await db.insert(authUsers).values({
    id,
    name,
    email: normalizedEmail,
    emailVerified: true,
    image: null,
    createdAt: now,
    updatedAt: now,
  });
  return { id, created: true };
}

// Deterministic RFC-4122 v5 UUID (SHA-1 of namespace || name). Implemented inline to
// avoid pulling in the `uuid` package for a single call site.
function uuidV5(name: string, namespace: string): string {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(ns).update(Buffer.from(name, "utf8")).digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50; // version 5
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

// Optional explicit pins mapping a Portal org id (its CUID) to a specific existing
// Conductor company UUID. Format: "<portalOrgId>=<companyUuid>,<portalOrgId2>=<companyUuid2>".
// Used so a pre-existing company (e.g. the Orbit org on …c0de) keeps its data, memberships,
// installed plugins, and memory scope when per-org resolution lands, instead of being
// remapped to a freshly-derived UUID. Read per-request so env changes take effect on redeploy.
function portalCompanyOverrides(): Map<string, string> {
  const raw = process.env.PORTAL_COMPANY_OVERRIDES ?? "";
  const map = new Map<string, string>();
  for (const pair of raw.split(",")) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf("=");
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key && isUuid(value)) map.set(key, value);
  }
  return map;
}

// Deterministic Portal-org-id → Conductor company UUID derivation. EXTRACTED so both the
// login callback (below) and the entitlement webhook receiver (portal-webhooks.ts) map a
// Portal org to the SAME company, without duplicating PORTAL_ORG_UUID_NAMESPACE:
//   - org_id pinned via overrides   → the pinned company UUID
//   - org_id already a UUID         → used directly (future-proof for UUID-keyed orgs)
//   - org_id is a CUID (today)      → a stable per-org UUIDv5
// Callers must handle the "no org_id at all" case themselves (the login callback maps it to
// DEFAULT_PORTAL_COMPANY_ID; the webhook rejects it as a malformed payload).
export function resolvePortalOrgCompanyId(orgId: string): string {
  const override = portalCompanyOverrides().get(orgId);
  return override ?? (isUuid(orgId) ? orgId : uuidV5(orgId, PORTAL_ORG_UUID_NAMESPACE));
}

// Resolve the Conductor company for a Portal-provisioned login:
//   - no org_id at all              → the shared DEFAULT_PORTAL_COMPANY_ID (true fallback)
//   - org_id pinned via overrides   → the pinned company UUID
//   - org_id already a UUID         → used directly (future-proof for UUID-keyed orgs)
//   - org_id is a CUID (today)      → a stable per-org UUIDv5, so every org gets its own company
export function resolvePortalCompany(claims: PortalJwtClaims): {
  companyId: string;
  name: string;
  fallback: boolean;
} {
  const orgId = claims.org_id?.trim();
  const displayName =
    claims.org_name && claims.org_name.trim().length > 0
      ? claims.org_name.trim()
      : claims.org_slug && claims.org_slug.trim().length > 0
        ? claims.org_slug.trim()
        : null;

  if (!orgId) {
    return {
      companyId: DEFAULT_PORTAL_COMPANY_ID,
      name: DEFAULT_PORTAL_COMPANY_NAME,
      fallback: true,
    };
  }

  const companyId = resolvePortalOrgCompanyId(orgId);
  const name = displayName ?? `Portal Org ${orgId.slice(0, 8)}`;
  return { companyId, name, fallback: false };
}

function selectCompanyId(db: Db, companyId: string): Promise<{ id: string } | null> {
  return db
    .select({ id: companies.id })
    .from(companies)
    .where(eq(companies.id, companyId))
    .then((rows: { id: string }[]) => rows[0] ?? null);
}

/**
 * Does this company row exist yet?
 *
 * Thin boolean wrapper over {@link selectCompanyId} (behavior unchanged), exported for
 * callers outside the login path that must tell "not provisioned yet" apart from a real
 * failure. A portal-provisioned company only materializes on that org's FIRST Conductor
 * login, so anything Portal pushes before then legitimately targets an absent company.
 * @see routes/portal-webhooks.ts (entitlement webhook skip-and-200)
 */
export async function companyExists(db: Db, companyId: string): Promise<boolean> {
  return (await selectCompanyId(db, companyId)) !== null;
}

/**
 * Best-effort: persist this company's WorkPipe org id into the workpipe-tools plugin's
 * per-company settings row, so each new org drives its own WorkPipe business instead of
 * falling back to the plugin's instance-wide config value.
 *
 * The stored value is the RAW Portal org id (`claims.org_id`, a CUID that equals the
 * WorkPipe `Business.id`) — NOT the Conductor companyId, which is only a UUIDv5 *derived*
 * from it and means nothing to WorkPipe.
 *
 * Mirrors the Phase-1.1 CEO-seed posture: this is decoration on top of a successful
 * provision, so every failure is logged and swallowed — a settings write must never fail
 * a portal login. Silently skipped when workpipe-tools is not registered on this
 * deployment (a fresh install may never have installed the plugin).
 */
async function persistWorkpipePortalOrgId(
  db: Db,
  companyId: string,
  portalOrgId: string | undefined,
): Promise<void> {
  // Never write garbage: the fallback company (no org_id claim) has no WorkPipe business.
  if (typeof portalOrgId !== "string" || portalOrgId.length === 0) return;

  try {
    const plugin = await pluginRegistryService(db).getByKey(WORKPIPE_TOOLS_PLUGIN_KEY);
    if (!plugin) {
      logger.info(
        { companyId, pluginKey: WORKPIPE_TOOLS_PLUGIN_KEY },
        "workpipe-tools plugin not registered; skipping per-company portalOrgId write",
      );
      return;
    }
    // Non-clobbering: only write when the company has no portalOrgId yet. Never
    // overwrite a set value (a manual correction, or a prior write) — this is what
    // makes the call safe on EXISTING-company logins (self-heal, #55), not just on
    // company creation.
    const existing = await pluginCompanySettingsService(db).get(companyId, plugin.id);
    const current = (
      existing?.settingsJson as Record<string, unknown> | null | undefined
    )?.portalOrgId;
    if (typeof current === "string" && current.trim() !== "") return;
    // upsert (not insert) so a concurrent first login is idempotent.
    await pluginCompanySettingsService(db).upsert(companyId, plugin.id, { portalOrgId });
  } catch (err) {
    logger.warn(
      { companyId, err },
      "Failed to persist per-company WorkPipe portalOrgId; login continues",
    );
  }
}

/**
 * Resolve (and if needed provision) the Conductor company for a Portal login.
 *
 * Creation goes through the `companyService.create` chokepoint rather than a raw
 * `db.insert(companies)`, so a portal-provisioned org gets the same treatment as one created
 * through the API: a unique issue prefix, its local environment, and the seeded CEO agent
 * (bootstrapAgents defaults on — portal orgs SHOULD get the seed).
 *
 * Race-safe: `createCompanyWithUniquePrefix` internally retries only the
 * `companies_issue_prefix_idx` conflict and RETHROWS a primary-key collision, so two concurrent
 * first-logins for the same new org can race — one wins, the other's create throws. Absorbed by
 * re-reading, the same idiom `bridge-ensure-agent.ts` (ensureCompany) uses: tolerate the failure
 * iff the row now exists, otherwise rethrow so non-unique errors still propagate.
 */
async function findOrCreateCompany(
  db: Db,
  claims: PortalJwtClaims,
): Promise<{ id: string; created: boolean; fallback: boolean }> {
  const { companyId, name, fallback } = resolvePortalCompany(claims);

  const existing = await selectCompanyId(db, companyId);
  if (existing) {
    // #55 self-heal: orgs created before the per-company portalOrgId setting existed
    // have no plugin_company_settings row → WorkPipe tools fail closed ("not scoped
    // to a WorkPipe organization"). Back-fill it on login. persistWorkpipePortalOrgId
    // is non-clobbering, so a set/hand-corrected value is preserved.
    await persistWorkpipePortalOrgId(db, existing.id, claims.org_id);
    return { id: existing.id, created: false, fallback };
  }

  try {
    // Default opts: issue-prefix allocation + ensureLocalEnvironment + CEO seed.
    const created = await companyService(db).create({ id: companyId, name });
    // Also written on the existing-company path above (self-heal #55); safe on both
    // because persistWorkpipePortalOrgId only writes when the value is missing.
    await persistWorkpipePortalOrgId(db, created.id, claims.org_id);
    return { id: created.id, created: true, fallback };
  } catch (err) {
    // Lost a create race (or the row appeared concurrently) — tolerate iff it now exists.
    const raced = await selectCompanyId(db, companyId);
    if (!raced) throw err;
    return { id: raced.id, created: false, fallback };
  }
}

export { uuidV5, PORTAL_ORG_UUID_NAMESPACE };

async function findOrCreateCompanyMembership(
  db: Db,
  companyId: string,
  userId: string,
): Promise<{ created: boolean }> {
  const existing = await db
    .select({ id: companyMemberships.id })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.companyId, companyId),
        eq(companyMemberships.principalType, "user"),
        eq(companyMemberships.principalId, userId),
      ),
    )
    .then((rows: { id: string }[]) => rows[0] ?? null);
  if (existing) return { created: false };

  await db.insert(companyMemberships).values({
    companyId,
    principalType: "user",
    principalId: userId,
    status: "active",
    membershipRole: PORTAL_MEMBERSHIP_ROLE,
  });
  return { created: true };
}

async function insertSession(
  db: Db,
  userId: string,
  now: Date,
  req: Request,
): Promise<{ token: string }> {
  const token = randomBytes(32).toString("hex");
  const id = randomBytes(16).toString("hex");
  await db.insert(authSessions).values({
    id,
    token,
    userId,
    expiresAt: new Date(now.getTime() + SESSION_LIFETIME_MS),
    createdAt: now,
    updatedAt: now,
    ipAddress: req.ip ?? null,
    userAgent: req.header("user-agent") ?? null,
  });
  return { token };
}

export function portalCallbackRoutes(db: Db) {
  const router = Router();

  router.get("/conductor/auth/callback", async (req, res) => {
    const tokenParam = req.query.token;
    if (typeof tokenParam !== "string" || tokenParam.length === 0) {
      res.status(400).json({ error: "missing_token" });
      return;
    }

    const result = verifyPortalJwt(tokenParam);
    if (!result.ok) {
      logger.warn({ reason: result.reason }, "Portal JWT verification failed");
      const status = result.reason === "secret_missing" ? 503 : 403;
      res.status(status).json({ error: result.reason });
      return;
    }

    const claims = result.claims;

    // Entitlement gate — layer 1 (transient JWT claim, KEPT for belt-and-suspenders).
    // This runs BEFORE any provisioning so a login lacking the CONDUCTOR claim is rejected
    // without creating a user, company, membership, or app_access rows — preserving the
    // invariant that denied logins have no side effects, and guaranteeing that anyone
    // denied under the old claim-only gate stays denied.
    if (!claims.app_access.includes(REQUIRED_APP_ACCESS)) {
      logger.warn(
        { sub: claims.sub, app_access: claims.app_access },
        "Portal JWT entitlement denied: CONDUCTOR not in app_access",
      );
      res.status(403).json({ error: "entitlement_denied" });
      return;
    }

    const cookieSecret = betterAuthSecret();
    if (!cookieSecret) {
      logger.error("BETTER_AUTH_SECRET not configured; cannot establish Conductor session");
      res.status(503).json({ error: "auth_not_configured" });
      return;
    }

    const now = new Date();
    const { id: userId, created } = await findOrCreateConductorUser(db, claims, now);
    const {
      id: companyId,
      created: companyCreated,
      fallback: companyFallback,
    } = await findOrCreateCompany(db, claims);

    // Upsert-on-launch: persist the org-level Portal claim into the durable per-company
    // app_access table now that companyId is resolved. Runs BEFORE the DB-backed gate so
    // the table reflects this login's claim. No data-migration backfill is needed: the
    // table is DEFAULT-ON (an empty table locks nobody out) and each login populates its
    // own company here.
    await reconcileAppAccess(db, companyId, claims.app_access);

    // Entitlement gate — layer 2 (DB-backed, default-on). Requires companyId, hence
    // placed after company resolution. Denies when the app_access table explicitly
    // disables CONDUCTOR for this company. Combined with layer 1, access requires BOTH the
    // JWT claim AND the table not disabling CONDUCTOR.
    if (!(await canAccessApp(db, companyId, REQUIRED_APP_ACCESS))) {
      logger.warn(
        { sub: claims.sub, companyId },
        "Conductor entitlement denied: app_access table disables CONDUCTOR for company",
      );
      res.status(403).json({ error: "entitlement_denied" });
      return;
    }

    const { created: membershipCreated } = await findOrCreateCompanyMembership(
      db,
      companyId,
      userId,
    );
    const { token } = await insertSession(db, userId, now, req);

    setSessionCookie(res, token, cookieSecret, detectHttps(req));

    logger.info(
      {
        sub: claims.sub,
        userId,
        created,
        companyId,
        companyCreated,
        companyFallback,
        membershipCreated,
        app_access: claims.app_access,
      },
      "Portal JWT exchanged for Conductor session",
    );

    const redirectTo = resolveRedirectTarget(req.query.redirect_to);
    res.redirect(302, redirectTo);
  });

  return router;
}

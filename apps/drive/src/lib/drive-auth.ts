import { cookies } from "next/headers";
import { getPortalContext } from "@/lib/auth";
import {
  hasDriveAccess,
  PORTAL_TOKEN_COOKIE,
  verifyPortalToken,
  type PortalJwtPayload,
} from "@/lib/portal-jwt";
import { db } from "@/lib/db";

// Cookie that holds Drive's local sub-account selection (set by the in-app
// switcher). A sub-account id selects it; the BUSINESS sentinel forces business
// scope; absence falls back to the Portal JWT's sub_account_id claim.
export const DRIVE_SUBACCOUNT_COOKIE = "drive_subaccount";
export const DRIVE_BUSINESS_SCOPE = "__business__";

type DriveContext = {
  userId: string;
  orgId: string;
  /** Active sub-account scoped to orgId. null = business scope. */
  subAccountId: string | null;
  memberRole: string;
};

export type ServiceDriveContext = {
  userId: string;
  orgId: string;
  /** The explicit, validated sub-account for this request. null = business scope. */
  subAccountId: string | null;
};

/**
 * Auth context for SERVICE callers (sibling apps like WorkPipe), server-to-server.
 *
 * Unlike getDriveContext this requires NO Drive `Member` row — it trusts the
 * signed Portal JWT's `org_id` (verified with the shared secret + DRIVE
 * entitlement), exactly like /summary. The sub-account is taken from an EXPLICIT
 * request value (not the cookie/claim) and validated against the org; an invalid
 * id FAILS CLOSED (throws INVALID_SUBACCOUNT) rather than silently falling back
 * to business scope, so a caller can never write to the wrong tenant by accident.
 *
 * `explicitSubAccountId` undefined/null ⇒ business scope (null). A non-empty
 * string must name an ACTIVE sub-account of the token's org.
 */
export async function getServiceDriveContext(
  req: Request,
  explicitSubAccountId?: string | null,
): Promise<ServiceDriveContext> {
  const cookieStore = await cookies();
  let token = cookieStore.get(PORTAL_TOKEN_COOKIE)?.value;
  if (!token) {
    const authz = req.headers.get("authorization");
    if (authz?.startsWith("Bearer ")) token = authz.slice(7);
  }

  const payload = token ? verifyPortalToken(token) : null;
  if (!payload) throw new Error("UNAUTHORIZED");
  if (!hasDriveAccess(payload)) throw new Error("DRIVE_ACCESS_DENIED");

  const orgId = payload.org_id;

  let subAccountId: string | null = null;
  if (explicitSubAccountId) {
    subAccountId = await validateSubAccount(orgId, explicitSubAccountId);
    if (!subAccountId) throw new Error("INVALID_SUBACCOUNT"); // fail closed
  }

  return { userId: payload.sub, orgId, subAccountId };
}

/** Returns the id only if it names an ACTIVE sub-account of this org, else null. */
export async function validateSubAccount(orgId: string, id: string): Promise<string | null> {
  const sub = await db.subAccount.findFirst({
    where: { id, orgId, status: "ACTIVE" },
    select: { id: true },
  });
  return sub?.id ?? null;
}

/**
 * Resolve the active sub-account, strictly scoped to the resolved workspace.
 * Precedence:
 *   1. Drive's own selection cookie (the in-app switcher) — overrides, so a user
 *      can scope Drive independently of whatever Portal baked into the JWT.
 *      The BUSINESS sentinel means explicit business scope (null).
 *   2. The Portal JWT `sub_account_id` claim (the propagated default), honored
 *      only when minted for THIS org.
 *   3. null (business scope).
 * Every candidate is validated against the org, so a stale/cross-org id never
 * leaks into another org's view.
 */
async function resolveActiveSubAccountId(
  orgId: string,
  payload: PortalJwtPayload,
  cookieValue: string | undefined,
): Promise<string | null> {
  if (cookieValue === DRIVE_BUSINESS_SCOPE) return null;
  if (cookieValue) return validateSubAccount(orgId, cookieValue);

  const claim = payload.sub_account_id;
  if (!claim || payload.org_id !== orgId) return null;
  return validateSubAccount(orgId, claim);
}

/**
 * Check if the org has Drive access via subscription/app access.
 * Phase 1: Always returns true (no subscription wall).
 * Phase 2: Check AppAccess table for DRIVE + active subscription.
 */
async function checkDriveAccess(orgId: string): Promise<boolean> {
  // TODO: Phase 2 — uncomment to enforce subscription
  // const access = await db.appAccess.findUnique({
  //   where: { orgId_app: { orgId, app: "DRIVE" } },
  // });
  // if (!access?.enabled) return false;
  //
  // const sub = await db.subscription.findUnique({
  //   where: { orgId },
  // });
  // if (!sub || sub.status !== "ACTIVE") return false;

  // Phase 1: All authenticated org members get Drive access
  return true;
}

/**
 * Get Drive context for authenticated requests.
 * 
 * Auth flow (decoupled from Clerk's org layer):
 * 1. Clerk provides userId (authentication only — "who are you?")
 * 2. DB Member table maps userId → org (authorization — "what can you access?")
 * 3. This keeps org management in our DB, not Clerk's
 * 
 * If user belongs to multiple orgs, uses X-Org-Id header to select.
 * If user belongs to one org, auto-selects it.
 */
export async function getDriveContext(req?: Request): Promise<DriveContext> {
  const payload = await getPortalContext();

  if (!payload) {
    throw new Error("UNAUTHORIZED");
  }

  const userId = payload.sub;

  // Look up user's org memberships from our DB (not Clerk)
  const memberships = await db.member.findMany({
    where: { clerkUserId: userId },
    include: { org: true },
  });

  if (memberships.length === 0) {
    throw new Error("NO_ORG");
  }

  let membership;

  if (memberships.length === 1) {
    // Single org — auto-select
    membership = memberships[0];
  } else {
    // Multiple orgs — check X-Org-Id header
    const requestedOrgId = req?.headers.get("x-org-id");
    if (!requestedOrgId) {
      throw new Error("MULTI_ORG_SELECT_REQUIRED");
    }
    membership = memberships.find((m: typeof memberships[0]) => m.orgId === requestedOrgId);
    if (!membership) {
      throw new Error("FORBIDDEN");
    }
  }

  // Check subscription/access (Phase 1: always passes)
  const hasAccess = await checkDriveAccess(membership.orgId);
  if (!hasAccess) {
    throw new Error("DRIVE_ACCESS_DENIED");
  }

  const cookieStore = await cookies();
  const subAccountId = await resolveActiveSubAccountId(
    membership.orgId,
    payload,
    cookieStore.get(DRIVE_SUBACCOUNT_COOKIE)?.value,
  );

  return {
    userId,
    orgId: membership.orgId,
    subAccountId,
    memberRole: membership.role,
  };
}

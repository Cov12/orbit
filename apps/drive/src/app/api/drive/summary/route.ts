import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { DriveAuditAction, DriveFileStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { verifyPortalToken, hasDriveAccess, PORTAL_TOKEN_COOKIE } from "@/lib/portal-jwt";
import { validateSubAccount } from "@/lib/drive-auth";
import { logDriveAudit } from "@/lib/drive-audit";
import { driveErrorResponse, serializeBigInts } from "@/lib/drive-http";
import { getOrCreateQuota } from "@/lib/drive-quota";

/**
 * GET /api/drive/summary — read-only, org + sub-account scoped storage/file summary for
 * cross-app dashboards (Atrium's cross-ecosystem dashboard).
 *
 * Auth: a Portal-signed JWT — the browser cookie OR a service Bearer token forwarded by a
 * sibling app — verified with the shared JWT_SECRET via `verifyPortalToken` + `hasDriveAccess`
 * (the exact verification every Drive request uses). The org scope comes from the token's
 * SIGNED `org_id` claim (the same value `getPortalUser` exposes as `user.orgId`), NOT a
 * user-membership lookup — so a sibling service, which has no Drive user identity, can read
 * ITS OWN org's summary. Org membership is enforced by the caller (Atrium `require_org_access`
 * mints the token only for an org the user belongs to); Drive independently verifies the
 * signature + DRIVE entitlement here. Scope matches the `/files` list route so the counts and
 * recent files reflect exactly what a user sees.
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    let token = cookieStore.get(PORTAL_TOKEN_COOKIE)?.value;
    if (!token) {
      const authz = (await headers()).get("authorization");
      if (authz?.startsWith("Bearer ")) token = authz.slice(7);
    }

    const payload = token ? verifyPortalToken(token) : null;
    if (!payload) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }
    if (!hasDriveAccess(payload)) {
      return NextResponse.json({ error: "DRIVE_ACCESS_DENIED" }, { status: 403 });
    }

    const orgId = payload.org_id;
    // Validate the token's sub-account claim belongs to this org (null = business scope),
    // reusing the same check the interactive routes use.
    const subAccountId = payload.sub_account_id
      ? await validateSubAccount(orgId, payload.sub_account_id)
      : null;

    // Same visible-file scope as the /files list route so counts/recent match the file list.
    const fileWhere = {
      orgId,
      subAccountId,
      deletedAt: null,
      status: { not: DriveFileStatus.DELETED },
    };

    const [quota, fileCount, folderCount, recentFiles] = await Promise.all([
      getOrCreateQuota(orgId),
      db.driveFile.count({ where: fileWhere }),
      db.driveFolder.count({ where: { orgId, subAccountId } }),
      db.driveFile.findMany({
        where: fileWhere,
        orderBy: { createdAt: "desc" },
        take: 5,
        select: { id: true, name: true, size: true, mimeType: true, createdAt: true },
      }),
    ]);

    // Best-effort audit — never let a logging failure break a read-only summary.
    try {
      await logDriveAudit({
        orgId,
        subAccountId,
        userId: payload.sub,
        action: DriveAuditAction.QUOTA_VIEW,
        metadata: { summary: true, fileCount, folderCount },
      });
    } catch {
      // ignore
    }

    return NextResponse.json({
      quota: serializeBigInts(quota),
      fileCount,
      folderCount,
      recentFiles: serializeBigInts(recentFiles),
    });
  } catch (error) {
    return driveErrorResponse(error);
  }
}

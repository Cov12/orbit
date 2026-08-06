import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { postConductorEntitlements } from "@/lib/conductor-entitlements";

/**
 * POST /api/admin/orgs/:orgId/license  { licensed }
 *
 * Super-admin toggle of an org's per-org license grant. Sets Organization.licensed,
 * which the entitlement core reads via isOrgLicensed() (OR'd with the global
 * ORBIT_LICENSE_MODE env). When licensed, the org is fully entitled with no
 * subscription and its billing UI is hidden — the change reflects in that org's
 * JWT/UI on next load, and is pushed to Conductor immediately.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orgId: string }> }
) {
  const admin = await getAdminSession();
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // CSRF: a cross-site request would carry a foreign Origin.
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (origin && host && new URL(origin).host !== host) {
    return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
  }

  const { orgId } = await params;

  let licensed: boolean;
  try {
    const body = await req.json();
    licensed = Boolean(body.licensed);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true, slug: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  await db.organization.update({
    where: { id: orgId },
    data: { licensed },
  });

  logAdminAction({
    action: "license_toggle",
    adminEmail: admin.email,
    target: org.slug,
    outcome: "success",
    detail: licensed ? "licensed" : "unlicensed",
  });

  // Keep Conductor's cached entitlements in sync (best-effort, never blocks).
  try {
    await postConductorEntitlements(orgId);
  } catch (error) {
    console.error(`[admin] Conductor entitlement sync failed for ${orgId}:`, error);
  }

  return NextResponse.json({ ok: true, licensed });
}

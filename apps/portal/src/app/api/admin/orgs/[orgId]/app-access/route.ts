import { NextResponse } from "next/server";
import type { AppType } from "@prisma/client";
import { db } from "@/lib/db";
import { getAdminSession } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";
import { postConductorEntitlements } from "@/lib/conductor-entitlements";

const APPS: AppType[] = ["WORKPIPE", "ATRIUM", "DRIVE", "CONDUCTOR"];

/**
 * POST /api/admin/orgs/:orgId/app-access  { app, enabled }
 *
 * Super-admin toggle of an org's app access. Writes the same AppAccess.enabled
 * flag the unified entitlement selector (#20) reads, so the change reflects in
 * that org's UI + JWT on their next load, and is pushed to Conductor immediately.
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

  let app: string;
  let enabled: boolean;
  try {
    const body = await req.json();
    app = String(body.app);
    enabled = Boolean(body.enabled);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!APPS.includes(app as AppType)) {
    return NextResponse.json({ error: "Unknown app" }, { status: 400 });
  }

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { id: true, slug: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  await db.appAccess.upsert({
    where: { orgId_app: { orgId, app: app as AppType } },
    create: { orgId, app: app as AppType, enabled },
    update: { enabled },
  });

  logAdminAction({
    action: "app_access_toggle",
    adminEmail: admin.email,
    target: `${org.slug}:${app}`,
    outcome: "success",
    detail: enabled ? "enabled" : "disabled",
  });

  // Keep Conductor's cached entitlements in sync (best-effort, never blocks).
  try {
    await postConductorEntitlements(orgId);
  } catch (error) {
    console.error(
      `[admin] Conductor entitlement sync failed for ${orgId}:`,
      error
    );
  }

  return NextResponse.json({ ok: true, app, enabled });
}

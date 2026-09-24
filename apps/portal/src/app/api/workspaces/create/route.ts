import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { AppType } from "@prisma/client";
import { db } from "@/lib/db";
import { ALL_APP_TYPES } from "@/lib/entitlements";
import { postConductorEntitlements } from "@/lib/conductor-entitlements";

const KNOWN_APPS: ReadonlySet<string> = new Set(ALL_APP_TYPES);

/**
 * POST /api/workspaces/create
 *
 * Creates a new workspace. No subscriptions are created: under the license
 * edition every org is entitled via license mode (see lib/license.ts). An
 * AppAccess row is still written for each requested app (default: every app) so
 * entitlement keeps working when an operator runs with license mode off.
 *
 * Body: { name, industry?, logoUrl?, apps?: AppType[], subAccounts?: [{ name }] }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, industry, logoUrl, apps, subAccounts } = body as {
      name: string;
      industry?: string;
      logoUrl?: string;
      apps?: unknown;
      subAccounts?: Array<{ name: string }>;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }

    // Optional app selection; omitted or empty means every app.
    if (apps !== undefined && !Array.isArray(apps)) {
      return NextResponse.json({ error: "apps must be an array" }, { status: 400 });
    }
    const appList: unknown[] = Array.isArray(apps) ? apps : [];
    if (appList.some((a) => typeof a !== "string" || !KNOWN_APPS.has(a))) {
      return NextResponse.json({ error: "Unknown app in apps" }, { status: 400 });
    }
    const requestedApps: AppType[] =
      appList.length > 0 ? Array.from(new Set(appList as AppType[])) : [...ALL_APP_TYPES];

    // Generate a unique slug from the name
    const baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 30);

    // Check for existing slug and make unique if needed
    let slug = baseSlug;
    let suffix = 1;
    while (await db.organization.findUnique({ where: { slug } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    // Optional initial sub-accounts: slugify + de-dupe within this batch (the org
    // is brand new, so the only possible collisions are between the inputs).
    const usedSubSlugs = new Set<string>();
    const subAccountData = (Array.isArray(subAccounts) ? subAccounts : [])
      .filter((s): s is { name: string } => Boolean(s) && typeof s.name === "string" && s.name.trim().length > 0)
      .map((s) => {
        const base =
          s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 30) ||
          "sub-account";
        let subSlug = base;
        let n = 1;
        while (usedSubSlugs.has(subSlug)) {
          subSlug = `${base}-${n}`;
          n++;
        }
        usedSubSlugs.add(subSlug);
        return { name: s.name.trim(), slug: subSlug };
      });

    // Seed the owner's email/name from Clerk so the member record isn't empty
    // (token minting falls back to these / the email local-part for display).
    const clerkUser = await currentUser();
    const ownerEmail =
      clerkUser?.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)?.emailAddress ??
      null;
    const ownerName =
      [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(" ").trim() || null;

    // Trust only a real https URL from our upload host; ignore anything else.
    const cleanLogoUrl =
      typeof logoUrl === "string" && logoUrl.startsWith("https://") ? logoUrl : null;

    // Persist the industry captured in the wizard (previously accepted then dropped).
    const cleanIndustry =
      typeof industry === "string" && industry.trim() ? industry.trim() : null;

    const org = await db.organization.create({
      data: {
        name: name.trim(),
        slug,
        logoUrl: cleanLogoUrl,
        industry: cleanIndustry,
        members: {
          create: {
            clerkUserId: userId,
            email: ownerEmail,
            name: ownerName,
            role: "OWNER",
          },
        },
        appAccess: {
          create: requestedApps.map((app) => ({ app, enabled: true })),
        },
        ...(subAccountData.length > 0
          ? { subAccounts: { create: subAccountData } }
          : {}),
      },
    });

    try {
      await postConductorEntitlements(org.id);
    } catch (error) {
      console.error(`[Entitlements Sync] Unexpected failure after workspace bootstrap for ${org.id}:`, error);
    }

    // Set this as the current workspace
    const cookieStore = await cookies();
    cookieStore.set("orbit_workspace", org.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });

    return NextResponse.json({
      success: true,
      workspace: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        apps: requestedApps,
      },
    });
  } catch (error) {
    console.error("[Workspace Create]", error);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}

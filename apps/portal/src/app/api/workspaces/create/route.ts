import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";

/**
 * POST /api/workspaces/create
 *
 * Creates a new workspace with a 7-day trial subscription.
 * No credit card required upfront.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { name, industry, logoUrl, products, subAccounts } = body as {
      name: string;
      industry?: string;
      logoUrl?: string;
      products: Array<{
        app: "WORKPIPE" | "ATRIUM";
        plan: string;
      }>;
      subAccounts?: Array<{ name: string }>;
    };

    if (!name?.trim()) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }

    if (!products || products.length === 0) {
      return NextResponse.json({ error: "At least one product must be selected" }, { status: 400 });
    }

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

    // Calculate trial end date (7 days from now)
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);

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

    // Create the organization with subscriptions
    // Trust only a real https URL from our upload host; ignore anything else.
    const cleanLogoUrl =
      typeof logoUrl === "string" && logoUrl.startsWith("https://") ? logoUrl : null;

    const org = await db.organization.create({
      data: {
        name: name.trim(),
        slug,
        logoUrl: cleanLogoUrl,
        members: {
          create: {
            clerkUserId: userId,
            email: ownerEmail,
            name: ownerName,
            role: "OWNER",
          },
        },
        subscriptions: {
          create: products.map((p) => ({
            app: p.app,
            plan: p.plan as "STARTER" | "PRO" | "BUSINESS" | "GROWTH" | "ENTERPRISE",
            status: "TRIALING",
            currentPeriodEnd: trialEndDate,
          })),
        },
        appAccess: {
          create: products.map((p) => ({
            app: p.app,
            enabled: true,
          })),
        },
        ...(subAccountData.length > 0
          ? { subAccounts: { create: subAccountData } }
          : {}),
      },
      include: {
        subscriptions: true,
        members: { where: { clerkUserId: userId } },
      },
    });

    // Also give Orbit Drive access (free with any subscription)
    await db.subscription.create({
      data: {
        orgId: org.id,
        app: "DRIVE",
        plan: "FREE",
        status: "ACTIVE",
      },
    });
    await db.appAccess.create({
      data: {
        orgId: org.id,
        app: "DRIVE",
        enabled: true,
      },
    });

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
        trialEndsAt: trialEndDate.toISOString(),
      },
    });
  } catch (error) {
    console.error("[Workspace Create]", error);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}

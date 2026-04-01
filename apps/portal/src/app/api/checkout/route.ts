import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";

// Per-product pricing: monthly and annual
const PRICE_MAP: Record<string, Record<string, Record<string, string>>> = {
  WORKPIPE: {
    STARTER:  { monthly: "price_REDACTED", annual: "price_REDACTED" },
    PRO:      { monthly: "price_REDACTED", annual: "price_REDACTED" },
    BUSINESS: { monthly: "price_REDACTED", annual: "price_REDACTED" },
  },
  ATRIUM: {
    STARTER:    { monthly: "price_REDACTED", annual: "price_REDACTED" },
    GROWTH:     { monthly: "price_REDACTED", annual: "price_REDACTED" },
    ENTERPRISE: { monthly: "price_REDACTED", annual: "price_REDACTED" },
  },
};

/**
 * POST /api/checkout
 * Creates a Stripe Checkout session for a per-product subscription.
 * Body: { app: "WORKPIPE" | "ATRIUM", plan: "STARTER" | "PRO" | ... }
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { app, plan, interval = "monthly" } = await req.json();

    if (!app || !PRICE_MAP[app]) {
      return NextResponse.json({ error: "Invalid app" }, { status: 400 });
    }
    if (!plan || !PRICE_MAP[app][plan]) {
      return NextResponse.json({ error: "Invalid plan for this app" }, { status: 400 });
    }
    if (interval !== "monthly" && interval !== "annual") {
      return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
    }

    // Find user's workspace
    const cookieStore = await cookies();
    const savedWorkspace = cookieStore.get("orbit_workspace")?.value;

    let membership;
    if (savedWorkspace) {
      membership = await db.member.findFirst({
        where: { clerkUserId: userId, orgId: savedWorkspace },
      });
    }
    if (!membership) {
      membership = await db.member.findFirst({
        where: { clerkUserId: userId },
      });
    }

    if (!membership) {
      return NextResponse.json({ error: "No workspace found" }, { status: 400 });
    }

    const session = await getStripe().checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: PRICE_MAP[app][plan][interval], quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://portal.orbit.example"}/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://portal.orbit.example"}/billing?canceled=true`,
      metadata: {
        orgId: membership.orgId,
        app,
        plan,
        userId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("[Checkout]", error);
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}

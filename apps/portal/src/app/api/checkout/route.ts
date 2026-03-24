import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";

const PRICE_IDS: Record<string, string> = {
  STARTER: "price_REDACTED",
  PRO: "price_REDACTED",
  ENTERPRISE: "price_REDACTED",
};

/**
 * POST /api/checkout
 * Creates a Stripe Checkout session for upgrading a plan.
 */
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = await req.json();

    if (!plan || !PRICE_IDS[plan]) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
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
      line_items: [{ price: PRICE_IDS[plan], quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://portal.orbit.example"}/billing?success=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "https://portal.orbit.example"}/billing?canceled=true`,
      metadata: {
        orgId: membership.orgId,
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

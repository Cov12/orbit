import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import type { Plan, SubStatus } from "@prisma/client";
import Stripe from "stripe";

export async function POST(req: Request) {
  const body = await req.text();
  const headerPayload = await headers();
  const signature = headerPayload.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.orgId;
        const plan = (session.metadata?.plan as Plan) || "STARTER";

        if (orgId && session.subscription) {
          const sub = await getStripe().subscriptions.retrieve(session.subscription as string);

          await db.subscription.upsert({
            where: { orgId },
            create: {
              orgId,
              stripeCustomerId: session.customer as string,
              stripeSubId: sub.id,
              plan,
              status: "ACTIVE",
              currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
            },
            update: {
              stripeCustomerId: session.customer as string,
              stripeSubId: sub.id,
              plan,
              status: "ACTIVE",
              currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
            },
          });

          // Enable app access based on plan
          if (plan === "PRO" || plan === "ENTERPRISE") {
            await db.appAccess.upsert({
              where: { orgId_app: { orgId, app: "ATRIUM" } },
              create: { orgId, app: "ATRIUM", enabled: true },
              update: { enabled: true },
            });
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const existing = await db.subscription.findUnique({
          where: { stripeSubId: sub.id },
        });

        if (existing) {
          const statusMap: Record<string, SubStatus> = {
            active: "ACTIVE",
            past_due: "PAST_DUE",
            canceled: "CANCELED",
            trialing: "TRIALING",
          };

          await db.subscription.update({
            where: { stripeSubId: sub.id },
            data: {
              status: statusMap[sub.status] || "ACTIVE",
              currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
            },
          });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const existing = await db.subscription.findUnique({
          where: { stripeSubId: sub.id },
          include: { org: true },
        });

        if (existing) {
          // Downgrade to free
          await db.subscription.update({
            where: { stripeSubId: sub.id },
            data: { status: "CANCELED", plan: "FREE" },
          });

          // Disable Atrium access
          await db.appAccess.updateMany({
            where: { orgId: existing.orgId, app: "ATRIUM" },
            data: { enabled: false },
          });
        }
        break;
      }

      default:
        console.log(`[Stripe Webhook] Unhandled: ${event.type}`);
    }
  } catch (error) {
    console.error(`[Stripe Webhook] Error:`, error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

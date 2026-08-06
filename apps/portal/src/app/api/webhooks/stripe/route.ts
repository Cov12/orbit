import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { db } from "@/lib/db";
import type { AppType, Plan, SubStatus } from "@prisma/client";
import Stripe from "stripe";
import { isSubscriptionActive } from "@/lib/entitlements";
import { postConductorEntitlements } from "@/lib/conductor-entitlements";
import { isOrgLicensed } from "@/lib/license";

// Effective license for the org this webhook event targets: the global env
// switch OR the org's per-org `licensed` flag. Under either, a subscription
// event must never revoke app access.
async function orgIsLicensed(orgId: string): Promise<boolean> {
  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { licensed: true },
  });
  return isOrgLicensed(org);
}

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
        const app = (session.metadata?.app as AppType) || "WORKPIPE";
        const plan = (session.metadata?.plan as Plan) || "STARTER";

        if (orgId && session.subscription) {
          const sub = await getStripe().subscriptions.retrieve(session.subscription as string);

          await db.subscription.upsert({
            where: { orgId_app: { orgId, app } },
            create: {
              orgId,
              app,
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

          // Enable app access
          await db.appAccess.upsert({
            where: { orgId_app: { orgId, app } },
            create: { orgId, app, enabled: true },
            update: { enabled: true },
          });

          // Atrium includes WorkPipe + Conductor — enable them too
          if (app === "ATRIUM") {
            await db.appAccess.upsert({
              where: { orgId_app: { orgId, app: "WORKPIPE" } },
              create: { orgId, app: "WORKPIPE", enabled: true },
              update: { enabled: true },
            });
            await db.appAccess.upsert({
              where: { orgId_app: { orgId, app: "CONDUCTOR" } },
              create: { orgId, app: "CONDUCTOR", enabled: true },
              update: { enabled: true },
            });
          }

          try {
            await postConductorEntitlements(orgId);
          } catch (error) {
            console.error(`[Entitlements Sync] Unexpected failure after checkout.session.completed for ${orgId}:`, error);
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

          const nextStatus = statusMap[sub.status] || "ACTIVE";

          await db.subscription.update({
            where: { stripeSubId: sub.id },
            data: {
              status: nextStatus,
              currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
            },
          });

          // Conductor rides on Atrium — flip CONDUCTOR AppAccess to mirror parent.
          // Under a term license, keep it enabled regardless of Stripe status.
          if (existing.app === "ATRIUM") {
            const conductorEnabled =
              (await orgIsLicensed(existing.orgId)) || isSubscriptionActive(nextStatus);
            await db.appAccess.upsert({
              where: { orgId_app: { orgId: existing.orgId, app: "CONDUCTOR" } },
              create: { orgId: existing.orgId, app: "CONDUCTOR", enabled: conductorEnabled },
              update: { enabled: conductorEnabled },
            });
          }

          if (
            existing.app === "ATRIUM" &&
            isSubscriptionActive(existing.status) !== isSubscriptionActive(nextStatus)
          ) {
            try {
              await postConductorEntitlements(existing.orgId);
            } catch (error) {
              console.error(
                `[Entitlements Sync] Unexpected failure after customer.subscription.updated for ${existing.orgId}:`,
                error
              );
            }
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const existing = await db.subscription.findUnique({
          where: { stripeSubId: sub.id },
        });

        if (existing) {
          await db.subscription.update({
            where: { stripeSubId: sub.id },
            data: { status: "CANCELED", plan: "FREE" },
          });

          // Under a term license, entitlement is granted by the license, not by
          // Stripe — never disable app access in response to a subscription event.
          if (!(await orgIsLicensed(existing.orgId))) {
            // Disable app access
            await db.appAccess.updateMany({
              where: { orgId: existing.orgId, app: existing.app },
              data: { enabled: false },
            });

            // Conductor rides on Atrium — disable CONDUCTOR too when parent is deleted.
            if (existing.app === "ATRIUM") {
              await db.appAccess.updateMany({
                where: { orgId: existing.orgId, app: "CONDUCTOR" },
                data: { enabled: false },
              });
            }
          }

          try {
            await postConductorEntitlements(existing.orgId);
          } catch (error) {
            console.error(
              `[Entitlements Sync] Unexpected failure after customer.subscription.deleted for ${existing.orgId}:`,
              error
            );
          }
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

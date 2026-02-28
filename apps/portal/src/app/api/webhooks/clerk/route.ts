import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { Webhook } from "svix";
import { db } from "@/lib/db";

type WebhookEvent = {
  type: string;
  data: Record<string, unknown>;
};

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let event: WebhookEvent;

  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as WebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = event;

  try {
    switch (type) {
      case "organization.created": {
        const { id, name, slug } = data as { id: string; name: string; slug: string };
        await db.organization.create({
          data: {
            name,
            slug,
            clerkOrgId: id,
            subscriptions: {
              create: { plan: "FREE", status: "ACTIVE" },
            },
            appAccess: {
              create: { app: "WORKPIPE", enabled: true },
            },
          },
        });
        break;
      }

      case "organization.updated": {
        const { id, name, slug } = data as { id: string; name: string; slug: string };
        await db.organization.update({
          where: { clerkOrgId: id },
          data: { name, slug },
        });
        break;
      }

      case "organization.deleted": {
        const { id } = data as { id: string };
        await db.organization.delete({
          where: { clerkOrgId: id },
        });
        break;
      }

      case "organizationMembership.created": {
        const membership = data as {
          organization: { id: string };
          public_user_data: { user_id: string; identifier?: string; first_name?: string; last_name?: string };
          role: string;
        };
        const org = await db.organization.findUnique({
          where: { clerkOrgId: membership.organization.id },
        });
        if (org) {
          const userData = membership.public_user_data;
          const name = [userData.first_name, userData.last_name].filter(Boolean).join(" ") || null;
          await db.member.upsert({
            where: {
              clerkUserId_orgId: {
                clerkUserId: userData.user_id,
                orgId: org.id,
              },
            },
            create: {
              clerkUserId: userData.user_id,
              email: userData.identifier,
              name,
              orgId: org.id,
              role: membership.role === "admin" ? "ADMIN" : "MEMBER",
            },
            update: {
              role: membership.role === "admin" ? "ADMIN" : "MEMBER",
              email: userData.identifier,
              name,
            },
          });
        }
        break;
      }

      case "organizationMembership.deleted": {
        const membership = data as {
          organization: { id: string };
          public_user_data: { user_id: string };
        };
        const org = await db.organization.findUnique({
          where: { clerkOrgId: membership.organization.id },
        });
        if (org) {
          await db.member.deleteMany({
            where: {
              clerkUserId: membership.public_user_data.user_id,
              orgId: org.id,
            },
          });
        }
        break;
      }

      default:
        console.log(`[Clerk Webhook] Unhandled event: ${type}`);
    }
  } catch (error) {
    console.error(`[Clerk Webhook] Error processing ${type}:`, error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

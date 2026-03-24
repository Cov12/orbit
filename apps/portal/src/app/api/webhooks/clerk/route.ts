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
      case "user.created": {
        // Auto-create a personal workspace for new users
        const { id, email_addresses, first_name, last_name } = data as {
          id: string;
          email_addresses: Array<{ email_address: string }>;
          first_name?: string;
          last_name?: string;
        };

        const email = email_addresses?.[0]?.email_address;
        const displayName = [first_name, last_name].filter(Boolean).join(" ") || "My Workspace";

        // Check if user already has a workspace (e.g., created via /api/workspaces)
        const existing = await db.member.findFirst({
          where: { clerkUserId: id },
        });

        if (!existing) {
          await db.organization.create({
            data: {
              name: `${displayName}'s Workspace`,
              slug: `ws-${id.slice(-8).toLowerCase()}`,
              members: {
                create: {
                  clerkUserId: id,
                  email,
                  name: displayName !== "My Workspace" ? displayName : null,
                  role: "OWNER",
                },
              },
              subscriptions: {
                create: { plan: "FREE", status: "ACTIVE" },
              },
              appAccess: {
                create: [
                  { app: "WORKPIPE", enabled: true },
                  { app: "DRIVE", enabled: true },
                ],
              },
            },
          });
        }
        break;
      }

      case "user.updated": {
        const { id, email_addresses, first_name, last_name } = data as {
          id: string;
          email_addresses: Array<{ email_address: string }>;
          first_name?: string;
          last_name?: string;
        };

        const email = email_addresses?.[0]?.email_address;
        const name = [first_name, last_name].filter(Boolean).join(" ") || null;

        // Update all member records for this user
        await db.member.updateMany({
          where: { clerkUserId: id },
          data: { email, name },
        });
        break;
      }

      case "user.deleted": {
        const { id } = data as { id: string };

        // Find all workspaces where user is OWNER and sole member
        const ownedMemberships = await db.member.findMany({
          where: { clerkUserId: id, role: "OWNER" },
          include: {
            org: {
              include: { members: true },
            },
          },
        });

        // Delete workspaces where user is the only member
        for (const membership of ownedMemberships) {
          if (membership.org.members.length === 1) {
            await db.organization.delete({
              where: { id: membership.org.id },
            });
          }
        }

        // Remove user from any remaining workspaces
        await db.member.deleteMany({
          where: { clerkUserId: id },
        });
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

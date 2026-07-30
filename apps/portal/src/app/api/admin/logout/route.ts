import { NextResponse } from "next/server";
import { clearAdminCookie, getAdminSession } from "@/lib/admin-auth";
import { logAdminAction } from "@/lib/audit";

export async function POST() {
  const session = await getAdminSession();
  await clearAdminCookie();
  if (session) {
    logAdminAction({
      action: "logout",
      adminEmail: session.email,
      outcome: "success",
    });
  }
  return NextResponse.json({ ok: true });
}

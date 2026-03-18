import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDriveContext } from "@/lib/drive-auth";
import { driveErrorResponse } from "@/lib/drive-http";

type RouteContext = {
  params: Promise<{ shareId: string }>;
};

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const { orgId, userId } = await getDriveContext();
    const { shareId } = await context.params;

    const share = await db.driveShare.findFirst({
      where: { id: shareId, orgId, createdBy: userId },
      select: { id: true },
    });

    if (!share) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    await db.driveShare.update({
      where: { id: shareId },
      data: { isRevoked: true },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return driveErrorResponse(error);
  }
}

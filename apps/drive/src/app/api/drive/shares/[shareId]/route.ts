import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getDriveContext } from "@/lib/drive-auth";
import { driveErrorResponse } from "@/lib/drive-http";

type RouteContext = {
  params: Promise<{ shareId: string }>;
};

/**
 * GET /api/drive/shares/[shareId] — Public share metadata (no auth required)
 * Returns file name, size, and download URL for valid share links.
 */
export async function GET(_req: Request, context: RouteContext) {
  try {
    const { shareId } = await context.params;

    const share = await db.driveShare.findUnique({
      where: { id: shareId },
      include: {
        file: {
          select: { id: true, name: true, size: true, mimeType: true },
        },
      },
    });

    if (!share || !share.file) {
      return NextResponse.json({ error: "Share not found" }, { status: 404 });
    }

    if (share.isRevoked) {
      return NextResponse.json({ error: "This share link has been revoked" }, { status: 403 });
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      return NextResponse.json({ error: "This share link has expired" }, { status: 410 });
    }

    if (share.maxAccesses !== null && share.accessCount >= share.maxAccesses) {
      return NextResponse.json({ error: "This share link has reached its download limit" }, { status: 410 });
    }

    return NextResponse.json({
      shareId: share.id,
      fileName: share.file.name,
      fileSize: share.file.size,
      mimeType: share.file.mimeType,
      downloadUrl: `/api/drive/files/${share.file.id}/download?token=${share.token}`,
    });
  } catch (error) {
    return driveErrorResponse(error);
  }
}

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

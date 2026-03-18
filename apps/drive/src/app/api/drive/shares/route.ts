import { NextResponse } from "next/server";
import { DriveFileStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { getDriveContext } from "@/lib/drive-auth";
import { driveErrorResponse, serializeBigInts } from "@/lib/drive-http";

export async function GET() {
  try {
    const { userId, orgId } = await getDriveContext();

    const shares = await db.driveShare.findMany({
      where: { orgId, createdBy: userId },
      orderBy: { createdAt: "desc" },
      include: {
        file: {
          select: { id: true, name: true, mimeType: true, size: true, status: true },
        },
      },
    });

    const filtered = shares.filter(
      (share: (typeof shares)[number]) => share.file?.status !== DriveFileStatus.DELETED,
    );
    return NextResponse.json({ shares: serializeBigInts(filtered) });
  } catch (error) {
    return driveErrorResponse(error);
  }
}

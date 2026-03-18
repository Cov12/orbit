import { NextResponse } from "next/server";
import { DriveAuditAction } from "@prisma/client";
import { db } from "@/lib/db";
import { getDriveContext } from "@/lib/drive-auth";
import { logDriveAudit } from "@/lib/drive-audit";
import { driveErrorResponse } from "@/lib/drive-http";

type CreateFolderBody = {
  name?: string;
  parentId?: string | null;
};

export async function POST(req: Request) {
  try {
    const { userId, orgId } = await getDriveContext();
    const body = (await req.json()) as CreateFolderBody;

    if (!body.name || !body.name.trim()) {
      return NextResponse.json({ error: "Folder name is required" }, { status: 400 });
    }

    if (body.parentId) {
      const parent = await db.driveFolder.findFirst({
        where: { id: body.parentId, orgId },
      });
      if (!parent) {
        return NextResponse.json({ error: "Parent folder not found" }, { status: 404 });
      }
    }

    const folder = await db.driveFolder.create({
      data: {
        name: body.name.trim(),
        parentId: body.parentId ?? null,
        orgId,
        createdBy: userId,
      },
    });

    await logDriveAudit({
      orgId,
      userId,
      action: DriveAuditAction.FOLDER_CREATE,
      metadata: {
        folderId: folder.id,
        name: folder.name,
        parentId: folder.parentId,
      },
      request: req,
    });

    return NextResponse.json({ folder }, { status: 201 });
  } catch (error) {
    return driveErrorResponse(error);
  }
}

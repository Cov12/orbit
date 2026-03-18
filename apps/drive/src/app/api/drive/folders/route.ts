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

export async function GET(req: Request) {
  try {
    const { orgId } = await getDriveContext();
    const url = new URL(req.url);
    const parentId = url.searchParams.get("parentId");

    const folders = await db.driveFolder.findMany({
      where: { orgId, parentId: parentId ?? null },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { files: true, children: true } } },
    });

    const breadcrumbs = [] as Array<{ id: string; name: string; parentId: string | null; createdAt: Date }>;
    let currentId = parentId;
    while (currentId) {
      const folder = await db.driveFolder.findFirst({
        where: { id: currentId, orgId },
        select: { id: true, name: true, parentId: true, createdAt: true },
      });
      if (!folder) break;
      breadcrumbs.unshift(folder);
      currentId = folder.parentId;
    }

    return NextResponse.json({ folders, breadcrumbs });
  } catch (error) {
    return driveErrorResponse(error);
  }
}

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

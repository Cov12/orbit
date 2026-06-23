import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@clerk/nextjs/server";

const f = createUploadthing();

/**
 * Portal UploadThing FileRouter.
 *
 * Single route today: `orgLogo` — the workspace logo captured during onboarding.
 * The uploaded URL is echoed back to the client and persisted to
 * `Organization.logoUrl` at workspace creation (see api/workspaces/create),
 * which then propagates to every app via the JWT `org_logo` claim.
 *
 * NOTE: this is a deliberately thin, interim host. The branding store is slated
 * to move to a public Orbit Drive bucket, at which point this router (and the
 * UploadThing dependency) is removed app-wide in one sweep.
 */
export const portalFileRouter = {
  orgLogo: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      // Only a signed-in Portal user may upload. Whatever is returned here is
      // available as `metadata` in onUploadComplete.
      const { userId } = await auth();
      if (!userId) throw new Error("Unauthorized");
      return { userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      // The client reads file.ufsUrl from the upload result and writes it into
      // the workspace form, so no server-side persistence is needed here.
      // Returned value is delivered to the client's onClientUploadComplete.
      return { uploadedBy: metadata.userId, url: file.ufsUrl };
    }),
} satisfies FileRouter;

export type PortalFileRouter = typeof portalFileRouter;

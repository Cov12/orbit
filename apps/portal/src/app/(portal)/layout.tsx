import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar } from "@/components/portal/sidebar";

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Mandatory onboarding: an authenticated user with no workspace is sent to the
  // wizard. Workspaces are no longer auto-created on sign-in (Clerk webhook /
  // /api/workspaces), so the wizard is the single entry into the portal.
  // (Unauthenticated users are handled upstream by Clerk middleware.)
  const { userId } = await auth();
  if (userId) {
    const member = await db.member.findFirst({
      where: { clerkUserId: userId },
      select: { id: true },
    });
    if (!member) {
      redirect("/onboarding/new-workspace");
    }
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}

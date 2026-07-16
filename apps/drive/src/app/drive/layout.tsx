import { Suspense } from "react";
import Sidebar from "@/components/Sidebar";
import { OrgBrandingProvider } from "@/components/OrgBrandingProvider";
import { getPortalContext } from "@/lib/auth";

export default async function DriveLayout({ children }: { children: React.ReactNode }) {
  const portal = await getPortalContext();

  return (
    <OrgBrandingProvider logo={portal?.org_logo ?? null} name={portal?.org_name ?? ""}>
      <div className="flex h-screen">
        <Sidebar />
        <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-8 h-8 border-2 border-[#6961ff] border-t-transparent rounded-full animate-spin" /></div>}>
          {children}
        </Suspense>
      </div>
    </OrgBrandingProvider>
  );
}

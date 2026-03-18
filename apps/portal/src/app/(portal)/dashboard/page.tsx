import { currentUser } from "@clerk/nextjs/server";
import { AppCard } from "@/components/portal/app-card";

export default async function DashboardPage() {
  const user = await currentUser();

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          Welcome back{user?.firstName ? `, ${user.firstName}` : ""}
        </h1>
        <p className="text-gray-400 mt-1">
          Manage your Orbit products and team from one place.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass p-5">
          <p className="text-sm text-gray-400">Current Plan</p>
          <p className="text-xl font-semibold mt-1">Free</p>
        </div>
        <div className="glass p-5">
          <p className="text-sm text-gray-400">Team Members</p>
          <p className="text-xl font-semibold mt-1">1</p>
        </div>
        <div className="glass p-5">
          <p className="text-sm text-gray-400">Active Apps</p>
          <p className="text-xl font-semibold mt-1">1</p>
        </div>
      </div>

      {/* Apps */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Your Apps</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <AppCard
            name="WorkPipe CRM"
            description="Pipelines, contacts, invoices, and automations. Everything you need to run your business."
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            }
            color="#2B2FFF"
            status="active"
            url={process.env.NEXT_PUBLIC_WORKPIPE_URL}
          />
          <AppCard
            name="Orbit Drive"
            description="Banking-grade encrypted file storage for your organization. Upload, share, and manage files securely."
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.338 4.502 4.502 0 013.516 5.855A4.5 4.5 0 0117.25 19.5H6.75z" />
              </svg>
            }
            color="#6961ff"
            status="active"
            url={process.env.NEXT_PUBLIC_DRIVE_URL}
          />
          <AppCard
            name="Atrium"
            description="AI department heads for sales, support, and operations. Fortune 500 leverage for small teams."
            icon={
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            }
            color="#20B2AA"
            status="inactive"
          />
        </div>
      </div>
    </div>
  );
}

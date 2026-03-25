import { AppCard } from "@/components/portal/app-card";

export default function AppsPage() {
  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Apps</h1>
        <p className="text-gray-400 mt-1">
          Launch and manage your Orbit products.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AppCard
          name="WorkPipe CRM"
          slug="workpipe"
          description="Full-featured CRM with pipelines, contacts, invoices, and automations for small businesses."
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
          color="#2B2FFF"
          status="active"
        />

        <AppCard
          name="Orbit Drive"
          slug="drive"
          description="Banking-grade encrypted file storage for your workspace. Upload, share, and manage files securely."
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.338 4.502 4.502 0 013.516 5.855A4.5 4.5 0 0117.25 19.5H6.75z" />
            </svg>
          }
          color="#6961ff"
          status="active"
        />

        <AppCard
          name="Atrium"
          slug="atrium"
          description="AI-powered department heads that handle sales, support, and operations on autopilot."
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          }
          color="#20B2AA"
          status="inactive"
        />

        <AppCard
          name="More Coming Soon"
          slug=""
          description="We're building more tools to help your business grow. Stay tuned."
          icon={
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          }
          color="#6961ff"
          status="coming_soon"
        />
      </div>
    </div>
  );
}

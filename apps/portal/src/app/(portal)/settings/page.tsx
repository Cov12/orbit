import { currentUser } from "@clerk/nextjs/server";
import { UserProfile } from "@clerk/nextjs";

export default async function SettingsPage() {
  const user = await currentUser();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-400 mt-1">
          Manage your profile and organization settings.
        </p>
      </div>

      {/* Organization Info */}
      <div className="glass p-6 space-y-4">
        <h2 className="text-lg font-semibold">Organization</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-400">Organization Name</label>
            <p className="mt-1 font-medium">—</p>
          </div>
          <div>
            <label className="text-sm text-gray-400">Slug</label>
            <p className="mt-1 font-medium text-gray-500">Set up an organization to get started</p>
          </div>
        </div>
      </div>

      {/* Clerk Profile */}
      <div className="glass p-6 space-y-4">
        <h2 className="text-lg font-semibold">Profile</h2>
        <UserProfile
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-transparent shadow-none border-0",
            },
          }}
        />
      </div>
    </div>
  );
}

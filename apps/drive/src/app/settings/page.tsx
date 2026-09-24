import { redirect } from "next/navigation";

/**
 * Settings are managed in Orbit Portal.
 */
export default function SettingsPage() {
  const portalUrl = process.env.NEXT_PUBLIC_PORTAL_URL || "https://portal.orbit.example";
  return redirect(`${portalUrl}/settings`);
}

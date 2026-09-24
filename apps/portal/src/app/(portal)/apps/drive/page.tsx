import { AppLanding } from "@/components/portal/app-landing";
import { getCurrentOrgEntitlements } from "@/lib/org-entitlements";

const features = [
  {
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>,
    title: "End-to-End Encryption",
    description: "Every file is encrypted at rest using AES-256. Your data stays private — even from us.",
  },
  {
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" /></svg>,
    title: "Folders & Organization",
    description: "Create nested folders, move files around, and keep your workspace clean and structured.",
  },
  {
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>,
    title: "Secure Sharing",
    description: "Share files with expiring links, password protection, and download limits. Full control over who sees what.",
  },
  {
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
    title: "Audit Trail",
    description: "Every upload, download, share, and deletion is logged. Know exactly who did what, and when.",
  },
  {
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.338 4.502 4.502 0 013.516 5.855A4.5 4.5 0 0117.25 19.5H6.75z" /></svg>,
    title: "Cloudflare R2 Storage",
    description: "Files are stored on Cloudflare's global edge network for fast, reliable access from anywhere.",
  },
  {
    icon: <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>,
    title: "Workspace-Scoped",
    description: "Files are scoped to your workspace and sub-accounts, so each client's data stays separate.",
  },
];

export default async function DrivePage() {
  const entitlements = await getCurrentOrgEntitlements();
  const status = entitlements?.appStatus.DRIVE ? "active" : "inactive";

  // Drive's SSO callback lives at the ORIGIN root (/auth/callback), NOT the Atrium default
  // path — and NEXT_PUBLIC_DRIVE_URL may carry a /drive UI path. Strip to the origin so the
  // launch redirect_uri is exactly `${origin}/auth/callback`, not `${…}/drive/atrium/auth/callback`.
  const driveEnv = process.env.NEXT_PUBLIC_DRIVE_URL;
  let driveOrigin: string | undefined = driveEnv;
  if (driveEnv) {
    try {
      driveOrigin = new URL(driveEnv).origin;
    } catch {
      driveOrigin = driveEnv;
    }
  }
  return (
    <AppLanding
      name="Orbit Drive"
      tagline="Secure storage for your workspace."
      description="Banking-grade encrypted file storage included with every Orbit workspace. Upload, organize, and share files with confidence."
      color="#6961ff"
      icon={
        <svg className="w-full h-full" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.338 4.502 4.502 0 013.516 5.855A4.5 4.5 0 0117.25 19.5H6.75z" />
        </svg>
      }
      videoUrl="/videos/drive-bg.mp4"
      launchUrl={driveOrigin}
      callbackPath="/auth/callback"
      status={status}
      features={features}
      includedNote="Orbit Drive is included with every licensed workspace, alongside WorkPipe and Atrium."
    />
  );
}

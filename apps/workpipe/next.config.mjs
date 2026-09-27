// Portal hosts organization logos, so allow images from its origin (set at build time).
const portalImagePattern = (() => {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_PORTAL_URL || '')
    return [{ protocol: url.protocol.replace(':', ''), hostname: url.hostname }]
  } catch {
    return []
  }
})()

/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
          ...portalImagePattern,
          {
            protocol: 'https',
            hostname: 'uploadthing.com',
          },
          {
            protocol: 'https',
            hostname: 'utfs.io',
          },
          {
            // Orbit public R2 branding bucket — workspace logos captured at
            // Portal onboarding (Organization.logoUrl -> Business.businessLogo).
            protocol: 'https',
            hostname: 'branding.orbit.example',
          },
          {
            protocol: 'https',
            hostname: 'img.clerk.com',
          },
          {
            protocol: 'https',
            hostname: 'subdomain',
          },
          {
            protocol: 'https',
            hostname: 'files.stripe.com',
          },
        ],
      },
      reactStrictMode: false,
      eslint: {
        // Warning: This allows production builds to successfully complete even if
        // your project has ESLint errors.
        ignoreDuringBuilds: true,
      },
      typescript: {
        // Warning: This allows production builds to successfully complete even if
        // your project has TypeScript errors.
        ignoreBuildErrors: true,
      },
}

export default nextConfig;

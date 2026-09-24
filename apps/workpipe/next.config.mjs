/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        remotePatterns: [
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

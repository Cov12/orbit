/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        domains: [
          'uploadthing.com',
          'utfs.io',
          'img.clerk.com',
          'subdomain',
          'files.stripe.com',
        ],
      },
      reactStrictMode: false,
      eslint: {
        // Warning: This allows production builds to successfully complete even if
        // your project has ESLint errors.
        ignoreDuringBuilds: true,
      },
}

export default nextConfig;

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Turned off to prevent double renders of Sockets in Dev
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

module.exports = nextConfig;

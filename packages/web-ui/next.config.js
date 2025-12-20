/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@apexcli/core'],
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig

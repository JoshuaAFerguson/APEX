/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@apex/core'],
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
}

module.exports = nextConfig

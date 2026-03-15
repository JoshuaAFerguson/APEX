const packageJson = require('./package.json');

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  transpilePackages: ['@apexcli/core'],
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  // Performance optimizations
  poweredByHeader: false,
  compress: true,
}

module.exports = nextConfig

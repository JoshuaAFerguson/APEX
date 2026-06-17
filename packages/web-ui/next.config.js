const packageJson = require('./package.json');

/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_APP_VERSION: packageJson.version,
  },
  transpilePackages: ['@apexcli/core'],
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true, // Test files trigger lint errors; real linting via npm run lint
  },
  typescript: {
    ignoreBuildErrors: true, // TODO: fix Next 15.5.14 module resolution issue with ./config
  },
  // Performance optimizations
  poweredByHeader: false,
  compress: true,
}

module.exports = nextConfig

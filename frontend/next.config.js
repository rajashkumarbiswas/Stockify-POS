/** @type {import('next').NextConfig} */
const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async rewrites() {
    return [
      {
        // Browser calls /api/*, Next forwards to Express. Same origin = simple cookie auth.
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'localhost',
        port: '8081',  // Changed from 8080
        pathname: '/api/images/**',
      },
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8081',  // Changed from 8080
        pathname: '/api/images/**',
      },
      {
        protocol: 'http',
        hostname: 'host.docker.internal',
        port: '8081',  // Changed from 8080
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig
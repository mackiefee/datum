/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: '/index.html',
        destination: '/',
      },
    ];
  },
};

export default nextConfig;

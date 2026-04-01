/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: new URL("../..", import.meta.url).pathname,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

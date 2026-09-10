/** @type {import('next').NextConfig} */
const nextConfig = {
  output: process.env.EXPORT_STATIC === 'true' ? 'export' : undefined,
  distDir: process.env.EXPORT_STATIC === 'true' ? 'dist' : '.next',
  images: {
    unoptimized: process.env.EXPORT_STATIC === 'true',
  },
};

export default nextConfig;

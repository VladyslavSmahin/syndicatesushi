/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // нативний sharp і S3-клієнт не бандлимо у serverless — підвантажуються з node_modules
  // (інакше імпорт у /api/upload, /api/banners падає 500 на Vercel)
  serverExternalPackages: ["sharp", "@aws-sdk/client-s3"],
};

export default nextConfig;

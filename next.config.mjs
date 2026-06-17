/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // нативний sharp і S3-клієнт не бандлимо у serverless — підвантажуються з node_modules
  serverExternalPackages: ["sharp", "@aws-sdk/client-s3"],
  // sharp вантажить libvips через dlopen у рантаймі — трейсер Next цього не бачить,
  // тому явно вкладаємо нативні бінарі @img/** у функції завантаження (інакше 500 на Vercel)
  outputFileTracingIncludes: {
    "/api/upload": ["./node_modules/@img/**", "./node_modules/sharp/**"],
    "/api/banners": ["./node_modules/@img/**", "./node_modules/sharp/**"],
  },
};

export default nextConfig;

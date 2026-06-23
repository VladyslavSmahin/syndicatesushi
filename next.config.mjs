/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // не розкривати "X-Powered-By: Next.js"
  // Security-заголовки на всі відповіді (clickjacking, sniffing, HTTPS, referrer)
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
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

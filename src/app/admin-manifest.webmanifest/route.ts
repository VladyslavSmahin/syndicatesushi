// Маніфест адмінки — окремий застосунок «Адмінка» на екрані «Додому» (своя іконка з плашкою,
// відкривається одразу в /admin). Адреса поза /admin — щоб middleware-гард її не чіпав.
export const dynamic = "force-static";

export function GET() {
  const manifest = {
    id: "/admin",
    name: "Sushi Syndicate — Адмінка",
    short_name: "SS Адмінка",
    description: "Замовлення, меню та налаштування Sushi Syndicate",
    lang: "uk",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    background_color: "#0D0B09",
    theme_color: "#0D0B09",
    icons: [
      { src: "/pwa/admin-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/admin-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/admin-icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
}

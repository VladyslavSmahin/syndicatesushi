import { SITE_NAME } from "@/lib/seo";

// PWA магазину: «На екран Додому» → відкривається як застосунок (без панелей браузера).
// Роутом, а не файлом manifest.ts: файловий маніфест Next не дає адмінці підставити свій
// (/admin-manifest.webmanifest, scope /admin) — посилання задаємо в metadata.manifest.
export const dynamic = "force-static";

export function GET() {
  const manifest = {
    id: "/",
    name: `${SITE_NAME} — суші Тульчин`,
    short_name: SITE_NAME,
    description: "Доставка суші, ролів і сетів у Тульчині",
    lang: "uk",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0D0B09",
    theme_color: "#0D0B09",
    icons: [
      { src: "/pwa/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json; charset=utf-8" },
  });
}

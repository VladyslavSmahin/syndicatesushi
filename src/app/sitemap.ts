import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { fetchProductSlugs } from "@/features/publicData.server";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const slugs = await fetchProductSlugs();

  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    // /about, /oferta, /privacy поки чернетки (noindex) — повернути сюди, коли тексти будуть фінальні
    // сторінки страв — по них і приходять запити на кшталт «філадельфія тульчин»
    ...slugs.map((slug) => ({
      url: `${SITE_URL}/menu/${slug}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}

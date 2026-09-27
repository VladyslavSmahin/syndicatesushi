import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";
import { fetchProductSlugs } from "@/features/publicData.server";

// кеш — під PUBLIC_TAG (fetchProductSlugs); ISR раз на хвилину як страховка
export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const products = await fetchProductSlugs();

  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    // /about, /oferta, /privacy поки чернетки (noindex) — повернути сюди, коли тексти будуть фінальні
    // сторінки страв — по них і приходять запити на кшталт «філадельфія тульчин»
    // lastModified — дата створення товару (колонки updated_at у products немає)
    ...products.map(({ slug, lastModified }) => ({
      url: `${SITE_URL}/menu/${slug}`,
      lastModified: lastModified ? new Date(lastModified) : now,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}

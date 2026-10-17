import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CategoryPage from "@/components/CategoryPage";
import { PublicDataProvider } from "@/features/publicData";
import { fetchPublicData } from "@/features/publicData.server";
import { fetchOgImage } from "@/features/ogImage.server";
import { CATEGORY_SEO, categoryByPath } from "@/lib/categorySeo";
import { SITE_URL, SITE_NAME, CITY } from "@/lib/seo";

// ISR, як і сторінки страв: кеш скидає адмінка (PUBLIC_TAG), раз на хвилину — страховий перерендер.
export const revalidate = 60;
// лише адреси з CATEGORY_SEO; будь-що інше на першому рівні — 404
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.values(CATEGORY_SEO).map((c) => ({ category: c.path }));
}

type Params = { params: Promise<{ category: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const found = categoryByPath((await params).category);
  if (!found) return {};
  const [, seo] = found;
  const ogImage = await fetchOgImage();
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: `/${seo.path}` },
    openGraph: {
      type: "website", locale: "uk_UA", siteName: SITE_NAME,
      title: seo.title, description: seo.description, url: `/${seo.path}`,
      images: [{ url: ogImage, width: 1200, height: 630, alt: `${SITE_NAME} — суші та роли, ${CITY}` }],
    },
  };
}

export default async function Page({ params }: Params) {
  const found = categoryByPath((await params).category);
  if (!found) notFound();
  const [slug, seo] = found;
  const data = await fetchPublicData();
  const cat = data.categories.find((c) => c.slug === slug);
  // категорію вимкнули в адмінці — сторінки немає
  if (!cat || !cat.isActive) notFound();

  const url = `${SITE_URL}/${seo.path}`;
  const items = data.catalog.filter((p) => p.category === slug);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Головна", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: cat.name, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "ItemList",
      name: seo.h1,
      itemListElement: items.map((p, i) => ({ "@type": "ListItem", position: i + 1, url: `${SITE_URL}/menu/${p.slug}`, name: p.name })),
    },
  ];

  return (
    <PublicDataProvider value={data}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <CategoryPage slug={slug} seo={seo} />
    </PublicDataProvider>
  );
}

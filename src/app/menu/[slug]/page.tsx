import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductPage from "@/components/ProductPage";
import { PublicDataProvider } from "@/features/publicData";
import { fetchPublicData } from "@/features/publicData.server";
import { SITE_URL, SITE_NAME, CITY } from "@/lib/seo";
import type { Product } from "@/lib/types";

// каталог і акції змінюються через адмінку — рендеримо динамічно
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ slug: string }> };

/** Опис для пошуку: склад страви або дефолтний текст із вагою. */
function describe(p: Product): string {
  const base = p.composition?.trim() || p.desc?.trim();
  const tail = [p.pieces, p.weight].filter(Boolean).join(" · ");
  return base
    ? `${p.name} — ${base}. ${tail ? tail + ". " : ""}Замовити з доставкою в ${CITY}і — ${SITE_NAME}.`
    : `${p.name} — замовити з доставкою в ${CITY}і. ${tail}`.trim();
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchPublicData();
  const item = data.catalog.find((p) => p.slug === slug);
  if (!item) return { title: "Страву не знайдено" };

  const title = `${item.name} — замовити в ${CITY}і`;
  const description = describe(item);
  const images = item.photo ? [{ url: item.photo, alt: `${item.name} — суші та роли, ${CITY}` }] : undefined;

  return {
    title,
    description,
    alternates: { canonical: `/menu/${item.slug}` },
    openGraph: { type: "article", title, description, url: `/menu/${item.slug}`, images },
    twitter: { card: "summary_large_image", title, description, images: item.photo ? [item.photo] : undefined },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const data = await fetchPublicData();
  const item = data.catalog.find((p) => p.slug === slug);
  if (!item) notFound();

  const url = `${SITE_URL}/menu/${item.slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: item.name,
      description: describe(item),
      ...(item.photo ? { image: item.photo } : {}),
      ...(item.weight ? { weight: item.weight } : {}),
      brand: { "@type": "Brand", name: SITE_NAME },
      offers: {
        "@type": "Offer",
        url,
        price: item.price,
        priceCurrency: "UAH",
        availability: "https://schema.org/InStock",
        seller: { "@id": `${SITE_URL}/#restaurant` },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Головна", item: SITE_URL },
        { "@type": "ListItem", position: 2, name: "Меню", item: `${SITE_URL}/#menu` },
        { "@type": "ListItem", position: 3, name: item.name, item: url },
      ],
    },
  ];

  return (
    <PublicDataProvider value={data}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />
      <ProductPage item={item} />
    </PublicDataProvider>
  );
}

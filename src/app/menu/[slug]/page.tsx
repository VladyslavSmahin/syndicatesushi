import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductPage from "@/components/ProductPage";
import { PublicDataProvider } from "@/features/publicData";
import { fetchPublicData } from "@/features/publicData.server";
import { SITE_URL, SITE_NAME, CITY } from "@/lib/seo";
import { fetchOgImage } from "@/features/ogImage.server";
import type { Product } from "@/lib/types";

// ISR: сторінка кешується, адмінка скидає кеш через revalidateTag(PUBLIC_TAG);
// раз на хвилину — страховий перерендер. Нові слаги рендеряться на першому запиті,
// невідомі — 404 (notFound), тож generateStaticParams не потрібен.
export const revalidate = 60;
export const dynamicParams = true;

// порожній список: сторінки страв не збираються під час білду, а рендеряться при першому
// заході й далі віддаються з кешу (ISR). Без цієї функції Next рендерить їх на кожен запит.
export async function generateStaticParams() {
  return [];
}

type Params = { params: Promise<{ slug: string }> };

/** Опис для пошуку: склад страви або дефолтний текст із вагою. */
function describe(p: Product): string {
  const base = p.composition?.trim() || p.desc?.trim();
  const tail = [p.pieces, p.weight].filter(Boolean).join(" · ");
  return base
    ? `${p.name} — ${base}. ${tail ? tail + ". " : ""}Замовити з доставкою в ${CITY}і — ${SITE_NAME}.`
    : `${p.name} — замовити з доставкою в ${CITY}і. ${tail}`.trim();
}

/** Вага в грамах із рядка на кшталт «290 г», «1.2 кг», «250»; undefined — якщо не розпізнали. */
function weightGrams(weight: string): number | undefined {
  const m = weight.trim().match(/^(\d+(?:[.,]\d+)?)\s*(кг|kg|гр|г|g)?\.?$/i);
  if (!m) return undefined;
  const n = Number(m[1].replace(",", "."));
  if (!(n > 0)) return undefined;
  const grams = /^(кг|kg)$/i.test(m[2] ?? "") ? n * 1000 : n;
  return Math.round(grams * 10) / 10;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const data = await fetchPublicData();
  const item = data.catalog.find((p) => p.slug === slug);
  if (!item) return { title: "Страву не знайдено" };

  const title = `${item.name} — замовити в ${CITY}і`;
  const description = describe(item);
  const ogImage = await fetchOgImage(); // якщо в страви немає фото
  // openGraph у дочірній сторінці повністю замінює кореневий — тож дублюємо siteName/locale/images
  const images = item.photo
    ? [{ url: item.photo, alt: `${item.name} — суші та роли, ${CITY}` }]
    : [{ url: ogImage, width: 1200, height: 630, alt: `${SITE_NAME} — суші та роли, ${CITY}` }];

  return {
    title,
    description,
    alternates: { canonical: `/menu/${item.slug}` },
    openGraph: {
      type: "article", locale: "uk_UA", siteName: SITE_NAME,
      title, description, url: `/menu/${item.slug}`, images,
    },
    twitter: { card: "summary_large_image", title, description, images: [item.photo ?? ogImage] },
  };
}

export default async function Page({ params }: Params) {
  const { slug } = await params;
  const data = await fetchPublicData();
  const item = data.catalog.find((p) => p.slug === slug);
  if (!item) notFound();

  const url = `${SITE_URL}/menu/${item.slug}`;
  const grams = item.weight ? weightGrams(item.weight) : undefined;
  // кінець акції — лише якщо на товар діє акція і дата задана (YYYY-MM-DD)
  const priceValidUntil = item.oldPrice && item.promoUntil ? item.promoUntil.slice(0, 10) : undefined;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: item.name,
      description: describe(item),
      ...(item.photo ? { image: item.photo } : {}),
      ...(grams ? { weight: { "@type": "QuantitativeValue", value: grams, unitCode: "GRM" } } : {}),
      brand: { "@type": "Brand", name: SITE_NAME },
      offers: {
        "@type": "Offer",
        url,
        price: item.price,
        priceCurrency: "UAH",
        ...(priceValidUntil ? { priceValidUntil } : {}),
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

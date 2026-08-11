import HomeClient from "@/components/HomeClient";
import StructuredData from "@/components/StructuredData";
import { PublicDataProvider } from "@/features/publicData";
import { fetchPublicData } from "@/features/publicData.server";

// Каталог змінюється через адмінку → рендеримо динамічно (без кешу).
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await fetchPublicData();
  // діапазон цін для розмітки — з реального каталогу
  const prices = data.catalog.map((p) => p.price).filter((p) => p > 0);
  const priceRange = prices.length ? `${Math.min(...prices)}–${Math.max(...prices)} UAH` : undefined;

  return (
    <PublicDataProvider value={data}>
      <StructuredData contacts={data.contacts} delivery={data.delivery} seoBlock={data.seoBlock} priceRange={priceRange} />
      <HomeClient />
    </PublicDataProvider>
  );
}

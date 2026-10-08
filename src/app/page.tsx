import HomeClient from "@/components/HomeClient";
import StructuredData from "@/components/StructuredData";
import { PublicDataProvider } from "@/features/publicData";
import { fetchPublicData } from "@/features/publicData.server";
import { after } from "next/server";
import { syncTikTok, TIKTOK_SYNC_EVERY_MS } from "@/lib/tiktokSync.server";

// ISR: сторінка кешується, адмінка скидає кеш через revalidateTag(PUBLIC_TAG);
// раз на хвилину — страховий перерендер, якщо інвалідація не дійшла.
export const revalidate = 60;

export default async function Page() {
  const data = await fetchPublicData();
  // TikTok «auto»: свіжі ролики підтягуємо у фоні після відповіді (не частіше ніж раз на 2 год) —
  // відвідувач не чекає, а наступний перерендер покаже нові
  const tt = data.tiktok;
  if (tt.mode === "auto" && tt.profileUrl && (!tt.syncedAt || Date.now() - Date.parse(tt.syncedAt) > TIKTOK_SYNC_EVERY_MS)) {
    after(() => syncTikTok().catch(() => {}));
  }
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

import HomeClient from "@/components/HomeClient";
import { PublicDataProvider } from "@/features/publicData";
import { fetchPublicData } from "@/features/publicData.server";

// Каталог змінюється через адмінку → рендеримо динамічно (без кешу).
export const dynamic = "force-dynamic";

export default async function Page() {
  const data = await fetchPublicData();
  return (
    <PublicDataProvider value={data}>
      <HomeClient />
    </PublicDataProvider>
  );
}

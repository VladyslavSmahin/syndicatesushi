import { fetchIngredientsPage } from "@/features/admin/server/ingredients";
import { parsePage, parseQuery } from "@/features/admin/server/pagination";
import IngredientsClient from "@/components/admin/IngredientsClient";

export default async function IngredientsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const page = parsePage(sp.page);
  const q = parseQuery(sp.q);
  const { rows, total, pageCount } = await fetchIngredientsPage(page, q);

  return <IngredientsClient rows={rows} total={total} page={page} pageCount={pageCount} />;
}

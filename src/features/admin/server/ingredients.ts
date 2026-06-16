import "server-only";
import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { ADMIN_PER_PAGE, makePageResult, type PageResult } from "./pagination";
import { INGREDIENTS_TAG, type AdminIngredient } from "../ingredientsShared";
import { ADMIN_TAG } from "../adminCache";

export type { AdminIngredient };
export { INGREDIENTS_TAG };

async function queryIngredients(page: number, q: string): Promise<PageResult<AdminIngredient>> {
  const supabase = createAdminClient();
  const from = (page - 1) * ADMIN_PER_PAGE;
  let query = supabase
    .from("ingredients")
    .select("id, name, slug, kcal, protein, fat, carbs", { count: "exact" })
    .order("name");
  if (q) query = query.ilike("name", `%${q}%`);
  const { data, count, error } = await query.range(from, from + ADMIN_PER_PAGE - 1);
  if (error) {
    console.error("ingredients page:", error.message);
    return makePageResult<AdminIngredient>([], 0, page);
  }
  return makePageResult((data ?? []) as AdminIngredient[], count ?? 0, page);
}

/**
 * Сторінка інгредієнтів із кешем Next (Data Cache). Кешується по (page, q);
 * скидається revalidateTag(INGREDIENTS_TAG) із серверних actions і кнопки «Оновити».
 */
export function fetchIngredientsPage(page: number, q: string): Promise<PageResult<AdminIngredient>> {
  return unstable_cache(
    () => queryIngredients(page, q),
    ["admin-ingredients", String(page), q],
    { tags: [INGREDIENTS_TAG, ADMIN_TAG] }
  )();
}

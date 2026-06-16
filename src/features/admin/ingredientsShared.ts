// Спільні тип і тег кешу інгредієнтів — БЕЗ "server-only",
// щоб можна було імпортувати і з клієнтських компонентів (import type), і з actions.
export interface AdminIngredient {
  id: string;
  name: string;
  slug: string;
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
}

// тег для інвалідації кешу (revalidateTag) після мутацій інгредієнтів
export const INGREDIENTS_TAG = "admin:ingredients";

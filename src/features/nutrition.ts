// Розрахунок ваги та КБЖУ порції за грамовкою інгредієнтів.
// Спільний хелпер для адмін-форми (live-прев'ю) та публічного каталогу.

import type { Portion } from "@/lib/types";

export interface NutritionPer100 {
  kcal?: number | null;
  protein?: number | null;
  fat?: number | null;
  carbs?: number | null;
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * @param grams   мапа ingredientId → грами в порції
 * @param ingById мапа ingredientId → КБЖУ на 100 г
 */
export function computePortion(
  grams: Record<string, number> | undefined,
  ingById: Map<string, NutritionPer100>
): Portion {
  let weight = 0, kcal = 0, protein = 0, fat = 0, carbs = 0;

  if (grams) {
    for (const [id, raw] of Object.entries(grams)) {
      const g = Number(raw);
      if (!g || g <= 0) continue;
      weight += g;
      const ing = ingById.get(id);
      if (!ing) continue;
      const k = g / 100;
      kcal += (ing.kcal ?? 0) * k;
      protein += (ing.protein ?? 0) * k;
      fat += (ing.fat ?? 0) * k;
      carbs += (ing.carbs ?? 0) * k;
    }
  }

  return { weight: r1(weight), kcal: Math.round(kcal), protein: r1(protein), fat: r1(fat), carbs: r1(carbs) };
}

"use server";

import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slugify";
import { isStaff } from "@/lib/adminAuth";
import { INGREDIENTS_TAG } from "../ingredientsShared";
import { PUBLIC_TAG } from "@/features/publicCache";

export interface ActionResult {
  error?: string;
}

interface Nutrition {
  kcal: number | null;
  protein: number | null;
  fat: number | null;
  carbs: number | null;
}

export async function createIngredientAction(name: string, nutrition: Nutrition): Promise<ActionResult> {
  const n = name.trim();
  if (!n) return { error: "Вкажіть назву" };
  const supabase = await createClient();
  const { error } = await supabase.from("ingredients").insert({ name: n, slug: slugify(n), ...nutrition });
  if (error) return { error: error.message.includes("duplicate") ? "Такий інгредієнт вже є" : error.message };
  revalidateTag(INGREDIENTS_TAG);
  revalidateTag(PUBLIC_TAG); // назви/КБЖУ інгредієнтів видно на сайті
  return {};
}

export async function updateIngredientAction(
  id: string,
  patch: Partial<Nutrition> & { name?: string }
): Promise<ActionResult> {
  if (patch.name !== undefined) {
    patch = { ...patch, name: patch.name.trim() };
    if (!patch.name) return { error: "Вкажіть назву" };
  }
  const supabase = await createClient();
  // slug не чіпаємо при перейменуванні — як і в підкатегорій
  const { error } = await supabase.from("ingredients").update(patch).eq("id", id);
  if (error) return { error: error.message.includes("duplicate") ? "Такий інгредієнт вже є" : error.message };
  revalidateTag(INGREDIENTS_TAG);
  revalidateTag(PUBLIC_TAG); // назви/КБЖУ інгредієнтів видно на сайті
  return {};
}

export async function deleteIngredientAction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("ingredients").delete().eq("id", id);
  if (error) return { error: error.message.includes("policy") ? "Лише адміністратор може видаляти" : error.message };
  revalidateTag(INGREDIENTS_TAG);
  revalidateTag(PUBLIC_TAG); // назви/КБЖУ інгредієнтів видно на сайті
  return {};
}

/** Кнопка «Оновити весь список» — примусово скидає кеш. */
export async function refreshIngredientsAction(): Promise<void> {
  if (!(await isStaff())) return;
  revalidateTag(INGREDIENTS_TAG);
}

"use client";

import { createLocalStore } from "./createLocalStore";
import { MENU, INGREDIENT_FILTERS, PROMOS } from "@/data/site";
import type { Badge } from "@/lib/types";

// ===== Інгредієнти (окрема сутність — для фільтрації каталогу) =====
export interface Ingredient {
  id: string;
  name: string;
}

const ingredientSeed: Ingredient[] = INGREDIENT_FILTERS.filter((i) => i !== "Всі").map((name, i) => ({
  id: `i${i}`,
  name,
}));

// мапа «назва (нижній регістр) → id» для звʼязування товарів зі стартових даних
const ingByName = new Map(ingredientSeed.map((i) => [i.name.toLowerCase(), i.id]));

export const { store: ingredientsStore, useItems: useIngredients } =
  createLocalStore<Ingredient>("ss_ingredients_v1", ingredientSeed);

// ===== Товари =====
export interface AdminProduct {
  id: string;
  name: string;
  category: string; // slug
  price: number;
  weight: string;
  pieces: string;
  badge: Badge;
  isHit: boolean;
  desc: string;
  composition: string;        // описовий склад (текст, для відображення)
  ingredientIds: string[];    // звʼязок із сутностями інгредієнтів (для фільтра)
  fullDesc: string;
  photo: string | null;
  isAvailable: boolean;
}

const productSeed: AdminProduct[] = MENU.map((m) => ({
  id: `p${m.id}`,
  name: m.name,
  category: m.category,
  price: m.price,
  weight: m.weight,
  pieces: m.pieces,
  badge: m.badge,
  isHit: m.isHit,
  desc: m.desc,
  composition: m.composition,
  ingredientIds: m.ingredients
    .map((n) => ingByName.get(n.toLowerCase()))
    .filter((id): id is string => Boolean(id)),
  fullDesc: m.fullDesc,
  photo: m.photo,
  isAvailable: true,
}));

export const { store: productsStore, useItems: useProducts } =
  createLocalStore<AdminProduct>("ss_products_v2", productSeed);

// ===== Акції =====
export interface AdminPromo {
  id: string;
  title: string;
  label: string;
  productId: string; // звʼязок із товаром (admin id)
  price: number;
  oldPrice: number;
  isActive: boolean;
}

const promoSeed: AdminPromo[] = PROMOS.map((p) => ({
  id: `pr${p.id}`,
  title: p.title,
  label: p.label,
  productId: `p${p.linkedItemId}`,
  price: p.price,
  oldPrice: p.oldPrice,
  isActive: true,
}));

export const { store: promosStore, useItems: usePromos } =
  createLocalStore<AdminPromo>("ss_promos_v1", promoSeed);

// ===== Промокоди =====
export interface PromoCode {
  id: string;
  code: string;
  discountType: "percent" | "fixed";
  value: number;
  isActive: boolean;
}

const promoCodeSeed: PromoCode[] = [
  { id: "c1", code: "SUSHI10", discountType: "percent", value: 10, isActive: true },
  { id: "c2", code: "WELCOME50", discountType: "fixed", value: 50, isActive: true },
];

export const { store: promoCodesStore, useItems: usePromoCodes } =
  createLocalStore<PromoCode>("ss_promocodes_v1", promoCodeSeed);

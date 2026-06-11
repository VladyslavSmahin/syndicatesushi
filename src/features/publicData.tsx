"use client";

// Публічні дані каталогу (товари / категорії / підкатегорії), завантажені з Supabase
// на сервері (RSC) і передані сюди як value. Хуки повторюють сигнатури колишніх
// localStorage-сторів, щоб публічні компоненти змінювались мінімально.

import { createContext, useContext } from "react";
import type { Product, Promo } from "@/lib/types";
import { DEFAULT_DELIVERY, type DeliverySettings } from "@/lib/delivery";

export interface PubCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  showInNav: boolean;
  isActive: boolean;
}

export interface PubSubcategory {
  id: string;
  categorySlug: string;
  name: string;
  slug: string;
  sortOrder: number;
}

export interface PublicData {
  catalog: Product[];
  categories: PubCategory[];
  subcategories: PubSubcategory[];
  promos: Promo[];
  delivery: DeliverySettings;
}

const Ctx = createContext<PublicData>({ catalog: [], categories: [], subcategories: [], promos: [], delivery: DEFAULT_DELIVERY });

export function PublicDataProvider({ value, children }: { value: PublicData; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePublicCatalog(): Product[] {
  return useContext(Ctx).catalog;
}

export function usePublicCategories(opts?: { navOnly?: boolean }): PubCategory[] {
  const cats = useContext(Ctx).categories;
  return opts?.navOnly ? cats.filter((c) => c.isActive && c.showInNav) : cats;
}

export function usePublicSubcategories(categorySlug?: string): PubSubcategory[] {
  const subs = useContext(Ctx).subcategories;
  return categorySlug ? subs.filter((s) => s.categorySlug === categorySlug) : subs;
}

export function usePublicPromos(): Promo[] {
  return useContext(Ctx).promos;
}

export function usePublicDelivery(): DeliverySettings {
  return useContext(Ctx).delivery;
}

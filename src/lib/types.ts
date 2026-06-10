// Типи даних сайту. Узгоджені зі схемою БД (див. ARCHITECTURE.md §4).
// Поки що джерело — статичні дані (src/data/site.ts). Пізніше замінимо на Supabase.

export type Badge = "ХІТ" | "НОВЕ" | "";

export interface Product {
  id: number;
  name: string;
  /** короткий опис на картці */
  desc: string;
  /** повний опис у модалці */
  fullDesc: string;
  /** склад текстом */
  composition: string;
  price: number;
  /** напр. "290 г" */
  weight: string;
  /** напр. "8 шт" */
  pieces: string;
  badge: Badge;
  /** основна категорія (slug) */
  category: string;
  /** інгредієнти для фільтрації (нижній регістр) */
  ingredients: string[];
  /** показувати у блоці «Хіти меню» */
  isHit: boolean;
  /** шлях до фото або null (плейсхолдер) */
  photo: string | null;
}

export interface Promo {
  id: number;
  bannerImage: string;
  label: string;
  title: string;
  price: number;
  oldPrice: number;
  /** id товару з меню, який додається в кошик */
  linkedItemId: number;
}

export interface NavCategory {
  id: string;
  label: string;
  filter?: { category?: string; badge?: Badge };
  scrollTo?: string;
}

export interface CartItem {
  id: number;
  name: string;
  price: number;
  qty: number;
}

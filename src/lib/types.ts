// Типи даних сайту. Узгоджені зі схемою БД (див. ARCHITECTURE.md §4).
// Поки що джерело — статичні дані (src/data/site.ts). Пізніше замінимо на Supabase.

export type Badge = "ХІТ" | "НОВЕ" | "";

/** Харчова цінність порції (сума по інгредієнтах з урахуванням грамовки). */
export interface Portion {
  /** сумарна вага, г */
  weight: number;
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
}

export interface Product {
  /** ідентифікатор товару (рядок — узгоджено з адмін-сховищем / майбутніми uuid Supabase) */
  id: string;
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
  /** бейдж картки; «ХІТ» також додає товар у блок «Хіти меню» */
  badge: Badge;
  /** основна категорія (slug) */
  category: string;
  /** підкатегорія в межах категорії (slug); напр. тип ролу. Опційно. */
  subcategory?: string;
  /** інгредієнти для фільтрації (нижній регістр) */
  ingredients: string[];
  /** шлях до фото або null (плейсхолдер) */
  photo: string | null;
  /** розрахована харчова цінність порції (якщо вказана грамовка інгредієнтів) */
  portion?: Portion;
}

export interface Promo {
  id: string;
  bannerImage: string;
  label: string;
  title: string;
  price: number;
  oldPrice: number;
  /** id товару з каталогу, який додається в кошик */
  linkedItemId: string;
}

export interface NavCategory {
  id: string;
  label: string;
  filter?: { category?: string; badge?: Badge };
  scrollTo?: string;
}

export interface CartItem {
  id: string;
  name: string;
  price: number;
  qty: number;
}

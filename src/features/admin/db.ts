"use client";

// Доступ до каталогу в Supabase для адмінки: хуки читання (з refetch) + мутації.
// Заміна localStorage-сторів. RLS: читання публічне, запис — staff, видалення — admin.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseDeliverySettings, DEFAULT_DELIVERY, type DeliverySettings } from "@/lib/delivery";
import { parseContacts, type SiteContacts } from "@/lib/contacts";
import { parseSeoBlock, type SeoBlock } from "@/lib/seoBlock";
import { parseHeroBg, DEFAULT_HERO_BG, type HeroBg } from "@/lib/heroBg";
import { NAV_SPECIALS, parseNavVisibility } from "@/lib/navSpecials";
import { parseGlossary, type Glossary } from "@/lib/glossary";
import type { Badge } from "@/lib/types";
import { revalidatePublicAction } from "./actions/public";

// ---------- Типи ----------
export interface DbIngredient {
  id: string; name: string; slug: string;
  kcal: number | null; protein: number | null; fat: number | null; carbs: number | null;
}
export interface DbCategory { id: string; name: string; slug: string; sortOrder: number; showInNav: boolean; isActive: boolean; }
export interface DbSubcategory { id: string; categoryId: string; name: string; slug: string; sortOrder: number; }
export interface DbProduct {
  id: string; categoryId: string | null; subcategoryId: string | null;
  name: string; slug: string; price: number; weight: string; pieces: string; badge: Badge;
  desc: string; composition: string; fullDesc: string; photo: string | null;
  isAvailable: boolean; deletedAt: string | null; sortOrder: number;
  ingredientIds: string[]; ingredientGrams: Record<string, number>;
  setItemIds: string[]; // для сетів: id товарів-ролів у складі
}
export interface ProductInput {
  categoryId: string | null; subcategoryId: string | null;
  name: string; price: number; weight: string; pieces: string; badge: Badge;
  desc: string; composition: string; fullDesc: string; photo: string | null;
  isAvailable: boolean; ingredientIds: string[]; ingredientGrams: Record<string, number>;
  setItemIds: string[];
}

const slugify = (s: string) =>
  (s.toLowerCase().trim().replace(/[^a-z0-9а-яіїєґ]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "product") +
  "-" + Math.random().toString(36).slice(2, 7);

// ---------- Рядки select ----------
interface ProductRow {
  id: string; category_id: string | null; subcategory_id: string | null; name: string; slug: string;
  price: number | string; weight: string | null; pieces: string | null; badge: string | null;
  short_desc: string | null; full_desc: string | null; composition: string | null; image_path: string | null;
  is_available: boolean; deleted_at: string | null; sort_order: number;
  items: { ingredient_id: string; grams: number | string | null }[] | null;
  setItems: { product_id: string; qty: number | null; sort_order: number }[] | null;
}

function mapProduct(p: ProductRow): DbProduct {
  const items = p.items ?? [];
  const grams: Record<string, number> = {};
  for (const it of items) if (it.grams != null) grams[it.ingredient_id] = Number(it.grams);
  // один рядок set_items = рол + кількість; розгортаємо у плаский список,
  // щоб «два однакових роли в сеті» були двома пунктами у складі
  const setItems = (p.setItems ?? []).slice().sort((a, b) => a.sort_order - b.sort_order);
  const setItemIds = setItems.flatMap((it) => Array.from({ length: Math.max(1, Number(it.qty) || 1) }, () => it.product_id));
  return {
    id: p.id, categoryId: p.category_id, subcategoryId: p.subcategory_id,
    name: p.name, slug: p.slug, price: Number(p.price), weight: p.weight ?? "", pieces: p.pieces ?? "",
    badge: (p.badge ?? "") as Badge, desc: p.short_desc ?? "", composition: p.composition ?? "",
    fullDesc: p.full_desc ?? "", photo: p.image_path ?? null, isAvailable: p.is_available,
    deletedAt: p.deleted_at, sortOrder: p.sort_order,
    ingredientIds: items.map((it) => it.ingredient_id), ingredientGrams: grams,
    setItemIds,
  };
}

const PRODUCT_SELECT =
  "id, category_id, subcategory_id, name, slug, price, weight, pieces, badge, short_desc, full_desc, composition, image_path, is_available, deleted_at, sort_order, items:product_ingredients(ingredient_id, grams), setItems:set_items!set_id(product_id, qty, sort_order)";

// ---------- Хуки читання ----------
export function useDbProducts() {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from("products").select(PRODUCT_SELECT).order("sort_order");
    if (error) console.error("products:", error.message);
    else setProducts(((data ?? []) as unknown as ProductRow[]).map(mapProduct));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { products, loading, refetch };
}

export function useDbIngredients() {
  const supabase = useMemo(() => createClient(), []);
  const [ingredients, setIngredients] = useState<DbIngredient[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from("ingredients").select("id, name, slug, kcal, protein, fat, carbs").order("name");
    if (error) console.error("ingredients:", error.message);
    else setIngredients((data ?? []) as DbIngredient[]);
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { ingredients, loading, refetch };
}

export function useDbCategories() {
  const supabase = useMemo(() => createClient(), []);
  const [categories, setCategories] = useState<DbCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from("categories").select("id, name, slug, sort_order, show_in_nav, is_active").order("sort_order");
    if (error) console.error("categories:", error.message);
    else setCategories((data ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug, sortOrder: c.sort_order, showInNav: c.show_in_nav, isActive: c.is_active })));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { categories, loading, refetch };
}

export function useDbSubcategories() {
  const supabase = useMemo(() => createClient(), []);
  const [subcategories, setSubcategories] = useState<DbSubcategory[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    const { data, error } = await supabase.from("subcategories").select("id, category_id, name, slug, sort_order").order("sort_order");
    if (error) console.error("subcategories:", error.message);
    else setSubcategories((data ?? []).map((s) => ({ id: s.id, categoryId: s.category_id, name: s.name, slug: s.slug, sortOrder: s.sort_order })));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { subcategories, loading, refetch };
}

// ---------- Мутації ----------
/**
 * Скинути кеш публічного сайту після успішної мутації (server action → revalidateTag).
 * Fire-and-forget: UI не чекає, помилки ігноруємо — страховкою є revalidate: 60.
 * Серію мутацій (масова зміна цін, сортування) склеюємо в один виклик.
 */
let touchTimer: ReturnType<typeof setTimeout> | null = null;
function touchPublic() {
  if (touchTimer) clearTimeout(touchTimer);
  touchTimer = setTimeout(() => {
    touchTimer = null;
    revalidatePublicAction().catch(() => {});
  }, 300);
}

async function syncIngredients(
  supabase: ReturnType<typeof createClient>,
  productId: string,
  ids: string[],
  grams: Record<string, number>
): Promise<string | undefined> {
  const del = await supabase.from("product_ingredients").delete().eq("product_id", productId);
  if (del.error) return del.error.message;
  if (ids.length) {
    const ins = await supabase.from("product_ingredients").insert(
      ids.map((id) => ({ product_id: productId, ingredient_id: id, grams: grams[id] ?? null }))
    );
    if (ins.error) return ins.error.message;
  }
  return undefined;
}

// Склад сету: зв'язки set_items (set_id -> product_id ролів).
// Один і той самий рол може бути в сеті кілька разів — у БД це один рядок із qty,
// бо первинний ключ таблиці — (set_id, product_id). Порядок — за першою появою.
async function syncSetItems(supabase: ReturnType<typeof createClient>, setId: string, productIds: string[]): Promise<string | undefined> {
  const del = await supabase.from("set_items").delete().eq("set_id", setId);
  if (del.error) return del.error.message;
  const grouped: { product_id: string; qty: number }[] = [];
  for (const pid of productIds) {
    const row = grouped.find((g) => g.product_id === pid);
    if (row) row.qty += 1;
    else grouped.push({ product_id: pid, qty: 1 });
  }
  if (grouped.length) {
    const ins = await supabase.from("set_items").insert(
      grouped.map((g, i) => ({ set_id: setId, product_id: g.product_id, qty: g.qty, sort_order: i }))
    );
    if (ins.error) return ins.error.message;
  }
  return undefined;
}

function productFields(input: ProductInput) {
  return {
    category_id: input.categoryId, subcategory_id: input.subcategoryId,
    name: input.name, short_desc: input.desc, full_desc: input.fullDesc, composition: input.composition,
    price: input.price, weight: input.weight || null, pieces: input.pieces || null,
    badge: input.badge || null, image_path: input.photo, is_available: input.isAvailable,
  };
}

/** Повертає текст помилки або undefined при успіху. */
export async function dbCreateProduct(input: ProductInput): Promise<string | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({ ...productFields(input), slug: slugify(input.name), sort_order: 9999 })
    .select("id").single();
  if (error || !data) return error?.message ?? "Не вдалося створити товар";
  // товар уже створено — кеш скидаємо навіть якщо склад зберігся з помилкою
  const syncErr = (await syncIngredients(supabase, data.id, input.ingredientIds, input.ingredientGrams))
    ?? (await syncSetItems(supabase, data.id, input.setItemIds));
  touchPublic();
  return syncErr;
}

export async function dbUpdateProduct(id: string, input: ProductInput): Promise<string | undefined> {
  const supabase = createClient();
  const { error } = await supabase.from("products").update(productFields(input)).eq("id", id);
  if (error) return error.message;
  const syncErr = (await syncIngredients(supabase, id, input.ingredientIds, input.ingredientGrams))
    ?? (await syncSetItems(supabase, id, input.setItemIds));
  touchPublic();
  return syncErr;
}

/** Повертає текст помилки або undefined при успіху. */
export async function dbUpdatePrice(id: string, price: number): Promise<string | undefined> {
  const { error } = await createClient().from("products").update({ price }).eq("id", id);
  if (!error) touchPublic();
  return error?.message;
}
/** Перезаписує порядок товарів: sort_order = індекс у переданому масиві id. */
export async function dbReorderProducts(ids: string[]) {
  const supabase = createClient();
  await Promise.all(ids.map((id, i) => supabase.from("products").update({ sort_order: i }).eq("id", id)));
  touchPublic();
}

export async function dbSetAvailable(id: string, value: boolean) {
  const { error } = await createClient().from("products").update({ is_available: value }).eq("id", id);
  if (!error) touchPublic();
}
export async function dbSoftDelete(id: string) {
  const { error } = await createClient().from("products").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (!error) touchPublic();
}
export async function dbRestore(id: string) {
  const { error } = await createClient().from("products").update({ deleted_at: null }).eq("id", id);
  if (!error) touchPublic();
}
export async function dbHardDelete(id: string) {
  const { error } = await createClient().from("products").delete().eq("id", id);
  if (!error) touchPublic();
}
export async function dbPurgeExpired(days = 90) {
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();
  await createClient().from("products").delete().not("deleted_at", "is", null).lt("deleted_at", cutoff);
}

// ---------- Інгредієнти CRUD ----------
type Nutrition = { kcal?: number | null; protein?: number | null; fat?: number | null; carbs?: number | null };

/** Створити інгредієнт. nutrition — опційне КБЖУ на 100 г. */
export async function dbCreateIngredient(name: string, nutrition?: Nutrition): Promise<DbIngredient | undefined> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ingredients")
    .insert({ name, slug: slugify(name), ...nutrition })
    .select("id, name, slug, kcal, protein, fat, carbs").single();
  if (error || !data) { console.error("ingredient create:", error?.message); return undefined; }
  touchPublic();
  return data as DbIngredient;
}

export async function dbUpdateIngredient(id: string, patch: Partial<{ name: string } & Nutrition>) {
  const { error } = await createClient().from("ingredients").update(patch).eq("id", id);
  if (!error) touchPublic();
}
export async function dbDeleteIngredient(id: string) {
  // product_ingredients чистяться каскадом (FK on delete cascade)
  const { error } = await createClient().from("ingredients").delete().eq("id", id);
  if (!error) touchPublic();
}

// ---------- Категорії CRUD ----------
export interface CategoryInput { name: string; slug: string; sortOrder: number; showInNav: boolean; isActive: boolean; }
export async function dbCreateCategory(input: CategoryInput): Promise<string | undefined> {
  const { error } = await createClient().from("categories").insert({
    name: input.name, slug: input.slug, sort_order: input.sortOrder, show_in_nav: input.showInNav, is_active: input.isActive,
  });
  if (!error) touchPublic();
  return error?.message;
}
export async function dbUpdateCategory(id: string, patch: Partial<{ name: string; slug: string; sortOrder: number; showInNav: boolean; isActive: boolean }>) {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.slug !== undefined) row.slug = patch.slug;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  if (patch.showInNav !== undefined) row.show_in_nav = patch.showInNav;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  const { error } = await createClient().from("categories").update(row).eq("id", id);
  if (!error) touchPublic();
}
/** Перезаписує порядок категорій: sort_order = індекс у переданому масиві id. */
export async function dbReorderCategories(ids: string[]) {
  const supabase = createClient();
  await Promise.all(ids.map((id, i) => supabase.from("categories").update({ sort_order: i }).eq("id", id)));
  touchPublic();
}

export async function dbDeleteCategory(id: string) {
  const { error } = await createClient().from("categories").delete().eq("id", id);
  if (!error) touchPublic();
}

// ---------- Підкатегорії CRUD ----------
export async function dbCreateSubcategory(input: { categoryId: string; name: string; sortOrder: number }): Promise<string | undefined> {
  const { error } = await createClient().from("subcategories").insert({
    category_id: input.categoryId, name: input.name, slug: slugify(input.name), sort_order: input.sortOrder,
  });
  if (!error) touchPublic();
  return error?.message;
}
export async function dbUpdateSubcategory(id: string, patch: Partial<{ name: string; sortOrder: number; categoryId: string }>) {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
  const { error } = await createClient().from("subcategories").update(row).eq("id", id);
  if (!error) touchPublic();
}
export async function dbDeleteSubcategory(id: string) {
  const { error } = await createClient().from("subcategories").delete().eq("id", id);
  if (!error) touchPublic();
}

// ---------- Акції ----------
export interface DbPromo {
  id: string; productId: string | null;
  price: number; oldPrice: number; isActive: boolean; sortOrder: number;
  validFrom: string | null; validUntil: string | null; // дати у форматі YYYY-MM-DD (для інпутів)
}
export interface PromoInput {
  productId: string | null;
  price: number; oldPrice: number; isActive: boolean;
  validFrom: string | null; validUntil: string | null;
}

export function useDbPromos() {
  const supabase = useMemo(() => createClient(), []);
  const [promos, setPromos] = useState<DbPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("promos")
      .select("id, product_id, promo_price, old_price, is_active, sort_order, valid_from, valid_until")
      .order("sort_order");
    if (error) console.error("promos:", error.message);
    else setPromos((data ?? []).map((p) => ({
      id: p.id, productId: p.product_id,
      price: Number(p.promo_price), oldPrice: Number(p.old_price ?? 0),
      isActive: p.is_active, sortOrder: p.sort_order,
      validFrom: p.valid_from ? String(p.valid_from).slice(0, 10) : null,
      validUntil: p.valid_until ? String(p.valid_until).slice(0, 10) : null,
    })));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { promos, loading, refetch };
}

function promoFields(input: PromoInput) {
  return {
    product_id: input.productId,
    promo_price: input.price, old_price: input.oldPrice || null,
    is_active: input.isActive,
    // дату-початок беремо як 00:00, дату-кінець — як кінець доби, щоб акція діяла весь день
    valid_from: input.validFrom ? `${input.validFrom}T00:00:00` : null,
    valid_until: input.validUntil ? `${input.validUntil}T23:59:59` : null,
  };
}
export async function dbCreatePromo(input: PromoInput): Promise<string | undefined> {
  const { error } = await createClient().from("promos").insert({ ...promoFields(input), sort_order: 9999 });
  if (!error) touchPublic();
  return error?.message;
}
export async function dbUpdatePromo(id: string, input: PromoInput): Promise<string | undefined> {
  const { error } = await createClient().from("promos").update(promoFields(input)).eq("id", id);
  if (!error) touchPublic();
  return error?.message;
}
export async function dbSetPromoActive(id: string, value: boolean) {
  const { error } = await createClient().from("promos").update({ is_active: value }).eq("id", id);
  if (!error) touchPublic();
}
export async function dbDeletePromo(id: string) {
  const { error } = await createClient().from("promos").delete().eq("id", id);
  if (!error) touchPublic();
}

// ---------- Банери (Hero-слайдер) ----------
export interface DbBanner { id: string; imagePath: string; isActive: boolean; sortOrder: number; }

export function useDbBanners() {
  const supabase = useMemo(() => createClient(), []);
  const [banners, setBanners] = useState<DbBanner[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("banners")
      .select("id, image_path, is_active, sort_order")
      .order("sort_order");
    if (error) console.error("banners:", error.message);
    else setBanners((data ?? []).map((b) => ({ id: b.id, imagePath: b.image_path, isActive: b.is_active, sortOrder: b.sort_order })));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { banners, loading, refetch };
}

/** Завантажує зображення через API (конвертація у WebP + R2). Повертає публічний URL або помилку. */
export async function dbUploadImage(file: File, folder = "products"): Promise<{ url?: string; error?: string }> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("folder", folder);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok || !j.url) return { error: j.error || `HTTP ${res.status}` };
  return { url: j.url };
}

/** Завантажує файл банера через API (конвертація у WebP + R2). Повертає текст помилки або undefined. */
export async function dbUploadBanner(file: File): Promise<string | undefined> {
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/banners", { method: "POST", body: fd });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    return j.error || `HTTP ${res.status}`;
  }
  return undefined;
}

export async function dbDeleteBanner(id: string): Promise<string | undefined> {
  const res = await fetch("/api/banners", {
    method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    return j.error || `HTTP ${res.status}`;
  }
  return undefined;
}

export async function dbSetBannerActive(id: string, value: boolean) {
  const { error } = await createClient().from("banners").update({ is_active: value }).eq("id", id);
  if (!error) touchPublic();
}

/** Перезаписує порядок банерів: sort_order = індекс у переданому масиві id. */
export async function dbReorderBanners(ids: string[]) {
  const supabase = createClient();
  await Promise.all(ids.map((id, i) => supabase.from("banners").update({ sort_order: i }).eq("id", id)));
  touchPublic();
}

// ---------- Промокоди ----------
export interface DbPromoCode { id: string; code: string; discountType: "percent" | "fixed"; value: number; isActive: boolean; }

export function useDbPromoCodes() {
  const supabase = useMemo(() => createClient(), []);
  const [codes, setCodes] = useState<DbPromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("promo_codes")
      .select("id, code, discount_type, discount_value, is_active")
      .order("created_at");
    if (error) console.error("promo_codes:", error.message);
    else setCodes((data ?? []).map((c) => ({
      id: c.id, code: c.code, discountType: c.discount_type as "percent" | "fixed", value: Number(c.discount_value), isActive: c.is_active,
    })));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { codes, loading, refetch };
}

export async function dbCreatePromoCode(input: { code: string; discountType: "percent" | "fixed"; value: number }): Promise<string | undefined> {
  const { error } = await createClient().from("promo_codes").insert({
    code: input.code, discount_type: input.discountType, discount_value: input.value, is_active: true,
  });
  return error?.message;
}
export async function dbSetPromoCodeActive(id: string, value: boolean) {
  await createClient().from("promo_codes").update({ is_active: value }).eq("id", id);
}
export async function dbDeletePromoCode(id: string) {
  await createClient().from("promo_codes").delete().eq("id", id);
}

// ---------- Замовлення ----------
export type OrderStatus = "new" | "confirmed" | "done" | "canceled";
export interface DbOrderItem { name: string; price: number; quantity: number; }
export interface DbOrder {
  id: string; customerName: string; phone: string; deliveryType: "delivery" | "pickup";
  address: string | null; comment: string | null; status: OrderStatus;
  subtotal: number; discount: number; deliveryCost: number; total: number;
  createdAt: string; items: DbOrderItem[];
  /** на коли: день (YYYY-MM-DD) і час (HH:MM); null — якнайшвидше / старі замовлення */
  scheduledDate: string | null; scheduledTime: string | null;
  /** замовлено з акаунта клієнта */
  userId: string | null;
}

/** «на коли» для замовлення: «сьогодні о 18:30», «08.10, по готовності». null — не вказано. */
export function orderScheduleLabel(o: Pick<DbOrder, "scheduledDate" | "scheduledTime" | "deliveryType">): string | null {
  if (!o.scheduledDate) return null;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
  const tomorrow = new Date(Date.now() + 86_400_000).toLocaleDateString("en-CA", { timeZone: "Europe/Kyiv" });
  const [, m, d] = o.scheduledDate.split("-");
  const day = o.scheduledDate === today ? "сьогодні" : o.scheduledDate === tomorrow ? "завтра" : `${d}.${m}`;
  return o.scheduledTime ? `${day} о ${o.scheduledTime}` : `${day}, ${o.deliveryType === "pickup" ? "по готовності" : "якнайшвидше"}`;
}

export function useDbOrders() {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, customer_name, phone, delivery_type, address, comment, status, subtotal, discount, delivery_cost, total, created_at, scheduled_date, scheduled_time, user_id, items:order_items(product_name, price, quantity)")
      .order("created_at", { ascending: false });
    if (error) console.error("orders:", error.message);
    else setOrders((data ?? []).map((o) => ({
      id: o.id, customerName: o.customer_name, phone: o.phone, deliveryType: o.delivery_type as "delivery" | "pickup",
      address: o.address, comment: o.comment, status: o.status as OrderStatus,
      subtotal: Number(o.subtotal), discount: Number(o.discount), deliveryCost: Number(o.delivery_cost), total: Number(o.total),
      createdAt: o.created_at,
      scheduledDate: o.scheduled_date, scheduledTime: o.scheduled_time?.slice(0, 5) ?? null, userId: o.user_id,
      items: ((o.items ?? []) as { product_name: string; price: number; quantity: number }[])
        .map((it) => ({ name: it.product_name, price: Number(it.price), quantity: it.quantity })),
    })));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { orders, loading, refetch };
}

export async function dbSetOrderStatus(id: string, status: OrderStatus) {
  await createClient().from("orders").update({ status }).eq("id", id);
}

// ---------- Клієнти (акаунти на сайті) ----------
export interface DbCustomer {
  id: string; email: string; name: string | null; phone: string | null; phoneNorm: string | null;
  phoneVerifiedAt: string | null; createdAt: string;
  /** замовлення клієнта без скасованих: з акаунта + за підтвердженим номером */
  ordersCount: number; ordersTotal: number; lastOrderAt: string | null;
  /** усього замовлень у базі на номер із профілю (навіть непідтверджений) */
  phoneOrders: number;
  emailConfirmed: boolean;
  /** як зареєструвався: 'google' | 'email' */
  provider: string | null;
}

export function useDbCustomers() {
  const supabase = useMemo(() => createClient(), []);
  const [customers, setCustomers] = useState<DbCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("staff_customers");
    if (error) console.error("customers:", error.message);
    else setCustomers(((data ?? []) as Record<string, unknown>[]).map((c) => ({
      id: c.id as string, email: (c.email as string) ?? "", name: c.name as string | null, phone: c.phone as string | null,
      phoneNorm: c.phone_norm as string | null, phoneVerifiedAt: c.phone_verified_at as string | null, createdAt: c.created_at as string,
      ordersCount: Number(c.orders_count), ordersTotal: Number(c.orders_total), lastOrderAt: c.last_order_at as string | null,
      phoneOrders: Number(c.phone_orders), emailConfirmed: !!c.email_confirmed, provider: (c.provider as string) ?? null,
    })));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { customers, loading, refetch };
}

/** Підтвердити / зняти підтвердження номера. Повертає null або код помилки ('taken', 'no_phone', …). */
export async function dbSetCustomerPhoneVerified(id: string, verified: boolean): Promise<string | null> {
  const { data, error } = await createClient().rpc("staff_set_phone_verified", { customer_id: id, verified });
  if (error) return error.message;
  return data === "ok" ? null : String(data);
}

/** Замовлення клієнта для адмінки: з акаунта + усі на номер із профілю (позначаємо, які лише за номером). */
export async function dbCustomerOrders(c: Pick<DbCustomer, "id" | "phoneNorm">) {
  const supabase = createClient();
  const filter = c.phoneNorm ? `user_id.eq.${c.id},phone_norm.eq.${c.phoneNorm}` : `user_id.eq.${c.id}`;
  const { data, error } = await supabase
    .from("orders")
    .select("id, status, delivery_type, total, created_at, user_id, items:order_items(product_name, quantity)")
    .or(filter)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) console.error("customer orders:", error.message);
  return (data ?? []).map((o) => ({
    id: o.id as string, status: o.status as OrderStatus, deliveryType: o.delivery_type as "delivery" | "pickup",
    total: Number(o.total), createdAt: o.created_at as string, fromAccount: o.user_id === c.id,
    items: ((o.items ?? []) as { product_name: string; quantity: number }[]).map((it) => `${it.product_name} ×${it.quantity}`),
  }));
}

/** Усі замовлення (полегшено) — для списку всіх клієнтів, що будь-коли замовляли. */
export interface ClientOrder {
  id: string; customerName: string; phone: string; phoneNorm: string | null; userId: string | null;
  status: OrderStatus; deliveryType: "delivery" | "pickup"; total: number; createdAt: string;
  items: string[];
}

export async function dbAllClientOrders(): Promise<ClientOrder[]> {
  const supabase = createClient();
  const out: ClientOrder[] = [];
  // пагінація по 1000 (ліміт PostgREST за замовчуванням)
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, customer_name, phone, phone_norm, user_id, status, delivery_type, total, created_at, items:order_items(product_name, quantity)")
      .order("created_at", { ascending: false })
      .range(from, from + 999);
    if (error) { console.error("client orders:", error.message); break; }
    for (const o of data ?? []) {
      out.push({
        id: o.id, customerName: o.customer_name, phone: o.phone, phoneNorm: o.phone_norm, userId: o.user_id,
        status: o.status as OrderStatus, deliveryType: o.delivery_type as "delivery" | "pickup",
        total: Number(o.total), createdAt: o.created_at,
        items: ((o.items ?? []) as { product_name: string; quantity: number }[]).map((it) => `${it.product_name} ×${it.quantity}`),
      });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

// ---------- Статистика ----------
export interface StatsOrder {
  id: string; status: OrderStatus; deliveryType: "delivery" | "pickup"; total: number;
  createdAt: string; userId: string | null; phoneNorm: string | null;
  items: { name: string; quantity: number; price: number }[];
}

/** Дата першого замовлення (ISO) — для періоду «Весь час». null — замовлень немає. */
export async function dbFirstOrderAt(): Promise<string | null> {
  const { data } = await createClient().from("orders").select("created_at").order("created_at").limit(1).maybeSingle();
  return data?.created_at ?? null;
}

/** Замовлення, створені в інтервалі [fromIso; toIso). */
export async function dbStatsOrders(fromIso: string, toIso: string): Promise<StatsOrder[]> {
  const supabase = createClient();
  const out: StatsOrder[] = [];
  // пагінація по 1000 (ліміт PostgREST за замовчуванням)
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("orders")
      .select("id, status, delivery_type, total, created_at, user_id, phone_norm, items:order_items(product_name, quantity, price)")
      .gte("created_at", fromIso)
      .lt("created_at", toIso)
      .order("created_at")
      .range(from, from + 999);
    if (error) { console.error("stats orders:", error.message); break; }
    for (const o of data ?? []) {
      out.push({
        id: o.id, status: o.status as OrderStatus, deliveryType: o.delivery_type as "delivery" | "pickup",
        total: Number(o.total), createdAt: o.created_at, userId: o.user_id, phoneNorm: o.phone_norm,
        items: ((o.items ?? []) as { product_name: string; quantity: number; price: number }[])
          .map((it) => ({ name: it.product_name, quantity: it.quantity, price: Number(it.price) })),
      });
    }
    if (!data || data.length < 1000) break;
  }
  return out;
}

// ---------- Відгуки ----------
export type ReviewStatus = "pending" | "approved" | "rejected";
export interface DbReview {
  id: string; authorName: string; contact: string; rating: number | null; text: string;
  status: ReviewStatus; createdAt: string;
}

export function useDbReviews() {
  const supabase = useMemo(() => createClient(), []);
  const [reviews, setReviews] = useState<DbReview[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    // контакт автора — не публічна колонка: читаємо окремо функцією, доступною лише staff
    const [{ data, error }, contactsRes] = await Promise.all([
      supabase
        .from("reviews")
        .select("id, author_name, rating, text, status, created_at")
        .order("created_at", { ascending: false }),
      supabase.rpc("staff_review_contacts"),
    ]);
    if (contactsRes.error) console.error("review contacts:", contactsRes.error.message);
    const contacts = new Map<string, string>(
      ((contactsRes.data ?? []) as { id: string; contact: string }[]).map((c) => [c.id, c.contact]),
    );
    if (error) console.error("reviews:", error.message);
    else setReviews((data ?? []).map((r) => ({
      id: r.id, authorName: r.author_name, contact: contacts.get(r.id) ?? "", rating: r.rating, text: r.text,
      status: r.status as ReviewStatus, createdAt: r.created_at,
    })));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { reviews, loading, refetch };
}

export async function dbSetReviewStatus(id: string, status: ReviewStatus) {
  const { error } = await createClient().from("reviews").update({ status }).eq("id", id);
  if (!error) touchPublic();
}
export async function dbDeleteReview(id: string) {
  const { error } = await createClient().from("reviews").delete().eq("id", id);
  if (!error) touchPublic();
}

// ---------- Фон головного екрана (settings, key='hero_bg') ----------
export function useDbHeroBg() {
  const supabase = useMemo(() => createClient(), []);
  const [heroBg, setHeroBg] = useState<HeroBg>(DEFAULT_HERO_BG);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("settings").select("value").eq("key", "hero_bg").maybeSingle();
    if (error) console.error("hero_bg settings:", error.message);
    else setHeroBg(parseHeroBg(data?.value));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { heroBg, loading, refetch };
}

export async function dbSaveHeroBg(value: HeroBg): Promise<string | undefined> {
  const { error } = await createClient().from("settings").upsert({ key: "hero_bg", value }, { onConflict: "key" });
  if (!error) touchPublic();
  return error?.message;
}

/** Прибирає файл фонового фото з R2 (best-effort: помилка не блокує видалення з налаштувань). */
export async function dbDeleteHeroPhotoFile(url: string): Promise<void> {
  await fetch("/api/hero-bg", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url }) })
    .catch(() => {});
}

// ---------- Налаштування доставки (settings, key='delivery') ----------
export function useDbDelivery() {
  const supabase = useMemo(() => createClient(), []);
  const [delivery, setDelivery] = useState<DeliverySettings>(DEFAULT_DELIVERY);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("settings").select("value").eq("key", "delivery").maybeSingle();
    if (error) console.error("delivery settings:", error.message);
    else setDelivery(parseDeliverySettings(data?.value));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { delivery, loading, refetch };
}

export async function dbSaveDelivery(settings: DeliverySettings): Promise<string | undefined> {
  const { error } = await createClient().from("settings").upsert({ key: "delivery", value: settings }, { onConflict: "key" });
  if (!error) touchPublic();
  return error?.message;
}

// ---------- Спец-пункти навігації (Новинки / Акції) ----------
export interface NavSpecialItem { id: string; label: string; showInNav: boolean; }

export function useDbNavSpecials() {
  const supabase = useMemo(() => createClient(), []);
  const [specials, setSpecials] = useState<NavSpecialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("settings").select("value").eq("key", "nav_specials").maybeSingle();
    if (error) console.error("nav_specials:", error.message);
    const vis = parseNavVisibility(data?.value);
    setSpecials(NAV_SPECIALS.map((sp) => ({ id: sp.id, label: sp.label, showInNav: vis[sp.id] })));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { specials, loading, refetch };
}

/** Перемкнути видимість одного спец-пункту (інші лишаються як були). */
export async function dbSetNavSpecialVisible(specials: NavSpecialItem[], id: string, visible: boolean) {
  const map: Record<string, boolean> = {};
  for (const sp of specials) map[sp.id] = sp.id === id ? visible : sp.showInNav;
  const { error } = await createClient().from("settings").upsert({ key: "nav_specials", value: map }, { onConflict: "key" });
  if (!error) touchPublic();
}

// ---------- Глосарій (settings, key='glossary') ----------
export function useDbGlossary() {
  const supabase = useMemo(() => createClient(), []);
  const [glossary, setGlossary] = useState<Glossary>(parseGlossary(null));
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("settings").select("value").eq("key", "glossary").maybeSingle();
    if (error) console.error("glossary:", error.message);
    setGlossary(parseGlossary(data?.value));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { glossary, loading, refetch };
}

export async function dbSaveGlossary(glossary: Glossary): Promise<string | undefined> {
  const { error } = await createClient().from("settings").upsert({ key: "glossary", value: glossary }, { onConflict: "key" });
  if (!error) touchPublic();
  return error?.message;
}

// ---------- Контакти закладу (settings, key='contacts') ----------
export function useDbContacts() {
  const supabase = useMemo(() => createClient(), []);
  const [contacts, setContacts] = useState<SiteContacts>(parseContacts(null));
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("settings").select("value").eq("key", "contacts").maybeSingle();
    if (error) console.error("contacts:", error.message);
    setContacts(parseContacts(data?.value));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { contacts, loading, refetch };
}

export async function dbSaveContacts(contacts: SiteContacts): Promise<string | undefined> {
  const { error } = await createClient().from("settings").upsert({ key: "contacts", value: contacts }, { onConflict: "key" });
  if (!error) touchPublic();
  return error?.message;
}

// ---------- SEO-блок на головній (settings, key='seo_block') ----------
export function useDbSeoBlock() {
  const supabase = useMemo(() => createClient(), []);
  const [seoBlock, setSeoBlock] = useState<SeoBlock>(parseSeoBlock(null));
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("settings").select("value").eq("key", "seo_block").maybeSingle();
    if (error) console.error("seo_block:", error.message);
    setSeoBlock(parseSeoBlock(data?.value));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { seoBlock, loading, refetch };
}

export async function dbSaveSeoBlock(block: SeoBlock): Promise<string | undefined> {
  const { error } = await createClient().from("settings").upsert({ key: "seo_block", value: block }, { onConflict: "key" });
  if (!error) touchPublic();
  return error?.message;
}

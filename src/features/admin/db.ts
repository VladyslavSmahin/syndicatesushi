"use client";

// Доступ до каталогу в Supabase для адмінки: хуки читання (з refetch) + мутації.
// Заміна localStorage-сторів. RLS: читання публічне, запис — staff, видалення — admin.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseDeliverySettings, DEFAULT_DELIVERY, type DeliverySettings } from "@/lib/delivery";
import type { Badge } from "@/lib/types";

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
}
export interface ProductInput {
  categoryId: string | null; subcategoryId: string | null;
  name: string; price: number; weight: string; pieces: string; badge: Badge;
  desc: string; composition: string; fullDesc: string; photo: string | null;
  isAvailable: boolean; ingredientIds: string[]; ingredientGrams: Record<string, number>;
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
}

function mapProduct(p: ProductRow): DbProduct {
  const items = p.items ?? [];
  const grams: Record<string, number> = {};
  for (const it of items) if (it.grams != null) grams[it.ingredient_id] = Number(it.grams);
  return {
    id: p.id, categoryId: p.category_id, subcategoryId: p.subcategory_id,
    name: p.name, slug: p.slug, price: Number(p.price), weight: p.weight ?? "", pieces: p.pieces ?? "",
    badge: (p.badge ?? "") as Badge, desc: p.short_desc ?? "", composition: p.composition ?? "",
    fullDesc: p.full_desc ?? "", photo: p.image_path ?? null, isAvailable: p.is_available,
    deletedAt: p.deleted_at, sortOrder: p.sort_order,
    ingredientIds: items.map((it) => it.ingredient_id), ingredientGrams: grams,
  };
}

const PRODUCT_SELECT =
  "id, category_id, subcategory_id, name, slug, price, weight, pieces, badge, short_desc, full_desc, composition, image_path, is_available, deleted_at, sort_order, items:product_ingredients(ingredient_id, grams)";

// ---------- Хуки читання ----------
export function useDbProducts() {
  const supabase = useMemo(() => createClient(), []);
  const [products, setProducts] = useState<DbProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
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
    setLoading(true);
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
    setLoading(true);
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
    setLoading(true);
    const { data, error } = await supabase.from("subcategories").select("id, category_id, name, slug, sort_order").order("sort_order");
    if (error) console.error("subcategories:", error.message);
    else setSubcategories((data ?? []).map((s) => ({ id: s.id, categoryId: s.category_id, name: s.name, slug: s.slug, sortOrder: s.sort_order })));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { subcategories, loading, refetch };
}

// ---------- Мутації ----------
async function syncIngredients(
  supabase: ReturnType<typeof createClient>,
  productId: string,
  ids: string[],
  grams: Record<string, number>
) {
  await supabase.from("product_ingredients").delete().eq("product_id", productId);
  if (ids.length) {
    await supabase.from("product_ingredients").insert(
      ids.map((id) => ({ product_id: productId, ingredient_id: id, grams: grams[id] ?? null }))
    );
  }
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
  await syncIngredients(supabase, data.id, input.ingredientIds, input.ingredientGrams);
  return undefined;
}

export async function dbUpdateProduct(id: string, input: ProductInput): Promise<string | undefined> {
  const supabase = createClient();
  const { error } = await supabase.from("products").update(productFields(input)).eq("id", id);
  if (error) return error.message;
  await syncIngredients(supabase, id, input.ingredientIds, input.ingredientGrams);
  return undefined;
}

export async function dbUpdatePrice(id: string, price: number) {
  await createClient().from("products").update({ price }).eq("id", id);
}
export async function dbSetAvailable(id: string, value: boolean) {
  await createClient().from("products").update({ is_available: value }).eq("id", id);
}
export async function dbSoftDelete(id: string) {
  await createClient().from("products").update({ deleted_at: new Date().toISOString() }).eq("id", id);
}
export async function dbRestore(id: string) {
  await createClient().from("products").update({ deleted_at: null }).eq("id", id);
}
export async function dbHardDelete(id: string) {
  await createClient().from("products").delete().eq("id", id);
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
  return data as DbIngredient;
}

export async function dbUpdateIngredient(id: string, patch: Partial<{ name: string } & Nutrition>) {
  await createClient().from("ingredients").update(patch).eq("id", id);
}
export async function dbDeleteIngredient(id: string) {
  // product_ingredients чистяться каскадом (FK on delete cascade)
  await createClient().from("ingredients").delete().eq("id", id);
}

// ---------- Категорії CRUD ----------
export interface CategoryInput { name: string; slug: string; sortOrder: number; showInNav: boolean; isActive: boolean; }
export async function dbCreateCategory(input: CategoryInput): Promise<string | undefined> {
  const { error } = await createClient().from("categories").insert({
    name: input.name, slug: input.slug, sort_order: input.sortOrder, show_in_nav: input.showInNav, is_active: input.isActive,
  });
  return error?.message;
}
export async function dbUpdateCategory(id: string, patch: Partial<{ name: string; slug: string; sortOrder: number; showInNav: boolean; isActive: boolean }>) {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.slug !== undefined) row.slug = patch.slug;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  if (patch.showInNav !== undefined) row.show_in_nav = patch.showInNav;
  if (patch.isActive !== undefined) row.is_active = patch.isActive;
  await createClient().from("categories").update(row).eq("id", id);
}
export async function dbDeleteCategory(id: string) {
  await createClient().from("categories").delete().eq("id", id);
}

// ---------- Підкатегорії CRUD ----------
export async function dbCreateSubcategory(input: { categoryId: string; name: string; sortOrder: number }): Promise<string | undefined> {
  const { error } = await createClient().from("subcategories").insert({
    category_id: input.categoryId, name: input.name, slug: slugify(input.name), sort_order: input.sortOrder,
  });
  return error?.message;
}
export async function dbUpdateSubcategory(id: string, patch: Partial<{ name: string; sortOrder: number; categoryId: string }>) {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
  if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
  await createClient().from("subcategories").update(row).eq("id", id);
}
export async function dbDeleteSubcategory(id: string) {
  await createClient().from("subcategories").delete().eq("id", id);
}

// ---------- Акції ----------
export interface DbPromo {
  id: string; productId: string | null; label: string; title: string;
  price: number; oldPrice: number; bannerImagePath: string; isActive: boolean; sortOrder: number;
}
export interface PromoInput {
  productId: string | null; label: string; title: string;
  price: number; oldPrice: number; bannerImagePath: string; isActive: boolean;
}

export function useDbPromos() {
  const supabase = useMemo(() => createClient(), []);
  const [promos, setPromos] = useState<DbPromo[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("promos")
      .select("id, product_id, label, title, promo_price, old_price, banner_image_path, is_active, sort_order")
      .order("sort_order");
    if (error) console.error("promos:", error.message);
    else setPromos((data ?? []).map((p) => ({
      id: p.id, productId: p.product_id, label: p.label ?? "", title: p.title ?? "",
      price: Number(p.promo_price), oldPrice: Number(p.old_price ?? 0), bannerImagePath: p.banner_image_path ?? "",
      isActive: p.is_active, sortOrder: p.sort_order,
    })));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { promos, loading, refetch };
}

function promoFields(input: PromoInput) {
  return {
    product_id: input.productId, label: input.label || null, title: input.title,
    promo_price: input.price, old_price: input.oldPrice || null,
    banner_image_path: input.bannerImagePath || null, is_active: input.isActive,
  };
}
export async function dbCreatePromo(input: PromoInput): Promise<string | undefined> {
  const { error } = await createClient().from("promos").insert({ ...promoFields(input), sort_order: 9999 });
  return error?.message;
}
export async function dbUpdatePromo(id: string, input: PromoInput): Promise<string | undefined> {
  const { error } = await createClient().from("promos").update(promoFields(input)).eq("id", id);
  return error?.message;
}
export async function dbSetPromoActive(id: string, value: boolean) {
  await createClient().from("promos").update({ is_active: value }).eq("id", id);
}
export async function dbDeletePromo(id: string) {
  await createClient().from("promos").delete().eq("id", id);
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
}

export function useDbOrders() {
  const supabase = useMemo(() => createClient(), []);
  const [orders, setOrders] = useState<DbOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const refetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("id, customer_name, phone, delivery_type, address, comment, status, subtotal, discount, delivery_cost, total, created_at, items:order_items(product_name, price, quantity)")
      .order("created_at", { ascending: false });
    if (error) console.error("orders:", error.message);
    else setOrders((data ?? []).map((o) => ({
      id: o.id, customerName: o.customer_name, phone: o.phone, deliveryType: o.delivery_type as "delivery" | "pickup",
      address: o.address, comment: o.comment, status: o.status as OrderStatus,
      subtotal: Number(o.subtotal), discount: Number(o.discount), deliveryCost: Number(o.delivery_cost), total: Number(o.total),
      createdAt: o.created_at,
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
    const { data, error } = await supabase
      .from("reviews")
      .select("id, author_name, contact, rating, text, status, created_at")
      .order("created_at", { ascending: false });
    if (error) console.error("reviews:", error.message);
    else setReviews((data ?? []).map((r) => ({
      id: r.id, authorName: r.author_name, contact: r.contact, rating: r.rating, text: r.text,
      status: r.status as ReviewStatus, createdAt: r.created_at,
    })));
    setLoading(false);
  }, [supabase]);
  useEffect(() => { refetch(); }, [refetch]);
  return { reviews, loading, refetch };
}

export async function dbSetReviewStatus(id: string, status: ReviewStatus) {
  await createClient().from("reviews").update({ status }).eq("id", id);
}
export async function dbDeleteReview(id: string) {
  await createClient().from("reviews").delete().eq("id", id);
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
  return error?.message;
}

import "server-only";
import { cache } from "react";
import { unstable_cache } from "next/cache";
import { createPublicClient } from "@/lib/supabase/public";
import { PUBLIC_TAG, PUBLIC_REVALIDATE } from "@/features/publicCache";
import type { Product, Badge, Portion, Promo, Banner } from "@/lib/types";
import { sumPortions } from "@/features/nutrition";
import type { PublicData, PubCategory, PubSubcategory, PubReview } from "@/features/publicData";
import { parseDeliverySettings } from "@/lib/delivery";
import { NAV_SPECIALS, parseNavVisibility } from "@/lib/navSpecials";
import { parseGlossary } from "@/lib/glossary";
import { parseContacts } from "@/lib/contacts";
import { parseSeoBlock } from "@/lib/seoBlock";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r1 = (n: number) => Math.round(n * 10) / 10;

type PIRow = { grams: number | null; ingredient: { name: string; kcal: number | null; protein: number | null; fat: number | null; carbs: number | null } | null };
type ProductRow = {
  id: string; name: string; slug: string; short_desc: string | null; full_desc: string | null; composition: string | null;
  price: number | string; weight: string | null; pieces: string | null; badge: string | null; image_path: string | null;
  category: { slug: string; is_active: boolean | null } | null; subcategory: { slug: string } | null; items: PIRow[] | null;
};
// рядок складу сета: рол (з його грамовками) + кількість цього рола в сеті
type SetItemRow = { set_id: string; qty: number | null; product: { items: PIRow[] | null } | { items: PIRow[] | null }[] | null };

/** Вага + КБЖУ порції з грамовок інгредієнтів; undefined, якщо грамовок немає. */
function portionFromItems(items: PIRow[]): Portion | undefined {
  let weight = 0, kcal = 0, protein = 0, fat = 0, carbs = 0;
  for (const it of items) {
    const g = num(it.grams);
    if (g <= 0 || !it.ingredient) continue;
    const k = g / 100;
    weight += g;
    kcal += num(it.ingredient.kcal) * k;
    protein += num(it.ingredient.protein) * k;
    fat += num(it.ingredient.fat) * k;
    carbs += num(it.ingredient.carbs) * k;
  }
  return weight > 0
    ? { weight: r1(weight), kcal: Math.round(kcal), protein: r1(protein), fat: r1(fat), carbs: r1(carbs) }
    : undefined;
}

/**
 * КБЖУ сетів: сума порцій ролів, що входять у сет (з урахуванням кількості).
 * Рахуємо окремим запитом по set_items, а не з уже завантаженого каталогу, щоб
 * тимчасово вимкнений (`is_available = false`) рол не занижував КБЖУ сета.
 */
function setPortions(rows: SetItemRow[]): Map<string, Portion> {
  const parts = new Map<string, Portion[]>();
  for (const row of rows) {
    const prod = Array.isArray(row.product) ? row.product[0] : row.product;
    const portion = portionFromItems(prod?.items ?? []);
    if (!portion) continue;
    const qty = Math.max(1, Number(row.qty) || 1);
    const list = parts.get(row.set_id) ?? [];
    for (let i = 0; i < qty; i++) list.push(portion);
    parts.set(row.set_id, list);
  }
  return new Map([...parts].map(([setId, list]) => [setId, sumPortions(list)] as const));
}

/** Товар показуємо, лише якщо його категорія не вимкнена (без категорії — показуємо). */
function isPublicProduct(p: { category: { is_active: boolean | null } | { is_active: boolean | null }[] | null }): boolean {
  const cat = Array.isArray(p.category) ? p.category[0] : p.category;
  return cat?.is_active !== false;
}

function mapProduct(p: ProductRow, setPortion?: Portion): Product {
  const items = p.items ?? [];
  // власні грамовки товару в пріоритеті; для сета їх немає — беремо суму ролів
  const portion: Portion | undefined = portionFromItems(items) ?? setPortion;

  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    desc: p.short_desc ?? "",
    fullDesc: p.full_desc ?? "",
    composition: p.composition ?? "",
    price: num(p.price),
    weight: p.weight ?? (portion ? `${portion.weight} г` : ""),
    pieces: p.pieces ?? "",
    badge: (p.badge ?? "") as Badge,
    category: p.category?.slug ?? "",
    subcategory: p.subcategory?.slug ?? undefined,
    ingredients: items.map((it) => it.ingredient?.name?.toLowerCase()).filter((n): n is string => Boolean(n)),
    photo: p.image_path ?? null,
    portion,
  };
}

async function queryPublicData(): Promise<PublicData> {
  const supabase = createPublicClient();

  const [catsRes, subsRes, prodsRes, setItemsRes, promosRes, bannersRes, deliveryRes, reviewsRes] = await Promise.all([
    supabase.from("categories").select("id, name, slug, sort_order, show_in_nav, is_active").order("sort_order"),
    supabase.from("subcategories").select("id, name, slug, sort_order, category:categories(slug)").eq("is_active", true).order("sort_order"),
    supabase
      .from("products")
      .select("id, name, slug, short_desc, full_desc, composition, price, weight, pieces, badge, image_path, sort_order, category:categories(slug, is_active), subcategory:subcategories(slug), items:product_ingredients(grams, ingredient:ingredients(name, kcal, protein, fat, carbs))")
      .is("deleted_at", null)
      .eq("is_available", true)
      .order("sort_order"),
    supabase
      .from("set_items")
      .select("set_id, qty, product:products!product_id(items:product_ingredients(grams, ingredient:ingredients(name, kcal, protein, fat, carbs)))"),
    supabase.from("promos").select("id, label, title, promo_price, old_price, banner_image_path, valid_from, valid_until, product:products(id)").eq("is_active", true).order("sort_order"),
    supabase.from("banners").select("id, image_path").eq("is_active", true).order("sort_order"),
    supabase.from("settings").select("key, value").in("key", ["delivery", "nav_specials", "glossary", "contacts", "seo_block"]),
    supabase.from("reviews").select("id, author_name, rating, text, created_at").eq("status", "approved").order("created_at", { ascending: false }).limit(24),
  ]);

  if (catsRes.error) console.error("categories fetch:", catsRes.error.message);
  if (subsRes.error) console.error("subcategories fetch:", subsRes.error.message);
  if (prodsRes.error) console.error("products fetch:", prodsRes.error.message);
  if (setItemsRes.error) console.error("set items fetch:", setItemsRes.error.message);
  if (promosRes.error) console.error("promos fetch:", promosRes.error.message);
  if (bannersRes.error) console.error("banners fetch:", bannersRes.error.message);
  if (reviewsRes.error) console.error("reviews fetch:", reviewsRes.error.message);

  const categories: PubCategory[] = (catsRes.data ?? []).map((c) => ({
    id: c.id, name: c.name, slug: c.slug, sortOrder: c.sort_order, showInNav: c.show_in_nav, isActive: c.is_active,
  }));

  const subcategories: PubSubcategory[] = (subsRes.data ?? []).map((s) => {
    const cat = s.category as { slug: string } | { slug: string }[] | null;
    const categorySlug = Array.isArray(cat) ? cat[0]?.slug ?? "" : cat?.slug ?? "";
    return { id: s.id, categorySlug, name: s.name, slug: s.slug, sortOrder: s.sort_order };
  });

  // ефективна акційна ціна на товар: активна акція в межах дат і нижча за каталожну
  const now = Date.now();
  const promoByProduct = new Map<string, { price: number; until: string | null }>();
  for (const pr of (promosRes.data ?? []) as { promo_price: number | string; valid_from: string | null; valid_until: string | null; product: { id: string } | { id: string }[] | null }[]) {
    const prod = pr.product;
    const pid = Array.isArray(prod) ? prod[0]?.id : prod?.id;
    if (!pid) continue;
    if (pr.valid_from && new Date(pr.valid_from).getTime() > now) continue;
    if (pr.valid_until && new Date(pr.valid_until).getTime() < now) continue;
    const pp = Number(pr.promo_price);
    const prev = promoByProduct.get(pid);
    if (pp > 0 && (!prev || pp < prev.price)) promoByProduct.set(pid, { price: pp, until: pr.valid_until });
  }

  // Порядок товарів: спочатку за порядком категорій (як у меню сайту), далі
  // товари з фото перед товарами без фото, потім за sort_order товару всередині
  // категорії. Інакше в «Повному меню» товари з «Додатково» (васабі, імбир)
  // могли опинятись першими. Сортування стабільне, тож порядок усередині групи
  // зберігається з .order("sort_order").
  const catOrder = new Map(categories.map((c, i) => [c.slug, i] as const));
  const catRank = (slug: string) => catOrder.get(slug) ?? Number.MAX_SAFE_INTEGER;
  const photoRank = (p: Product) => (p.photo ? 0 : 1);
  const setPortionById = setPortions((setItemsRes.data ?? []) as unknown as SetItemRow[]);
  // товари неактивної категорії приховані на всьому публічному сайті (каталог, хіти, пошук, /menu/[slug])
  const catalog = ((prodsRes.data ?? []) as unknown as ProductRow[])
    .filter(isPublicProduct)
    .map((p) => mapProduct(p, setPortionById.get(p.id)))
    .sort((a, b) => catRank(a.category) - catRank(b.category) || photoRank(a) - photoRank(b))
    .map((p) => {
      const pr = promoByProduct.get(p.id);
      if (!pr || pr.price >= p.price) return p;
      return { ...p, oldPrice: p.price, price: pr.price, ...(pr.until ? { promoUntil: pr.until } : {}) };
    });

  const promos: Promo[] = (promosRes.data ?? []).map((p) => {
    const prod = p.product as { id: string } | { id: string }[] | null;
    const linkedItemId = Array.isArray(prod) ? prod[0]?.id ?? "" : prod?.id ?? "";
    return {
      id: p.id, bannerImage: p.banner_image_path ?? "", label: p.label ?? "", title: p.title ?? "",
      price: Number(p.promo_price), oldPrice: Number(p.old_price ?? 0), linkedItemId,
    };
  });

  const banners: Banner[] = ((bannersRes.data ?? []) as { id: string; image_path: string }[])
    .map((b) => ({ id: b.id, image: b.image_path }));

  const settingsRows = (deliveryRes.data ?? []) as { key: string; value: unknown }[];
  const delivery = parseDeliverySettings(settingsRows.find((r) => r.key === "delivery")?.value);
  const navVis = parseNavVisibility(settingsRows.find((r) => r.key === "nav_specials")?.value);
  const glossary = parseGlossary(settingsRows.find((r) => r.key === "glossary")?.value);
  const contacts = parseContacts(settingsRows.find((r) => r.key === "contacts")?.value);
  const seoBlock = parseSeoBlock(settingsRows.find((r) => r.key === "seo_block")?.value);
  // підписи спец-пунктів навігації беремо з глосарію
  const navLabel: Record<string, string> = { novynky: glossary.nav_novynky, aktsii: glossary.nav_aktsii };
  const navSpecials = NAV_SPECIALS.filter((sp) => navVis[sp.id]).map((sp) => ({ ...sp, label: navLabel[sp.id] ?? sp.label }));

  const reviews: PubReview[] = ((reviewsRes.data ?? []) as { id: string; author_name: string; rating: number | null; text: string; created_at: string }[]).map((r) => ({
    id: r.id, authorName: r.author_name, rating: r.rating, text: r.text, createdAt: r.created_at,
  }));

  return { catalog, categories, subcategories, promos, banners, delivery, navSpecials, glossary, contacts, seoBlock, reviews };
}

/**
 * Публічні дані сайту з кешем Next (Data Cache) під тегом PUBLIC_TAG.
 * Скидається revalidateTag(PUBLIC_TAG) після мутацій в адмінці; revalidate — страховка.
 * React cache() — щоб generateMetadata і Page в одному запиті не читали двічі.
 */
export const fetchPublicData = cache(
  unstable_cache(queryPublicData, ["public-data"], { tags: [PUBLIC_TAG], revalidate: PUBLIC_REVALIDATE })
);

export interface ProductSlug { slug: string; lastModified: string | null }

/** Слаги доступних товарів (крім неактивних категорій) — лише для sitemap (без важкого джойну інгредієнтів). */
async function queryProductSlugs(): Promise<ProductSlug[]> {
  const supabase = createPublicClient();
  // updated_at у products немає — для lastModified беремо created_at
  const { data, error } = await supabase
    .from("products")
    .select("slug, created_at, category:categories(is_active)")
    .is("deleted_at", null)
    .eq("is_available", true)
    .order("sort_order");
  if (error) { console.error("product slugs:", error.message); return []; }
  type SlugRow = { slug: string; created_at: string | null; category: { is_active: boolean | null } | { is_active: boolean | null }[] | null };
  return ((data ?? []) as unknown as SlugRow[])
    .filter((r) => isPublicProduct(r) && Boolean(r.slug))
    .map((r) => ({ slug: r.slug, lastModified: r.created_at }));
}

export const fetchProductSlugs = cache(
  unstable_cache(queryProductSlugs, ["public-product-slugs"], { tags: [PUBLIC_TAG], revalidate: PUBLIC_REVALIDATE })
);

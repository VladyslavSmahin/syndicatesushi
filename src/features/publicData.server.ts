import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Product, Badge, Portion, Promo, Banner } from "@/lib/types";
import type { PublicData, PubCategory, PubSubcategory, PubReview } from "@/features/publicData";
import { parseDeliverySettings } from "@/lib/delivery";
import { NAV_SPECIALS, parseNavVisibility } from "@/lib/navSpecials";
import { parseGlossary } from "@/lib/glossary";

const num = (v: unknown) => (v == null ? 0 : Number(v));
const r1 = (n: number) => Math.round(n * 10) / 10;

type PIRow = { grams: number | null; ingredient: { name: string; kcal: number | null; protein: number | null; fat: number | null; carbs: number | null } | null };
type ProductRow = {
  id: string; name: string; short_desc: string | null; full_desc: string | null; composition: string | null;
  price: number | string; weight: string | null; pieces: string | null; badge: string | null; image_path: string | null;
  category: { slug: string } | null; subcategory: { slug: string } | null; items: PIRow[] | null;
};

function mapProduct(p: ProductRow): Product {
  const items = p.items ?? [];
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
  const portion: Portion | undefined = weight > 0
    ? { weight: r1(weight), kcal: Math.round(kcal), protein: r1(protein), fat: r1(fat), carbs: r1(carbs) }
    : undefined;

  return {
    id: p.id,
    name: p.name,
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

export async function fetchPublicData(): Promise<PublicData> {
  const supabase = await createClient();

  const [catsRes, subsRes, prodsRes, promosRes, bannersRes, deliveryRes, reviewsRes] = await Promise.all([
    supabase.from("categories").select("id, name, slug, sort_order, show_in_nav, is_active").order("sort_order"),
    supabase.from("subcategories").select("id, name, slug, sort_order, category:categories(slug)").eq("is_active", true).order("sort_order"),
    supabase
      .from("products")
      .select("id, name, short_desc, full_desc, composition, price, weight, pieces, badge, image_path, sort_order, category:categories(slug), subcategory:subcategories(slug), items:product_ingredients(grams, ingredient:ingredients(name, kcal, protein, fat, carbs))")
      .is("deleted_at", null)
      .eq("is_available", true)
      .order("sort_order"),
    supabase.from("promos").select("id, label, title, promo_price, old_price, banner_image_path, valid_from, valid_until, product:products(id)").eq("is_active", true).order("sort_order"),
    supabase.from("banners").select("id, image_path").eq("is_active", true).order("sort_order"),
    supabase.from("settings").select("key, value").in("key", ["delivery", "nav_specials", "glossary"]),
    supabase.from("reviews").select("id, author_name, rating, text, created_at").eq("status", "approved").order("created_at", { ascending: false }).limit(24),
  ]);

  if (catsRes.error) console.error("categories fetch:", catsRes.error.message);
  if (subsRes.error) console.error("subcategories fetch:", subsRes.error.message);
  if (prodsRes.error) console.error("products fetch:", prodsRes.error.message);
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
  const promoByProduct = new Map<string, number>();
  for (const pr of (promosRes.data ?? []) as { promo_price: number | string; valid_from: string | null; valid_until: string | null; product: { id: string } | { id: string }[] | null }[]) {
    const prod = pr.product;
    const pid = Array.isArray(prod) ? prod[0]?.id : prod?.id;
    if (!pid) continue;
    if (pr.valid_from && new Date(pr.valid_from).getTime() > now) continue;
    if (pr.valid_until && new Date(pr.valid_until).getTime() < now) continue;
    const pp = Number(pr.promo_price);
    if (pp > 0) promoByProduct.set(pid, Math.min(promoByProduct.get(pid) ?? Infinity, pp));
  }

  const catalog = ((prodsRes.data ?? []) as unknown as ProductRow[]).map(mapProduct).map((p) => {
    const pp = promoByProduct.get(p.id);
    return pp != null && pp < p.price ? { ...p, oldPrice: p.price, price: pp } : p;
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
  // підписи спец-пунктів навігації беремо з глосарію
  const navLabel: Record<string, string> = { novynky: glossary.nav_novynky, aktsii: glossary.nav_aktsii };
  const navSpecials = NAV_SPECIALS.filter((sp) => navVis[sp.id]).map((sp) => ({ ...sp, label: navLabel[sp.id] ?? sp.label }));

  const reviews: PubReview[] = ((reviewsRes.data ?? []) as { id: string; author_name: string; rating: number | null; text: string; created_at: string }[]).map((r) => ({
    id: r.id, authorName: r.author_name, rating: r.rating, text: r.text, createdAt: r.created_at,
  }));

  return { catalog, categories, subcategories, promos, banners, delivery, navSpecials, glossary, reviews };
}

import { NextResponse } from "next/server";
import { sendTelegramMessage, esc } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rateLimit";

interface IncomingItem {
  id: string;        // uuid товару з каталогу
  name: string;
  price: number;
  qty: number;
}

interface OrderBody {
  delivery: "delivery" | "pickup";
  name: string;
  phone: string;
  address?: string;
  comment?: string;
  promo?: string;
  consent?: boolean;
  items: IncomingItem[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// екранує спецсимволи LIKE (%, _, \), щоб ввід не змінював семантику пошуку
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => "\\" + m);

const MAX_LINE_ITEMS = 100; // макс. різних позицій у замовленні
const MAX_QTY = 100;        // макс. кількість однієї позиції

export async function POST(req: Request) {
  const rl = rateLimit(`order:${clientIp(req)}`, 6, 60_000); // 6 замовлень / хв з IP
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  }

  let body: OrderBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const { delivery, name, phone, address, comment, promo, consent, items } = body;

  if (!name?.trim() || !phone?.trim() || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  if (items.length > MAX_LINE_ITEMS) {
    return NextResponse.json({ ok: false, error: "too_many_items" }, { status: 400 });
  }
  if (items.some((i) => !i || typeof i.id !== "string")) {
    return NextResponse.json({ ok: false, error: "bad_items" }, { status: 400 });
  }
  if (consent !== true) {
    return NextResponse.json({ ok: false, error: "consent_required" }, { status: 400 });
  }
  if (delivery === "delivery" && !address?.trim()) {
    return NextResponse.json({ ok: false, error: "address_required" }, { status: 400 });
  }
  // ліміти довжини текстових полів (анти-спам/абʼюз)
  if (name.length > 100 || phone.length > 30 || (address?.length ?? 0) > 300 || (comment?.length ?? 0) > 1000) {
    return NextResponse.json({ ok: false, error: "field_too_long" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ---- Авторитетні ціни з БД (захист від підміни ціни на клієнті) ----
  const ids = [...new Set(items.map((i) => i.id).filter((id) => UUID_RE.test(id)))];
  const fromDb = new Map<string, { name: string; price: number }>();
  const promoPrice = new Map<string, number>(); // авторитетна акційна ціна по товару
  if (ids.length) {
    const { data: prods } = await supabase
      .from("products")
      .select("id, name, price, is_available, deleted_at")
      .in("id", ids);
    for (const p of prods ?? []) {
      if (p.is_available && !p.deleted_at) fromDb.set(p.id, { name: p.name, price: Number(p.price) });
    }
    // активні акції на ці товари — щоб ціна замовлення збігалася з тією, що бачить клієнт
    const { data: promos } = await supabase
      .from("promos")
      .select("product_id, promo_price, is_active, valid_from, valid_until")
      .in("product_id", ids)
      .eq("is_active", true);
    const now = new Date();
    for (const pr of promos ?? []) {
      if (!pr.product_id) continue;
      if (pr.valid_from && new Date(pr.valid_from) > now) continue;
      if (pr.valid_until && new Date(pr.valid_until) < now) continue;
      const pp = Number(pr.promo_price);
      if (pp > 0) {
        const prev = promoPrice.get(pr.product_id);
        promoPrice.set(pr.product_id, prev != null ? Math.min(prev, pp) : pp);
      }
    }
  }

  // Кожна позиція мусить резолвитись у доступний товар з БД.
  // Ціна й назва — ВИКЛЮЧНО з БД (ніколи з клієнта), інакше — відмова.
  const lineItems: { productId: string; name: string; price: number; qty: number }[] = [];
  for (const i of items) {
    const db = fromDb.get(i.id);
    if (!db) {
      return NextResponse.json({ ok: false, error: "item_unavailable" }, { status: 400 });
    }
    const qty = Math.floor(Number(i.qty) || 0);
    if (qty < 1 || qty > MAX_QTY) {
      return NextResponse.json({ ok: false, error: "invalid_qty" }, { status: 400 });
    }
    const promoP = promoPrice.get(i.id);
    lineItems.push({
      productId: i.id,
      name: db.name,
      // акційна ціна, якщо вона є й нижча за каталожну
      price: promoP != null ? Math.min(db.price, promoP) : db.price,
      qty,
    });
  }
  const subtotal = lineItems.reduce((s, i) => s + i.price * i.qty, 0);

  // ---- Промокод (валідація + знижка на сервері) ----
  let promoCodeId: string | null = null;
  let discount = 0;
  const code = promo?.trim().toUpperCase();
  if (code) {
    const { data: pc } = await supabase
      .from("promo_codes")
      .select("id, discount_type, discount_value, is_active, valid_until, usage_limit, used_count")
      .ilike("code", escapeLike(code))
      .maybeSingle();
    const valid = pc && pc.is_active
      && (!pc.valid_until || new Date(pc.valid_until) > new Date())
      && (pc.usage_limit == null || pc.used_count < pc.usage_limit);
    if (valid) {
      promoCodeId = pc!.id;
      const v = Number(pc!.discount_value);
      discount = pc!.discount_type === "percent" ? Math.round((subtotal * v) / 100) : v;
      discount = Math.min(discount, subtotal);
    }
  }

  // ---- Доставка ----
  // Вартість доставки рахується менеджером окремо (від 100 грн, залежно від відстані),
  // тому в замовленні delivery_cost = 0, а адреса йде в Telegram/адмінку для прорахунку.
  const deliveryCost = 0;

  const total = Math.max(0, subtotal - discount);

  // ---- Запис замовлення в БД (service role обходить RLS) ----
  let orderId: string | null = null;
  let dbSaved = false;
  try {
    const { data: order, error } = await supabase
      .from("orders")
      .insert({
        customer_name: name.trim(),
        phone: phone.trim(),
        delivery_type: delivery,
        address: delivery === "delivery" ? address?.trim() ?? null : null,
        comment: comment?.trim() || null,
        subtotal,
        promo_code_id: promoCodeId,
        discount,
        delivery_cost: deliveryCost,
        total,
        pd_consent_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;
    orderId = order.id;

    const { error: itemsErr } = await supabase.from("order_items").insert(
      lineItems.map((i) => ({ order_id: orderId, product_id: i.productId, product_name: i.name, price: i.price, quantity: i.qty }))
    );
    if (itemsErr) throw itemsErr;
    dbSaved = true;
  } catch (e) {
    console.error("order insert failed:", (e as Error).message);
  }

  // ---- Сповіщення в Telegram (за авторитетними цінами) ----
  const lines = lineItems.map((i) => `• ${esc(i.name)} × ${i.qty} — ${i.price * i.qty} грн`);
  const msg = [
    "🍣 <b>НОВЕ ЗАМОВЛЕННЯ</b>",
    "",
    `👤 <b>Ім'я:</b> ${esc(name)}`,
    `📞 <b>Телефон:</b> ${esc(phone)}`,
    `🚚 <b>Спосіб:</b> ${delivery === "delivery" ? "Доставка" : "Самовивіз"}`,
    delivery === "delivery" && address ? `📍 <b>Адреса:</b> ${esc(address)}` : null,
    code ? `🎟 <b>Промокод:</b> ${esc(code)}${discount ? ` (−${discount} грн)` : " (не застосовано)"}` : null,
    comment?.trim() ? `💬 <b>Коментар:</b> ${esc(comment)}` : null,
    "",
    "<b>Позиції:</b>",
    ...lines,
    "",
    discount ? `Сума: ${subtotal} грн · Знижка: −${discount} грн` : null,
    deliveryCost > 0 ? `🚚 <b>Доставка:</b> ${deliveryCost} грн` : null,
    `💰 <b>Разом:</b> ${total} грн`,
    !dbSaved ? "\n⚠️ <i>Замовлення не збереглося в БД — перевірте адмінку</i>" : null,
  ]
    .filter(Boolean)
    .join("\n");

  const sent = await sendTelegramMessage(msg);

  // замовлення нікуди не дійшло (ні БД, ні Telegram) — чесна помилка, клієнт НЕ очистить кошик
  if (!dbSaved && !sent) {
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 502 });
  }

  return NextResponse.json({ ok: true, orderId });
}

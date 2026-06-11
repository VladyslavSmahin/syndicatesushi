import { NextResponse } from "next/server";
import { sendTelegramMessage, esc } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { quoteDelivery, parseDeliverySettings } from "@/lib/delivery";

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
  lat?: number;
  lng?: number;
  items: IncomingItem[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const { delivery, name, phone, address, comment, promo, items } = body;

  if (!name?.trim() || !phone?.trim() || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  if (delivery === "delivery" && !address?.trim()) {
    return NextResponse.json({ ok: false, error: "address_required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // ---- Авторитетні ціни з БД (захист від підміни ціни на клієнті) ----
  const ids = [...new Set(items.map((i) => i.id).filter((id) => UUID_RE.test(id)))];
  const fromDb = new Map<string, { name: string; price: number }>();
  if (ids.length) {
    const { data: prods } = await supabase
      .from("products")
      .select("id, name, price, is_available, deleted_at")
      .in("id", ids);
    for (const p of prods ?? []) {
      if (p.is_available && !p.deleted_at) fromDb.set(p.id, { name: p.name, price: Number(p.price) });
    }
  }

  const lineItems = items.map((i) => {
    const db = fromDb.get(i.id);
    const qty = Math.max(1, Math.floor(Number(i.qty) || 1));
    return {
      productId: db ? i.id : null,
      name: db?.name ?? i.name,
      price: db ? db.price : Math.max(0, Number(i.price) || 0),
      qty,
    };
  });
  const subtotal = lineItems.reduce((s, i) => s + i.price * i.qty, 0);

  // ---- Промокод (валідація + знижка на сервері) ----
  let promoCodeId: string | null = null;
  let discount = 0;
  const code = promo?.trim().toUpperCase();
  if (code) {
    const { data: pc } = await supabase
      .from("promo_codes")
      .select("id, discount_type, discount_value, is_active, valid_until, usage_limit, used_count")
      .ilike("code", code)
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

  // ---- Вартість доставки (перерахунок на сервері з координат + налаштувань) ----
  let deliveryCost = 0;
  if (delivery === "delivery") {
    const { data: ds } = await supabase.from("settings").select("value").eq("key", "delivery").maybeSingle();
    const settings = parseDeliverySettings(ds?.value);
    if (typeof body.lat === "number" && typeof body.lng === "number") {
      const q = quoteDelivery(settings, body.lat, body.lng, subtotal);
      deliveryCost = q.free ? 0 : q.price;
    } else {
      deliveryCost = settings.basePrice; // адреса без координат — базова ціна
    }
  }

  const total = Math.max(0, subtotal - discount + deliveryCost);

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

  return NextResponse.json({ ok: true, orderId, dbSaved, telegram: sent });
}

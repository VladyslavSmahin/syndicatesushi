import { NextResponse } from "next/server";
import { sendTelegramMessage, esc } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { parseContacts } from "@/lib/contacts";
import { kyivNow, addDays, parseHours, toMinutes, PICKUP_DAYS_AHEAD, PICKUP_STEP_MIN } from "@/lib/kyivTime";

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
  /** самовивіз: бажаний день (YYYY-MM-DD) і час (HH:MM; порожньо = по готовності) */
  pickupDate?: string;
  pickupTime?: string;
  /** кількість наборів приборів (0 = не потрібні) */
  cutlery?: number;
  promo?: string;
  consent?: boolean;
  items: IncomingItem[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// екранує спецсимволи LIKE (%, _, \), щоб ввід не змінював семантику пошуку
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => "\\" + m);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** «2026-08-30» + «18:30» → «30.08 о 18:30» (сьогодні/завтра — словами, за київським часом). */
function formatPickup(date: string, time: string): string {
  const today = kyivNow().date;
  const [y, m, d] = date.split("-");
  const day = date === today ? "сьогодні" : date === addDays(today, 1) ? "завтра" : `${d}.${m}.${y}`;
  return time ? `${day} о ${time}` : `${day}, по готовності`;
}

/** Рядок або відсутнє значення; інше (число, обʼєкт…) — невалідний ввід. */
const optStr = (v: unknown): v is string | undefined | null => v == null || typeof v === "string";

const TG_LIMIT = 4000; // ліміт Telegram — 4096 символів, лишаємо запас
/** Обрізає вже екрановану HTML-стрічку, не розриваючи сутність на кшталт «&amp;». */
const cutEscaped = (s: string, n: number) =>
  s.length > n ? s.slice(0, Math.max(0, n - 1)).replace(/&[a-z#0-9]*$/i, "") + "…" : s;

const MAX_CUTLERY = 6;      // макс. наборів приборів
const MAX_LINE_ITEMS = 100; // макс. різних позицій у замовленні
const MAX_QTY = 100;        // макс. кількість однієї позиції
const MAX_PROMO_LEN = 50;   // макс. довжина промокоду

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

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const { delivery, name, phone, address, comment, pickupDate, pickupTime, cutlery, promo, consent, items } = body;

  // строгі типи: не-рядок у текстовому полі — це 400, а не падіння на .trim()
  if (!optStr(name) || !optStr(phone) || !optStr(address) || !optStr(comment) || !optStr(promo) || !optStr(pickupDate) || !optStr(pickupTime)) {
    return NextResponse.json({ ok: false, error: "bad_fields" }, { status: 400 });
  }
  if (delivery !== "delivery" && delivery !== "pickup") {
    return NextResponse.json({ ok: false, error: "bad_delivery" }, { status: 400 });
  }
  if (!name?.trim() || !phone?.trim() || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  if (items.length > MAX_LINE_ITEMS) {
    return NextResponse.json({ ok: false, error: "too_many_items" }, { status: 400 });
  }
  if (items.some((i) => !i || typeof i !== "object" || typeof i.id !== "string")) {
    return NextResponse.json({ ok: false, error: "bad_items" }, { status: 400 });
  }
  if (consent !== true) {
    return NextResponse.json({ ok: false, error: "consent_required" }, { status: 400 });
  }
  if (delivery === "delivery" && !address?.trim()) {
    return NextResponse.json({ ok: false, error: "address_required" }, { status: 400 });
  }

  // ліміти довжини текстових полів (анти-спам/абʼюз)
  if (name.length > 100 || phone.length > 30 || (address?.length ?? 0) > 300 || (comment?.length ?? 0) > 1000 || (promo?.length ?? 0) > MAX_PROMO_LEN) {
    return NextResponse.json({ ok: false, error: "field_too_long" }, { status: 400 });
  }

  // прибори: ціле число в межах 0…MAX_CUTLERY, решту ігноруємо
  const cutleryQty = Math.min(MAX_CUTLERY, Math.max(0, Math.floor(Number(cutlery) || 0)));

  const supabase = createAdminClient();

  // ---- Самовивіз: дата в межах [сьогодні; +7 днів] і час не в минулому (за київським часом) ----
  let pickup = "";
  if (delivery === "pickup") {
    const date = pickupDate ?? "";
    const time = pickupTime ?? "";
    const now = kyivNow();
    if (!DATE_RE.test(date) || date < now.date || date > addDays(now.date, PICKUP_DAYS_AHEAD)) {
      return NextResponse.json({ ok: false, error: "pickup_date_invalid" }, { status: 400 });
    }
    if (time && !TIME_RE.test(time)) {
      return NextResponse.json({ ok: false, error: "pickup_time_invalid" }, { status: 400 });
    }
    // години роботи — з налаштувань контактів (як і в пікері на сайті)
    const { data: contactsRow } = await supabase.from("settings").select("value").eq("key", "contacts").maybeSingle();
    const [open, close] = parseHours(parseContacts(contactsRow?.value).hours);
    if (time) {
      const t = toMinutes(time);
      if (t < open || t > close - PICKUP_STEP_MIN) {
        return NextResponse.json({ ok: false, error: "pickup_time_invalid" }, { status: 400 });
      }
      // без запасу на приготування: невеликий розсинхрон годинника клієнта не має блокувати замовлення
      if (date === now.date && t < now.minutes) {
        return NextResponse.json({ ok: false, error: "pickup_time_passed" }, { status: 400 });
      }
    } else if (date === now.date && now.minutes >= close) {
      // «по готовності» на сьогодні, коли заклад уже зачинився
      return NextResponse.json({ ok: false, error: "pickup_time_passed" }, { status: 400 });
    }
    pickup = formatPickup(date, time);
  }

  // ---- Авторитетні ціни з БД (захист від підміни ціни на клієнті) ----
  const ids = [...new Set(items.map((i) => i.id).filter((id) => UUID_RE.test(id)))];
  const fromDb = new Map<string, { name: string; price: number }>();
  const promoPrice = new Map<string, number>(); // авторитетна акційна ціна по товару
  if (ids.length) {
    const { data: prods } = await supabase
      .from("products")
      .select("id, name, price, is_available, deleted_at, category:categories(is_active)")
      .in("id", ids);
    for (const p of prods ?? []) {
      // товар у вимкненій категорії на сайті не показується — і замовити його не можна
      const cat = p.category as { is_active: boolean } | { is_active: boolean }[] | null;
      const catActive = (Array.isArray(cat) ? cat[0]?.is_active : cat?.is_active) !== false;
      if (p.is_available && !p.deleted_at && catActive) fromDb.set(p.id, { name: p.name, price: Number(p.price) });
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
  // Недоступні позиції повертаємо списком — клієнт прибере їх із кошика.
  const badIds = [...new Set(items.filter((i) => !fromDb.has(i.id)).map((i) => i.id))];
  if (badIds.length) {
    return NextResponse.json({ ok: false, error: "item_unavailable", badIds }, { status: 400 });
  }
  const lineItems: { productId: string; name: string; price: number; qty: number }[] = [];
  for (const i of items) {
    const db = fromDb.get(i.id)!;
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
        // окремої колонки під час самовивозу немає — дописуємо його першим рядком коментаря
        comment: [pickup && `Самовивіз: ${pickup}`, cutleryQty > 0 && `Прибори: ${cutleryQty} шт`, comment?.trim()].filter(Boolean).join("\n") || null,
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
  const buildMsg = (commentHtml: string, itemLines: string[]) => [
    "🍣 <b>НОВЕ ЗАМОВЛЕННЯ</b>",
    "",
    `👤 <b>Ім'я:</b> ${esc(name)}`,
    `📞 <b>Телефон:</b> ${esc(phone)}`,
    `🚚 <b>Спосіб:</b> ${delivery === "delivery" ? "Доставка" : "Самовивіз"}`,
    delivery === "delivery" && address ? `📍 <b>Адреса:</b> ${esc(address)}` : null,
    pickup ? `🕒 <b>Забрати:</b> ${esc(pickup)}` : null,
    cutleryQty > 0 ? `🥢 <b>Прибори:</b> ${cutleryQty} шт` : null,
    code ? `🎟 <b>Промокод:</b> ${esc(code)}${discount ? ` (−${discount} грн)` : " (не застосовано)"}` : null,
    commentHtml ? `💬 <b>Коментар:</b> ${commentHtml}` : null,
    "",
    "<b>Позиції:</b>",
    ...itemLines,
    "",
    discount ? `Сума: ${subtotal} грн · Знижка: −${discount} грн` : null,
    deliveryCost > 0 ? `🚚 <b>Доставка:</b> ${deliveryCost} грн` : null,
    `💰 <b>Разом:</b> ${total} грн`,
    !dbSaved ? "\n⚠️ <i>Замовлення не збереглося в БД — перевірте адмінку</i>" : null,
  ]
    .filter(Boolean)
    .join("\n");

  // Telegram не приймає повідомлення довші за 4096 символів: спершу скорочуємо
  // коментар, потім — список позицій (повні дані все одно є в адмінці).
  let commentHtml = comment?.trim() ? esc(comment.trim()) : "";
  let itemLines = lines;
  let msg = buildMsg(commentHtml, itemLines);
  if (msg.length > TG_LIMIT && commentHtml) {
    commentHtml = cutEscaped(commentHtml, Math.max(100, commentHtml.length - (msg.length - TG_LIMIT)));
    msg = buildMsg(commentHtml, itemLines);
  }
  for (let keep = lines.length - 1; msg.length > TG_LIMIT && keep > 0; keep--) {
    itemLines = [...lines.slice(0, keep), `… та ще ${lines.length - keep} поз. (див. адмінку)`];
    msg = buildMsg(commentHtml, itemLines);
  }

  const sent = await sendTelegramMessage(msg);

  // замовлення нікуди не дійшло (ні БД, ні Telegram) — чесна помилка, клієнт НЕ очистить кошик
  if (!dbSaved && !sent) {
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 502 });
  }

  // серверна сума — клієнт покаже її, якщо вона відрізняється від тієї, що бачив у кошику
  return NextResponse.json({ ok: true, orderId, total });
}

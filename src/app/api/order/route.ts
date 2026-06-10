import { NextResponse } from "next/server";
import { sendTelegramMessage, esc } from "@/lib/telegram";

interface IncomingItem {
  id: number;
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
  items: IncomingItem[];
}

export async function POST(req: Request) {
  let body: OrderBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const { delivery, name, phone, address, comment, promo, items } = body;

  // мінімальна валідація
  if (!name?.trim() || !phone?.trim() || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  if (delivery === "delivery" && !address?.trim()) {
    return NextResponse.json({ ok: false, error: "address_required" }, { status: 400 });
  }

  // TODO (після Supabase): перерахувати ціни з БД, провалідувати промокод,
  // записати замовлення в orders/order_items. Поки що — лише сповіщення в Telegram.
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);

  const lines = items.map(
    (i) => `• ${esc(i.name)} × ${i.qty} — ${i.price * i.qty} грн`
  );

  const msg = [
    "🍣 <b>НОВЕ ЗАМОВЛЕННЯ</b>",
    "",
    `👤 <b>Ім'я:</b> ${esc(name)}`,
    `📞 <b>Телефон:</b> ${esc(phone)}`,
    `🚚 <b>Спосіб:</b> ${delivery === "delivery" ? "Доставка" : "Самовивіз"}`,
    delivery === "delivery" && address ? `📍 <b>Адреса:</b> ${esc(address)}` : null,
    promo?.trim() ? `🎟 <b>Промокод:</b> ${esc(promo)}` : null,
    comment?.trim() ? `💬 <b>Коментар:</b> ${esc(comment)}` : null,
    "",
    "<b>Позиції:</b>",
    ...lines,
    "",
    `💰 <b>Разом:</b> ${total} грн`,
  ]
    .filter(Boolean)
    .join("\n");

  const sent = await sendTelegramMessage(msg);

  // Заказ "прийнято" навіть якщо Telegram недоступний (помилка не ламає сценарій).
  return NextResponse.json({ ok: true, telegram: sent });
}

import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { PUBLIC_TAG } from "@/features/publicCache";
import { sendTelegramMessage, esc } from "@/lib/telegram";
import { SITE_URL } from "@/lib/seo";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rateLimit";

interface ReviewBody {
  name: string;
  contact: string;
  rating: number;
  text: string;
}

export async function POST(req: Request) {
  const rl = rateLimit(`review:${clientIp(req)}`, 4, 60_000); // 4 відгуки / хв з IP
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  }

  let body: ReviewBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const { name, contact, rating, text } = body;
  // строгі типи: не-рядок — це 400, а не падіння на .trim()
  if (typeof name !== "string" || typeof contact !== "string" || typeof text !== "string") {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  if (!name.trim() || !contact?.trim() || !text?.trim()) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }
  // ліміти довжини текстових полів (анти-спам/абʼюз)
  if (name.length > 100 || contact.length > 100 || text.length > 2000) {
    return NextResponse.json({ ok: false, error: "field_too_long" }, { status: 400 });
  }

  const r = Number(rating);
  const ratingVal = r >= 1 && r <= 5 ? Math.floor(r) : null;

  // 5 зірок — одразу на сайт (approved); решта — pending, модерація в адмінці
  const autoApproved = ratingVal === 5;
  let saved = false;
  try {
    const { error } = await createAdminClient().from("reviews").insert({
      author_name: name.trim(), contact: contact.trim(), rating: ratingVal, text: text.trim(),
      status: autoApproved ? "approved" : "pending",
    });
    if (error) console.error("review insert failed:", error.message);
    else {
      saved = true;
      if (autoApproved) revalidateTag(PUBLIC_TAG); // щоб відгук одразу зʼявився в блоці на сайті
    }
  } catch (e) {
    console.error("review insert failed:", (e as Error).message);
  }

  const stars = ratingVal ? "⭐".repeat(ratingVal) : "—";

  const msg = [
    "📝 <b>НОВИЙ ВІДГУК</b>",
    "",
    `👤 <b>Ім'я:</b> ${esc(name)}`,
    `📞 <b>Контакт:</b> ${esc(contact)}`,
    `⭐ <b>Оцінка:</b> ${stars}`,
    "",
    esc(text),
    "",
    // 5★ уже на сайті (можна прибрати в адмінці); решта чекає схвалення
    saved && autoApproved
      ? `✅ Опубліковано на сайті автоматично (5★). <a href="${SITE_URL}/admin/reviews">Керувати відгуками</a>`
      : `👉 <a href="${SITE_URL}/admin/reviews">Модерація відгуків</a>`,
  ].join("\n");

  const sent = await sendTelegramMessage(msg);
  // відгук нікуди не дійшов (ні БД, ні Telegram) — чесна помилка, форма покаже її клієнту
  if (!saved && !sent) {
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true, telegram: sent, published: saved && autoApproved });
}

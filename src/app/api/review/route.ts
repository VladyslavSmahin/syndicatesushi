import { NextResponse } from "next/server";
import { sendTelegramMessage, esc } from "@/lib/telegram";
import { createAdminClient } from "@/lib/supabase/admin";

interface ReviewBody {
  name: string;
  contact: string;
  rating: number;
  text: string;
}

export async function POST(req: Request) {
  let body: ReviewBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const { name, contact, rating, text } = body;
  if (!name?.trim() || !contact?.trim() || !text?.trim()) {
    return NextResponse.json({ ok: false, error: "missing_fields" }, { status: 400 });
  }

  const r = Number(rating);
  const ratingVal = r >= 1 && r <= 5 ? Math.floor(r) : null;

  // Запис у БД зі статусом pending (модерація в адмінці)
  try {
    const { error } = await createAdminClient().from("reviews").insert({
      author_name: name.trim(), contact: contact.trim(), rating: ratingVal, text: text.trim(), status: "pending",
    });
    if (error) console.error("review insert failed:", error.message);
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
  ].join("\n");

  const sent = await sendTelegramMessage(msg);
  return NextResponse.json({ ok: true, telegram: sent });
}

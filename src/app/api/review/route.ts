import { NextResponse } from "next/server";
import { sendTelegramMessage, esc } from "@/lib/telegram";

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

  // TODO (після Supabase): запис у таблицю reviews зі статусом pending.
  const stars = rating > 0 ? "⭐".repeat(Math.min(5, rating)) : "—";

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

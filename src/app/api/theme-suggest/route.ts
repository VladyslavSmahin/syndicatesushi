import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendTelegramMessage, esc } from "@/lib/telegram";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// POST /api/theme-suggest { text } — клієнт пропонує тематику фону кабінету → повідомлення в Telegram (бот замовлень).
export async function POST(req: Request) {
  const rl = rateLimit(`theme-suggest:${clientIp(req)}`, 3, 10 * 60_000); // 3 пропозиції / 10 хв з IP
  if (!rl.ok) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim().slice(0, 500) : "";
  if (text.length < 2) return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });

  const { data: c } = await supabase.from("customers").select("name, phone").eq("id", user.id).maybeSingle();
  const who = [c?.name, c?.phone, user.email].filter(Boolean).map((v) => esc(String(v))).join(" · ");
  const sent = await sendTelegramMessage(["🎨 <b>Пропозиція тематики фону кабінету</b>", "", esc(text), "", `👤 ${who || "клієнт"}`].join("\n"));
  return NextResponse.json({ ok: sent }, { status: sent ? 200 : 502 });
}

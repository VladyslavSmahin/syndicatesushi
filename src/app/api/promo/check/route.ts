import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// екранує спецсимволи LIKE (%, _, \), щоб ввід не змінював семантику пошуку
const escapeLike = (s: string) => s.replace(/[\\%_]/g, (m) => "\\" + m);

// POST /api/promo/check — перевірка промокоду без створення замовлення.
// promo_codes доступні лише staff (RLS), тому читаємо service-role клієнтом на сервері.
export async function POST(req: Request) {
  const rl = rateLimit(`promo:${clientIp(req)}`, 20, 60_000); // 20 перевірок / хв з IP
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429, headers: { "Retry-After": String(rl.retryAfter) } });
  }

  let body: { code?: string; subtotal?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const code = String(body.code ?? "").trim().toUpperCase();
  const subtotal = Math.max(0, Number(body.subtotal) || 0);
  if (!code) return NextResponse.json({ ok: true, valid: false });

  const { data: pc } = await createAdminClient()
    .from("promo_codes")
    .select("discount_type, discount_value, is_active, valid_until, usage_limit, used_count")
    .ilike("code", escapeLike(code))
    .maybeSingle();

  const valid = pc && pc.is_active
    && (!pc.valid_until || new Date(pc.valid_until) > new Date())
    && (pc.usage_limit == null || pc.used_count < pc.usage_limit);
  if (!valid) return NextResponse.json({ ok: true, valid: false });

  const v = Number(pc!.discount_value);
  let discount = pc!.discount_type === "percent" ? Math.round((subtotal * v) / 100) : v;
  discount = Math.min(discount, subtotal);

  return NextResponse.json({ ok: true, valid: true, discountType: pc!.discount_type, value: v, discount });
}

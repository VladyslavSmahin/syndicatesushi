import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { phoneDigits } from "@/lib/phone";

// «Запроси друга»: код клієнта (customers.ref_code) працює як промокод на ПЕРШЕ замовлення друга.
// Запрошувач отримує бали, коли замовлення друга виконано (тригер orders_referral_points у БД).

export const REFERRAL_PERCENT = 10;
export const REFERRAL_POINTS = 10;

type Admin = ReturnType<typeof createAdminClient>;
export interface Referrer { id: string; name: string | null; phoneNorm: string | null; code: string }

/** Код запрошення → власник. null — такого коду немає (або колонки ще немає в БД). */
export async function findReferrer(supabase: Admin, code: string): Promise<Referrer | null> {
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return null;
  const { data, error } = await supabase.from("customers").select("id, name, phone_norm, ref_code").eq("ref_code", code).maybeSingle();
  if (error || !data) return null;
  return { id: data.id, name: data.name, phoneNorm: data.phone_norm, code: data.ref_code };
}

/** Чому знижка за запрошенням не діє: 'self' — свій код, 'not_first' — уже були замовлення. null — діє. */
export async function referralBlock(
  supabase: Admin,
  ref: Referrer,
  who: { userId: string | null; phone: string | null },
): Promise<"self" | "not_first" | null> {
  const phoneNorm = who.phone ? phoneDigits(who.phone) || null : null;
  if (ref.id === who.userId || (phoneNorm && ref.phoneNorm === phoneNorm)) return "self";
  const owner = [who.userId && `user_id.eq.${who.userId}`, phoneNorm && `phone_norm.eq.${phoneNorm}`].filter(Boolean).join(",");
  if (!owner) return null; // ще не знаємо, хто це — остаточно перевіримо при оформленні
  const { count } = await supabase.from("orders").select("id", { count: "exact", head: true }).or(owner).neq("status", "canceled");
  return count ? "not_first" : null;
}

/** Імʼя для тексту «запрошення від …»: лише перше слово. */
export const firstName = (n: string | null) => (n ?? "").trim().split(/\s+/)[0] || null;

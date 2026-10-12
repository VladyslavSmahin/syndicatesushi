import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";
import { phoneDigits } from "@/lib/phone";

// «Приведи друга»: код клієнта (customers.ref_code) працює як промокод на ПЕРШЕ замовлення друга від 1500 грн (−10%).
// Запрошувач отримує сертифікат 100 грн на замовлення від 1000 грн, коли замовлення друга виконано
// (тригер orders_referral_reward у БД); списується сертифікат тут, при оформленні (claimCertificate).

export const REFERRAL_PERCENT = 10;
export const REFERRAL_MIN_TOTAL = 1500;

type Admin = ReturnType<typeof createAdminClient>;
export interface Referrer { id: string; name: string | null; phoneNorm: string | null; code: string }

/** Код запрошення → власник. null — такого коду немає (або колонки ще немає в БД). */
export async function findReferrer(supabase: Admin, code: string): Promise<Referrer | null> {
  if (!/^[A-Z0-9]{4,12}$/.test(code)) return null;
  const { data, error } = await supabase.from("customers").select("id, name, phone_norm, ref_code").eq("ref_code", code).maybeSingle();
  if (error || !data) return null;
  return { id: data.id, name: data.name, phoneNorm: data.phone_norm, code: data.ref_code };
}

/** Хто запросив цього клієнта (customers.referred_by — фіксується при реєстрації за посиланням). */
export async function referrerOfUser(supabase: Admin, userId: string): Promise<Referrer | null> {
  const { data, error } = await supabase.from("customers").select("referred_by").eq("id", userId).maybeSingle();
  if (error || !data?.referred_by) return null;
  const { data: r } = await supabase.from("customers").select("id, name, phone_norm, ref_code").eq("id", data.referred_by).maybeSingle();
  return r ? { id: r.id, name: r.name, phoneNorm: r.phone_norm, code: r.ref_code ?? "" } : null;
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

export interface Certificate { id: string; amount: number; minOrder: number }

/** Найстаріший активний сертифікат клієнта (без списання). */
export async function activeCertificate(supabase: Admin, userId: string): Promise<Certificate | null> {
  const { data, error } = await supabase.from("customer_certificates")
    .select("id, amount, min_order").eq("customer_id", userId).eq("status", "active")
    .order("created_at").limit(1).maybeSingle();
  if (error || !data) return null;
  return { id: data.id, amount: Number(data.amount), minOrder: Number(data.min_order) };
}

/** Списати сертифікат (атомарно: лише якщо він ще активний). false — його вже використали в іншому замовленні. */
export async function claimCertificate(supabase: Admin, certId: string): Promise<boolean> {
  const { data } = await supabase.from("customer_certificates")
    .update({ status: "used", used_at: new Date().toISOString() })
    .eq("id", certId).eq("status", "active").select("id");
  return !!data?.length;
}

/** Повернути сертифікат (замовлення не збереглося) або привʼязати до замовлення. */
export async function releaseCertificate(supabase: Admin, certId: string) {
  await supabase.from("customer_certificates").update({ status: "active", used_at: null, used_order_id: null }).eq("id", certId);
}
export async function bindCertificate(supabase: Admin, certId: string, orderId: string) {
  await supabase.from("customer_certificates").update({ used_order_id: orderId }).eq("id", certId);
}

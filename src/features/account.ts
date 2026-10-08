"use client";

// Кабінет клієнта: сесія Supabase (Google), профіль із customers і власні замовлення.
// Що саме видно клієнту — вирішує RLS (див. міграцію 20261008120000):
// замовлення з цього акаунта + (якщо номер підтверджено) усі замовлення на цей номер.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export interface CustomerProfile {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  /** номер у форматі БД (normalize_phone) — для фільтра історії */
  phoneNorm: string | null;
  phoneVerifiedAt: string | null;
  /** пошту підтверджено (Google — одразу, email+пароль — після листа) */
  emailConfirmed: boolean;
}

export type AccountOrderStatus = "new" | "confirmed" | "done" | "canceled";
export interface AccountOrder {
  id: string;
  status: AccountOrderStatus;
  deliveryType: "delivery" | "pickup";
  address: string | null;
  total: number;
  discount: number;
  createdAt: string;
  scheduledDate: string | null;
  scheduledTime: string | null;
  items: { name: string; price: number; quantity: number }[];
}

/** Повернення після Google / посилання з листа: через callback на сторінку next. */
const callbackUrl = (next: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

/** Вхід через Google; після авторизації повертаємось на next (за замовчуванням — у кабінет). */
export async function signInCustomer(next = "/account") {
  return createClient().auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(next) },
  });
}

/** Реєстрація поштою: ім'я й номер ідуть у метадані (customer_ensure перенесе їх у профіль).
 *  Якщо в Supabase увімкнено підтвердження пошти — сесії ще немає, клієнт має перейти за посиланням із листа. */
export async function signUpCustomer(p: { email: string; password: string; name: string; phone: string }) {
  const { data, error } = await createClient().auth.signUp({
    email: p.email,
    password: p.password,
    options: { data: { full_name: p.name, phone: p.phone }, emailRedirectTo: callbackUrl("/account?confirmed=1") },
  });
  return { error, needsConfirmation: !error && !data.session };
}

export async function signInCustomerPassword(email: string, password: string) {
  return createClient().auth.signInWithPassword({ email, password });
}

/** Надіслати лист підтвердження ще раз. */
export async function resendConfirmation(email: string) {
  return createClient().auth.resend({ type: "signup", email, options: { emailRedirectTo: callbackUrl("/account?confirmed=1") } });
}

/** Лист зі скиданням пароля → посилання відкриє кабінет у режимі «новий пароль». */
export async function requestPasswordReset(email: string) {
  return createClient().auth.resetPasswordForEmail(email, { redirectTo: callbackUrl("/account?reset=1") });
}

export async function updatePassword(password: string) {
  return createClient().auth.updateUser({ password });
}

export async function signOutCustomer() {
  await createClient().auth.signOut();
}

/** Профіль поточного клієнта (створюється при першому зверненні). null — не залогінений / ще вантажиться. */
async function loadProfile(): Promise<CustomerProfile | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return null;
  await supabase.rpc("customer_ensure");
  const { data } = await supabase
    .from("customers")
    .select("id, email, name, phone, phone_norm, phone_verified_at")
    .eq("id", session.user.id)
    .maybeSingle();
  if (!data) return null;
  return { id: data.id, email: data.email ?? session.user.email ?? "", name: data.name, phone: data.phone, phoneNorm: data.phone_norm, phoneVerifiedAt: data.phone_verified_at, emailConfirmed: !!session.user.email_confirmed_at };
}

/** Оновити номер у профілі (з кошика, за згодою клієнта). Зміна номера скидає його підтвердження (тригер у БД). */
export async function updateCustomerPhone(id: string, phone: string): Promise<boolean> {
  const { error } = await createClient().from("customers").update({ phone }).eq("id", id);
  return !error;
}

/** Профіль поточного клієнта або null (не залогінений / не вдалося завантажити). */
export const fetchCustomerProfile = () => loadProfile();

/** Для кошика: профіль залогіненого клієнта (тихо null, якщо не залогінений або щось не так). */
export function useCustomerProfile(enabled: boolean): CustomerProfile | null {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    loadProfile().then((p) => { if (active) setProfile(p); }).catch(() => {});
    return () => { active = false; };
  }, [enabled]);
  return profile;
}

/** Власні замовлення: з акаунта + (якщо номер підтверджено) усі на цей номер. */
function ownOrdersFilter(p: CustomerProfile): string {
  const norm = p.phoneVerifiedAt && p.phoneNorm && /^\d+$/.test(p.phoneNorm) ? p.phoneNorm : null;
  return norm ? `user_id.eq.${p.id},phone_norm.eq.${norm}` : `user_id.eq.${p.id}`;
}

/** Стан кабінету: сесія, профіль, історія. */
export function useAccount() {
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  // є сесія (на випадок, коли профіль не завантажився — напр. БД ще без таблиці customers)
  const [signedIn, setSignedIn] = useState(false);
  const [orders, setOrders] = useState<AccountOrder[]>([]);

  const refetch = useCallback(async () => {
    const p = await loadProfile().catch(() => null);
    setProfile(p);
    setSignedIn(!!p || !!(await supabase.auth.getSession()).data.session);
    if (p) {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, delivery_type, address, total, discount, created_at, scheduled_date, scheduled_time, items:order_items(product_name, price, quantity)")
        // явний фільтр, а не лише RLS: співробітнику RLS віддає ВСІ замовлення — у кабінеті ж тільки власні
        .or(ownOrdersFilter(p))
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) console.error("account orders:", error.message);
      setOrders((data ?? []).map((o) => ({
        id: o.id, status: o.status as AccountOrderStatus, deliveryType: o.delivery_type as "delivery" | "pickup",
        address: o.address, total: Number(o.total), discount: Number(o.discount), createdAt: o.created_at,
        scheduledDate: o.scheduled_date, scheduledTime: o.scheduled_time?.slice(0, 5) ?? null,
        items: ((o.items ?? []) as { product_name: string; price: number; quantity: number }[])
          .map((it) => ({ name: it.product_name, price: Number(it.price), quantity: it.quantity })),
      })));
    } else {
      setOrders([]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    refetch();
    // вхід/вихід в іншій вкладці або після OAuth-редіректу
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") refetch();
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase, refetch]);

  /** Зберегти ім'я/номер. Зміна номера скидає підтвердження (тригер у БД). */
  const saveProfile = useCallback(async (patch: { name: string; phone: string }) => {
    if (!profile) return "no_session";
    const { error } = await supabase.from("customers").update({ name: patch.name || null, phone: patch.phone || null }).eq("id", profile.id);
    if (error) return error.message;
    await refetch();
    return null;
  }, [supabase, profile, refetch]);

  return { loading, profile, signedIn, orders, refetch, saveProfile };
}

/** Чи залогінений клієнт (для іконки кабінету в шапці): undefined — ще перевіряємо. */
export function useIsSignedIn(): boolean | undefined {
  const [signedIn, setSignedIn] = useState<boolean | undefined>(undefined);
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setSignedIn(!!session));
    return () => sub.subscription.unsubscribe();
  }, []);
  return signedIn;
}

/** Роль співробітника поточного користувача (admin/editor) — для кнопки «Адмінка»; null — не співробітник.
 *  Рядок у profiles є лише для email із білого списку (RLS: кожен бачить свій). */
export function useStaffRole(): "admin" | "editor" | null {
  const [role, setRole] = useState<"admin" | "editor" | null>(null);
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { if (active) setRole(null); return; }
      const { data } = await supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle();
      if (active) setRole(data?.role === "admin" || data?.role === "editor" ? data.role : null);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN" || e === "SIGNED_OUT") check(); });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);
  return role;
}

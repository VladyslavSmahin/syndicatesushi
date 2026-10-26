"use client";

// Кабінет клієнта: сесія Supabase (Google), профіль із customers і власні замовлення.
// Що саме видно клієнту — вирішує RLS (див. міграцію 20261008120000):
// замовлення з цього акаунта + (якщо номер підтверджено) усі замовлення на цей номер.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseProfileBg, type ProfileBg } from "@/lib/profileBg";
import { signInWithGoogle } from "@/lib/pwa";

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
  /** фото, завантажене в кабінеті (R2); null — немає */
  avatarUrl: string | null;
  /** фото з Google-акаунта (метадані сесії) — показуємо, якщо свого немає */
  googleAvatar: string | null;
  /** фон кабінету (тема або своє фото + кадр для телефона/ПК); null — без фону */
  profileBg: ProfileBg | null;
  /** бонусні бали (+10 за кожного запрошеного друга); null — колонки ще немає в БД */
  bonusPoints: number | null;
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
  /** productId — null, якщо товар відтоді видалили з бази назавжди */
  items: { productId: string | null; name: string; price: number; quantity: number }[];
}

/** Повернення після Google / посилання з листа: через callback на сторінку next. */
const callbackUrl = (next: string) => `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

/** Вхід через Google; після авторизації повертаємось на next (за замовчуванням — у кабінет). */
export async function signInCustomer(next = "/account") {
  // у застосунку на iPhone — через вікно window.open (lib/pwa.ts)
  return signInWithGoogle(createClient(), next);
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

// Один профіль на вкладку: кабінет, «Обране», кошик, вікно телефону й кнопка профілю беруть його звідси,
// а не ходять у базу кожен сам (раніше — 2–3 однакові ланцюжки запитів на кожен перехід).
let profileCache: { uid: string; at: number; p: Promise<CustomerProfile | null> } | null = null;
const PROFILE_TTL = 60_000;

/** Скинути кеш профілю — після змін (імʼя/номер, фото, фон), щоб наступне читання взяло свіже з бази. */
export function invalidateProfile() { profileCache = null; }

/** Профіль поточного клієнта (створюється при першому зверненні). null — не залогінений. force — повз кеш. */
async function loadProfile(force = false): Promise<CustomerProfile | null> {
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession(); // локально, без запиту в мережу
  if (!session?.user) { profileCache = null; return null; }
  const uid = session.user.id;
  if (!force && profileCache && profileCache.uid === uid && Date.now() - profileCache.at < PROFILE_TTL) return profileCache.p;
  const p = queryProfile(supabase, session).catch((e) => { profileCache = null; throw e; });
  profileCache = { uid, at: Date.now(), p };
  return p;
}

async function queryProfile(
  supabase: ReturnType<typeof createClient>,
  session: NonNullable<Awaited<ReturnType<ReturnType<typeof createClient>["auth"]["getSession"]>>["data"]["session"]>,
): Promise<CustomerProfile | null> {
  const base = "id, email, name, phone, phone_norm, phone_verified_at";
  // нові колонки можуть ще не бути в БД (міграції 20261008210000 / 20261008230000) — тоді без них, а не зламаний кабінет
  const select = async () => {
    let r = await supabase.from("customers").select(`${base}, avatar_url, profile_bg, bonus_points`).eq("id", session.user.id).maybeSingle();
    if (r.error) r = await supabase.from("customers").select(`${base}, avatar_url, profile_bg`).eq("id", session.user.id).maybeSingle() as typeof r;
    if (r.error) r = await supabase.from("customers").select(`${base}, avatar_url`).eq("id", session.user.id).maybeSingle() as typeof r;
    if (r.error) r = await supabase.from("customers").select(base).eq("id", session.user.id).maybeSingle() as typeof r;
    return r;
  };
  let res = await select();
  // рядка клієнта ще немає (перший вхід) — створюємо й читаємо ще раз; далі цей зайвий запит не робимо
  if (!res.error && !res.data) {
    await supabase.rpc("customer_ensure");
    res = await select();
  }
  const data = res.data as ({ id: string; email: string | null; name: string | null; phone: string | null; phone_norm: string | null; phone_verified_at: string | null; avatar_url?: string | null; profile_bg?: unknown; bonus_points?: number | null }) | null;
  if (!data) return null;
  const meta = session.user.user_metadata ?? {};
  const google = typeof meta.avatar_url === "string" ? meta.avatar_url : typeof meta.picture === "string" ? meta.picture : null;
  return {
    id: data.id, email: data.email ?? session.user.email ?? "", name: data.name, phone: data.phone, phoneNorm: data.phone_norm,
    phoneVerifiedAt: data.phone_verified_at, emailConfirmed: !!session.user.email_confirmed_at,
    avatarUrl: data.avatar_url ?? null, googleAvatar: google, profileBg: parseProfileBg(data.profile_bg),
    bonusPoints: typeof data.bonus_points === "number" ? data.bonus_points : null,
  };
}

/** Оновити номер у профілі (з кошика, за згодою клієнта). Зміна номера скидає його підтвердження (тригер у БД). */
export async function updateCustomerPhone(id: string, phone: string): Promise<boolean> {
  const { error } = await createClient().from("customers").update({ phone }).eq("id", id);
  invalidateProfile();
  return !error;
}

/** Завантажити/замінити фото профілю (сервер обріже до 320×320). Повертає код помилки або null. */
export async function uploadCustomerAvatar(file: File): Promise<string | null> {
  invalidateProfile();
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/avatar", { method: "POST", body: fd });
  const j = await res.json().catch(() => ({}));
  return res.ok && j.ok ? null : (j.error || `HTTP ${res.status}`);
}

export async function removeCustomerAvatar(): Promise<boolean> {
  invalidateProfile();
  const res = await fetch("/api/avatar", { method: "DELETE" }).catch(() => null);
  return !!res?.ok;
}

/** Фон кабінету: своє фото (сервер стисне й збереже з поточним кадром). Повертає код помилки або null. */
export async function uploadProfileBg(file: File): Promise<string | null> {
  invalidateProfile();
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/profile-bg", { method: "POST", body: fd });
  const j = await res.json().catch(() => ({}));
  return res.ok && j.ok ? null : (j.error || `HTTP ${res.status}`);
}

/** Зберегти тему/кадр фону; null — прибрати фон. */
export async function saveProfileBg(bg: ProfileBg | null): Promise<string | null> {
  invalidateProfile();
  const res = await fetch("/api/profile-bg", bg
    ? { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bg) }
    : { method: "DELETE" });
  const j = await res.json().catch(() => ({}));
  return res.ok && j.ok ? null : (j.error || `HTTP ${res.status}`);
}

/** Запропонувати тематику фону — йде повідомленням у Telegram. */
export async function suggestTheme(text: string): Promise<string | null> {
  const res = await fetch("/api/theme-suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  const j = await res.json().catch(() => ({}));
  return res.ok && j.ok ? null : (j.error || `HTTP ${res.status}`);
}

export type FriendStatus = "registered" | "ordered" | "confirmed";
export interface ReferralFriend { name: string; status: FriendStatus; since: string | null }
export interface MyCertificate { id: string; amount: number; minOrder: number; status: "active" | "used" | "revoked"; createdAt: string }
export interface MyReferral { code: string; friends: ReferralFriend[]; certificates: MyCertificate[] }

/** «Приведи друга»: свій код (створюється при першому зверненні), запрошені зі статусами й сертифікати.
 *  null — міграції ще немає або не вдалося. */
export async function fetchMyReferral(): Promise<MyReferral | null> {
  const supabase = createClient();
  const [code, friends, certs] = await Promise.all([
    supabase.rpc("customer_ref_code"),
    supabase.rpc("my_referrals"),
    supabase.from("customer_certificates").select("id, amount, min_order, status, created_at").order("created_at", { ascending: false }),
  ]);
  if (code.error || !code.data) return null;
  const rows = (Array.isArray(friends.data) ? friends.data : []) as { name?: string; status?: string; since?: string | null }[];
  return {
    code: String(code.data),
    // стара версія my_referrals (до міграції сертифікатів) повертала лічильники, а не список — тоді просто порожньо
    friends: rows.filter((r) => typeof r.status === "string").map((r) => ({
      name: r.name?.trim() || "Друг",
      status: (r.status === "confirmed" || r.status === "ordered" ? r.status : "registered") as FriendStatus,
      since: r.since ?? null,
    })),
    certificates: (certs.data ?? []).map((c) => ({
      id: c.id, amount: Number(c.amount), minOrder: Number(c.min_order), status: c.status as MyCertificate["status"], createdAt: c.created_at,
    })),
  };
}

/** Активні сертифікати клієнта (для кошика). Порожньо — немає або таблиці ще немає. */
export async function fetchActiveCertificates(): Promise<MyCertificate[]> {
  const { data, error } = await createClient().from("customer_certificates")
    .select("id, amount, min_order, status, created_at").eq("status", "active").order("created_at");
  if (error || !data) return [];
  return data.map((c) => ({ id: c.id, amount: Number(c.amount), minOrder: Number(c.min_order), status: "active" as const, createdAt: c.created_at }));
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

/** Власні замовлення: з акаунта + усі на номер із профілю (без підтвердження — рішення власника 2026-10-09). */
function ownOrdersFilter(p: CustomerProfile): string {
  // номер не потребує підтвердження: історія — і з акаунта, і всі замовлення на номер із профілю
  const norm = p.phoneNorm && /^\d+$/.test(p.phoneNorm) ? p.phoneNorm : null;
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

  // force — коли кабінет сам щось змінив (збереження, фото, фон): беремо свіже з бази
  const refetch = useCallback(async (force = false) => {
    const p = await loadProfile(force).catch(() => null);
    setProfile(p);
    setSignedIn(!!p || !!(await supabase.auth.getSession()).data.session);
    if (p) {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, delivery_type, address, total, discount, created_at, scheduled_date, scheduled_time, items:order_items(product_id, product_name, price, quantity)")
        // явний фільтр, а не лише RLS: співробітнику RLS віддає ВСІ замовлення — у кабінеті ж тільки власні
        .or(ownOrdersFilter(p))
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) console.error("account orders:", error.message);
      setOrders((data ?? []).map((o) => ({
        id: o.id, status: o.status as AccountOrderStatus, deliveryType: o.delivery_type as "delivery" | "pickup",
        address: o.address, total: Number(o.total), discount: Number(o.discount), createdAt: o.created_at,
        scheduledDate: o.scheduled_date, scheduledTime: o.scheduled_time?.slice(0, 5) ?? null,
        items: ((o.items ?? []) as { product_id: string | null; product_name: string; price: number; quantity: number }[])
          .map((it) => ({ productId: it.product_id, name: it.product_name, price: Number(it.price), quantity: it.quantity })),
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
    await refetch(true);
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
let staffCache: { uid: string; p: Promise<"admin" | "editor" | null> } | null = null;

export function useStaffRole(): "admin" | "editor" | null {
  const [role, setRole] = useState<"admin" | "editor" | null>(null);
  useEffect(() => {
    const supabase = createClient();
    let active = true;
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { staffCache = null; if (active) setRole(null); return; }
      // роль на вкладку питаємо в базі один раз (шапка, бургер і т.д. — з кешу)
      if (!staffCache || staffCache.uid !== session.user.id) {
        staffCache = {
          uid: session.user.id,
          p: Promise.resolve(supabase.from("profiles").select("role").eq("id", session.user.id).maybeSingle())
            .then(({ data }) => (data?.role === "admin" || data?.role === "editor" ? data.role : null)),
        };
      }
      const r = await staffCache.p.catch(() => null);
      if (active) setRole(r);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange((e) => { if (e === "SIGNED_IN" || e === "SIGNED_OUT") { staffCache = null; profileCache = null; check(); } });
    return () => { active = false; sub.subscription.unsubscribe(); };
  }, []);
  return role;
}

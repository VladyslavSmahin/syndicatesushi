import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/seo";
import { APP_VERSION, CHANGELOG } from "@/data/changelog";

// Пуш-сповіщення. Персонал (PWA «SS Адмінка») — staff_push_subscriptions, вмикає сам співробітник
// в адмінці. Клієнти сайту — customer_push_subscriptions, вмикає клієнт у кабінеті (статус замовлення,
// окремо — акції). Без VAPID-ключів у env — тихо нічого не робимо.

export type PushPayload = {
  title: string;
  body: string;
  /** куди відкрити при тапі (у межах /admin) */
  url: string;
  /** однаковий tag — нове сповіщення замінює попереднє, а не множиться */
  tag?: string;
  /** число на іконці застосунку (непереглянуті замовлення + непереглянута версія) */
  badge?: number;
};

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };
type StaffSubscriptionRow = SubscriptionRow & { user_id: string; created_at: string };

let configured: boolean | null = null;
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || SITE_URL, pub, priv);
  return (configured = true);
}

type PushTable = "staff_push_subscriptions" | "customer_push_subscriptions";

/** Надсилає на пристрої; мертві endpoint'и (404/410 — застосунок видалено/вимкнено) прибирає з БД. */
export async function sendPush(rows: SubscriptionRow[], payload: PushPayload, table: PushTable = "staff_push_subscriptions") {
  const result = { sent: 0, removed: 0, failed: 0 };
  if (!pushConfigured() || rows.length === 0) return result;
  const admin = createAdminClient();
  const body = JSON.stringify(payload);
  await Promise.all(
    rows.map(async (r) => {
      try {
        await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, body, {
          TTL: 60 * 60,
          urgency: "high",
        });
        result.sent++;
        await admin.from(table).update({ last_sent_at: new Date().toISOString() }).eq("id", r.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          result.removed++;
          await admin.from(table).delete().eq("id", r.id);
        } else {
          result.failed++;
          console.error("push send failed:", status, (e as Error).message);
        }
      }
    }),
  );
  return result;
}

/** Пристрої співробітників, які досі в білому списку (allowed_staff). */
async function activeStaffSubscriptions(): Promise<StaffSubscriptionRow[]> {
  const admin = createAdminClient();
  const [{ data: subs }, { data: allowed }] = await Promise.all([
    admin.from("staff_push_subscriptions").select("id, user_id, created_at, endpoint, p256dh, auth, profiles!inner(email)"),
    admin.from("allowed_staff").select("email"),
  ]);
  const emails = new Set((allowed ?? []).map((a) => String(a.email).toLowerCase()));
  return (subs ?? [])
    .filter((s) => {
      const p = s.profiles as unknown as { email: string | null } | null;
      return !!p?.email && emails.has(p.email.toLowerCase());
    })
    .map(({ id, user_id, created_at, endpoint, p256dh, auth }) => ({ id, user_id, created_at, endpoint, p256dh, auth }));
}

/**
 * Число на іконці для співробітника: замовлення, що прийшли після того, як він востаннє відкривав
 * дошку замовлень, + 1, якщо ще не відкривав «Що нового» поточної версії.
 * Без запису в staff_seen рахуємо від `since` (напр. коли ввімкнув сповіщення), щоб не показати
 * одразу всю історію.
 */
export async function staffBadge(userId: string, since?: string): Promise<number> {
  const admin = createAdminClient();
  const { data: seen } = await admin.from("staff_seen").select("orders_seen_at, seen_version").eq("user_id", userId).maybeSingle();
  const from = seen?.orders_seen_at ?? since ?? new Date().toISOString();
  const { count } = await admin.from("orders").select("id", { count: "exact", head: true }).gt("created_at", from);
  return (count ?? 0) + (seen?.seen_version === APP_VERSION ? 0 : 1);
}

/** Позначити переглянутим: замовлення (відкрив дошку) і/або поточну версію «Що нового». Повертає нове число. */
export async function markStaffSeen(userId: string, what: { orders?: boolean; version?: boolean }): Promise<number> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: seen } = await admin.from("staff_seen").select("user_id").eq("user_id", userId).maybeSingle();
  const patch: { orders_seen_at?: string; seen_version?: string; updated_at: string } = { updated_at: now };
  if (what.orders || !seen) patch.orders_seen_at = now; // перший запис — відлік з цього моменту
  if (what.version) patch.seen_version = APP_VERSION;
  if (what.orders || what.version || !seen) {
    await admin.from("staff_seen").upsert({ user_id: userId, ...patch }, { onConflict: "user_id" });
  }
  return staffBadge(userId);
}

/** Надіслати всім співробітникам з увімкненими сповіщеннями; число на іконці — своє в кожного. */
async function sendToStaff(payload: Omit<PushPayload, "badge">) {
  const rows = await activeStaffSubscriptions();
  if (!rows.length) return;
  const byUser = new Map<string, StaffSubscriptionRow[]>();
  for (const r of rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) ?? []), r]);
  await Promise.all(
    [...byUser].map(async ([userId, subs]) => {
      const since = subs.map((x) => x.created_at).sort()[0];
      const badge = await staffBadge(userId, since).catch(() => undefined);
      await sendPush(subs, { ...payload, badge });
    }),
  );
}

/** Нове замовлення → пуш усім співробітникам з увімкненими сповіщеннями. Помилки не кидає. */
export async function notifyStaffNewOrder(o: {
  id: string | null;
  total: number;
  delivery: "delivery" | "pickup";
  name: string;
  when: string | null;
  items: number;
}) {
  try {
    if (!pushConfigured()) return;
    await sendToStaff({
      title: `🍣 Нове замовлення · ${o.total} грн`,
      body: [o.delivery === "delivery" ? "Доставка" : "Самовивіз", o.name, o.when || "якнайшвидше", `${o.items} поз.`].join(" · "),
      url: "/admin/orders/board",
      tag: o.id ? `order-${o.id}` : undefined,
    });
  } catch (e) {
    console.error("notifyStaffNewOrder failed:", (e as Error).message);
  }
}

/**
 * Нова версія в «Що нового» → один пуш усім співробітникам. Викликається при старті сервера
 * (instrumentation.ts) після деплою; release_push_log гарантує «рівно один раз» навіть якщо
 * одночасно стартує кілька інстансів. Помилки не кидає.
 */
export async function notifyStaffRelease() {
  try {
    if (!pushConfigured()) return;
    const release = CHANGELOG[0];
    const { data: inserted, error } = await createAdminClient()
      .from("release_push_log")
      .upsert({ version: release.version }, { onConflict: "version", ignoreDuplicates: true })
      .select("version");
    if (error || !inserted?.length) return; // уже розіслано (або таблиці ще немає)
    await sendToStaff({
      title: `🆕 Оновлення адмінки · v${release.version}`,
      body: release.title,
      url: "/admin?whatsnew=1",
      tag: `release-${release.version}`,
    });
  } catch (e) {
    console.error("notifyStaffRelease failed:", (e as Error).message);
  }
}

// ---------- Клієнти сайту ----------

const ORDER_STATUS_PUSH: Record<string, { title: string; body: (total: number) => string }> = {
  confirmed: { title: "✅ Замовлення прийнято", body: (t) => `Готуємо ваше замовлення на ${t} грн 🍣` },
  done: { title: "🍣 Замовлення виконано", body: () => "Дякуємо, що обрали нас! Смачного." },
  canceled: { title: "Замовлення скасовано", body: () => "Якщо це помилка — зателефонуйте нам, усе виправимо." },
};

/** Статус замовлення змінено в адмінці → пуш клієнту, якщо замовлення з його акаунта й він погодився. */
export async function notifyCustomerOrderStatus(orderId: string) {
  try {
    if (!pushConfigured()) return { sent: 0 };
    const admin = createAdminClient();
    const { data: order } = await admin.from("orders").select("id, user_id, status, total").eq("id", orderId).maybeSingle();
    const text = order && ORDER_STATUS_PUSH[order.status];
    if (!order?.user_id || !text) return { sent: 0 };
    const { data: rows } = await admin
      .from("customer_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", order.user_id)
      .eq("notify_orders", true);
    if (!rows?.length) return { sent: 0 };
    return sendPush(rows, { title: text.title, body: text.body(order.total), url: "/account?tab=orders", tag: `order-${order.id}` }, "customer_push_subscriptions");
  } catch (e) {
    console.error("notifyCustomerOrderStatus failed:", (e as Error).message);
    return { sent: 0 };
  }
}

/** Скільки пристроїв отримає рекламну розсилку (погодились на акції). */
export async function customerPromoAudience(): Promise<number> {
  const { count } = await createAdminClient()
    .from("customer_push_subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("notify_promos", true);
  return count ?? 0;
}

/** Рекламна розсилка (акції/новинки) усім, хто погодився. Пише в журнал push_broadcasts. */
export async function sendCustomerPromo(p: { title: string; body: string; url: string | null; sentBy: string }) {
  const admin = createAdminClient();
  const { data: rows } = await admin.from("customer_push_subscriptions").select("id, endpoint, p256dh, auth").eq("notify_promos", true);
  const all = rows ?? [];
  const total = { sent: 0, removed: 0, failed: 0 };
  // пачками, щоб не відкривати сотні з'єднань одночасно
  for (let i = 0; i < all.length; i += 50) {
    const r = await sendPush(all.slice(i, i + 50), { title: p.title, body: p.body, url: p.url || "/", tag: "promo" }, "customer_push_subscriptions");
    total.sent += r.sent; total.removed += r.removed; total.failed += r.failed;
  }
  await admin.from("push_broadcasts").insert({ sent_by: p.sentBy, title: p.title, body: p.body, url: p.url, recipients: all.length, sent: total.sent });
  return { recipients: all.length, ...total };
}

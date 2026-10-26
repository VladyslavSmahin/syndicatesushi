import "server-only";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/admin";
import { SITE_URL } from "@/lib/seo";

// Пуш-сповіщення персоналу (PWA «SS Адмінка»). Підписки — staff_push_subscriptions (вмикає
// сам співробітник у меню адмінки). Без VAPID-ключів у env — тихо нічого не робимо.

export type PushPayload = {
  title: string;
  body: string;
  /** куди відкрити при тапі (у межах /admin) */
  url: string;
  /** однаковий tag — нове сповіщення замінює попереднє, а не множиться */
  tag?: string;
  /** число на іконці застосунку (нові замовлення) */
  badge?: number;
};

type SubscriptionRow = { id: string; endpoint: string; p256dh: string; auth: string };

let configured: boolean | null = null;
export function pushConfigured(): boolean {
  if (configured !== null) return configured;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return (configured = false);
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || SITE_URL, pub, priv);
  return (configured = true);
}

/** Надсилає на пристрої; мертві endpoint'и (404/410 — застосунок видалено/вимкнено) прибирає з БД. */
export async function sendPush(rows: SubscriptionRow[], payload: PushPayload) {
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
        await admin.from("staff_push_subscriptions").update({ last_sent_at: new Date().toISOString() }).eq("id", r.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          result.removed++;
          await admin.from("staff_push_subscriptions").delete().eq("id", r.id);
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
async function activeStaffSubscriptions(): Promise<SubscriptionRow[]> {
  const admin = createAdminClient();
  const [{ data: subs }, { data: allowed }] = await Promise.all([
    admin.from("staff_push_subscriptions").select("id, endpoint, p256dh, auth, profiles!inner(email)"),
    admin.from("allowed_staff").select("email"),
  ]);
  const emails = new Set((allowed ?? []).map((a) => String(a.email).toLowerCase()));
  return (subs ?? [])
    .filter((s) => {
      const p = s.profiles as unknown as { email: string | null } | null;
      return !!p?.email && emails.has(p.email.toLowerCase());
    })
    .map(({ id, endpoint, p256dh, auth }) => ({ id, endpoint, p256dh, auth }));
}

async function newOrdersCount(): Promise<number | undefined> {
  const { count } = await createAdminClient().from("orders").select("id", { count: "exact", head: true }).eq("status", "new");
  return count ?? undefined;
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
    const [rows, badge] = await Promise.all([activeStaffSubscriptions(), newOrdersCount()]);
    if (!rows.length) return;
    await sendPush(rows, {
      title: `🍣 Нове замовлення · ${o.total} грн`,
      body: [o.delivery === "delivery" ? "Доставка" : "Самовивіз", o.name, o.when || "якнайшвидше", `${o.items} поз.`].join(" · "),
      url: "/admin/orders/board",
      tag: o.id ? `order-${o.id}` : undefined,
      badge,
    });
  } catch (e) {
    console.error("notifyStaffNewOrder failed:", (e as Error).message);
  }
}

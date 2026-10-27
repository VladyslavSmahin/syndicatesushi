import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushConfigured, sendPush } from "@/lib/push.server";

export const runtime = "nodejs";

// POST /api/push — сповіщення клієнта сайту на цьому пристрої (кабінет → «Сповіщення»).
// { action: "subscribe", subscription, orders?, promos? } | { action: "prefs", endpoint, orders?, promos? }
// | { action: "get", endpoint } | { action: "unsubscribe", endpoint } | { action: "test", endpoint }
// Лише залогінений клієнт; пише service role (пристрій міг належати іншому акаунту).

const isPushEndpoint = (u: unknown): u is string => {
  if (typeof u !== "string" || u.length > 1000) return false;
  try { return new URL(u).protocol === "https:"; } catch { return false; }
};
const TABLE = "customer_push_subscriptions";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });

  let body: {
    action?: string; endpoint?: unknown; orders?: unknown; promos?: unknown;
    subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 }); }
  const admin = createAdminClient();
  const prefs: { notify_orders?: boolean; notify_promos?: boolean } = {};
  if (typeof body.orders === "boolean") prefs.notify_orders = body.orders;
  if (typeof body.promos === "boolean") prefs.notify_promos = body.promos;

  if (body.action === "subscribe") {
    const sub = body.subscription;
    const p256dh = sub?.keys?.p256dh, auth = sub?.keys?.auth;
    if (!isPushEndpoint(sub?.endpoint) || typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) {
      return NextResponse.json({ ok: false, error: "bad_subscription" }, { status: 400 });
    }
    const userAgent = (req.headers.get("user-agent") || "").slice(0, 300);
    await admin.from(TABLE).delete().eq("endpoint", sub.endpoint);
    const { error } = await admin.from(TABLE).insert({ user_id: user.id, endpoint: sub.endpoint, p256dh, auth, user_agent: userAgent, ...prefs });
    if (error) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (!isPushEndpoint(body.endpoint)) return NextResponse.json({ ok: false, error: "bad_endpoint" }, { status: 400 });
  const mine = () => admin.from(TABLE).select("id, endpoint, p256dh, auth, notify_orders, notify_promos").eq("endpoint", body.endpoint as string).eq("user_id", user.id);

  if (body.action === "get") {
    const { data } = await mine();
    const row = data?.[0];
    return NextResponse.json({ ok: true, subscribed: !!row, orders: row?.notify_orders ?? false, promos: row?.notify_promos ?? false });
  }

  if (body.action === "prefs") {
    const { error } = await admin.from(TABLE).update(prefs).eq("endpoint", body.endpoint).eq("user_id", user.id);
    if (error) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "unsubscribe") {
    await admin.from(TABLE).delete().eq("endpoint", body.endpoint).eq("user_id", user.id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "test") {
    const { data: rows } = await mine();
    if (!rows?.length) return NextResponse.json({ ok: false, error: "not_subscribed" }, { status: 404 });
    const r = await sendPush(rows, {
      title: "🔔 Тестове сповіщення",
      body: "Сповіщення працюють — сюди прийде статус замовлення.",
      url: "/account",
      tag: "test",
    }, TABLE);
    return NextResponse.json({ ok: r.sent > 0, ...r });
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}

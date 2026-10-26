import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { pushConfigured, sendPush } from "@/lib/push.server";

export const runtime = "nodejs";

// POST /api/admin/push — сповіщення персоналу на цьому пристрої.
// { action: "subscribe", subscription } | { action: "unsubscribe", endpoint } | { action: "test", endpoint }
// Лише залогінений співробітник; пише service role (один пристрій може перейти до іншого співробітника).
async function currentStaffId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  return profile?.role === "admin" || profile?.role === "editor" ? user.id : null;
}

const isPushEndpoint = (u: unknown): u is string => {
  if (typeof u !== "string" || u.length > 1000) return false;
  try { return new URL(u).protocol === "https:"; } catch { return false; }
};

export async function POST(req: Request) {
  const userId = await currentStaffId();
  if (!userId) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });

  let body: { action?: string; endpoint?: unknown; subscription?: { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 }); }
  const admin = createAdminClient();

  if (body.action === "subscribe") {
    const sub = body.subscription;
    const p256dh = sub?.keys?.p256dh, auth = sub?.keys?.auth;
    if (!isPushEndpoint(sub?.endpoint) || typeof p256dh !== "string" || typeof auth !== "string" || p256dh.length > 200 || auth.length > 100) {
      return NextResponse.json({ ok: false, error: "bad_subscription" }, { status: 400 });
    }
    const userAgent = (req.headers.get("user-agent") || "").slice(0, 300);
    // endpoint унікальний: пристрій міг належати іншому співробітнику — переписуємо на поточного
    await admin.from("staff_push_subscriptions").delete().eq("endpoint", sub.endpoint);
    const { error } = await admin.from("staff_push_subscriptions").insert({ user_id: userId, endpoint: sub.endpoint, p256dh, auth, user_agent: userAgent });
    if (error) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (body.action === "unsubscribe") {
    if (!isPushEndpoint(body.endpoint)) return NextResponse.json({ ok: false, error: "bad_endpoint" }, { status: 400 });
    await admin.from("staff_push_subscriptions").delete().eq("endpoint", body.endpoint).eq("user_id", userId);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "test") {
    if (!isPushEndpoint(body.endpoint)) return NextResponse.json({ ok: false, error: "bad_endpoint" }, { status: 400 });
    const { data: rows } = await admin
      .from("staff_push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("endpoint", body.endpoint)
      .eq("user_id", userId);
    if (!rows?.length) return NextResponse.json({ ok: false, error: "not_subscribed" }, { status: 404 });
    const r = await sendPush(rows, {
      title: "🔔 Тестове сповіщення",
      body: "Сповіщення про нові замовлення працюють на цьому пристрої.",
      url: "/admin/orders/board",
      tag: "test",
    });
    return NextResponse.json({ ok: r.sent > 0, ...r });
  }

  return NextResponse.json({ ok: false, error: "bad_action" }, { status: 400 });
}

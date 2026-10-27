import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markStaffSeen } from "@/lib/push.server";

export const runtime = "nodejs";

// POST /api/admin/seen — число непереглянутого для іконки «SS Адмінка».
// { orders?: true } — відкрив дошку замовлень; { version?: true } — відкрив «Що нового»; {} — лише прочитати.
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "admin" && profile?.role !== "editor") {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { orders?: unknown; version?: unknown } = {};
  try { body = await req.json(); } catch { /* порожнє тіло = лише прочитати */ }
  try {
    const badge = await markStaffSeen(user.id, { orders: body.orders === true, version: body.version === true });
    return NextResponse.json({ ok: true, badge });
  } catch {
    return NextResponse.json({ ok: false, error: "failed" }, { status: 500 });
  }
}

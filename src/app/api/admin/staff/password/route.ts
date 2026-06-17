import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAdmin } from "@/lib/adminAuth";

export const runtime = "nodejs";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const MIN_PASSWORD = 8;

// Шукає auth-користувача за email (Supabase admin API не має прямого пошуку —
// гортаємо сторінки). Staff-список малий, тож кілька сторінок з головою.
async function findUserByEmail(admin: ReturnType<typeof createAdminClient>, email: string) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) return null;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email);
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

// POST /api/admin/staff/password — задає/скидає пароль співробітника (JSON { email, password }).
// Якщо auth-користувача ще нема (заходив лише через Google або новий) — створює його.
// Тільки для головного адміністратора. Email має бути в allowed_staff, інакше профіль
// (а отже й доступ) не створиться — це гарантує тригер handle_new_user.
export async function POST(req: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }

  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, error: "bad_email" }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json({ ok: false, error: "weak_password" }, { status: 400 });
  }

  const admin = createAdminClient();

  // email має бути у білому списку — інакше пароль ні до чого (немає профілю → немає доступу)
  const { data: allowed } = await admin
    .from("allowed_staff")
    .select("email")
    .eq("email", email)
    .maybeSingle();
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "not_in_allowlist" }, { status: 400 });
  }

  const existing = await findUserByEmail(admin, email);

  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
    if (error) {
      console.error("staff password update failed:", error.message);
      return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, created: false });
  }

  // нового користувача одразу підтверджуємо, щоб міг увійти без листа
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) {
    console.error("staff user create failed:", error.message);
    return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, created: true });
}

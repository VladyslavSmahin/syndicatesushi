import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadAvatar } from "@/lib/imageUpload";
import { r2Delete, r2KeyFromUrl } from "@/lib/r2";
import { rateLimit, clientIp } from "@/lib/rateLimit";

// sharp потребує Node-рантайму (не edge).
export const runtime = "nodejs";

// Фото профілю клієнта. POST (multipart "file") — завантажити/замінити; DELETE — прибрати.
// Колонку avatar_url пише лише сервер (service role) і лише для власного акаунта з сесії.

async function sessionUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await (await createClient()).auth.getUser();
    return user?.id ?? null;
  } catch { return null; }
}

/** Прибрати старий файл з R2 (лише наш, з теки avatars цього клієнта). Помилка не критична. */
async function dropOld(url: string | null | undefined, uid: string) {
  const key = url ? r2KeyFromUrl(url) : null;
  if (key && key.startsWith(`avatars/${uid}/`)) await r2Delete(key).catch((e) => console.error("avatar delete:", (e as Error).message));
}

export async function POST(req: Request) {
  const rl = rateLimit(`avatar:${clientIp(req)}`, 6, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const uid = await sessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  let file: FormDataEntryValue | null;
  try { file = (await req.formData()).get("file"); } catch { return NextResponse.json({ ok: false, error: "bad_form" }, { status: 400 }); }
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });

  const r = await uploadAvatar(file, uid);
  if ("error" in r) return NextResponse.json({ ok: false, error: r.error }, { status: r.status });

  const admin = createAdminClient();
  const { data: prev } = await admin.from("customers").select("avatar_url").eq("id", uid).maybeSingle();
  const { error } = await admin.from("customers").update({ avatar_url: r.url }).eq("id", uid);
  if (error) {
    await dropOld(r.url, uid);
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }
  await dropOld(prev?.avatar_url, uid);
  return NextResponse.json({ ok: true, url: r.url });
}

export async function DELETE() {
  const uid = await sessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data: prev } = await admin.from("customers").select("avatar_url").eq("id", uid).maybeSingle();
  const { error } = await admin.from("customers").update({ avatar_url: null }).eq("id", uid);
  if (error) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  await dropOld(prev?.avatar_url, uid);
  return NextResponse.json({ ok: true });
}

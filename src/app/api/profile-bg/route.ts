import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { uploadProfileBgImage } from "@/lib/imageUpload";
import { r2Delete, r2KeyFromUrl } from "@/lib/r2";
import { rateLimit, clientIp } from "@/lib/rateLimit";
import { findThemeImage, parseFrame, parseProfileBg, BG_FRAME_DEFAULT, type ProfileBg } from "@/lib/profileBg";

// sharp потребує Node-рантайму (не edge).
export const runtime = "nodejs";

// Фон кабінету клієнта. POST (multipart "file") — своє фото; PUT (json) — тема/кадр; DELETE — без фону.
// Колонку profile_bg пише лише сервер: src — або тема з PROFILE_THEMES, або фото цього ж клієнта в нашому R2.

async function sessionUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await (await createClient()).auth.getUser();
    return user?.id ?? null;
  } catch { return null; }
}

const ownKey = (src: string, uid: string) => {
  const key = /^https:\/\//.test(src) ? r2KeyFromUrl(src) : null;
  return key && key.startsWith(`profile-bg/${uid}/`) ? key : null;
};

async function current(uid: string): Promise<ProfileBg | null> {
  const { data } = await createAdminClient().from("customers").select("profile_bg").eq("id", uid).maybeSingle();
  return parseProfileBg(data?.profile_bg);
}

async function save(uid: string, prev: ProfileBg | null, next: ProfileBg | null) {
  const { error } = await createAdminClient().from("customers").update({ profile_bg: next }).eq("id", uid);
  if (error) return false;
  // своє фото замінили/прибрали — старий файл з R2 прибираємо
  const oldKey = prev ? ownKey(prev.src, uid) : null;
  if (oldKey && prev?.src !== next?.src) await r2Delete(oldKey).catch(() => {});
  return true;
}

export async function POST(req: Request) {
  const rl = rateLimit(`profile-bg:${clientIp(req)}`, 6, 60_000);
  if (!rl.ok) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });
  const uid = await sessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  let file: FormDataEntryValue | null;
  try { file = (await req.formData()).get("file"); } catch { return NextResponse.json({ ok: false, error: "bad_form" }, { status: 400 }); }
  if (!(file instanceof File)) return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });

  const up = await uploadProfileBgImage(file, uid);
  if ("error" in up) return NextResponse.json({ ok: false, error: up.error }, { status: up.status });
  const prev = await current(uid);
  const next: ProfileBg = { src: up.url, mobile: prev?.mobile ?? BG_FRAME_DEFAULT, desktop: prev?.desktop ?? BG_FRAME_DEFAULT };
  if (!(await save(uid, prev, next))) {
    const k = ownKey(up.url, uid); if (k) await r2Delete(k).catch(() => {});
    return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, bg: next });
}

export async function PUT(req: Request) {
  const uid = await sessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null) as { src?: unknown; mobile?: unknown; desktop?: unknown } | null;
  const src = typeof body?.src === "string" ? body.src : "";
  if (!findThemeImage(src) && !ownKey(src, uid)) return NextResponse.json({ ok: false, error: "bad_src" }, { status: 400 });
  const prev = await current(uid);
  const next: ProfileBg = { src, mobile: parseFrame(body?.mobile), desktop: parseFrame(body?.desktop) };
  if (!(await save(uid, prev, next))) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  return NextResponse.json({ ok: true, bg: next });
}

export async function DELETE() {
  const uid = await sessionUserId();
  if (!uid) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const prev = await current(uid);
  if (!(await save(uid, prev, null))) return NextResponse.json({ ok: false, error: "save_failed" }, { status: 500 });
  return NextResponse.json({ ok: true });
}

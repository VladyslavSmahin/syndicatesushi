import { NextResponse } from "next/server";
import { isStaff } from "@/lib/adminAuth";
import { r2Delete, r2KeyFromUrl } from "@/lib/r2";

export const runtime = "nodejs";

// DELETE /api/hero-bg — прибрати файл фонового фото з R2 (JSON { url }).
// Запис у settings оновлює сама сторінка адмінки; тут лише файл, і тільки з папки hero/.
export async function DELETE(req: Request) {
  if (!(await isStaff())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let url: unknown;
  try {
    url = (await req.json())?.url;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  const key = typeof url === "string" ? r2KeyFromUrl(url) : null;
  if (!key || !key.startsWith("hero/")) {
    return NextResponse.json({ ok: false, error: "bad_url" }, { status: 400 });
  }
  try {
    await r2Delete(key);
  } catch (e) {
    console.error("hero-bg r2 delete:", (e as Error).message);
    return NextResponse.json({ ok: false, error: "delete_failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

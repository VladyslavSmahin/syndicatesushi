import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaff } from "@/lib/adminAuth";
import { convertAndUpload } from "@/lib/imageUpload";
import { r2Delete, r2KeyFromUrl } from "@/lib/r2";

// sharp потребує Node-рантайму (не edge).
export const runtime = "nodejs";

// POST /api/banners — завантаження банера (multipart, поле "file").
// Конвертує у WebP, кладе в R2, пише рядок у banners. Повертає { id, imagePath }.
export async function POST(req: Request) {
  if (!(await isStaff())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let file: FormDataEntryValue | null;
  try {
    file = (await req.formData()).get("file");
  } catch {
    return NextResponse.json({ ok: false, error: "bad_form" }, { status: 400 });
  }
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });
  }

  const up = await convertAndUpload(file, "banners");
  if ("error" in up) {
    return NextResponse.json({ ok: false, error: up.error }, { status: up.status });
  }

  const { data, error } = await createAdminClient()
    .from("banners")
    .insert({ image_path: up.url, sort_order: 9999, is_active: true })
    .select("id")
    .single();
  if (error) {
    // прибираємо завантажений файл, щоб не лишати сміття в R2
    const key = r2KeyFromUrl(up.url);
    if (key) { try { await r2Delete(key); } catch { /* best-effort */ } }
    console.error("banner insert failed:", error.message);
    return NextResponse.json({ ok: false, error: "db_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id: data.id, imagePath: up.url });
}

// DELETE /api/banners — видалення банера (JSON { id }). Прибирає рядок і файл у R2.
export async function DELETE(req: Request) {
  if (!(await isStaff())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let id: string | undefined;
  try {
    id = (await req.json())?.id;
  } catch {
    return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 });
  }
  if (!id) return NextResponse.json({ ok: false, error: "no_id" }, { status: 400 });

  const admin = createAdminClient();
  const { data: row } = await admin.from("banners").select("image_path").eq("id", id).maybeSingle();
  const { error } = await admin.from("banners").delete().eq("id", id);
  if (error) {
    console.error("banner delete failed:", error.message);
    return NextResponse.json({ ok: false, error: "db_failed" }, { status: 500 });
  }

  if (row?.image_path) {
    const key = r2KeyFromUrl(row.image_path);
    if (key) { try { await r2Delete(key); } catch (e) { console.error("r2 delete:", (e as Error).message); } }
  }
  return NextResponse.json({ ok: true });
}

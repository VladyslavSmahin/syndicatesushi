import { NextResponse } from "next/server";
import { isStaff } from "@/lib/adminAuth";
import { convertAndUpload } from "@/lib/imageUpload";

// sharp потребує Node-рантайму (не edge).
export const runtime = "nodejs";

// ТИМЧАСОВА діагностика: перевірити, чи вантажиться sharp на Vercel (без авторизації).
// Прибрати після з'ясування причини 500.
export async function GET() {
  try {
    const sharp = (await import("sharp")).default;
    const buf = await sharp({ create: { width: 2, height: 2, channels: 3, background: { r: 1, g: 2, b: 3 } } }).webp().toBuffer();
    return NextResponse.json({ ok: true, sharpBytes: buf.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message, stack: (e as Error).stack?.split("\n").slice(0, 4) }, { status: 500 });
  }
}

// POST /api/upload — завантаження зображення (multipart: "file", опц. "folder").
// Конвертує у WebP, кладе в R2, повертає { url }. Запис у БД робить відповідна форма.
export async function POST(req: Request) {
  if (!(await isStaff())) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "bad_form" }, { status: 400 });
  }

  const file = form.get("file");
  const folder = String(form.get("folder") || "products");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "no_file" }, { status: 400 });
  }

  const r = await convertAndUpload(file, folder, folder === "products" ? 1280 : 1600);
  if ("error" in r) {
    return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  }
  return NextResponse.json({ ok: true, url: r.url });
}

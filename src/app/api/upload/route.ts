import { NextResponse } from "next/server";
import { isStaff } from "@/lib/adminAuth";
import { convertAndUpload, uploadOgImage } from "@/lib/imageUpload";

// sharp потребує Node-рантайму (не edge).
export const runtime = "nodejs";

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

  // og — картинка превʼю посилання: окремо, рівно 1200×630 JPEG
  // hero — фон на весь екран: більший розмір (2560 по довгій стороні), якість 80 — оптимум вага/чіткість
  const r = folder === "og"
    ? await uploadOgImage(file)
    : folder === "hero"
    ? await convertAndUpload(file, folder, 2560, 80)
    : await convertAndUpload(file, folder, folder === "products" ? 1280 : 1600);
  if ("error" in r) {
    return NextResponse.json({ ok: false, error: r.error }, { status: r.status });
  }
  return NextResponse.json({ ok: true, url: r.url });
}

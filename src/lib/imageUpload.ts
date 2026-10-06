import "server-only";
import { r2Configured, r2Put } from "@/lib/r2";
import { THUMB_SUFFIX } from "@/lib/thumb";

const MAX_BYTES = 8 * 1024 * 1024; // 8 МБ на вихідний файл
const FOLDERS = new Set(["products", "banners", "hero"]);

export type UploadResult = { url: string } | { error: string; status: number };

// Конвертує зображення у WebP (з обмеженням розміру) і кладе в R2. Повертає URL або помилку.
export async function convertAndUpload(file: File, folder: string, maxDim = 1600, quality = 82): Promise<UploadResult> {
  if (!FOLDERS.has(folder)) return { error: "bad_folder", status: 400 };
  if (!r2Configured()) return { error: "r2_not_configured", status: 503 };
  if (file.size > MAX_BYTES) return { error: "too_large", status: 413 };

  let webp: Buffer;
  let thumb: Buffer | null = null;
  try {
    // динамічний імпорт нативного sharp — щоб модуль роута не падав на імпорті
    const sharp = (await import("sharp")).default;
    const src = Buffer.from(await file.arrayBuffer());
    webp = await sharp(src)
      .rotate()
      .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
      .webp({ quality, effort: 5 })
      .toBuffer();
    // фото товару — ще й зменшена копія для карток/пошуку/кошика (див. src/lib/thumb.ts)
    if (folder === "products") {
      thumb = await sharp(src)
        .rotate()
        .resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
        .webp({ quality: 74 })
        .toBuffer();
    }
  } catch (e) {
    console.error("sharp failed:", (e as Error).message);
    return { error: "image_processing_failed", status: 500 };
  }

  const id = crypto.randomUUID();
  const key = `${folder}/${id}.webp`;
  try {
    const url = await r2Put(key, webp, "image/webp");
    // копія не критична: якщо не вийшло — сайт покаже оригінал
    if (thumb) {
      await r2Put(`${folder}/${id}${THUMB_SUFFIX}.webp`, thumb, "image/webp")
        .catch((e) => console.error("r2 thumb put failed:", (e as Error).message));
    }
    return { url };
  } catch (e) {
    console.error("r2 put failed:", (e as Error).message);
    return { error: "upload_failed", status: 502 };
  }
}

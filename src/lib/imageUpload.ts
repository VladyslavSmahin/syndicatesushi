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

/** Картинка для превʼю посилання (Open Graph: Telegram, Viber, Facebook…): рівно 1200×630, обрізка по центру,
 *  JPEG — WebP підтримують не всі месенджери. */
export async function uploadOgImage(file: File): Promise<UploadResult> {
  if (!r2Configured()) return { error: "r2_not_configured", status: 503 };
  if (file.size > MAX_BYTES) return { error: "too_large", status: 413 };
  let jpg: Buffer;
  try {
    const sharp = (await import("sharp")).default;
    jpg = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 1200, height: 630, fit: "cover", position: "centre" })
      .jpeg({ quality: 86, mozjpeg: true })
      .toBuffer();
  } catch (e) {
    console.error("sharp failed:", (e as Error).message);
    return { error: "image_processing_failed", status: 500 };
  }
  try {
    return { url: await r2Put(`og/${crypto.randomUUID()}.jpg`, jpg, "image/jpeg") };
  } catch (e) {
    console.error("r2 put failed:", (e as Error).message);
    return { error: "upload_failed", status: 502 };
  }
}

/** Фото профілю клієнта: квадрат 320×320 по центру, WebP. Кладе в avatars/<id клієнта>/… */
export async function uploadAvatar(file: File, customerId: string): Promise<UploadResult> {
  if (!r2Configured()) return { error: "r2_not_configured", status: 503 };
  if (file.size > MAX_BYTES) return { error: "too_large", status: 413 };
  let webp: Buffer;
  try {
    const sharp = (await import("sharp")).default;
    webp = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 320, height: 320, fit: "cover", position: "attention" })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (e) {
    console.error("sharp failed:", (e as Error).message);
    return { error: "image_processing_failed", status: 500 };
  }
  try {
    return { url: await r2Put(`avatars/${customerId}/${crypto.randomUUID()}.webp`, webp, "image/webp") };
  } catch (e) {
    console.error("r2 put failed:", (e as Error).message);
    return { error: "upload_failed", status: 502 };
  }
}

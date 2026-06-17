import "server-only";
import sharp from "sharp";
import { r2Configured, r2Put } from "@/lib/r2";

const MAX_BYTES = 8 * 1024 * 1024; // 8 МБ на вихідний файл
const FOLDERS = new Set(["products", "banners"]);

export type UploadResult = { url: string } | { error: string; status: number };

// Конвертує зображення у WebP (з обмеженням розміру) і кладе в R2. Повертає URL або помилку.
export async function convertAndUpload(file: File, folder: string, maxDim = 1600): Promise<UploadResult> {
  if (!FOLDERS.has(folder)) return { error: "bad_folder", status: 400 };
  if (!r2Configured()) return { error: "r2_not_configured", status: 503 };
  if (file.size > MAX_BYTES) return { error: "too_large", status: 413 };

  let webp: Buffer;
  try {
    webp = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    return { error: "bad_image", status: 400 };
  }

  const key = `${folder}/${crypto.randomUUID()}.webp`;
  try {
    const url = await r2Put(key, webp, "image/webp");
    return { url };
  } catch (e) {
    console.error("r2 put failed:", (e as Error).message);
    return { error: "upload_failed", status: 502 };
  }
}

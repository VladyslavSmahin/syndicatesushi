// Клієнтське зменшення/стиснення зображення ДО завантаження.
// Потрібне, щоб обійти ліміт тіла запиту Vercel (~4.5 МБ): фото з телефону
// часто важчі, і платформа рубить запит з HTTP 413 ще до нашого роуту.
// Сервер усе одно переконвертує у WebP — тут лише готуємо легкий файл.

export async function downscaleImage(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
  // не чіпаємо не-растрові та анімовані формати — їх canvas зіпсує
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") {
    return file;
  }
  let bitmap: ImageBitmap;
  try {
    // imageOrientation: from-image — застосувати EXIF-поворот (інакше фото з телефону ляже боком)
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file; // не вдалось декодувати (напр. HEIC у не-Safari) — лишаємо оригінал, вирішить сервер
  }
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) { bitmap.close?.(); return file; }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/webp", quality));
  if (!blob || blob.size >= file.size) return file; // не стало менше — лишаємо оригінал
  const base = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${base}.webp`, { type: "image/webp" });
}

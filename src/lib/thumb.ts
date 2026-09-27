// Зменшені копії фото товарів (~480px) лежать у R2 поруч з оригіналом:
//   products/<uuid>.webp  →  products/<uuid>_480.webp
// Картки, пошук і кошик показують копію (у 4–6 разів легша), модалка й сторінка страви — оригінал.
// Якщо копії ще немає (старі фото до прогону scripts/make_thumbs.mjs) — <img> перемикається на оригінал.

export const THUMB_SUFFIX = "_480";

const PRODUCT_PHOTO = /\/products\/[0-9a-f-]{36}\.webp$/i;

/** URL зменшеної копії; для чужих/нестандартних адрес — сам URL. */
export function thumbUrl(url: string): string {
  return PRODUCT_PHOTO.test(url) ? url.replace(/\.webp$/i, `${THUMB_SUFFIX}.webp`) : url;
}


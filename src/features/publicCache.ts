// Тег кешу публічних даних сайту (каталог, акції, банери, налаштування, відгуки, контакти, sitemap).
// Скидається revalidateTag(PUBLIC_TAG) після мутацій в адмінці (revalidatePublicAction)
// і глобальною кнопкою «Оновити». revalidate — страховка, якщо інвалідація не дійшла.
export const PUBLIC_TAG = "public-data";
export const PUBLIC_REVALIDATE = 60;

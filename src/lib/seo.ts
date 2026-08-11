// Єдине джерело SEO-констант: домен, назви, дефолтні тексти.
// Домен можна перевизначити змінною NEXT_PUBLIC_SITE_URL (напр. для preview-деплоїв).

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://sushi-syndicate-tulchin.com").replace(/\/$/, "");
export const SITE_NAME = "Sushi Syndicate";
export const CITY = "Тульчин";

/** Ключові слова в природній формі: «суші Тульчин», «роли Тульчин», «доставка суші». */
export const DEFAULT_TITLE = `Суші Тульчин — доставка ролів та сетів | ${SITE_NAME}`;
export const TITLE_TEMPLATE = `%s | ${SITE_NAME} — суші ${CITY}`;
export const DEFAULT_DESCRIPTION =
  `Доставка суші та ролів у Тульчині — швидко, зі свіжої риби, готуємо після замовлення. ` +
  `Сети, роли, суші-бургери, HOT/WOK, боули. Доставка та самовивіз щодня.`;

export const OG_IMAGE = "/og-cover.jpg";

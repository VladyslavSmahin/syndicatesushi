// Тема сайту: «dark» (за замовчуванням) або «light». Ставиться атрибутом data-theme на <html>
// ще до першого малювання (скрипт у layout.tsx — без спалаху темної теми). Адмінка завжди темна.

export type Theme = "dark" | "light";
export const THEME_KEY = "ss_theme";
const META = { dark: "#0D0B09", light: "#F3F2F5" };

/** Інлайн-скрипт для <head>: застосувати збережену тему до гідрації. */
export const THEME_BOOT = `try{if(!location.pathname.startsWith('/admin')&&localStorage.getItem('${THEME_KEY}')==='light'){document.documentElement.dataset.theme='light'}}catch(e){}`;

export function currentTheme(): Theme {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function applyTheme(t: Theme, persist = true) {
  const el = document.documentElement;
  // плавний перехід кольорів лише на момент перемикання (інакше transition !important заважав би анімаціям)
  if (persist) { el.classList.add("theme-anim"); window.setTimeout(() => el.classList.remove("theme-anim"), 450); }
  if (t === "light") el.dataset.theme = "light"; else delete el.dataset.theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", META[t]);
  if (persist) { try { localStorage.setItem(THEME_KEY, t); } catch { /* ignore */ } }
  window.dispatchEvent(new CustomEvent("ss-theme", { detail: t }));
}

"use client";

import type { NavCategory } from "@/lib/types";

/**
 * Повернення «назад» на головну в той самий стан: категорія, фільтри, сортування,
 * скільки товарів підвантажено, вкладка «Новинки/Хіти», позиція скролу, відкрита картка.
 *
 * Стан пишемо в sessionStorage (живе в межах вкладки), а відновлюємо ЛИШЕ при поверненні
 * назад (popstate або back_forward-завантаження) — перехід по лого/посиланню відкриває
 * головну «з нуля».
 */

type NavFilter = NonNullable<NavCategory["filter"]>;

export type HomeSnapshot = {
  navFilter?: NavFilter | null;
  selected?: string[];
  selectedSub?: string | null;
  sort?: string;
  visibleCount?: number;
  hitsTab?: number;
  scrollY?: number;
  /** id товарів списку, з якого відкрили модалку (для свайпу після повернення) */
  modalList?: string[];
};

const KEY = "home-state";
const IN_APP_KEY = "in-app-nav";

/** Ключ у history.state, під яким лежить slug відкритої модалки товару. */
export const MODAL_STATE_KEY = "ssModal";

export function saveHomeState(patch: HomeSnapshot) {
  try {
    const prev = JSON.parse(sessionStorage.getItem(KEY) || "{}");
    sessionStorage.setItem(KEY, JSON.stringify({ ...prev, ...patch }));
  } catch { /* сховище недоступне — просто не відновимо */ }
}

function readHomeState(): HomeSnapshot | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---- чи прийшли на сторінку кнопкою «назад» ----

// шлях, на який привів останній popstate (null — останній перехід був звичайним)
let pendingPopPath: string | null = null;

if (typeof window !== "undefined") {
  // слухач реєструється раніше за будь-яку сторінку (модуль імпортує NavTracker у layout)
  window.addEventListener("popstate", () => { pendingPopPath = window.location.pathname; });
}

/** Скидає ознаку popstate — викликають сторінки, що обробили його самі (напр. закриття модалки). */
export function clearPendingPop() {
  pendingPopPath = null;
}

// відновлювати стан — один раз на монтування головної
let restoreSnapshot: HomeSnapshot | null = null;
let restoring = false;

/**
 * Викликається при монтуванні головної: якщо прийшли «назад» — повертає збережений стан
 * і вмикає режим відновлення (ефекти-скидання фільтрів у цей час мають мовчати).
 */
export function beginHomeRestore(): HomeSnapshot | null {
  // ідемпотентно: React (strict mode) може викликати ініціалізатор двічі
  if (restoring) return restoreSnapshot;
  const byPop = pendingPopPath === window.location.pathname;
  pendingPopPath = null;
  let byReload = false;
  try {
    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    // back_forward-завантаження сторінки — відновлюємо лише один раз на це завантаження
    const onceKey = `home-restored-${Math.round(performance.timeOrigin)}`;
    byReload = nav?.type === "back_forward" && !sessionStorage.getItem(onceKey);
    if (byReload) sessionStorage.setItem(onceKey, "1");
  } catch { /* ignore */ }
  if (!byPop && !byReload) {
    restoreSnapshot = null;
    return null;
  }
  restoreSnapshot = readHomeState();
  restoring = !!restoreSnapshot;
  return restoreSnapshot;
}

/** Збережений стан, який зараз відновлюється (для дочірніх компонентів головної). */
export function peekHomeRestore(): HomeSnapshot | null {
  return restoring ? restoreSnapshot : null;
}

export function isHomeRestoring() {
  return restoring;
}

export function endHomeRestore() {
  restoring = false;
  restoreSnapshot = null;
}

// завершення відновлення з затримкою; повторний старт (strict mode монтує ефекти двічі) його скасовує
let endTimer: ReturnType<typeof setTimeout> | undefined;
export function scheduleEndHomeRestore(ms: number) {
  clearTimeout(endTimer);
  endTimer = setTimeout(endHomeRestore, ms);
}
export function cancelEndHomeRestore() {
  clearTimeout(endTimer);
}

// ---- чи є куди повертатися в межах сайту ----

export function markInAppNavigation() {
  try { sessionStorage.setItem(IN_APP_KEY, "1"); } catch { /* ignore */ }
}

export function hasInAppHistory(): boolean {
  try {
    return sessionStorage.getItem(IN_APP_KEY) === "1" && window.history.length > 1;
  } catch {
    return false;
  }
}
